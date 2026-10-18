'use strict';

// Schnellladung. _endBoost() gegen den Fehler, aus dem es entstanden ist:
// Schlug das Zurückschalten fehl, war der Timer schon gelöscht, die Capability
// blieb auf true und die Wärmepumpe im Zuheizer-Modus — ohne dass irgendetwas
// sie zurückgeschaltet hätte. Dazu der Store, mit dem eine Ladung einen
// App-Neustart übersteht: Vorher ging sie dabei verloren, und die Wärmepumpe
// blieb im Zuheizer- oder Party-Betrieb.

const { test } = require('node:test');
const assert = require('node:assert');
const { extractMethod } = require('./helpers');

// Nachgebaute Timer: Die Methoden bekommen sie statt der echten, damit kein
// Test minutenlang auf eine Ladung wartet oder den Testlauf offen hält.
const timers = new Map();
let nextTimer = 1;
const fakeTimers = {
  setTimeout: (fn, ms) => { const t = { id: nextTimer++, fn, ms }; timers.set(t.id, t); return t; },
  clearTimeout: (t) => { if (t) timers.delete(t.id); },
};
const methods = Object.assign({},
  ...['_boostConfig', '_startBoost', '_armBoost', '_endBoost', '_stopHotwaterBoost', '_stopHotwaterBoostParty',
    '_superviseBoost', '_clearStaleBoostTiles', '_writeFromPoll', '_int']
    .map((name) => extractMethod(name, undefined, fakeTimers)));

const trigger = (calls, name) => ({ trigger: () => { calls.push(`trigger:${name}`); return Promise.resolve(); } });
const settle = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Gerät mit nachgebautem Regler in Betriebsart `mode`. `writeFails` lässt
 * jedes Schreiben der Betriebsart scheitern.
 */
function makeDevice({ mode = 0, writeFails = false, store = {}, capabilities = {} } = {}) {
  const calls = [];
  const dev = {
    ...methods,
    calls,
    controllerMode: mode,
    writeFails,
    store: { ...store },
    capabilities: { hotwater_boost: false, hotwater_boost_party: false, warmwater_operation_mode: String(mode), ...capabilities },
    _boostTimer: null,
    _boostPartyTimer: null,
    _boostBusy: 0,
    _boostRetryAt: 0,
    _tl: (de) => de,
    log() {},
    error(...a) { calls.push(`error:${a[0]}`); },
    _notify(msg) { calls.push(`notify:${msg}`); return Promise.resolve(); },
    _setWarmwaterOperationMode(m) {
      calls.push(`write:${m}`);
      if (dev.writeFails) return Promise.reject(new Error('Write-Timeout: warmwater_operation_mode'));
      dev.controllerMode = m;
      dev.capabilities.warmwater_operation_mode = String(m);
      return Promise.resolve();
    },
    getCapabilityValue: (cap) => dev.capabilities[cap],
    setCapabilityValue(cap, val) { calls.push(`cap:${cap}=${val}`); dev.capabilities[cap] = val; return Promise.resolve(); },
    getStoreValue: (key) => dev.store[key],
    setStoreValue(key, val) { dev.store[key] = val; return Promise.resolve(); },
    unsetStoreValue(key) { delete dev.store[key]; return Promise.resolve(); },
    _triggerBoostStarted: trigger(calls, 'boost_started'),
    _triggerBoostEnded: trigger(calls, 'boost_ended'),
    _triggerBoostPartyStarted: trigger(calls, 'party_started'),
    _triggerBoostPartyEnded: trigger(calls, 'party_ended'),
  };
  return dev;
}
const count = (dev, entry) => dev.calls.filter((c) => c === entry).length;

test('erfolgreiches Beenden: zurück auf die Betriebsart davor, Kachel aus, Trigger genau einmal', async () => {
  // Stand Warmwasser vorher auf "Aus", stand es nach der Ladung auf Automatik.
  const dev = makeDevice({ mode: 4 });
  await dev._startBoost('aux', 60);
  assert.deepStrictEqual([dev.controllerMode, dev.capabilities.hotwater_boost], [1, true]);
  assert.deepStrictEqual(dev.store.hotwater_boost.previousMode, 4);
  assert.strictEqual(dev._boostTimer.ms, 60 * 60 * 1000);

  // Die Dauer läuft ab.
  dev._boostTimer.fn();
  await settle();
  assert.strictEqual(dev.controllerMode, 4);
  assert.strictEqual(dev._boostTimer, null, 'Timer muss gelöscht sein');
  assert.strictEqual(dev.capabilities.hotwater_boost, false);
  assert.strictEqual(dev.store.hotwater_boost, undefined, 'die Ladung ist aus dem Store');
  assert.strictEqual(count(dev, 'trigger:boost_ended'), 1,
    'Trigger feuerte früher doppelt, weil _processData ihn zusätzlich auslöste');
});

