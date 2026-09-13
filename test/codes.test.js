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
