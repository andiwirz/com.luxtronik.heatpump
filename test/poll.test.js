'use strict';

// Was ein Poll übernimmt und was er meldet. Zwei Fehler, die die Windows-App
// desselben Autors schon abfängt: Eine Abfrage aus lauter Nullen landete auf
// den Kacheln, und "Fehler aufgetreten" kam nur, wenn Statuszeile 1 gerade bei
// einer Abfrage auf 4 stand.

const { test } = require('node:test');
const assert = require('node:assert');
const { extractMethod } = require('./helpers');
const codes = require('../lib/luxtronik-codes');

const { _discardFaultyPoll } = extractMethod('_discardFaultyPoll', undefined, { faultyReading: codes.faultyReading });
const { _doPoll } = extractMethod('_doPoll');
const { _reportNewErrors } = extractMethod('_reportNewErrors', undefined, {
  newErrors: codes.newErrors,
  plausibleLogEntries: codes.plausibleLogEntries,
  errorText: codes.errorText,
  errorHint: codes.errorHint,
});

// Messwerte mit laufenden Zählern an den Stellen, die faultyReading() prüft.
function reading(overrides = {}) {
  const values = new Array(260).fill(0);
  Object.assign(values, { 10: 215, 56: 74595599, 57: 6126, 63: 74595600, 64: 70000000, 151: 771093 }, overrides);
  return values;
}
const ZEROS = new Array(260).fill(0);

// Gerät mit nachgebautem Regler: Jede Lesung liefert die nächste Messwertliste.
function makePollingDevice(readings) {
  const calls = [];
  const dev = {
    _doPoll,
    _discardFaultyPoll,
    calls,
    _polling: false,
    _pollTimeout: null,
    _rawValues: null,
    _rawParameters: null,
    _lastGoodValues: reading(),
    _faultyPolls: 0,
    _lastSuccessfulPoll: null,
    _firstPollDone: true,
    _ensurePump: () => true,
    _pollTimeoutSec: () => 30,
    _guardSocket: () => {},
    _markUnavailable: () => calls.push('unavailable'),
    _resetPump: () => {},
    _schedulePollAfterWrite: (ms) => calls.push(`erneut nach ${ms} ms`),
    getAvailable: () => true,
    setAvailable: () => { calls.push('available'); return Promise.resolve(); },
    _triggerDeviceAvailable: { trigger: () => Promise.resolve() },
    _setIfValid: () => Promise.resolve(),
    _processData: () => { calls.push('verarbeitet'); return Promise.resolve(); },
    homey: { clock: { getTimezone: () => 'Europe/Zurich' }, __: () => undefined },
    log: () => {},
    error: () => {},
    _pump: {
      read: (callback) => {
        // Wie die Bibliothek: die Hooks laufen vor dem Callback.
        dev._rawValues = readings.shift();
        dev._rawParameters = [0, 20, 480];
        callback(null, { values: {}, parameters: {} });
      },
    },
  };
  return dev;
}

test('eine Abfrage aus lauter Nullen kommt nicht auf die Kacheln', async () => {
  // Übernommen sprangen Zähler zurück, Temperaturen fielen auf 0 °C, der
  // Status wechselte auf "Heizbetrieb" und die Einstellungen würden auf 0
  // abgeglichen.
  const dev = makePollingDevice([ZEROS]);
  await dev._doPoll();
  assert.deepStrictEqual(dev.calls, ['erneut nach 5000 ms']);
  assert.strictEqual(dev._lastSuccessfulPoll, null, 'zählt nicht als gelungener Poll');
  assert.strictEqual(dev._polling, false, 'Verbindung wieder frei');
});

test('nur die erste verworfene Abfrage in Folge löst eine schnelle zweite aus', async () => {
  // Ein dauerhaft gestörter Regler soll nicht alle paar Sekunden abgefragt werden.
  const countersZero = reading({ 56: 0, 57: 0, 63: 0, 64: 0, 151: 0 });
  const dev = makePollingDevice([ZEROS, countersZero, reading()]);
  await dev._doPoll();
  await dev._doPoll();
  assert.deepStrictEqual(dev.calls, ['erneut nach 5000 ms'], 'alle Zähler auf einmal 0: ebenfalls verworfen');
  assert.strictEqual(dev._faultyPolls, 2);
  await dev._doPoll();
  assert.deepStrictEqual(dev.calls.slice(1), ['available', 'verarbeitet']);
  assert.strictEqual(dev._faultyPolls, 0, 'eine brauchbare Abfrage beendet die Folge');
  assert.ok(dev._lastSuccessfulPoll);
});

