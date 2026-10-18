'use strict';

// Die Übersetzungstabellen in lib/luxtronik-codes.js gegen die Bibliothek und
// gegen die Eigenheiten des Reglers.

const { test } = require('node:test');
const assert = require('node:assert');
const codes = require('../lib/luxtronik-codes');
const errors = require('../lib/luxtronik-errors');
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

test('Heizungsstatus und Abtau-Varianten gibt es in allen vier Sprachen', () => {
  // Auf Französisch fiel der Heizungsstatus bisher auf Englisch zurück.
  const missing = [];
  for (const [table, entries] of [['EXTENDED_STATES', codes.EXTENDED_STATES], ['DEFROST_VARIANTS', codes.DEFROST_VARIANTS]]) {
    for (const [key, entry] of Object.entries(entries)) {
      for (const lang of ['en', 'de', 'nl', 'fr']) if (!entry[lang]) missing.push(`${table}.${key} ${lang}`);
    }
  }
  assert.deepStrictEqual(missing, []);
  assert.strictEqual(codes.extendedState(0, 'fr'), 'Chauffage');
  assert.strictEqual(codes.defrostState('air', 'fr'), 'Dégivrage d\'air');
});

test('Sprachen ohne Übersetzung fallen auf Englisch zurück, nicht auf leer', () => {
  assert.strictEqual(codes.extendedState(0, 'it'), codes.extendedState(0, 'en'));
  assert.strictEqual(codes.defrostState('air', 'it'), codes.defrostState('air', 'en'));
  assert.strictEqual(codes.switchoffReason(9, 'it'), codes.switchoffReason(9, 'en'));
  assert.strictEqual(codes.errorText(701, 'it'), codes.errorText(701, 'en'));
  assert.strictEqual(codes.errorHint(701, 'it'), codes.errorHint(701, 'en'));
});

test('errorText: jeder Code der Bibliothek hat Text und Hinweis in allen vier Sprachen', () => {
  // Auf einer niederländischen Homey stand auf der Kachel "Unbekannter
  // Fehler": Die Bibliothek kennt ihre Codes nur auf Deutsch.
  const missing = [];
  for (const code of Object.keys(types.errorCodes).map(Number).filter((c) => c > 0)) {
    for (const lang of ['de', 'en', 'nl', 'fr']) {
      const entry = errors.ERRORS[code];
      if (!entry || !entry.text[lang] || !entry.hint[lang]) missing.push(`${code} ${lang}`);
    }
  }
  assert.deepStrictEqual(missing, []);
  assert.strictEqual(codes.errorText(701, 'nl'), 'Lagedrukstoring');
});

test('die Fehlertabelle ist vollständig: Text, Hinweis und Quittierung', () => {
  const problems = [];
  for (const [code, entry] of Object.entries(errors.ERRORS)) {
    for (const lang of ['de', 'en', 'nl', 'fr']) {
      if (!entry.text[lang]) problems.push(`${code}: Text ${lang}`);
      if (!entry.hint[lang]) problems.push(`${code}: Hinweis ${lang}`);
    }
    if (entry.reset !== null && !errors.ERROR_RESETS[entry.reset]) problems.push(`${code}: Quittierung ${entry.reset}`);
  }
  assert.deepStrictEqual(problems, []);
});

test('errorText: ein unbekannter Code heisst "Unbekannt", in der Sprache des Nutzers', () => {
  // Die Bibliothek liefert dafür "Unbekannter Fehler", auch auf Niederländisch.
  assert.strictEqual(codes.errorText(950, 'nl'), 'Onbekend');
  assert.strictEqual(codes.errorText(950, 'de'), 'Unbekannt');
});

test('errorHint: die Quittierung steht vorne, wie in der zweiten Zeile des Displays', () => {
  assert.match(codes.errorHint(701, 'de'), /^Bitte Inst\. rufen · Niederdruck-Pressostat/);
  assert.match(codes.errorHint(718, 'en'), /^Automatic RESET in hh:mm · /);
  // 731 (Zeitüberschreitung TDI) hat keine Quittierung, nur den Hinweis.
  assert.strictEqual(codes.errorHint(731, 'de'), errors.ERRORS[731].hint.de);
  assert.strictEqual(codes.errorHint(950, 'de'), null);
});

