'use strict';

// _endBoost() gegen den Fehler, aus dem es entstanden ist: schlug das
// Zurückschalten auf Automatik fehl, war der Timer schon gelöscht, die
// Capability blieb auf true und die Wärmepumpe im Zuheizer-Modus — ohne dass
// irgendetwas sie zurückgeschaltet hätte.

const { test } = require('node:test');
const assert = require('node:assert');
const { extractMethod } = require('./helpers');

const { _endBoost } = extractMethod('_endBoost');

/** Gerät-Attrappe. `writeFails` lässt das Zurückschalten scheitern. */
function makeDevice({ writeFails = false, timerActive = true } = {}) {
  const calls = [];
  const dev = {
    calls,
    _boostTimer: timerActive ? setTimeout(() => {}, 60000) : null,
    _boostPartyTimer: timerActive ? setTimeout(() => {}, 60000) : null,
    capabilities: { hotwater_boost: true, hotwater_boost_party: true },
    _endBoost,
    _tl: (de) => de,
    log() {},
    error(...a) { calls.push('error:' + a[0]); },
    _notify(msg) { calls.push('notify:' + msg); return Promise.resolve(); },
    _setWarmwaterOperationMode(mode) {
      calls.push('write:' + mode);
      return writeFails ? Promise.reject(new Error('Write-Timeout: warmwater_operation_mode')) : Promise.resolve();
    },
    setCapabilityValue(cap, val) {
      calls.push(`cap:${cap}=${val}`);
      dev.capabilities[cap] = val;
      return Promise.resolve();
    },
    _triggerBoostEnded: { trigger: () => { calls.push('trigger:boost_ended'); return Promise.resolve(); } },
    _triggerBoostPartyEnded: { trigger: () => { calls.push('trigger:party_ended'); return Promise.resolve(); } },
  };
  return dev;
}

test('erfolgreiches Beenden: zurückschalten, Kachel aus, Trigger genau einmal', async () => {
  const dev = makeDevice();
  const err = await dev._endBoost('aux');
  assert.strictEqual(err, null);
  assert.strictEqual(dev._boostTimer, null, 'Timer muss gelöscht sein');
  assert.strictEqual(dev.capabilities.hotwater_boost, false);
  assert.strictEqual(dev.calls.filter((c) => c === 'trigger:boost_ended').length, 1,
    'Trigger feuerte früher doppelt, weil _processData ihn zusätzlich auslöste');
});

test('fehlgeschlagenes Zurückschalten strandet die Wärmepumpe nicht', async () => {
  const dev = makeDevice({ writeFails: true });
  const err = await dev._endBoost('aux');

  // Der Fehler wird zurückgegeben, nicht geworfen: ein Aufruf aus _processData
  // darf den restlichen Poll nicht abbrechen.
  assert.ok(err instanceof Error, 'Schreibfehler muss zurückgegeben werden');
  assert.ok(dev.calls.some((c) => c.startsWith('error:')), 'Fehlschlag muss protokolliert werden');

  // Das Entscheidende: die Kachel bleibt nicht auf "aktiv" stehen, während der
  // Timer bereits weg ist.
  assert.strictEqual(dev.capabilities.hotwater_boost, false);
  assert.strictEqual(dev._boostTimer, null);
  assert.strictEqual(dev.calls.filter((c) => c === 'trigger:boost_ended').length, 1);
});

test('_endBoost wirft nie — der Poll läuft weiter', async () => {
  const dev = makeDevice({ writeFails: true });
  await assert.doesNotReject(() => dev._endBoost('aux'));
  await assert.doesNotReject(() => dev._endBoost('party'));
});

test('ohne laufende Ladung kein Trigger und keine Meldung', async () => {
  // Sonst würde ein Aufruf ohne aktive Schnellladung Nutzerflows auslösen.
  const dev = makeDevice({ timerActive: false });
  await dev._endBoost('aux');
  assert.strictEqual(dev.calls.filter((c) => c.startsWith('trigger:')).length, 0);
  assert.strictEqual(dev.calls.filter((c) => c.startsWith('notify:')).length, 0);
  // Zurückgeschaltet wird trotzdem — der Regler könnte noch im Zuheizer stehen.
  assert.ok(dev.calls.includes('write:0'));
});

test('Party-Variante wirkt auf ihre eigene Kachel und ihren eigenen Trigger', async () => {
  const dev = makeDevice();
  await dev._endBoost('party');
  assert.strictEqual(dev.capabilities.hotwater_boost_party, false);
  assert.strictEqual(dev.capabilities.hotwater_boost, true, 'darf die andere Ladung nicht anfassen');
  assert.strictEqual(dev._boostPartyTimer, null);
  assert.strictEqual(dev._boostTimer !== null, true);
  assert.strictEqual(dev.calls.filter((c) => c === 'trigger:party_ended').length, 1);
  assert.strictEqual(dev.calls.filter((c) => c === 'trigger:boost_ended').length, 0);
});
