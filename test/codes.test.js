'use strict';

// Die Übersetzungstabellen in lib/luxtronik-codes.js gegen die Bibliothek und
// gegen die Eigenheiten des Reglers.

const { test } = require('node:test');
const assert = require('node:assert');
const codes = require('../lib/luxtronik-codes');
const types = require('../lib/luxtronik2/types');

test('extendedState deckt jeden Zustandscode ab, den die Bibliothek kennt', () => {
  // Die App liest den Zustand über den Code (C0119). Fehlt ein Code in der
  // Tabelle, fällt sie auf den deutschen Text der Bibliothek zurück — für die
  // von der Bibliothek gemappten Codes darf das nie nötig sein.
  for (const code of Object.keys(types.extendetStateMessages).map(Number)) {
    for (const lang of ['en', 'de', 'nl']) {
      const label = codes.extendedState(code, lang);
      assert.ok(label, `Code ${code} hat keinen Text für ${lang}`);
    }
  }
});

test('extendedState: unbekannter Code ergibt null statt eines Platzhalters', () => {
  // Der Aufrufer erkennt daran, dass er auf den Bibliothekstext zurückfallen muss.
  assert.strictEqual(codes.extendedState(99, 'de'), null);
});

test('extendedState: Codes 15 und 18 kennt nur diese App', () => {
  // Weder luxtronik2 noch die Home-Assistant-Integration dokumentieren sie;
  // 15 wurde gemeinsam mit Fehler 718 "Max. Aussentemp." beobachtet.
  assert.strictEqual(codes.extendedState(15, 'de'), 'Einsatzgrenze / Sperre');
  assert.strictEqual(codes.extendedState(18, 'de'), 'Verdichter heizt auf');
  assert.ok(!Object.prototype.hasOwnProperty.call(types.extendetStateMessages, 15));
  assert.ok(!Object.prototype.hasOwnProperty.call(types.extendetStateMessages, 18));
});

test('Sprachen ohne Übersetzung fallen auf Englisch zurück, nicht auf leer', () => {
  assert.strictEqual(codes.extendedState(0, 'fr'), codes.extendedState(0, 'en'));
  assert.strictEqual(codes.switchoffReason(9, 'fr'), codes.switchoffReason(9, 'en'));
});

test('defrostVariant folgt derselben Logik wie die Bibliothek', () => {
  // luxtronik2 unterscheidet über Abtauventil (C0037), Verdichter (C0044) und
  // Wärmequellenmotor (C0043) — hier auf den Rohwerten statt am Textende.
  assert.strictEqual(codes.defrostVariant({ defrostValve: 1, compressor: 1, pumpFlow: 0 }), 'cycle_reversal');
  assert.strictEqual(codes.defrostVariant({ defrostValve: 0, compressor: 0, pumpFlow: 1 }), 'air');
  assert.strictEqual(codes.defrostVariant({ defrostValve: 0, compressor: 1, pumpFlow: 1 }), 'plain');
  // Fehlende Rohwerte dürfen nicht werfen.
  assert.strictEqual(codes.defrostVariant({}), 'plain');
});

test('switchoffReason: Code 4 ist unbelegt und ergibt null', () => {
  // Bibliothek und Home-Assistant-Integration führen 4 beide als leeren Text.
  // null signalisiert dem Aufrufer, die Kachel gar nicht zu setzen.
  assert.strictEqual(codes.switchoffReason(4, 'de'), null);
  assert.strictEqual(codes.switchoffReason(28, 'de'), null, '28-31 sind unbekannt');
});

test('switchoffReason deckt alle Codes ab, die der Regler meldet (0-27)', () => {
  const missing = [];
  for (let code = 0; code <= 27; code++) {
    if (code === 4) continue; // in der Steuerung unbelegt
    if (!codes.switchoffReason(code, 'de')) missing.push(code);
  }
  assert.deepStrictEqual(missing, [], 'nicht gemappte Abschaltgründe');
});

