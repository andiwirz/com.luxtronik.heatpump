'use strict';

// Abschaltgründe der Steuerung (Register P0716-P0720, von luxtronik2 als
// `switch_off` dekodiert).
//
// Die Bibliothek kennt nur die Codes 0-9 und liefert ausschließlich deutsche
// Texte. Die Steuerung meldet aber Codes bis 27. Die folgende Tabelle ist aus
// der Home-Assistant-Integration BenPru/luxtronik übernommen (MIT), die die
// Codes dokumentiert und übersetzt:
//
//   https://github.com/BenPru/luxtronik
//   custom_components/luxtronik2/const.py       -> LuxSwitchoffReason
//   custom_components/luxtronik2/translations/  -> en.json, de.json, nl.json
//
// Code 4 ist in der Steuerung unbelegt (auch die Quelle führt ihn als leeren
// Text) und 28-31 sind dort unbekannt; beide werden bewusst nicht gemappt.
// 9 und 22 bedeuten dasselbe, beide kommen in freier Wildbahn vor.
//
// Für Französisch liegen keine Übersetzungen vor, dort greift der englische
// Text - lieber unübersetzt als geraten.
const SWITCHOFF_REASONS = Object.freeze({
  0:  { en: 'Heatpump disturbance',                 de: 'Wärmepumpe Störung',                                  nl: 'Storing warmtepomp' },
  1:  { en: 'Plant disturbance',                    de: 'Anlagen Störung',                                     nl: 'Systeemstoring' },
  2:  { en: 'Operating mode second heat generator', de: 'Betriebsart Zweiter Wärmeerzeuger',                    nl: 'Bedrijfsmodus tweede warmteopwekker' },
  3:  { en: 'EVU-Lock',                             de: 'EVU-Sperre',                                          nl: 'EVU-blok' },
  5:  { en: 'Air defrosting',                       de: 'Lauftabtau (nur LW-Geräte)',                          nl: 'Ontdooiing actief (alleen LW-apparaten)' },
  6:  { en: 'Temperature limitation of use maximal', de: 'Temperatur Einsatzgrenze maximal',                   nl: 'Maximale toepassingslimiet temperatuur' },
  7:  { en: 'Temperature limitation of use minimal', de: 'Temperatur Einsatzgrenze minimal',                   nl: 'Minimale toepassingsgrens temperatuur' },
  8:  { en: 'Lower limitation of use',              de: 'Untere Einsatzgrenze',                                nl: 'Onderste toepassingslimiet' },
  9:  { en: 'No request',                           de: 'Keine Anforderung',                                   nl: 'Geen vraag' },
  10: { en: 'External energy source',               de: 'Externe Energiequelle',                               nl: 'Externe energiebron' },
  11: { en: 'Flow rate',                            de: 'Durchfluss-Wärmequelle',                              nl: 'Doorstroomwarmtebron' },
  12: { en: 'Low pressure pause',                   de: 'Niederdruck-Pause',                                   nl: 'Lagedruk-pauze' },
  13: { en: 'Superheating pause',                   de: 'Überhitzungs-Pause',                                  nl: 'Oververhittingspauze' },
  14: { en: 'Inverter pause',                       de: 'Inverter-Pause',                                      nl: 'Inverterpauze' },
  15: { en: 'Desuperheater pause',                  de: 'Enthitzer-Pause',                                     nl: 'Desuperheater-pauze' },
  16: { en: 'Operation mode for switching over',    de: 'Betriebsart Umschaltung',                             nl: 'Bedrijfsmodus omschakeling' },
  17: { en: 'Other shutdown',                       de: 'Sonstige Abschaltung',                                nl: 'Overige afschakeling' },
  18: { en: 'Minimum flow cooling',                 de: 'Mindestdurchfluss Kühlung',                           nl: 'Minimale doorstroming koeling' },
  19: { en: 'PV max',                               de: 'PV max',                                              nl: 'PV max' },
  20: { en: 'Hot gas pause',                        de: 'Heißgas-Pause',                                       nl: 'Heetgaspauze' },
  21: { en: 'Overheating hot gas pause',            de: 'Überhitzung Heißgas-Pause',                           nl: 'Oververhitting heetgaspauze' },
  22: { en: 'No request',                           de: 'Keine Anforderung',                                   nl: 'Geen vraag' },
  23: { en: 'Minimum heat source outlet cooling',   de: 'Minimale Wärmequellen-Austrittstemperatur Kühlung',   nl: 'Minimale uittredetemperatuur warmtebron koeling' },
  24: { en: 'LPC',                                  de: 'LPC',                                                 nl: 'LPC' },
  25: { en: 'Restart',                              de: 'Neustart',                                            nl: 'Herstart' },
  26: { en: 'Maximum return temperature increase',  de: 'TR Erhöhung max',                                     nl: 'TR Verhoging max' },
  27: { en: 'Maximum flow temperature',             de: 'Vorlauf max.',                                        nl: 'Aanvoer max.' },
});

/**
 * Übersetzten Abschaltgrund liefern, oder null wenn der Code unbekannt ist.
 * Der Aufrufer fällt dann auf den Text der Bibliothek zurück.
 */
function switchoffReason(code, language) {
  const entry = SWITCHOFF_REASONS[code];
  if (!entry) return null;
  return entry[language] || entry.en;
}

/**
 * Jüngsten Eintrag aus einem der Ringpuffer (errors, switch_off) liefern.
 * Die Steuerung liefert die fünf Plätze unsortiert, daher über das Datum.
 */
function newestEntry(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.reduce((newest, entry) => {
    if (!entry || !entry.date) return newest;
    if (!newest) return entry;
    return entry.date > newest.date ? entry : newest;
  }, null);
}

module.exports = {
  SWITCHOFF_REASONS,
  switchoffReason,
  newestEntry,
};
