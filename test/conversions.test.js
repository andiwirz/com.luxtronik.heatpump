'use strict';

// Die Umrechnungen aus device.js. Jeder Fall hier stammt aus einem echten
// Fehler oder aus einer Eigenheit des Reglers, nicht aus dem Lehrbuch.

const { test } = require('node:test');
const assert = require('node:assert');
const { extractMethod, extractConst } = require('./helpers');
const { coolingCounterState, coolingCounterRunning } = require('../lib/luxtronik-codes');

const dev = {
  ...extractMethod('_n'),
  ...extractMethod('_int'),
  ...extractMethod('_hours'),
  ...extractMethod('_scaled'),
  ...extractMethod('_temp'),
  ...extractMethod('_energyMetered'),
};

test('_showOrClear leert eine Kachel, statt den letzten Wert stehen zu lassen', async () => {
  // Ein Platzhalter (75 °C Warmwasser ohne Warmwasser) oder ein Unsinnsfehler
  // stand schon auf der Kachel. _setIfValid() überspringt null — ohne Leeren
  // bliebe der falsche Wert für immer stehen.
  const { _showOrClear } = extractMethod('_showOrClear');
  const make = (current) => {
    const calls = [];
    return {
      calls,
      hasCapability: () => true,
      getCapabilityValue: () => current,
      setCapabilityValue: (cap, value) => { calls.push(['set', cap, value]); return Promise.resolve(); },
      _setIfValid: (cap, value) => { calls.push(['valid', cap, value]); return Promise.resolve(); },
      error: () => {},
      _showOrClear,
    };
  };
  let dev = make(75);
  await dev._showOrClear('measure_temp_hotwater', null);
  assert.deepStrictEqual(dev.calls, [['set', 'measure_temp_hotwater', null]]);
  dev = make(null);
  await dev._showOrClear('measure_temp_hotwater', null);
  assert.deepStrictEqual(dev.calls, [], 'schon leer: nichts schreiben');
  dev = make(75);
  await dev._showOrClear('measure_temp_hotwater', 47.7);
  assert.deepStrictEqual(dev.calls, [['valid', 'measure_temp_hotwater', 47.7]]);
});