test('mixerCanCool erkennt genau die kühlfähigen Mischkreistypen', () => {
  // LuxMkTypes: 0 off, 1 discharge, 2 load, 3 cooling, 4 heating_cooling
  assert.strictEqual(codes.mixerCanCool(3), true);
  assert.strictEqual(codes.mixerCanCool(4), true);
  [0, 1, 2, undefined, null].forEach((t) => assert.strictEqual(codes.mixerCanCool(t), false, `Typ ${t}`));
});

test('newestEntry wählt über den Zeitstempel, nicht über die Position', () => {
  // Die fünf Ringpuffer-Plätze kommen unsortiert vom Regler.
  const list = [
    { code: 1, date: new Date('2026-08-31T08:19:30Z') },
    { code: 2, date: new Date('2026-08-31T12:08:07Z') },
    { code: 3, date: new Date('2026-08-30T09:07:24Z') },
  ];
  assert.strictEqual(codes.newestEntry(list).code, 2);
  assert.strictEqual(codes.newestEntry([]), null);
  assert.strictEqual(codes.newestEntry(null), null);
  // Ungültige Datumsangaben dürfen nicht werfen.
  assert.ok(codes.newestEntry([{ code: 9, date: new Date(NaN) }]) !== undefined);
});

test('controllerConfig nennt Raumeinheit und Regelungsart samt Rohwert', () => {
  assert.strictEqual(codes.controllerConfig(0, 0, 0),
    'Raumeinheit=keine (P0033=0), Regelungsart=Heizkurve (P0103=0)');
  assert.strictEqual(codes.controllerConfig(5, 0, 1),
    'Raumeinheit=Smart (P0033=5), Regelungsart=Festwert (P0103=1)');
  assert.strictEqual(codes.controllerConfig(1, 0, 2),
    'Raumeinheit=RFV (P0033=1), Regelungsart=Analog-Eingang (P0103=2)');
});

test('controllerConfig: eine RBE ab Firmware 2.0 ist eine RBE Plus', () => {
  // Mit einer RBE Plus gilt ein Raumsollwert statt der Korrektur P0001 — die
  // Grenze muss also genau sitzen. C0258 = Major × 100 + Minor.
  assert.match(codes.controllerConfig(4, 199, 0), /Raumeinheit=RBE \(P0033=4, RBE 1\.99\)/);
  assert.match(codes.controllerConfig(4, 200, 0), /Raumeinheit=RBE Plus \(P0033=4, RBE 2\.00\)/);
  assert.match(codes.controllerConfig(4, 201, 0), /Raumeinheit=RBE Plus \(P0033=4, RBE 2\.01\)/);
});

test('controllerConfig: fehlende Register werden benannt statt geraten', () => {
  // Ältere Regler liefern kürzere Listen. Ein fehlendes Register darf nicht
  // als "keine Raumeinheit" oder "Heizkurve" erscheinen — das wäre falsch
  // beruhigend, weil 0 genau diese Bedeutung hat.
  assert.strictEqual(codes.controllerConfig(undefined, undefined, undefined),
    'Raumeinheit=nicht gemeldet (P0033), Regelungsart=nicht gemeldet (P0103)');
  assert.match(codes.controllerConfig(4, undefined, 0), /Raumeinheit=RBE \(P0033=4, RBE-Version nicht gemeldet\)/);
  assert.match(codes.controllerConfig(4, 0, 0), /RBE-Version nicht gemeldet/);
});

test('controllerConfig: unbekannte Codes erscheinen mit Rohwert', () => {
  assert.strictEqual(codes.controllerConfig(7, 0, 9),
    'Raumeinheit=unbekannt (P0033=7), Regelungsart=unbekannt (P0103=9)');
});

