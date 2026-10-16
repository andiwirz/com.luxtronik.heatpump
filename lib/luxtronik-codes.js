'use strict';

const { PARAMETERS } = require('./luxtronik-registers');

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
const EXTENDED_STATES = Object.freeze({
  0:  { en: 'Heating',                    de: 'Heizbetrieb',                 nl: 'Verwarmen' },                  // heating
  1:  { en: 'No Request',                 de: 'Keine Anforderung',           nl: 'Geen warmtevraag' },           // no_request
  2:  { en: 'Grid Startup Delay',         de: 'Netz Einschaltverzögerung',   nl: 'Netinschakelvertraging' },     // grid_switch_on_delay
  3:  { en: 'Switching Cycle Time',       de: 'Schaltspielzeit',             nl: 'Schakelspeltijd' },            // cycle_lock
  4:  { en: 'EVU Lock',                   de: 'EVU Sperrzeit',               nl: 'EVU-blokkering' },             // lock_time
  5:  { en: 'Hot Water',                  de: 'Brauchwasser',                nl: 'Warmwater' },                  // domestic_water
  // 6 (Estrichprogramm / info_bake_out_program) trägt einen dynamischen
  // Suffix "Stufe X - Y °C" und wird im Device gesondert zusammengesetzt.
  6:  { en: 'Screed Program',             de: 'Estrich Programm',            nl: 'Dekvloerprogramma' },          // info_bake_out_program
  // 7 (Abtauen / defrost) wird über DEFROST_VARIANTS weiter aufgeschlüsselt.
  7:  { en: 'Defrost',                    de: 'Abtauen',                     nl: 'Ontdooien' },                  // defrost
  8:  { en: 'Pump Pre-run',               de: 'Pumpenvorlauf',               nl: 'Pompvoorloop' },               // pump_forerun
  9:  { en: 'Thermal Disinfection',       de: 'Thermische Desinfektion',     nl: 'Thermische desinfectie' },     // thermal_desinfection
  10: { en: 'Cooling',                    de: 'Kühlbetrieb',                 nl: 'Koelen' },                     // cooling
  12: { en: 'Pool / Photovoltaic',        de: 'Schwimmbad / Photovoltaik',   nl: 'Zwembad / Fotovoltaïsch' },    // swimming_pool_solar
  13: { en: 'External Heating',           de: 'Heizen Ext.',                 nl: 'Externe verwarming' },         // heating_external_energy_source
  14: { en: 'External Hot Water',         de: 'Brauchwasser Ext.',           nl: 'Extern warmwater' },           // domestic_water_external_energy_source
  // 15 und 18 kennt weder die Bibliothek noch die Integration; die Texte
  // stammen aus der App und bleiben unverändert.
  15: { en: 'Operating Limit',            de: 'Einsatzgrenze / Sperre',      nl: 'Bedrijfsgrens / blokkering' },
  16: { en: 'Flow Monitoring',            de: 'Durchflussüberwachung',       nl: 'Doorstroombewaking' },         // flow_monitoring
  17: { en: 'Electric Auxiliary Heating', de: 'Elektrische Zusatzheizung',   nl: 'Elektrische bijverwarming' },  // second_heat_generator_1_active
  18: { en: 'Compressor Heating Up',      de: 'Verdichter heizt auf',        nl: 'Compressor warmt op' },
  19: { en: 'DHW Reheating',              de: 'Warmwasser Nachheizung',      nl: 'Warmwater naverwarming' },
});

// Untertypen des Abtauens (Code 7). Die Bibliothek leitet sie aus dem
// Abtauventil, dem Verdichter und dem Wärmequellenmotor ab; hier wird dieselbe
// Unterscheidung getroffen, aber aus den Rohregistern statt aus dem
// zusammengeklebten String.
const DEFROST_VARIANTS = Object.freeze({
  cycle_reversal: { en: 'Defrost (Reverse Cycle)', de: 'Abtauen (Kreisumkehr)', nl: 'Ontdooien (kringomkering)' },
  air:            { en: 'Air Defrost',             de: 'Luftabtauen',           nl: 'Luchtontdooiing' },
  plain:          { en: 'Defrost',                 de: 'Abtauen',               nl: 'Ontdooien' },
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

/** Kann dieser Mischkreis kühlen? */
function mixerCanCool(type) {
  return type === MIXER_CIRCUIT_TYPES.cooling || type === MIXER_CIRCUIT_TYPES.heating_cooling;
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
 * Anlass: Auf manchen Reglern liefert P0001 gelesen die Nachtabsenkung statt
 * der Korrektur vom Startbildschirm. Ändert man dort etwas am Bedienteil, zeigt
 * diese Zeile, welches Register es tatsächlich trifft — und nach einem
 * Schreibvorgang der App, was der Regler daraus gemacht hat.
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

module.exports = {
  SWITCHOFF_REASONS,
  switchoffReason,
  newestEntry,
  EXTENDED_STATES,
  DEFROST_VARIANTS,
  extendedState,
  defrostVariant,
  defrostState,
  MIXER_CIRCUIT_TYPES,
  mixerCanCool,
  ROOM_UNIT_TYPES,
  HEATING_CONTROL_MODES,
  controllerConfig,
  PARAMETER_NAMES,
  parameterLabel,
  parameterChanges,
};
