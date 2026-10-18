'use strict';

const { CALCULATIONS, PARAMETERS } = require('./luxtronik-registers');
const { ERRORS, ERROR_RESETS, UNKNOWN_ERROR } = require('./luxtronik-errors');

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
// Französisch fehlt in der Quelle. Es stammt aus der Windows-App desselben
// Autors (Luxtronik-win-app, CoreStrings.fr.resx), die es an der französischen
// Betriebsanleitung ausgerichtet hat.
const SWITCHOFF_REASONS = Object.freeze({
  0:  { en: 'Heatpump disturbance',                 de: 'Wärmepumpe Störung',                                  nl: 'Storing warmtepomp',                              fr: 'Panne pompe à chaleur' },
  1:  { en: 'Plant disturbance',                    de: 'Anlagen Störung',                                     nl: 'Systeemstoring',                                  fr: 'Panne d\'installation' },
  2:  { en: 'Operating mode second heat generator', de: 'Betriebsart Zweiter Wärmeerzeuger',                    nl: 'Bedrijfsmodus tweede warmteopwekker',            fr: 'Mode Appoint' },
  3:  { en: 'EVU-Lock',                             de: 'EVU-Sperre',                                          nl: 'EVU-blok',                                        fr: 'Délestage' },
  5:  { en: 'Air defrosting',                       de: 'Lauftabtau (nur LW-Geräte)',                          nl: 'Ontdooiing actief (alleen LW-apparaten)',         fr: 'Dégivrage d\'air' },
  6:  { en: 'Temperature limitation of use maximal', de: 'Temperatur Einsatzgrenze maximal',                   nl: 'Maximale toepassingslimiet temperatuur',          fr: 'Température limite d\'utilisation maximale' },
  7:  { en: 'Temperature limitation of use minimal', de: 'Temperatur Einsatzgrenze minimal',                   nl: 'Minimale toepassingsgrens temperatuur',           fr: 'Température limite d\'utilisation minimale' },
  8:  { en: 'Lower limitation of use',              de: 'Untere Einsatzgrenze',                                nl: 'Onderste toepassingslimiet',                      fr: 'Limite d\'utilisation inférieure' },
  9:  { en: 'No request',                           de: 'Keine Anforderung',                                   nl: 'Geen vraag',                                      fr: 'Pas de demande' },
  10: { en: 'External energy source',               de: 'Externe Energiequelle',                               nl: 'Externe energiebron',                             fr: 'Source d\'énergie externe' },
  11: { en: 'Flow rate',                            de: 'Durchfluss-Wärmequelle',                              nl: 'Doorstroomwarmtebron',                            fr: 'Débit' },
  12: { en: 'Low pressure pause',                   de: 'Niederdruck-Pause',                                   nl: 'Lagedruk-pauze',                                  fr: 'Pause basse pression' },
  13: { en: 'Superheating pause',                   de: 'Überhitzungs-Pause',                                  nl: 'Oververhittingspauze',                            fr: 'Pause surchauffe' },
  14: { en: 'Inverter pause',                       de: 'Inverter-Pause',                                      nl: 'Inverterpauze',                                   fr: 'Pause inverter' },
  15: { en: 'Desuperheater pause',                  de: 'Enthitzer-Pause',                                     nl: 'Desuperheater-pauze',                             fr: 'Pause désurchauffeur' },
  16: { en: 'Operation mode for switching over',    de: 'Betriebsart Umschaltung',                             nl: 'Bedrijfsmodus omschakeling',                      fr: 'Changement de mode' },
  17: { en: 'Other shutdown',                       de: 'Sonstige Abschaltung',                                nl: 'Overige afschakeling',                            fr: 'Autre arrêt' },
  18: { en: 'Minimum flow cooling',                 de: 'Mindestdurchfluss Kühlung',                           nl: 'Minimale doorstroming koeling',                   fr: 'Débit minimal rafraîchissement' },
  19: { en: 'PV max',                               de: 'PV max',                                              nl: 'PV max',                                          fr: 'PV max' },
  20: { en: 'Hot gas pause',                        de: 'Heißgas-Pause',                                       nl: 'Heetgaspauze',                                    fr: 'Pause gaz chaud' },
  21: { en: 'Overheating hot gas pause',            de: 'Überhitzung Heißgas-Pause',                           nl: 'Oververhitting heetgaspauze',                     fr: 'Pause surchauffe gaz chaud' },
  22: { en: 'No request',                           de: 'Keine Anforderung',                                   nl: 'Geen vraag',                                      fr: 'Pas de demande' },
  23: { en: 'Minimum heat source outlet cooling',   de: 'Minimale Wärmequellen-Austrittstemperatur Kühlung',   nl: 'Minimale uittredetemperatuur warmtebron koeling', fr: 'Sortie source min. rafraîchissement' },
  24: { en: 'LPC',                                  de: 'LPC',                                                 nl: 'LPC',                                             fr: 'LPC' },
  25: { en: 'Restart',                              de: 'Neustart',                                            nl: 'Herstart',                                        fr: 'Redémarrage' },
  26: { en: 'Maximum return temperature increase',  de: 'TR Erhöhung max',                                     nl: 'TR Verhoging max',                                fr: 'Augmentation retour max.' },
  27: { en: 'Maximum flow temperature',             de: 'Vorlauf max.',                                        nl: 'Aanvoer max.',                                    fr: 'Départ max.' },
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
 * Kurztext einer Störung in der Sprache des Nutzers, siehe luxtronik-errors.js.
 * Ein Code, den keine Tabelle kennt, heisst "Unbekannt" statt wie in der
 * Bibliothek "Unbekannter Fehler" auf Deutsch, auch in anderen Sprachen.
 */
function errorText(code, language) {
  const texts = ERRORS[code] ? ERRORS[code].text : UNKNOWN_ERROR;
  return texts[language] || texts.en;
}

/**
 * Hinweis zu einer Störung, vorneweg die Quittierung wie in der zweiten Zeile
 * des Displays ("Bitte Inst. rufen · …"), oder null für einen unbekannten Code.
 */
function errorHint(code, language) {
  const entry = ERRORS[code];
  if (!entry) return null;
  const hint = entry.hint[language] || entry.hint.en;
  if (!entry.reset) return hint;
  const reset = ERROR_RESETS[entry.reset];
  return `${reset[language] || reset.en} · ${hint}`;
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

// Erweiterter Betriebszustand der Steuerung (Berechnung C0119), Code -> Text.
//
// luxtronik2 liefert diesen Zustand nur als deutschen String, den die App
// bisher wieder zurückübersetzen musste. Das war aus zwei Gründen brüchig:
// die Bibliothek hängt beim Abtauen den Untertyp ohne Trennzeichen an den
// bereits gesetzten Text an ("AbtauenLuftabtauen"), und beim Estrichprogramm
// klebt ein dynamischer Suffix daran. Beides zwang zu String-Vergleichen auf
// genau diese Eigenheiten.
//
// Die Zuordnung Code -> Bedeutung stammt aus der Home-Assistant-Integration
// BenPru/luxtronik (MIT), deren LuxStatus3Option-Reihenfolge sich eins zu eins
// mit den Codes der Bibliothek deckt; der Name dahinter ist der dortige
// Schlüssel, damit sich beide Seiten abgleichen lassen:
//   https://github.com/BenPru/luxtronik
//   custom_components/luxtronik2/const.py -> LuxStatus3Option
//
// Die Texte sind bewusst die der App geblieben. Die Integration übersetzt in
// einem anderen Stil ("heizt" statt "Heizbetrieb"); den zu übernehmen wäre
// eine Änderung an sichtbarem Text ohne Gewinn.
//
// Französisch stammt aus der Windows-App desselben Autors (CoreStrings.fr.resx,
// Status3_*), die es an der französischen Betriebsanleitung ausgerichtet hat.
// 15, 17, 18 und 19 sowie die Abtau-Varianten unten kennt sie nicht oder
// benennt sie anders; dort sind die Übersetzungen eigene.
const EXTENDED_STATES = Object.freeze({
  0:  { en: 'Heating',                    de: 'Heizbetrieb',                 nl: 'Verwarmen',                  fr: 'Chauffage' },                        // heating
  1:  { en: 'No Request',                 de: 'Keine Anforderung',           nl: 'Geen warmtevraag',           fr: 'Pas de demande' },                   // no_request
  2:  { en: 'Grid Startup Delay',         de: 'Netz Einschaltverzögerung',   nl: 'Netinschakelvertraging',     fr: 'Retard d\'enclenchement' },          // grid_switch_on_delay
  3:  { en: 'Switching Cycle Time',       de: 'Schaltspielzeit',             nl: 'Schakelspeltijd',            fr: 'Anti-court-cycle' },                 // cycle_lock
  4:  { en: 'EVU Lock',                   de: 'EVU Sperrzeit',               nl: 'EVU-blokkering',             fr: 'Temps de blocage' },                 // lock_time
  5:  { en: 'Hot Water',                  de: 'Brauchwasser',                nl: 'Warmwater',                  fr: 'Production ECS' },                   // domestic_water
  // 6 (Estrichprogramm / info_bake_out_program) trägt einen dynamischen
  // Suffix "Stufe X - Y °C" und wird im Device gesondert zusammengesetzt.
  6:  { en: 'Screed Program',             de: 'Estrich Programm',            nl: 'Dekvloerprogramma',          fr: 'Programme de séchage' },             // info_bake_out_program
  // 7 (Abtauen / defrost) wird über DEFROST_VARIANTS weiter aufgeschlüsselt.
  7:  { en: 'Defrost',                    de: 'Abtauen',                     nl: 'Ontdooien',                  fr: 'Dégivrage' },                        // defrost
  8:  { en: 'Pump Pre-run',               de: 'Pumpenvorlauf',               nl: 'Pompvoorloop',               fr: 'Pré-circulation pompe' },            // pump_forerun
  9:  { en: 'Thermal Disinfection',       de: 'Thermische Desinfektion',     nl: 'Thermische desinfectie',     fr: 'Désinfection thermique' },           // thermal_desinfection
  10: { en: 'Cooling',                    de: 'Kühlbetrieb',                 nl: 'Koelen',                     fr: 'Rafraîchissement' },                 // cooling
  12: { en: 'Pool / Photovoltaic',        de: 'Schwimmbad / Photovoltaik',   nl: 'Zwembad / Fotovoltaïsch',    fr: 'Piscine / Photovoltaïque' },         // swimming_pool_solar
  13: { en: 'External Heating',           de: 'Heizen Ext.',                 nl: 'Externe verwarming',         fr: 'Chauffage source d\'énergie ext.' }, // heating_external_energy_source
  14: { en: 'External Hot Water',         de: 'Brauchwasser Ext.',           nl: 'Extern warmwater',           fr: 'ECS source d\'énergie ext.' },       // domestic_water_external_energy_source
  // 15 und 18 kennt weder die Bibliothek noch die Integration; die Texte
  // stammen aus der App und bleiben unverändert.
  15: { en: 'Operating Limit',            de: 'Einsatzgrenze / Sperre',      nl: 'Bedrijfsgrens / blokkering', fr: 'Limite d\'utilisation / blocage' },
  16: { en: 'Flow Monitoring',            de: 'Durchflussüberwachung',       nl: 'Doorstroombewaking',         fr: 'Contrôle du débit' },                // flow_monitoring
  17: { en: 'Electric Auxiliary Heating', de: 'Elektrische Zusatzheizung',   nl: 'Elektrische bijverwarming',  fr: 'Appoint électrique' },               // second_heat_generator_1_active
  18: { en: 'Compressor Heating Up',      de: 'Verdichter heizt auf',        nl: 'Compressor warmt op',        fr: 'Préchauffage compresseur' },
  19: { en: 'DHW Reheating',              de: 'Warmwasser Nachheizung',      nl: 'Warmwater naverwarming',     fr: 'Réchauffage ECS' },
});

// Untertypen des Abtauens (Code 7). Die Bibliothek leitet sie aus dem
// Abtauventil, dem Verdichter und dem Wärmequellenmotor ab; hier wird dieselbe
// Unterscheidung getroffen, aber aus den Rohregistern statt aus dem
// zusammengeklebten String.
const DEFROST_VARIANTS = Object.freeze({
  cycle_reversal: { en: 'Defrost (Reverse Cycle)', de: 'Abtauen (Kreisumkehr)', nl: 'Ontdooien (kringomkering)', fr: 'Dégivrage (inversion de cycle)' },
  air:            { en: 'Air Defrost',             de: 'Luftabtauen',           nl: 'Luchtontdooiing',           fr: 'Dégivrage d\'air' },
  plain:          { en: 'Defrost',                 de: 'Abtauen',               nl: 'Ontdooien',                 fr: 'Dégivrage' },
});

/**
 * Untertyp des Abtauens bestimmen. Gleiche Logik wie in luxtronik2, aber auf
 * den ungefilterten Rohwerten: die Bibliothek blendet Abtauventil und
 * Wärmequellenmotor je nach Visibility-Flag aus und liefert dann 'no'.
 */
function defrostVariant({ defrostValve, compressor, pumpFlow }) {
  if (defrostValve === 1) return 'cycle_reversal';
  if (compressor === 0 && pumpFlow === 1) return 'air';
  return 'plain';
}

/**
 * Übersetzten erweiterten Betriebszustand liefern, oder null bei unbekanntem
 * Code - dann fällt der Aufrufer auf den Text der Bibliothek zurück.
 */
function extendedState(code, language) {
  const entry = EXTENDED_STATES[code];
  if (!entry) return null;
  return entry[language] || entry.en;
}

/** Übersetzten Abtau-Untertyp liefern. */
function defrostState(variant, language) {
  const entry = DEFROST_VARIANTS[variant];
  if (!entry) return null;
  return entry[language] || entry.en;
}

// Typ eines Mischkreises (Parameter P0042/P0130/P0780). Aus der
// Home-Assistant-Integration BenPru/luxtronik (MIT), const.py -> LuxMkTypes.
const MIXER_CIRCUIT_TYPES = Object.freeze({
  off:             0,
  discharge:       1,
  load:            2,
  cooling:         3,
  heating_cooling: 4,
});

// Frühestes Datum, das ein echter Protokolleintrag tragen kann.
const LOG_ENTRY_MIN_DATE = Date.UTC(2000, 0, 1);

/**
 * Nur die Einträge eines Fehler- oder Abschaltprotokolls, die ein Regler auch
 * geschrieben haben kann. Wer noch nie einen Fehler hatte, liefert in seinem
 * Fehlerspeicher Zufallswerte — beobachtet an einem LWD90V: Code 7409920 vom
 * 2.4.1970, Code -1062731009 von 1936. Daraus wurde die Kachel "Letzter
 * Fehler". Ein Eintrag zählt deshalb nur mit einem Code im Bereich der Liste
 * und einem Datum ab 2000.
 */
function plausibleLogEntries(list, minCode, maxCode) {
  if (!Array.isArray(list)) return [];
  return list.filter((entry) => {
    if (!entry || typeof entry.code !== 'number' || entry.code < minCode || entry.code > maxCode) return false;
    const time = new Date(entry.date).getTime();
    return !Number.isNaN(time) && time >= LOG_ENTRY_MIN_DATE;
  });
}

/**
 * Neue Einträge im Fehlerspeicher seit dem zuletzt bekannten, ältester zuerst,
 * und der Stand für das nächste Mal: der Zeitpunkt des neuesten Eintrags in ms.
 *
 * Gemeldet wird damit jede Störung, auch eine, die sich vor der nächsten
 * Abfrage von selbst erledigt hat ("RESET automatisch") oder die auftrat,
 * während Homey oder die App aus war. Ohne bekannten Stand, beim allerersten
 * Mal, gilt der Speicher als bekannt: Alte Störungen kommen nicht als neu. Ein
 * leerer Speicher ergibt dabei den Stand 0, damit der erste echte Eintrag
 * danach gemeldet wird. Gleiche Regel wie in der Windows-App (AlertMonitor).
 */
function newErrors(entries, knownUntil) {
  const time = (entry) => new Date(entry.date).getTime();
  const newest = Math.max(0, ...entries.map(time));
  if (typeof knownUntil !== 'number') return { fresh: [], knownUntil: newest };
  const fresh = entries.filter((entry) => time(entry) > knownUntil).sort((a, b) => time(a) - time(b));
  return { fresh, knownUntil: Math.max(knownUntil, newest) };
}

// Zähler, die nur wachsen und unabhängig voneinander laufen. Ein echtes
// Zurücksetzen durch die Fachperson trifft meist nur einen davon. Gleiche
// Auswahl wie in der Windows-App (SnapshotCheck).
const GLITCH_COUNTERS = Object.freeze([
  CALCULATIONS.C0056_COMPRESSOR1_OPERATION_HOURS,
  CALCULATIONS.C0057_COMPRESSOR1_IMPULSES,
  CALCULATIONS.C0063_OPERATION_HOURS,
  CALCULATIONS.C0064_OPERATION_HOURS_HEATING,
  CALCULATIONS.C0151_HEAT_AMOUNT_HEATING,
]);

/**
 * Ist eine Abfrage unbrauchbar? Der Regler liefert gelegentlich eine, in der
 * jedes Register 0 ist (BenPru/luxtronik). Übernommen sprängen Zähler zurück,
 * Temperaturen fielen auf 0 °C, Auslöser feuerten, und die Geräteeinstellungen
 * würden auf 0 abgeglichen. Unbrauchbar ist sie, wenn alle Messwerte oder alle
 * Parameter 0 sind, oder wenn alle Zähler, die zuletzt liefen — mindestens
 * zwei —, auf einmal auf 0 stehen. `previous` sind die Messwerte der letzten
 * brauchbaren Abfrage, ohne sie zählt nur die erste Regel.
 */
function faultyReading(previous, values, parameters) {
  const allZero = (list) => Array.isArray(list) && list.length > 0 && list.every((value) => value === 0);
  if (allZero(values) || allZero(parameters)) return true;
  if (!previous) return false;
  const running = GLITCH_COUNTERS.filter((index) => previous[index] > 0);
  return running.length >= 2 && running.every((index) => values[index] === 0);
}

// Platzhalter, die ein unbelegter Fühlereingang statt eines Messwerts meldet.
// Am Warmwasserfühler einer reinen Heizanlage ist es 75,0 °C: bei allen drei
// solchen Anlagen im Diagnose-Bestand der Home-Assistant-Integration und bei
// einem LWD90V aus dem Forum. 0,0 und 5,0 kommen auf anderen unbelegten Kanälen vor.
const UNWIRED_PLACEHOLDERS = Object.freeze([0, 5, 75]);

/**
 * Spricht etwas dafür, dass die Anlage Warmwasser hat? Laufende
 * Warmwasser-Betriebsstunden belegen es; eine frisch in Betrieb genommene
 * Anlage hat noch keine, dort genügt ein Fühler, der etwas anderes als einen
 * Platzhalter meldet. Gleiche Regel wie in der Home-Assistant-Integration.
 */
function hotWaterEvidence(temperature, hours) {
  if (typeof hours === 'number' && hours > 0) return true;
  return typeof temperature === 'number' && !UNWIRED_PLACEHOLDERS.includes(temperature);
}

/** Kann dieser Mischkreis kühlen? */
function mixerCanCool(type) {
  return type === MIXER_CIRCUIT_TYPES.cooling || type === MIXER_CIRCUIT_TYPES.heating_cooling;
}

// Lesungen des Kühlzählers, die näher beieinanderliegen, behalten das Urteil:
// Er zählt ganze Sekunden, und weil jede Abfrage eine eigene Verbindung
// aufbaut, kann zwischen Anfrage und Auswertung eine Sekunde vergehen.
const COOLING_COUNTER_MIN_SPACING_MS = 5000;

/** Stand für coolingCounterRunning() ohne Vergleichswert, wie nach dem Start oder einem Ausfall. */
function coolingCounterState() {
  return { seconds: null, readAt: null, running: null };
}

/**
 * Kühlt die Anlage gerade? true oder false, null ohne Vergleichswert.
 *
 * Passive Kühlung meldet der Regler als Statuszeile 3 = 0 „Heizbetrieb“, wie
 * eine Anlage, die heizt. Die Freigabe C0146 (FreigabKuehl) sagt nur, dass
 * gekühlt werden darf: Auf einer Anlage ohne eine einzige Kühlstunde stand sie
 * dauerhaft auf 1, und die App zeigte beim Heizen „Kühlen“. Der Kühlzähler
 * C0066 dagegen zählt jede Sekunde, in der der Regler kühlt; steigt er
 * zwischen zwei Abfragen, wird gekühlt. Gleiche Regel wie in der
 * Home-Assistant-Integration (#404, #826).
 *
 * `state` gehört dem Gerät und bleibt über die Abfragen erhalten. Ein Wert von
 * 0 oder ohne Zahl wird übergangen — eine gestörte Abfrage liest alle Register
 * als 0 —, ebenso eine Lesung kurz nach der letzten: Vergleichswert und Urteil
 * bleiben. Ein kleinerer Wert ist ein zurückgesetzter Zähler und wird neuer
 * Vergleichswert. Ohne Zählerstand über 0 heisst die Antwort false: Was nie
 * gekühlt hat, kühlt auch jetzt nicht.
 *
 * Die erste Lesung ergibt null, wo die Integration false meldet; was dann
 * gilt, entscheidet der Aufrufer. Die App lässt die bisherige Anzeige stehen,
 * denn bei ihr löst ein Statuswechsel Flows und Meldungen aus: Ein Sprung auf
 * „Heizen“ für eine Abfrage nach jedem Neustart feuerte beide zweimal.
 */
function coolingCounterRunning(state, seconds, now) {
  const spaced = state.readAt === null || now - state.readAt >= COOLING_COUNTER_MIN_SPACING_MS;
  if (typeof seconds === 'number' && seconds > 0 && spaced) {
    state.running = state.seconds === null ? null : seconds > state.seconds;
    state.seconds = seconds;
    state.readAt = now;
  }
  return state.seconds === null ? false : state.running;
}

/**
 * Angeschlossene Raumeinheit (P0033, ID_Einst_RFVEinb_akt). Codes wie in der
 * Home-Assistant-Integration (LuxRoomThermostatType).
 */
const ROOM_UNIT_TYPES = Object.freeze({
  0: 'keine',
  1: 'RFV',
  2: 'RFV-K',
  3: 'RFV-DK',
  4: 'RBE',
  5: 'Smart',
});
const ROOM_UNIT_RBE = 4;
// Ab Firmware 2.0 ist eine RBE eine "RBE Plus" — dieselbe Grenze zieht die
// Home-Assistant-Integration. C0258 kodiert die Version als Major × 100 + Minor.
const RBE_PLUS_MIN_VERSION = 200;

/** Regelungsart des Heizkreises (P0103, ID_Einst_RTyp_akt). */
const HEATING_CONTROL_MODES = Object.freeze({
  0: 'Heizkurve',
  1: 'Festwert',
  2: 'Analog-Eingang',
});

/**
 * Raumeinheit und Regelungsart als eine Logzeile, jeweils mit dem Rohwert.
 * Ein Register, das der Regler nicht liefert, erscheint als "nicht gemeldet"
 * statt als geratene Konfiguration.
 */
function controllerConfig(roomUnitType, rbeVersion, heatingControlMode) {
  let roomUnit = 'nicht gemeldet (P0033)';
  if (typeof roomUnitType === 'number') {
    let name = ROOM_UNIT_TYPES[roomUnitType] ?? 'unbekannt';
    let detail = `P0033=${roomUnitType}`;
    if (roomUnitType === ROOM_UNIT_RBE) {
      if (typeof rbeVersion === 'number' && rbeVersion > 0) {
        if (rbeVersion >= RBE_PLUS_MIN_VERSION) name = 'RBE Plus';
        detail += `, RBE ${Math.floor(rbeVersion / 100)}.${String(rbeVersion % 100).padStart(2, '0')}`;
      } else {
        detail += ', RBE-Version nicht gemeldet';
      }
    }
    roomUnit = `${name} (${detail})`;
  }
  const mode = typeof heatingControlMode === 'number'
    ? `${HEATING_CONTROL_MODES[heatingControlMode] ?? 'unbekannt'} (P0103=${heatingControlMode})`
    : 'nicht gemeldet (P0103)';
  return `Raumeinheit=${roomUnit}, Regelungsart=${mode}`;
}

// Index → Registername, damit die Logzeile "P0013_HEATING_CURVE_NIGHT_TEMPERATURE"
// zeigt statt einer nackten Zahl. Unbenannte Register erscheinen als "P1190".
const PARAMETER_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(PARAMETERS).map(([name, index]) => [index, name])),
);

/** "P0013_HEATING_CURVE_NIGHT_TEMPERATURE" für benannte Register, sonst "P1190". */
function parameterLabel(index) {
  return PARAMETER_NAMES[index] ?? `P${String(index).padStart(4, '0')}`;
}
// So viele Abfragen in Folge darf sich ein Register ändern, bevor es als
// laufender Zähler gilt und stummgeschaltet wird.
const PARAMETER_CHANGE_MUTE_AFTER = 3;
// Höchstzahl Änderungen pro Logzeile; der Rest wird nur gezählt.
const PARAMETER_CHANGE_MAX_LISTED = 20;

/**
 * Was sich zwischen zwei Abfragen an den Parametern geändert hat, als
 * Logzeile — oder null, wenn nichts. Rohwerte, wie der Regler sie speichert,
 * Temperaturen also in Zehnteln.
 *
 * Anlass: Auf einem LWD90V kam eine Korrektur, die am Startbildschirm des
 * Reglers gesetzt wurde, nicht in P0001 an, wo die App sie liest und schreibt.
 * Ändert man dort etwas am Bedienteil, zeigt diese Zeile, welches Register es
 * tatsächlich trifft — und nach einem Schreibvorgang der App, was der Regler
 * daraus gemacht hat.
 *
 * `state` gehört dem Gerät und bleibt über die Abfragen erhalten. Zähler wie
 * die Energieaufnahme (P1136 ff.) ändern sich bei laufender Pumpe mit jeder
 * Abfrage; ein Register, das sich PARAMETER_CHANGE_MUTE_AFTER Abfragen in Folge
 * ändert, wird deshalb bis zum nächsten Start stummgeschaltet, und die Zeile
 * sagt das einmal dazu. Eine Änderung am Bedienteil oder durch die App trifft
 * ein Register dagegen einmal und erscheint immer.
 */
function parameterChanges(before, now, state) {
  if (!before || !now) return null;
  const listed = [];
  const muted = [];
  let unlisted = 0;
  const n = Math.min(before.length, now.length);
  for (let i = 0; i < n; i++) {
    if (before[i] === now[i]) {
      if (state.streak[i]) delete state.streak[i];
      continue;
    }
    if (state.muted[i]) continue;
    const name = parameterLabel(i);
    state.streak[i] = (state.streak[i] || 0) + 1;
    if (state.streak[i] >= PARAMETER_CHANGE_MUTE_AFTER) {
      state.muted[i] = true;
      muted.push(name);
    }
    if (listed.length < PARAMETER_CHANGE_MAX_LISTED) listed.push(`${name} ${before[i]} → ${now[i]}`);
    else unlisted++;
  }
  const parts = [];
  if (before.length !== now.length) parts.push(`Parameterliste ${before.length} → ${now.length} Einträge`);
  if (listed.length) parts.push(listed.join(', ') + (unlisted ? ` … und ${unlisted} weitere` : ''));
  if (muted.length) parts.push(`ändert sich laufend, ab jetzt stumm: ${muted.join(', ')}`);
  return parts.length ? parts.join(' · ') : null;
}

// Wartezeiten vor jedem Zurücklesen nach einem Schreibvorgang, in ms: erst
// eine Sekunde, dann, solange der Wert noch fehlt, 0,5, 1 und 2 s. Manche
// Regler zeigen einen geschriebenen Wert erst verzögert (BenPru/luxtronik #729,
// LWC407 mit V1.88.3). Gleiche Abstände wie in der Windows-App.
const READBACK_DELAYS_MS = Object.freeze([1000, 500, 1000, 2000]);

/**
 * Hat der Regler den geschriebenen Rohwert übernommen? Die Quittung beantwortet
 * das nicht: Sie wiederholt nur die Parameternummer, nie den Wert. Einen Wert
 * ausserhalb seines Bereichs verwirft der Regler ohne Fehlermeldung.
 *
 * `read` liefert die Parameterliste und wirft bei einem Lesefehler, `sleep`
 * wartet. Ergebnis `accepted`: true, false — oder null, wenn schon das erste
 * Zurücklesen scheitert. Geschrieben ist dann geschrieben, nur die Kontrolle
 * fehlt. Scheitert eine spätere Lesung, gilt die letzte gelungene.
 */
async function readBack(read, index, expected, sleep) {
  let actual;
  for (const [attempt, delay] of READBACK_DELAYS_MS.entries()) {
    await sleep(delay);
    try {
      actual = (await read())[index];
    } catch (error) {
      if (attempt === 0) return { accepted: null, actual: undefined, error };
      break;
    }
    if (actual === expected) return { accepted: true, actual };
  }
  return { accepted: false, actual };
}

/** Logzeile zu einem Schreibvorgang: Register, Rohwert vorher → geschrieben, Ergebnis. */
function writeLogLine(index, before, sent, check) {
  const head = `${parameterLabel(index)} ${before ?? '?'} → ${sent}`;
  if (check.accepted === true) return `${head}: übernommen`;
  if (check.accepted === false) {
    return `${head}: nicht übernommen, Regler meldet ${check.actual === undefined ? 'kein solches Register' : check.actual}`;
  }
  return `${head}: nicht geprüft, Zurücklesen fehlgeschlagen (${(check.error && check.error.message) || check.error})`;
}

// Warmwasser-Soll. In Frage kommen zwei Register: P0002 ("Deckung WP"), das
// der Regler selbst absenkt, wenn die Wärmepumpe den Wert nicht erreicht, und
// P0105 ("Wunschwert"). Welches er auswertet, hängt von der Firmware ab: bis
// x.88.2 P0002, ab x.88.3 P0105 (BenPru/luxtronik, DHW_TARGET_REGISTERS.md;
// gemessen ist dort nur, dass es spätestens ab 90.0 P0105 ist). Zählt nur
// Neben- und Revisionsnummer, die erste Zahl ist die Baureihe (V1/V2
// Luxtronik 2.0, V3 2.1). Unbekannte Firmware gilt wie in der Windows-App als
// aktuelle.
const HOT_WATER_TARGET_RANGE = Object.freeze({ min: 30, max: 65 });

/** Software-Stand als Zahlen, z. B. "V1.89.0" → { series: 1, minor: 89, patch: 0 }; null, wenn nicht lesbar. */
function parseFirmware(firmware) {
  const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(firmware ?? ''));
  if (!match) return null;
  return { series: Number(match[1]), minor: Number(match[2]), patch: match[3] === undefined ? 0 : Number(match[3]) };
}