test('Protokolle und Warmwasser gehen nur geprüft auf die Kacheln', () => {
  // Die Prüfungen nützen nur, wenn _processData sie auch benutzt: Fehler- und
  // Abschaltprotokoll über plausibleLogEntries(), die Warmwasser-Temperatur
  // über _hotWaterTemp(), das den Platzhalter einer Heizanlage herausnimmt.
  const fs = require('node:fs');
  const path = require('node:path');
  const { ROOT } = require('./helpers');
  const src = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/device.js'), 'utf8');
  assert.doesNotMatch(src, /newestEntry\(v\.(?:errors|switch_off)\)/);
  assert.doesNotMatch(src, /v\.errors\.map\(/);
  assert.strictEqual((src.match(/v\.temperature_hot_water\b/g) || []).length, 1, 'Warmwasser-Temperatur ausserhalb von _hotWaterTemp() gelesen');
  assert.match(String(extractMethod('_hotWaterTemp')._hotWaterTemp), /v\.temperature_hot_water\b/);
});

test('Kachel und Auslöser zeigen den Fehler übersetzt, mit Hinweis als eigenem Token', () => {
  // Vorher kam der deutsche Text der Bibliothek auf die Kachel, auch auf
  // Niederländisch, und das Token des Auslösers war die ganze Liste als JSON.
  const fs = require('node:fs');
  const path = require('node:path');
  const { ROOT } = require('./helpers');
  const src = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/device.js'), 'utf8');
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  assert.doesNotMatch(src, /lastError\.message/);
  assert.doesNotMatch(src, /JSON\.stringify\(e\)/);
  assert.match(src, /errorText\(lastError\.code, /, 'Kachel');
  const tokens = app.flow.triggers.find((t) => t.id === 'error_occurred').tokens.map((t) => t.name);
  assert.deepStrictEqual(tokens, ['error', 'hint']);
  // Der Auslöser kommt nur aus _reportNewErrors(), mit Text und Hinweis des Eintrags.
  const { _reportNewErrors } = extractMethod('_reportNewErrors');
  assert.strictEqual((src.match(/_triggerErrorOccurred\.trigger\(/g) || []).length, 1, 'Auslöser ausserhalb von _reportNewErrors()');
  assert.match(String(_reportNewErrors), /_triggerErrorOccurred\.trigger\(this, \{ error, hint \}\)/);
  assert.match(String(_reportNewErrors), /errorText\(entry\.code, lang\)/);
  assert.match(String(_reportNewErrors), /errorHint\(entry\.code, lang\)/);
});

test('„Kühlen“ kommt vom Kühlzähler, nicht von der Freigabe', () => {
  // Auf einem LWD90V stand FreigabKuehl dauerhaft auf 1, ohne eine einzige
  // Kühlstunde, und Status und Heizungsstatus zeigten beim Heizen „Koelen“.
  // Die Freigabe entscheidet nur noch, ob die Kühl-Kacheln erscheinen.
  const fs = require('node:fs');
  const path = require('node:path');
  const { ROOT } = require('./helpers');
  const code = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/device.js'), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\/.*$/gm, '');
  const uses = code.split('\n').filter((line) => line.includes('FreigabKuehl'));
  assert.strictEqual(uses.length, 1, uses.join('\n'));
  assert.match(uses[0], /coolingDetected/);
  assert.match(code, /coolingRuns && stateSlug === 'heating' && rawState === 0/, 'Status');
  assert.match(code, /coolingRuns && code === 0/, 'Heizungsstatus');
});

test('_coolingRuns: ohne Vergleichswert bleibt die bisherige Anzeige', () => {
  // Nach einem Neustart oder Ausfall fehlt dem Kühlzähler der Vergleichswert.
  // Spränge der Status dann für eine Abfrage auf „Heizen“, feuerten „Status
  // geändert“ und die Meldung zweimal.
  const { _coolingRuns } = extractMethod('_coolingRuns', undefined, { coolingCounterRunning });
  const make = (shown, counter = coolingCounterState()) => ({
    _coolingCounter: counter,
    getCapabilityValue: (cap) => (cap === 'heatpump_state' ? shown : null),
    _coolingRuns,
  });
  assert.strictEqual(make('cooling')._coolingRuns({ raw_hours_cooling: 10504638 }), true);
  assert.strictEqual(make('heating')._coolingRuns({ raw_hours_cooling: 10504638 }), false);
  // Wer wegen der Freigabe fälschlich „Kühlen“ zeigt und nie gekühlt hat,
  // kommt sofort davon los, nicht erst nach einer zweiten Abfrage.
  assert.strictEqual(make('cooling')._coolingRuns({ raw_hours_cooling: 0 }), false);
  // Mit Vergleichswert entscheidet der Zähler, nicht die Anzeige.
  const baseline = () => ({ seconds: 10504638, readAt: Date.now() - 60000, running: null });
  assert.strictEqual(make('heating', baseline())._coolingRuns({ raw_hours_cooling: 10504698 }), true);
  assert.strictEqual(make('cooling', baseline())._coolingRuns({ raw_hours_cooling: 10504638 }), false);
});

test('_n: die Platzhalter des Reglers ergeben null, keine Zahl', () => {
  // luxtronik2 liefert 'no' für Werte, die das Visibility-Flag ausblendet.
  assert.strictEqual(dev._n('no'), null);
  assert.strictEqual(dev._n(null), null);
  assert.strictEqual(dev._n(undefined), null);
  assert.strictEqual(dev._n('abc'), null);
  assert.strictEqual(dev._n(0), 0, 'eine echte 0 muss erhalten bleiben');
  assert.strictEqual(dev._n(-12.5), -12.5);
  assert.strictEqual(dev._n('20.4'), 20.4);
});

test('_temp: -50 °C ist der Wert eines nicht angeschlossenen Fühlers', () => {
  const sentinel = extractConst('UNWIRED_SENSOR_TEMPERATURE');
  assert.strictEqual(sentinel, -50, 'Sentinel-Wert unerwartet geändert');
  assert.strictEqual(dev._temp(-50), null);
  // Knapp daneben ist eine echte Messung und muss durchkommen.
  assert.strictEqual(dev._temp(-49.9), -49.9);
  assert.strictEqual(dev._temp(-50.1), -50.1);
  assert.strictEqual(dev._temp(20.3), 20.3);
  assert.strictEqual(dev._temp('no'), null);
});

test('_hours: Sekundenzähler werden zu Stunden (Datentyp Seconds)', () => {
  // luxtronik2 rechnet dieselben Register ebenfalls durch 3600.
  assert.strictEqual(dev._hours(3600), 1);
  assert.strictEqual(dev._hours(0), 0);
  assert.strictEqual(dev._hours(109064520), 30295.7, 'Wert aus einer echten Anlage');
  assert.strictEqual(dev._hours('no'), null);
});

test('_scaled: Zehntel und Hundertstel laut python-luxtronik', () => {
  assert.strictEqual(dev._scaled(225, 10), 22.5, 'Celsius: °C/10');
  assert.strictEqual(dev._scaled(-113, 10), -11.3);
  assert.strictEqual(dev._scaled(1834, 100), 18.34, 'Pressure: bar/100');
  assert.strictEqual(dev._scaled(0, 100), 0);
  assert.strictEqual(dev._scaled('no', 10), null);
});

test('_int: nur ganze Zahlen, Platzhalter ergeben null', () => {
  assert.strictEqual(dev._int('42'), 42);
  assert.strictEqual(dev._int(42.7), 42);
  assert.strictEqual(dev._int(null), null);
  assert.strictEqual(dev._int('no'), null);
});

test('_energyMetered: 0 kWh beweist erst mit Laufzeit einen fehlenden Zähler', () => {
  // Werte aus zwei echten Anlagen.
  assert.strictEqual(dev._energyMetered(77105.5, 10119), true, 'Zähler vorhanden');
  assert.strictEqual(dev._energyMetered(0, 26827), false, 'kein Zähler: 0 kWh trotz langer Laufzeit');
  assert.strictEqual(dev._energyMetered(0, 5), true, 'frisch in Betrieb — Kachel behalten');
  assert.strictEqual(dev._energyMetered(0, 25), false, 'über der Schwelle von 24 h');
  // Blendet der Regler die Betriebsstunden aus, im Zweifel anzeigen statt
  // eine vorhandene Kachel zu entfernen.
  assert.strictEqual(dev._energyMetered(0, 'no'), true);
  assert.strictEqual(dev._energyMetered(null, 1000), false, 'kein Wert, nichts anzuzeigen');
});
