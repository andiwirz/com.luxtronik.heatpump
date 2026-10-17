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

test('plausibleLogEntries: ein nie beschriebener Fehlerspeicher liefert keinen Fehler', () => {
  // Der Fehlerspeicher eines LWD90V, der noch nie einen Fehler hatte. Die
  // Kachel "Letzter Fehler" zeigte daraus "7409920 - Unbekannter Fehler".
  const garbage = [
    { code: 6, date: new Date('1935-05-07T04:52:28Z') },
    { code: 7409920, date: new Date('1970-04-02T18:03:20Z') },
    { code: 0, date: new Date('1969-06-22T20:04:16Z') },
    { code: 7392648, date: new Date('1935-05-07T04:52:28Z') },
    { code: -1062731009, date: new Date('1936-04-28T20:52:54Z') },
  ];
  assert.deepStrictEqual(codes.plausibleLogEntries(garbage, 700, 999), []);
});

test('plausibleLogEntries behält echte Einträge, auch mit Datum als Text', () => {
  const error = { code: 718, date: new Date('2026-08-15T08:14:58Z'), message: 'Max. Aussentemp.' };
  assert.deepStrictEqual(codes.plausibleLogEntries([error], 700, 999), [error]);
  // Abschaltgrund 0 ("Wärmepumpe Störung") ist ein gültiger Code; hier
  // entscheidet allein das Datum.
  const switchoff = { code: 0, date: '2026-10-16T15:59:21.000Z' };
  assert.deepStrictEqual(codes.plausibleLogEntries([switchoff], 0, 99), [switchoff]);
  assert.deepStrictEqual(codes.plausibleLogEntries([{ code: 0, date: new Date('1969-06-22T20:04:16Z') }], 0, 99), []);
  assert.deepStrictEqual(codes.plausibleLogEntries([{ code: 718, date: new Date(NaN) }], 700, 999), []);
  assert.deepStrictEqual(codes.plausibleLogEntries(undefined, 0, 99), []);
  // Ein gültiges Datum allein genügt nicht: Der Code muss in den Bereich passen.
  assert.deepStrictEqual(codes.plausibleLogEntries([{ code: 7409920, date: new Date('2026-08-15T08:14:58Z') }], 700, 999), []);
});

test('hotWaterEvidence: Platzhalter einer reinen Heizanlage zählen nicht', () => {
  // LWD90V ohne Warmwasser: Fühler dauerhaft 75,0 °C, Betriebsstunden "no".
  // Die Kachel zeigte daraus 75 °C Warmwasser.
  for (const placeholder of [75, 0, 5]) {
    assert.strictEqual(codes.hotWaterEvidence(placeholder, null), false, `${placeholder} °C`);
  }
  assert.strictEqual(codes.hotWaterEvidence(null, null), false);
  // Ein echter Messwert belegt Warmwasser, gelaufene Warmwasserstunden auch —
  // dann sogar bei genau 75,0 °C.
  assert.strictEqual(codes.hotWaterEvidence(47.7, null), true);
  assert.strictEqual(codes.hotWaterEvidence(75, 3790), true);
});

test('mixerCanCool erkennt genau die kühlfähigen Mischkreistypen', () => {
  // LuxMkTypes: 0 off, 1 discharge, 2 load, 3 cooling, 4 heating_cooling
  assert.strictEqual(codes.mixerCanCool(3), true);
  assert.strictEqual(codes.mixerCanCool(4), true);
  [0, 1, 2, undefined, null].forEach((t) => assert.strictEqual(codes.mixerCanCool(t), false, `Typ ${t}`));
});

// Kühlzähler-Lesungen nacheinander ab dem Start: [Sekundenstand, Zeitpunkt in
// s] → Urteile.
function coolingVerdicts(readings) {
  const state = codes.coolingCounterState();
  return readings.map(([seconds, at]) => codes.coolingCounterRunning(state, seconds, at * 1000));
}

test('coolingCounterRunning: gekühlt wird, solange der Kühlzähler steigt', () => {
  // Die erste Lesung hat keinen Vergleichswert. Dann steigt der Zähler eine
  // Minute lang mit, danach steht er.
  assert.deepStrictEqual(
    coolingVerdicts([[10504638, 0], [10504698, 60], [10504698, 120]]),
    [null, true, false],
  );
});

test('coolingCounterRunning: ohne eine einzige Kühlsekunde wird nicht gekühlt', () => {
  // LWD90V aus dem Forum: FreigabKuehl dauerhaft 1, Kühlzähler 0, Kühlbetrieb
  // aus — und Status und Heizungsstatus zeigten beim Heizen „Koelen“. Die
  // Antwort ist false, nicht null: Mit null bliebe die alte Fehlanzeige nach
  // dem Update stehen.
  assert.deepStrictEqual(coolingVerdicts([[0, 0], [0, 60], [0, 120]]), [false, false, false]);
});

test('coolingCounterRunning: eine gestörte Abfrage ändert nichts', () => {
  // Eine Abfrage, die jedes Register als 0 liest, beweist nichts. Urteil und
  // Vergleichswert bleiben, sonst sähe die nächste Abfrage einen Sprung von 0
  // auf den vollen Stand.
  for (const glitch of [0, undefined]) {
    assert.deepStrictEqual(
      coolingVerdicts([[10504638, 0], [10504698, 60], [glitch, 120], [10504818, 180]]),
      [null, true, true, true],
      `Störwert ${glitch} während des Kühlens`,
    );
    assert.deepStrictEqual(
      coolingVerdicts([[10504638, 0], [10504638, 60], [glitch, 120], [10504638, 180]]),
      [null, false, false, false],
      `Störwert ${glitch} im Stillstand`,
    );
  }
});

test('coolingCounterRunning: eine Lesung kurz nach der letzten behält das Urteil', () => {
  // Der Bestätigungs-Poll nach einem Schreibvorgang kann Sekunden nach dem
  // regulären kommen. Der Zähler kann dann noch denselben Stand zeigen, obwohl
  // gekühlt wird. Zu früh heisst nicht „gestoppt“, und der Vergleichswert
  // bleibt: Die nächste Abfrage vergleicht wieder mit 10504698.
  assert.deepStrictEqual(
    coolingVerdicts([[10504638, 0], [10504698, 60], [10504698, 62], [10504758, 120]]),
    [null, true, true, true],
  );
});

test('coolingCounterRunning: ein zurückgesetzter Zähler wird neuer Vergleichswert', () => {
  assert.deepStrictEqual(
    coolingVerdicts([[10504638, 0], [500, 60], [560, 120]]),
    [null, false, true],
  );
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