/** Register des Warmwasser-Solls, das der Regler mit dieser Firmware auswertet. */
function hotWaterTargetParameter(firmware) {
  const fw = parseFirmware(firmware);
  const legacy = fw !== null && (fw.minor < 88 || (fw.minor === 88 && fw.patch < 3));
  return legacy ? PARAMETERS.P0002_DHW_TARGET_TEMPERATURE : PARAMETERS.P0105_DHW_TARGET_TEMPERATURE;
}

/**
 * "Max. WW-Temp." (P0973) in °C: Ein höheres Warmwasser-Soll setzt der Regler
 * selbst auf diesen Wert herab (gemessen an einer LWC mit V1.89.0: 53 °C wurden
 * 52 °C), das Zurücklesen meldete dann "nicht übernommen". null, wenn er das
 * Register nicht hat (ältere Firmware) oder 0 meldet.
 */
function hotWaterMaximum(parameters) {
  const raw = parameters ? Number(parameters[PARAMETERS.P0973_MAX_DHW_TEMPERATURE]) : NaN;
  return raw > 0 ? raw / 10 : null;
}

/** Warmwasser-Soll auf 30–65 °C und höchstens die "Max. WW-Temp." begrenzt. */
function clampHotWaterTarget(value, maximum) {
  const { min, max } = HOT_WATER_TARGET_RANGE;
  const upper = maximum ? Math.min(max, Math.max(min, maximum)) : max;
  return Math.min(upper, Math.max(min, value));
}

