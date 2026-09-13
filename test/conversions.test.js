'use strict';

// Die Umrechnungen aus device.js. Jeder Fall hier stammt aus einem echten
// Fehler oder aus einer Eigenheit des Reglers, nicht aus dem Lehrbuch.

const { test } = require('node:test');
const assert = require('node:assert');
const { extractMethod, extractConst } = require('./helpers');

const dev = {
  ...extractMethod('_n'),
  ...extractMethod('_int'),
  ...extractMethod('_hours'),
  ...extractMethod('_scaled'),
  ...extractMethod('_temp'),
  ...extractMethod('_energyMetered'),
};

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