test('ein einzelner zurückgesetzter Zähler ist keine Störung', async () => {
  // Die Fachperson setzt etwa die Wärmemenge zurück; das muss durchkommen.
  const dev = makePollingDevice([reading({ 151: 0 })]);
  await dev._doPoll();
  assert.deepStrictEqual(dev.calls, ['available', 'verarbeitet']);
  assert.strictEqual(dev._lastGoodValues[151], 0, 'neuer Vergleichsstand');
});

// Gerät für _reportNewErrors(): merkt sich Auslöser, Meldungen und den Store.
function makeErrorDevice(knownUntil, language = 'de') {
  const dev = {
    _reportNewErrors,
    _errorsKnownUntil: knownUntil,
    triggered: [],
    notified: [],
    stored: [],
    _triggerErrorOccurred: { trigger: (device, tokens) => { dev.triggered.push(tokens); return Promise.resolve(); } },
    _notify: (text) => { dev.notified.push(text); return Promise.resolve(); },
    _tl: (de, en) => (language === 'de' ? de : en),
    setStoreValue: (key, value) => { dev.stored.push([key, value]); return Promise.resolve(); },
    error: () => {},
    homey: { i18n: { getLanguage: () => language } },
  };
  return dev;
}

const log = (...entries) => entries.map(([code, iso]) => ({ code, message: 'Bibliothekstext', date: new Date(iso) }));

test('nach dem Update kommen alte Störungen nicht als neu', async () => {
  const dev = makeErrorDevice(null);
  await dev._reportNewErrors({ errors: log([701, '2026-03-01T10:00:00Z'], [702, '2026-09-12T08:30:00Z']) });
  assert.deepStrictEqual(dev.triggered, []);
  assert.deepStrictEqual(dev.stored, [['errors_known_until', Date.parse('2026-09-12T08:30:00Z')]]);
});

test('eine Störung, die sich vor der nächsten Abfrage erledigt hat, wird trotzdem gemeldet', async () => {
  // 702 (Niederdrucksperre) quittiert der Regler selbst: Statuszeile 1 stand
  // bei keiner Abfrage auf 4, der Eintrag im Fehlerspeicher bleibt.
  const dev = makeErrorDevice(Date.parse('2026-09-12T08:30:00Z'));
  await dev._reportNewErrors({ errors: log([701, '2026-03-01T10:00:00Z'], [702, '2026-10-18T06:00:00Z']) });
  assert.deepStrictEqual(dev.triggered, [{
    error: '702 - Niederdrucksperre',
    hint: codes.errorHint(702, 'de'),
  }]);
  assert.match(dev.notified[0], /^⚠️ Fehler aufgetreten: 702 - Niederdrucksperre\. RESET automatisch · /);
  assert.deepStrictEqual(dev.stored, [['errors_known_until', Date.parse('2026-10-18T06:00:00Z')]]);
});

test('was während eines Neustarts auftrat, kommt mit dem ersten Poll, ältestes zuerst', async () => {
  const dev = makeErrorDevice(Date.parse('2026-09-12T08:30:00Z'), 'nl');
  await dev._reportNewErrors({ errors: log([715, '2026-10-18T07:10:00Z'], [702, '2026-10-18T06:00:00Z'], [701, '2026-03-01T10:00:00Z']) });
  assert.deepStrictEqual(dev.triggered.map((t) => t.error), ['702 - Lagedrukblokkering', `715 - ${codes.errorText(715, 'nl')}`]);
});