/**
 * Obergrenze des Warmwasser-Thermostats: die "Max. WW-Temp.", aber nie unter dem
 * Soll, das der Regler gerade hat (etwa wenn die Grenze eben gesenkt wurde),
 * damit der Thermostat ihn noch zeigen kann. Ohne P0973 65 °C. Wie in der
 * Windows-App.
 */
function hotWaterDialMaximum(maximum, setpoint) {
  const { min, max } = HOT_WATER_TARGET_RANGE;
  const limit = Math.max(maximum || max, typeof setpoint === 'number' ? setpoint : min);
  return Math.min(max, Math.max(min, limit));
}

/**
 * Wert für den Warmwasser-Thermostat: das Register, das der Regler auswertet.
 * Liegt es ausserhalb von 30–65 °C, wie der Platzhalter 75 °C, den manche
 * Firmware in P0002 meldet, das andere; ist keines plausibel, null.
 */
function hotWaterSetpoint(firmware, p2, p105) {
  const { min, max } = HOT_WATER_TARGET_RANGE;
  const legacy = hotWaterTargetParameter(firmware) === PARAMETERS.P0002_DHW_TARGET_TEMPERATURE;
  return [legacy ? p2 : p105, legacy ? p105 : p2].find((t) => typeof t === 'number' && t >= min && t <= max) ?? null;
}

module.exports = {
  SWITCHOFF_REASONS,
  switchoffReason,
  errorText,
  errorHint,
  newestEntry,
  EXTENDED_STATES,
  DEFROST_VARIANTS,
  extendedState,
  defrostVariant,
  defrostState,
  MIXER_CIRCUIT_TYPES,
  mixerCanCool,
  coolingCounterState,
  coolingCounterRunning,
  plausibleLogEntries,
  newErrors,
  faultyReading,
  hotWaterEvidence,
  ROOM_UNIT_TYPES,
  HEATING_CONTROL_MODES,
  controllerConfig,
  PARAMETER_NAMES,
  parameterLabel,
  parameterChanges,
  READBACK_DELAYS_MS,
  readBack,
  writeLogLine,
  parseFirmware,
  hotWaterTargetParameter,
  hotWaterMaximum,
  clampHotWaterTarget,
  hotWaterDialMaximum,
  hotWaterSetpoint,
};