test('fehlgeschlagenes Zurückschalten strandet die Wärmepumpe nicht', async () => {
  const dev = makeDevice();
  await dev._startBoost('aux', 60);
  dev.writeFails = true;
  const err = await dev._endBoost('aux');

  // Der Fehler wird zurückgegeben, nicht geworfen: ein Aufruf aus _processData
  // darf den restlichen Poll nicht abbrechen.
  assert.ok(err instanceof Error, 'Schreibfehler muss zurückgegeben werden');
  assert.ok(dev.calls.some((c) => c.startsWith('error:')), 'Fehlschlag muss protokolliert werden');

  // Die Kachel bleibt nicht auf "aktiv" stehen, während der Timer bereits weg ist.
  assert.strictEqual(dev.capabilities.hotwater_boost, false);
  assert.strictEqual(dev._boostTimer, null);
  assert.strictEqual(count(dev, 'trigger:boost_ended'), 1);
  // Die Ladung bleibt als beendet stehen, für einen späteren Versuch.
  assert.strictEqual(dev.store.hotwater_boost.ended, true);
  assert.ok(dev._boostRetryAt > Date.now());
});

test('ein gescheitertes Zurückschalten kommt später wieder, ohne zweiten Auslöser', async () => {
  const dev = makeDevice({ mode: 1, store: { hotwater_boost: { kind: 'aux', until: Date.now() - 1000, previousMode: 3, ended: true } } });
  dev._boostRetryAt = Date.now() + 60000;
  await dev._superviseBoost(1);
  await settle();
  assert.deepStrictEqual(dev.calls, [], 'vor Ablauf der Wartezeit nichts');

  dev._boostRetryAt = 0;
  await dev._superviseBoost(1);
  await settle();
  assert.strictEqual(dev.controllerMode, 3);
  assert.strictEqual(dev.store.hotwater_boost, undefined);
  assert.strictEqual(count(dev, 'trigger:boost_ended'), 0, 'beendet war sie schon');
});

test('_endBoost wirft nie — der Poll läuft weiter', async () => {
  const dev = makeDevice({ writeFails: true });
  await assert.doesNotReject(() => dev._endBoost('aux'));
  await assert.doesNotReject(() => dev._endBoost('party'));
});

test('ohne laufende Ladung kein Trigger und keine Meldung', async () => {
  // Sonst würde ein Aufruf ohne aktive Schnellladung Nutzerflows auslösen.
  const dev = makeDevice();
  await dev._endBoost('aux');
  assert.strictEqual(dev.calls.filter((c) => c.startsWith('trigger:')).length, 0);
  assert.strictEqual(dev.calls.filter((c) => c.startsWith('notify:')).length, 0);
  // Zurückgeschaltet wird trotzdem — der Regler könnte noch im Zuheizer stehen.
  assert.ok(dev.calls.includes('write:0'));
});

test('Party-Variante wirkt auf ihre eigene Kachel und ihren eigenen Trigger', async () => {
  const dev = makeDevice({ capabilities: { hotwater_boost: true, hotwater_boost_party: true } });
  dev._boostTimer = fakeTimers.setTimeout(() => {}, 1000);
  dev._boostPartyTimer = fakeTimers.setTimeout(() => {}, 1000);
  await dev._endBoost('party');
  assert.strictEqual(dev.capabilities.hotwater_boost_party, false);
  assert.strictEqual(dev.capabilities.hotwater_boost, true, 'darf die andere Ladung nicht anfassen');
  assert.strictEqual(dev._boostPartyTimer, null);
  assert.strictEqual(dev._boostTimer !== null, true);
  assert.strictEqual(count(dev, 'trigger:party_ended'), 1);
  assert.strictEqual(count(dev, 'trigger:boost_ended'), 0);
});

test('eine Ladung löst die andere ab, zurück geht es auf die Betriebsart vor der ersten', async () => {
  // Vorher liefen beide unabhängig: Endete die eine, schaltete sie die andere
  // mit auf Automatik, deren Kachel und Timer aber weiterliefen.
  const dev = makeDevice({ mode: 3 });
  await dev._startBoost('aux', 60);
  await dev._startBoost('party', 30);
  assert.strictEqual(dev.controllerMode, 2);
  assert.deepStrictEqual([dev.capabilities.hotwater_boost, dev._boostTimer], [false, null]);
  assert.strictEqual(count(dev, 'trigger:boost_ended'), 1);
  assert.deepStrictEqual([dev.store.hotwater_boost.kind, dev.store.hotwater_boost.previousMode], ['party', 3]);
  assert.strictEqual(dev.calls.filter((c) => c.startsWith('write:')).join(), 'write:1,write:2', 'die abgelöste Ladung schaltet nicht zurück');

  await dev._stopHotwaterBoostParty();
  assert.strictEqual(dev.controllerMode, 3);
});

