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
