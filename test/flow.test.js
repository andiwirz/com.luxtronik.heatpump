'use strict';

// Flow-Bedingungen und -Aktionen gegen den Fehler, aus dem ihre Registrierung
// im Treiber entstanden ist: eine Flow-Karte gibt es App-weit nur einmal, und
// solange jedes Gerät in onInit seinen eigenen Run-Listener einhängte, ersetzte
// es den des vorherigen. Mit zwei Wärmepumpen bediente dann die zuletzt
// gestartete jede Aktion und jede Bedingung — gleich, welche im Flow gewählt
// war.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, extractMethod } = require('./helpers');
const { coolingCounterState } = require('../lib/luxtronik-codes');

const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const device = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/device.js'), 'utf8');
const { _registerFlowCards } = extractMethod('_registerFlowCards', 'drivers/luxtronik-heatpump/driver.js');

// Kartenargumente, wie Homey sie liefert — eine Obermenge für alle Karten,
// überzählige liest kein Listener.
const ARGS = { mode: '1', state: 'heating', value: 2, duration: 30, temperature: 5 };

// Die Attrappe kennt jede Methode aus device.js und die Homey-Getter, die die
// Bedingungen lesen. Ruft ein Listener etwas anderes auf, bricht der Test ab.
const DEVICE_METHODS = [
  ...[...device.matchAll(/^ {2}(?:async )?([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)].map((m) => m[1]),
  'getCapabilityValue', 'hasCapability', 'getSetting', 'getAvailable',
];

/** Geräte-Attrappe. Jeder Aufruf landet in `calls`; `results` legt Rückgabewerte fest. */
function makeDevice(results = {}) {
  const dev = { calls: [] };
  for (const name of DEVICE_METHODS) {
    dev[name] = () => {
      dev.calls.push(name);
      return results[name] ?? null;
    };
  }
  return dev;
}

/**
 * Lässt den Treiber seine Listener registrieren und gibt sie je Karte zurück.
 * `devices` sind die Geräte, die der Treiber über getDevices() erreicht.
 */
function registerListeners(devices = []) {
  const listeners = {};
  const card = (kind) => (id) => {
    // Homey wirft bei einer ID, die das Manifest nicht kennt — im Treiber
    // risse das alle Geräte mit.
    if (!app.flow[kind].some((c) => c.id === id)) throw new Error(`Invalid Flow Card ID: ${id}`);
    return {
      registerRunListener(fn) {
        listeners[`${kind}/${id}`] = fn;
        return this;
      },
    };
  };
  const driver = {
    homey: { flow: { getConditionCard: card('conditions'), getActionCard: card('actions') } },
    getDevices: () => devices,
    _registerFlowCards,
  };
  driver._registerFlowCards();
  return listeners;
}

test('jede Aktion und Bedingung wirkt nur auf das im Flow gewählte Gerät', async () => {
  // hasCapability: true, damit room_temp_above/below auch den Wert lesen.
  const chosen = makeDevice({ hasCapability: true });
  const other = makeDevice({ hasCapability: true });
  // Das andere Gerät ist über den Treiber erreichbar und steht zuletzt — wie im
  // ursprünglichen Fehler das zuletzt gestartete, das alles abbekam.
  const listeners = registerListeners([chosen, other]);
  const wrong = [];
  for (const kind of ['conditions', 'actions']) {
    for (const card of app.flow[kind]) {
      const run = listeners[`${kind}/${card.id}`];
      if (!run) {
        wrong.push(`${kind}/${card.id}: kein Listener`);
        continue;
      }
      chosen.calls.length = 0;
      other.calls.length = 0;
      await run({ ...ARGS, device: chosen });
      if (chosen.calls.length === 0) wrong.push(`${kind}/${card.id}: gewähltes Gerät nicht angesprochen`);
      if (other.calls.length > 0) wrong.push(`${kind}/${card.id}: anderes Gerät angesprochen`);
    }
  }
  assert.deepStrictEqual(wrong, []);
});

test('Stopp-Aktionen melden ein fehlgeschlagenes Zurückschalten', async () => {
  // _endBoost() gibt den Schreibfehler zurück, statt ihn zu werfen — der Poll
  // soll weiterlaufen. Die Flow-Aktion muss ihn trotzdem werfen, sonst gilt
  // ein gescheiterter Stopp im Flow als erledigt.
  const listeners = registerListeners();
  const failure = new Error('Write-Timeout: warmwater_operation_mode');
  for (const [id, method] of [['stop_hotwater_boost', '_stopHotwaterBoost'], ['stop_hotwater_boost_party', '_stopHotwaterBoostParty']]) {
    const run = listeners[`actions/${id}`];
    await assert.rejects(() => run({ device: makeDevice({ [method]: failure }) }), (e) => e === failure, id);
    await assert.doesNotReject(() => run({ device: makeDevice() }), id);
  }
});

test('keine Aktion und keine Bedingung wird pro Gerät registriert', () => {
  // Ein Gerät, das selbst einen Run-Listener einhängt, ersetzt den des
  // Treibers — und damit den aller anderen Geräte. Genau das war der Fehler.
  assert.doesNotMatch(device, /get(?:Action|Condition)Card\(/);
});

test('Aktionen finden schon während der Migrationen einen fertigen Zustand vor', () => {
  // Der Treiber hängt die Listener ein, bevor das onInit des Geräts läuft.
  // Nach einem App-Update gleicht die Titel-Synchronisation dort jede
  // Capability mit einem await einzeln ab; eine Aktion in dieser Zeit traf auf
  // einen halb belegten Zustand und scheiterte mit einem TypeError statt mit
  // "Nicht verbunden". Jedes Feld, das onInit belegt und eine Aktion erreichen
  // kann, muss deshalb vor dem ersten await stehen. Felder, die onInit gar nicht
  // belegt, sind bewusst erst bei Bedarf da und werden nicht geprüft.
  const src = device.replace(/\r\n/g, '\n');
  const driver = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/driver.js'), 'utf8');
  const body = (name) => {
    const head = new RegExp(`\\n  (?:async )?${name}\\s*\\([^)]*\\)\\s*\\{`).exec(src);
    if (!head) return '';
    const from = head.index + head[0].length;
    return src.slice(from, src.indexOf('\n  }\n', from));
  };
  // Alle Methoden, die eine Aktion über args.device erreicht, auch mittelbar.
  const reached = new Set();
  const queue = [...driver.matchAll(/args\.device\.(_\w+)\(/g)].map((m) => m[1]);
  while (queue.length) {
    const name = queue.shift();
    if (reached.has(name)) continue;
    reached.add(name);
    for (const m of body(name).matchAll(/this\.(_\w+)\(/g)) queue.push(m[1]);
  }
  const fields = new Set();
  for (const name of reached) {
    for (const m of body(name).matchAll(/this\.(_[A-Za-z]\w*)\b(?!\s*\()/g)) fields.add(m[1]);
  }
  const start = src.indexOf('  async onInit() {');
  // Kommentare durch Leerzeichen ersetzen: ein "await" im Kommentar ist keins,
  // und die Positionen bleiben gleich.
  const onInit = src.slice(start, src.indexOf('\n  }\n', start))
    .replace(/\/\/.*$/gm, (comment) => ' '.repeat(comment.length));
  // Ende des synchronen Teils: Anfang der Zeile mit dem ersten await — so zählt
  // auch `this._x = (await …)` als zu spät.
  const syncEnd = onInit.lastIndexOf('\n', onInit.search(/\bawait\b/));
  const late = [...fields].filter((field) => {
    const at = onInit.search(new RegExp(`this\\.${field}\\s*=(?!=)`));
    return at > syncEnd;
  });
  assert.ok(reached.size > 10 && fields.size > 10, 'Analyse hat nichts gefunden');
  assert.deepStrictEqual(late, []);
});

test('jeder Schreibvorgang läuft durch Warteschlange und Schutznetze', () => {
  // _writeRaw lief früher an Warteschlange, Timeout und Socket-Wächter vorbei:
  // Antwortete der Regler nicht, blieb das zuvor angehaltene Polling für immer
  // stehen. Die Desinfektion schrieb sogar direkt auf die Bibliothek. Deshalb
  // dürfen deren Schreibfunktionen nur in _writeNow() aufgerufen werden.
  const libWrite = /this\._pump\.(?:write|writeRaw|_startWrite)\(/g;
  const { _writeNow } = extractMethod('_writeNow');
  const inWriteNow = (String(_writeNow).match(libWrite) || []).length;
  assert.ok(inWriteNow >= 2, 'write und writeRaw gehören in _writeNow()');
  assert.strictEqual((device.match(libWrite) || []).length, inWriteNow, 'Schreibfunktion der Bibliothek ausserhalb von _writeNow()');
  const { _writeRaw } = extractMethod('_writeRaw');
  assert.match(String(_writeRaw), /return this\._write\(/);
});

test('"Gerät nicht erreichbar" feuert auf jedem Weg dorthin, aber nur einmal', () => {
  // Poll-Fehler, Poll-Timeout und Watchdog machen das Gerät unerreichbar.
  // Vorher löste nur der Poll-Fehler den Trigger aus — bei stillstehendem
  // Polling, dem Fall des Watchdogs, kam er nicht, "wieder erreichbar" aber
  // schon. Deshalb darf setUnavailable() nur in _markUnavailable() stehen.
  const { _markUnavailable } = extractMethod('_markUnavailable', undefined, { coolingCounterState });
  const direct = device.match(/this\.setUnavailable\(/g) || [];
  assert.strictEqual(direct.length, 1, 'setUnavailable() ausserhalb von _markUnavailable()');
  assert.match(String(_markUnavailable), /this\.setUnavailable\(/);

  // Der Watchdog schlägt bei einem Ausfall in jedem Prüfintervall erneut an;
  // der Trigger gehört nur zum Übergang.
  let available = true;
  let fired = 0;
  const dev = {
    getAvailable: () => available,
    setUnavailable: () => { available = false; return Promise.resolve(); },
    _triggerDeviceUnavailable: { trigger: () => { fired++; return Promise.resolve(); } },
    _markUnavailable,
  };
  dev._markUnavailable('Poll-Timeout');
  dev._markUnavailable('Watchdog');
  assert.strictEqual(fired, 1);
});

test('nach einem Ausfall vergleicht der Kühlzähler nicht über die Lücke', () => {
  // Gegen den Stand von vor dem Ausfall gälte als Kühlen, was während der
  // Lücke lief, auch wenn die Anlage inzwischen steht. Alle Wege in den
  // Ausfall laufen über _markUnavailable(), siehe oben.
  const { _markUnavailable } = extractMethod('_markUnavailable', undefined, { coolingCounterState });
  const dev = {
    getAvailable: () => true,
    setUnavailable: () => Promise.resolve(),
    _triggerDeviceUnavailable: { trigger: () => Promise.resolve() },
    _coolingCounter: { seconds: 10504698, readAt: 60000, running: true },
    _markUnavailable,
  };
  dev._markUnavailable('Poll-Fehler');
  assert.deepStrictEqual(dev._coolingCounter, coolingCounterState());
});