test('der Stand des Fehlerspeichers übersteht einen Neustart', () => {
  // Ohne ihn gälte nach jedem Neustart der ganze Speicher als bekannt, und was
  // während des Neustarts auftrat, käme nie an.
  const fs = require('node:fs');
  const path = require('node:path');
  const { ROOT } = require('./helpers');
  const src = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/device.js'), 'utf8').replace(/\r\n/g, '\n');
  const start = src.indexOf('  async onInit() {');
  const onInit = src.slice(start, src.indexOf('\n  }\n', start));
  const firstPoll = onInit.indexOf('await this._doPoll()');
  const load = onInit.search(/this\._errorsKnownUntil = knownErrors/);
  assert.ok(load > 0 && load < firstPoll, 'Stand vor dem ersten Poll aus dem Store laden');
  assert.match(onInit, /getStoreValue\('errors_known_until'\)/);
  assert.match(String(_reportNewErrors), /setStoreValue\('errors_known_until'/);
});

test('ohne neue Einträge wird nichts gemeldet und nichts gespeichert', async () => {
  const known = Date.parse('2026-09-12T08:30:00Z');
  const dev = makeErrorDevice(known);
  await dev._reportNewErrors({ errors: log([702, '2026-09-12T08:30:00Z']) });
  await dev._reportNewErrors({ errors: 'no' });
  assert.deepStrictEqual([dev.triggered, dev.stored], [[], []]);
});

// ── Schreibvorgänge, die eine Abfrage auslöst ───────────────────────────────

const writing = {
  ...extractMethod('_readParameters', undefined, { faultyReading: codes.faultyReading }),
  ...extractMethod('_write'),
  ...extractMethod('_writeChecked'),
  ...extractMethod('_writeAndReadBack', undefined, { readBack: codes.readBack }),
  ...extractMethod('_recordWrite', undefined, { writeLogLine: codes.writeLogLine }),
  ...extractMethod('_notAccepted'),
  ...extractMethod('_writeFromPoll'),
};

test('ein Schreibvorgang aus der Abfrage wartet nicht auf sie', async () => {
  // Erreichte eine Schnellladung ihr Ziel, schrieb _processData das
  // Zurückschalten und wartete darauf. Das Zurücklesen wartete seinerseits auf
  // das Ende der Abfrage, bis deren Notstopp nach rund 35 s das Gerät als
  // nicht erreichbar meldete — bei jedem automatischen Ende.
  const dev = makePollingDevice([reading()]);
  const registers = Object.assign(new Array(100).fill(0), { 1: 20, 2: 480, 47: 650 });
  let result = null;
  Object.assign(dev, writing, {
    _writeQueue: Promise.resolve(),
    _writeProtectUntil: {},
    _pollTimeoutSec: () => 1,
    _sleep: (ms) => new Promise((resolve) => setTimeout(resolve, Math.min(ms, 5))),
    _startPolling: () => {},
    _writeNow: async (parameter, value) => { registers[parameter] = value; return { parameter, value }; },
    getName: () => 'Wärmepumpe',
  });
  dev.homey.settings = { get: () => [], set: () => {} };
  dev._pump.readRaw = (callback) => callback(null, { values: JSON.stringify(reading()), parameters: JSON.stringify(registers) });
  dev._processData = async () => {
    dev._writeFromPoll('Testschreiben', () => dev._write(47, 750).then((r) => { result = r; }));
  };
  await dev._doPoll();
  const deadline = Date.now() + 3000;
  while (!result && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(result && result.accepted === true, 'Schreibvorgang samt Zurücklesen durch');
  assert.ok(!dev.calls.includes('unavailable'), 'kein Notstopp, kein "nicht erreichbar"');
  assert.strictEqual(dev._pollTimeout, null, 'Notstopp der Abfrage aufgehoben');
});

test('_processData und die Aufsicht der Schnellladung warten auf keinen Schreibvorgang', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { ROOT } = require('./helpers');
  const src = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/device.js'), 'utf8').replace(/\r\n/g, '\n');
  const body = (name) => {
    const start = src.search(new RegExp(`^  (?:async )?${name}\\(`, 'm'));
    return src.slice(start, src.indexOf('\n  }\n', start));
  };
  const awaitedWrite = /await this\._(?:write\w*|stopHotwaterBoost\w*|endBoost|endThermalDisinfection|set(?:ThermalDisinfectionContinuous|\w+OperationMode))\(/;
  for (const name of ['_processData', '_superviseBoost', '_clearStaleBoostTiles']) {
    assert.doesNotMatch(body(name), awaitedWrite, name);
  }
  assert.match(body('_processData'), /_writeFromPoll\('Desinfektion beenden'/);
});

// Gerät für _endThermalDisinfection(): merkt sich Schreiben, Auslöser und Meldung.
function makeDisinfectionDevice({ fails = false } = {}) {
  const dev = {
    ...extractMethod('_endThermalDisinfection'),
    calls: [],
    _disinfectionEnding: false,
    _disinfectionRetryAt: 0,
    _tl: (de) => de,
    log: () => {},
    error: () => dev.calls.push('error'),
    _setThermalDisinfectionContinuous: async (on) => {
      dev.calls.push(`write:${on}`);
      if (fails) throw new Error('Write-Timeout');
    },
    _triggerThermalDisinfEnded: { trigger: async () => { dev.calls.push('trigger'); } },
    _notify: async (text) => { dev.calls.push(`notify:${text}`); },
  };
  return dev;
}

test('die Desinfektion meldet "abgeschlossen" erst, wenn das Abschalten übernommen ist', async () => {
  // Vorher kamen Auslöser und Timeline auch nach einem Fehlschlag, und mit
  // jeder Abfrage wieder, solange der Dauerbetrieb lief.
  const ok = makeDisinfectionDevice();
  await ok._endThermalDisinfection(64, 64.5);
  assert.deepStrictEqual(ok.calls.map((c) => c.split(':')[0]), ['write', 'trigger', 'notify']);

  const failing = makeDisinfectionDevice({ fails: true });
  await failing._endThermalDisinfection(64, 64.5);
  assert.deepStrictEqual(failing.calls, ['write:false', 'error'], 'kein Auslöser, keine Meldung');
  await failing._endThermalDisinfection(64, 64.6);
  assert.strictEqual(failing.calls.filter((c) => c.startsWith('write')).length, 1, 'nicht mit der nächsten Abfrage wieder');
  assert.ok(failing._disinfectionRetryAt > Date.now());
  failing._disinfectionRetryAt = 0;
  await failing._endThermalDisinfection(64, 64.6);
  assert.strictEqual(failing.calls.filter((c) => c.startsWith('write')).length, 2, 'nach der Wartezeit schon');
});

test('läuft das Abschalten der Desinfektion noch, startet keine Abfrage ein zweites', async () => {
  const releases = [];
  const dev = makeDisinfectionDevice();
  dev._setThermalDisinfectionContinuous = (on) => {
    dev.calls.push(`write:${on}`);
    return new Promise((resolve) => { releases.push(resolve); });
  };
  const first = dev._endThermalDisinfection(64, 64.5);
  const second = dev._endThermalDisinfection(64, 64.7);
  for (const release of releases) release();
  await Promise.all([first, second]);
  assert.strictEqual(dev.calls.filter((c) => c.startsWith('write')).length, 1);
  assert.strictEqual(dev.calls.filter((c) => c === 'trigger').length, 1);
});

test('Temperatur-Auslöser bekommen den vorigen Wert mit, jeder Flow prüft seine Schwelle', async () => {
  // Vorher prüfte der Flow nur, ob der neue Wert jenseits der Schwelle lag,
  // und lief so bei jeder kleinen Änderung in diese Richtung.
  const { _triggerTemperatureChange } = extractMethod('_triggerTemperatureChange');
  const fired = [];
  const dropped = { trigger: async (device, tokens, state) => { fired.push(['fiel', state]); } };
  const rose = { trigger: async (device, tokens, state) => { fired.push(['stieg', state]); } };
  const dev = { _triggerTemperatureChange };
  await dev._triggerTemperatureChange(5.1, 5.0, dropped, rose);
  await dev._triggerTemperatureChange(5.0, 5.2, dropped, rose);
  await dev._triggerTemperatureChange(5.2, 5.2, dropped, rose);
  await dev._triggerTemperatureChange(null, 5.2, dropped, rose);
  assert.deepStrictEqual(fired, [['fiel', { temperature: 5.0, previous: 5.1 }], ['stieg', { temperature: 5.2, previous: 5.0 }]]);

  const fs = require('node:fs');
  const path = require('node:path');
  const { ROOT } = require('./helpers');
  const src = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/device.js'), 'utf8');
  assert.strictEqual(src.split('droppedBelow(state.previous, state.temperature, args.temperature)').length - 1, 2);
  assert.strictEqual(src.split('roseAbove(state.previous, state.temperature, args.temperature)').length - 1, 2);
});