test('switchoffReason: jeder Abschaltgrund auch auf Französisch', () => {
  const missing = Object.entries(codes.SWITCHOFF_REASONS).filter(([, entry]) => !entry.fr).map(([code]) => code);
  assert.deepStrictEqual(missing, []);
  assert.strictEqual(codes.switchoffReason(3, 'fr'), 'Délestage');
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

// Einträge im Fehlerspeicher, wie plausibleLogEntries() sie liefert.
const entry = (code, iso) => ({ code, date: new Date(iso) });

test('newErrors: beim allerersten Mal gilt der Fehlerspeicher als bekannt', () => {
  // Sonst käme nach dem Update jede alte Störung als neu.
  const log = [entry(701, '2026-03-01T10:00:00Z'), entry(702, '2026-09-12T08:30:00Z')];
  const { fresh, knownUntil } = codes.newErrors(log, null);
  assert.deepStrictEqual(fresh, []);
  assert.strictEqual(knownUntil, Date.parse('2026-09-12T08:30:00Z'));
});

test('newErrors: neue Einträge kommen einzeln, ältester zuerst', () => {
  // Auch Störungen, die sich bis zur nächsten Abfrage von selbst erledigt
  // haben: Statuszeile 1 stand dann nie auf 4, der Eintrag bleibt.
  const known = Date.parse('2026-09-12T08:30:00Z');
  const log = [entry(702, '2026-09-12T08:30:00Z'), entry(715, '2026-10-18T07:10:00Z'), entry(702, '2026-10-18T06:00:00Z')];
  const { fresh, knownUntil } = codes.newErrors(log, known);
  assert.deepStrictEqual(fresh.map((e) => e.code), [702, 715]);
  assert.strictEqual(knownUntil, Date.parse('2026-10-18T07:10:00Z'));
  assert.deepStrictEqual(codes.newErrors(log, knownUntil).fresh, [], 'derselbe Speicher meldet nichts mehr');
});

test('newErrors: nach einem leeren Speicher kommt schon der erste Eintrag', () => {
  const first = codes.newErrors([], null);
  assert.strictEqual(first.knownUntil, 0);
  const next = codes.newErrors([entry(701, '2026-10-18T07:10:00Z')], first.knownUntil);
  assert.deepStrictEqual(next.fresh.map((e) => e.code), [701]);
});

// Messwerte einer Abfrage: an den Stellen der fünf Zähler laufende Werte.
function readingWith(counters = {}) {
  const values = new Array(260).fill(0);
  values[10] = 215; // Vorlauf 21,5 °C, damit nicht alles 0 ist
  Object.assign(values, { 56: 74595599, 57: 6126, 63: 74595600, 64: 70000000, 151: 771093 }, counters);
  return values;
}

test('faultyReading: eine Abfrage aus lauter Nullen ist unbrauchbar', () => {
  // BenPru/luxtronik: Gelegentlich liest eine Abfrage jedes Register als 0.
  assert.strictEqual(codes.faultyReading(null, new Array(260).fill(0), [1, 2]), true);
  assert.strictEqual(codes.faultyReading(null, readingWith(), new Array(1100).fill(0)), true, 'alle Parameter 0');
  assert.strictEqual(codes.faultyReading(null, readingWith(), [1, 2]), false);
});

test('faultyReading: alle laufenden Zähler auf einmal 0 sind eine Störung, einer ist ein Zurücksetzen', () => {
  const previous = readingWith();
  const countersZero = { 56: 0, 57: 0, 63: 0, 64: 0, 151: 0 };
  assert.strictEqual(codes.faultyReading(previous, readingWith(countersZero), [1]), true, 'Vorlauf noch da, Zähler alle 0');
  assert.strictEqual(codes.faultyReading(previous, readingWith({ 151: 0 }), [1]), false, 'Wärmemenge zurückgesetzt');
  assert.strictEqual(codes.faultyReading(previous, readingWith({ 56: 0, 57: 0 }), [1]), false, 'nur ein Teil der Zähler');
  // Liefen vorher weniger als zwei, gibt es nichts zu vergleichen.
  const oneRunning = Object.assign(new Array(260).fill(0), { 10: 215, 57: 6126 });
  assert.strictEqual(codes.faultyReading(oneRunning, readingWith({ 57: 0 }), [1]), false);
  // Ohne vorige Abfrage zählt nur die Regel mit den lauter Nullen.
  assert.strictEqual(codes.faultyReading(null, readingWith(countersZero), [1]), false);
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

// Zurücklesen gegen nachgebaute Lesungen: jede Zahl ist der Wert, den der
// Regler bei dieser Lesung für das Register meldet, ein Error eine gescheiterte
// Lesung. Gewartet wird nicht, die Wartezeiten werden nur mitgeschrieben.
async function readBackWith(reads, index = 47, expected = 700) {
  const waits = [];
  let count = 0;
  const read = async () => {
    const next = reads[count++];
    if (next instanceof Error) throw next;
    const parameters = [];
    parameters[index] = next;
    return parameters;
  };
  const result = await codes.readBack(read, index, expected, async (ms) => { waits.push(ms); });
  return { ...result, waits, reads: count };
}

test('readBack: ein übernommener Wert ist mit der ersten Lesung bestätigt', async () => {
  const result = await readBackWith([700]);
  assert.strictEqual(result.accepted, true);
  assert.deepStrictEqual(result.waits, [1000]);
});

test('readBack: ein Regler, der verzögert übernimmt, bekommt weitere Lesungen', async () => {
  // BenPru/luxtronik #729: Ein LWC407 mit V1.88.3 zeigte den geschriebenen Wert
  // erst nach einer Weile.
  const result = await readBackWith([650, 650, 700]);
  assert.strictEqual(result.accepted, true);
  assert.deepStrictEqual(result.waits, [1000, 500, 1000]);
});

test('readBack: hält der Regler den alten Wert, ist der neue nicht übernommen', async () => {
  // So sieht ein Wert ausserhalb des Bereichs aus: Der Regler quittiert den
  // Schreibbefehl und verwirft den Wert.
  const result = await readBackWith([650, 650, 650, 650]);
  assert.deepStrictEqual([result.accepted, result.actual], [false, 650]);
  assert.deepStrictEqual(result.waits, [1000, 500, 1000, 2000]);
});

test('readBack: ohne eine gelungene Lesung ist nichts geprüft', async () => {
  // Geschrieben ist geschrieben, nur die Kontrolle fehlt: kein Fehlschlag.
  const busy = new Error('heatpump busy');
  const result = await readBackWith([busy]);
  assert.strictEqual(result.accepted, null);
  assert.strictEqual(result.error, busy);
  assert.strictEqual(result.reads, 1, 'nach einem Lesefehler keine weitere Lesung');
});

test('readBack: scheitert eine spätere Lesung, zählt die letzte gelungene', async () => {
  const result = await readBackWith([650, new Error('Timeout')]);
  assert.deepStrictEqual([result.accepted, result.actual], [false, 650]);
});

test('writeLogLine nennt Register, Rohwerte und Ergebnis', () => {
  assert.strictEqual(
    codes.writeLogLine(1, 0, 20, { accepted: true, actual: 20 }),
    'P0001_HEATING_TARGET_CORRECTION 0 → 20: übernommen',
  );
  assert.match(codes.writeLogLine(47, 650, 750, { accepted: false, actual: 650 }), /650 → 750: nicht übernommen, Regler meldet 650$/);
  assert.match(codes.writeLogLine(979, undefined, 150, { accepted: false, actual: undefined }), / \? → 150: nicht übernommen, Regler meldet kein solches Register$/);
  assert.match(codes.writeLogLine(1, 0, 20, { accepted: null, error: new Error('Timeout') }), /nicht geprüft, Zurücklesen fehlgeschlagen \(Timeout\)$/);
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

test('parseFirmware zerlegt den Software-Stand in Zahlen', () => {
  assert.deepStrictEqual(codes.parseFirmware('V1.89.0'), { series: 1, minor: 89, patch: 0 });
  assert.deepStrictEqual(codes.parseFirmware('V3.92.1'), { series: 3, minor: 92, patch: 1 });
  assert.deepStrictEqual(codes.parseFirmware('V3.79'), { series: 3, minor: 79, patch: 0 });
  assert.deepStrictEqual(codes.parseFirmware('WWB1.65.2'), { series: 1, minor: 65, patch: 2 });
  for (const unreadable of ['', null, undefined, 'V3']) assert.strictEqual(codes.parseFirmware(unreadable), null);
});

test('hotWaterTargetParameter: P0002 bis x.88.2, P0105 ab x.88.3', () => {
  // Es zählen Neben- und Revisionsnummer; die erste Zahl ist die Baureihe.
  const cases = [
    ['V3.79', 2], ['V1.81', 2], ['V3.88.0', 2], ['V2.88.2', 2],
    ['V2.88.3', 105], ['V1.89.0', 105], ['V1.90.0', 105], ['V3.92.1', 105],
  ];
  for (const [firmware, register] of cases) assert.strictEqual(codes.hotWaterTargetParameter(firmware), register, firmware);
  // Unbekannt gilt wie in der Windows-App als aktuelle Firmware.
  assert.strictEqual(codes.hotWaterTargetParameter(null), 105);
  assert.strictEqual(codes.hotWaterTargetParameter(''), 105);
});

test('hotWaterMaximum liest die "Max. WW-Temp." aus P0973', () => {
  assert.strictEqual(codes.hotWaterMaximum(Object.assign([], { 973: 550 })), 55);
  assert.strictEqual(codes.hotWaterMaximum(Object.assign([], { 973: 0 })), null);
  assert.strictEqual(codes.hotWaterMaximum(new Array(900).fill(1)), null, 'ältere Firmware ohne P0973');
  assert.strictEqual(codes.hotWaterMaximum(null), null);
});

test('clampHotWaterTarget begrenzt auf 30–65 °C und die "Max. WW-Temp."', () => {
  assert.strictEqual(codes.clampHotWaterTarget(60, 55), 55);
  assert.strictEqual(codes.clampHotWaterTarget(50, 55), 50);
  assert.strictEqual(codes.clampHotWaterTarget(70, null), 65);
  assert.strictEqual(codes.clampHotWaterTarget(25, 55), 30);
  // Eine unsinnige Grenze unter 30 °C hebt die Untergrenze nicht auf.
  assert.strictEqual(codes.clampHotWaterTarget(50, 20), 30);
});

test('hotWaterSetpoint zeigt das Register, das der Regler auswertet', () => {
  // Werte aus BenPru/luxtronik (DHW_TARGET_REGISTERS.md): V1.88.3 mit P0002 43 und P0105 46.
  assert.strictEqual(codes.hotWaterSetpoint('V1.88.3', 43, 46), 46);
  assert.strictEqual(codes.hotWaterSetpoint('V3.79', 43, 46), 43);
  // Den Platzhalter 75 °C in P0002 (V3.92.x) nie zeigen.
  assert.strictEqual(codes.hotWaterSetpoint('V3.92.1', 75, 53), 53);
  // Fehlt das Register oder liegt es ausserhalb von 30–65 °C: das andere.
  assert.strictEqual(codes.hotWaterSetpoint('V1.89.0', 49, null), 49);
  assert.strictEqual(codes.hotWaterSetpoint('V3.79', 0, 48), 48);
  assert.strictEqual(codes.hotWaterSetpoint('V1.89.0', 75, 0), null);
});