test('eine verlängerte Ladung behält die Betriebsart davor', async () => {
  const dev = makeDevice({ mode: 0 });
  await dev._startBoost('aux', 60);
  await dev._startBoost('aux', 120);
  assert.strictEqual(dev.store.hotwater_boost.previousMode, 0, 'nicht der Zuheizer der ersten Ladung');
  assert.strictEqual(dev._boostTimer.ms, 120 * 60 * 1000);
});

test('scheitert der Start, steht keine Ladung im Store', async () => {
  const dev = makeDevice({ writeFails: true });
  await assert.rejects(dev._startBoost('aux', 60));
  assert.strictEqual(dev.store.hotwater_boost, undefined);
  assert.deepStrictEqual([dev.capabilities.hotwater_boost, dev._boostTimer], [false, null]);
});

test('nach einem Neustart läuft die Ladung mit der Restzeit weiter', async () => {
  const until = Date.now() + 30 * 60 * 1000;
  const dev = makeDevice({ mode: 1, store: { hotwater_boost: { kind: 'aux', until, previousMode: 0 } } });
  await dev._superviseBoost(1);
  await settle();
  assert.ok(dev._boostTimer, 'Timer wieder gestellt');
  assert.ok(Math.abs(dev._boostTimer.ms - 30 * 60 * 1000) < 5000);
  assert.strictEqual(dev.capabilities.hotwater_boost, true);
  assert.deepStrictEqual(dev.calls.filter((c) => c.startsWith('write:') || c.startsWith('trigger:')), []);
  // Läuft der Timer, schaut die Aufsicht nicht weiter hin.
  await dev._superviseBoost(1);
  assert.deepStrictEqual(dev.calls.filter((c) => c.startsWith('write:')), []);
});

test('lief die Zeit während des Neustarts ab, endet die Ladung mit der ersten Abfrage', async () => {
  const dev = makeDevice({ mode: 2, store: { hotwater_boost: { kind: 'party', until: Date.now() - 1000, previousMode: 4 } } });
  await dev._superviseBoost(2);
  await settle();
  assert.strictEqual(dev.controllerMode, 4);
  assert.strictEqual(dev.store.hotwater_boost, undefined);
  assert.strictEqual(count(dev, 'trigger:party_ended'), 1);
});

test('wer am Bedienteil umgestellt hat, behält seine Betriebsart', async () => {
  const dev = makeDevice({ mode: 0, store: { hotwater_boost: { kind: 'aux', until: Date.now() + 60000, previousMode: 4 } } });
  dev.capabilities.hotwater_boost = true;
  await dev._superviseBoost(0);
  await settle();
  assert.deepStrictEqual(dev.calls.filter((c) => c.startsWith('write:')), [], 'nicht zurückschalten');
  assert.strictEqual(dev.store.hotwater_boost, undefined);
  assert.strictEqual(dev.capabilities.hotwater_boost, false);
  assert.strictEqual(count(dev, 'trigger:boost_ended'), 1);
});

test('eine Ladung aus einer Version ohne Store endet wie damals', async () => {
  // Kachel an, kein Store, kein Timer: Der Neustart hat sie abgehängt.
  const dev = makeDevice({ mode: 1, capabilities: { hotwater_boost: true } });
  await dev._superviseBoost(1);
  await settle();
  assert.deepStrictEqual([dev.controllerMode, dev.capabilities.hotwater_boost], [0, false]);
  assert.strictEqual(dev.calls.filter((c) => c.startsWith('trigger:')).length, 0);
  // Steht der Regler nicht mehr im Modus der Ladung, nur die Kachel.
  const other = makeDevice({ mode: 0, capabilities: { hotwater_boost_party: true } });
  await other._superviseBoost(0);
  await settle();
  assert.deepStrictEqual(other.calls, ['cap:hotwater_boost_party=false']);
});

test('während eines Starts oder Endes schaut die Aufsicht nicht hin', async () => {
  const dev = makeDevice({ mode: 1, store: { hotwater_boost: { kind: 'aux', until: Date.now() - 1000, previousMode: 0 } } });
  dev._boostBusy = 1;
  await dev._superviseBoost(1);
  await settle();
  assert.deepStrictEqual(dev.calls, []);
});