test('parameterLabel: Name aus der Registertabelle, sonst die Nummer', () => {
  assert.strictEqual(codes.parameterLabel(13), 'P0013_HEATING_CURVE_NIGHT_TEMPERATURE');
  assert.strictEqual(codes.parameterLabel(5), 'P0005');
  assert.strictEqual(codes.parameterLabel(1190), 'P1190');
  // Dieselben Namen, die app.js für den Debug-Tab ablegt.
  assert.strictEqual(codes.PARAMETER_NAMES[13], codes.parameterLabel(13));
  // Der Debug-Tab sortiert die Rohliste nach dem Text — das muss die
  // Zahlenfolge ergeben, auch gemischt aus benannten und unbenannten Registern.
  const labels = [2, 5, 13, 105, 1136, 1190].map(codes.parameterLabel);
  assert.deepStrictEqual([...labels].sort(), labels);
});

// Parameterliste in Reglergrösse; `set` überschreibt einzelne Indizes.
const params = (set = {}, length = 1200) => Array.from({ length }, (_, i) => (i in set ? set[i] : 0));
const freshState = () => ({ streak: {}, muted: {} });

test('parameterChanges: die erste Abfrage ist nur Vergleichsstand', () => {
  assert.strictEqual(codes.parameterChanges(null, params(), freshState()), null);
  assert.strictEqual(codes.parameterChanges(params(), params(), freshState()), null);
});

test('parameterChanges nennt Register mit Namen und Rohwert', () => {
  // Genau die Frage aus dem Forum: Was trifft ein Schreibvorgang auf P0001?
  assert.strictEqual(codes.parameterChanges(params(), params({ 1: 20 }), freshState()),
    'P0001_HEATING_TARGET_CORRECTION 0 → 20');
  // Register ohne Namen in der Tabelle erscheinen mit Nummer.
  assert.strictEqual(codes.parameterChanges(params(), params({ 1190: -15 }), freshState()), 'P1190 0 → -15');
});

test('parameterChanges: laufende Zähler werden nach drei Abfragen stumm', () => {
  // Die Energieaufnahme zählt bei laufender Pumpe mit jeder Abfrage hoch und
  // würde sonst jede Minute eine Zeile schreiben.
  const state = freshState();
  let line;
  for (let poll = 1; poll <= 3; poll++) {
    line = codes.parameterChanges(params({ 1136: poll }), params({ 1136: poll + 1 }), state);
  }
  assert.match(line, /ab jetzt stumm: P1136_HEAT_ENERGY_INPUT/);
  assert.strictEqual(codes.parameterChanges(params({ 1136: 4 }), params({ 1136: 5 }), state), null);
  // Andere Register erscheinen weiter.
  assert.match(codes.parameterChanges(params(), params({ 13: -15 }), state), /P0013_HEATING_CURVE_NIGHT_TEMPERATURE 0 → -15/);
});

test('parameterChanges: wer zwischendurch stillsteht, wird nicht stumm', () => {
  // Zweimal kurz nacheinander am Bedienteil verstellt ist kein Zähler.
  const state = freshState();
  codes.parameterChanges(params(), params({ 13: -10 }), state);
  codes.parameterChanges(params({ 13: -10 }), params({ 13: -10 }), state);
  codes.parameterChanges(params({ 13: -10 }), params({ 13: -15 }), state);
  assert.match(codes.parameterChanges(params({ 13: -15 }), params({ 13: -20 }), state), /-15 → -20$/);
});

test('parameterChanges: viele Änderungen auf einmal werden gezählt statt aufgelistet', () => {
  // Eine Abfrage, die alles als 0 liest, darf keine Zeile mit 1200 Einträgen erzeugen.
  const all = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [200 + i, 7]));
  const line = codes.parameterChanges(params(), params(all), freshState());
  assert.strictEqual(line.split(', ').length, 20);
  assert.match(line, / … und 5 weitere$/);
});

test('parameterChanges: eine kürzere Liste vergleicht nur, was beide haben', () => {
  const line = codes.parameterChanges(params({}, 1200), params({ 1: 5 }, 1100), freshState());
  assert.strictEqual(line, 'Parameterliste 1200 → 1100 Einträge · P0001_HEATING_TARGET_CORRECTION 0 → 5');
});
