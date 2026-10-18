'use strict';

// Schreiben mit Zurücklesen. Die Quittung des Reglers wiederholt nur die
// Parameternummer, nie den Wert, und einen Wert ausserhalb seines Bereichs
// verwirft er ohne Fehlermeldung. Vorher meldete eine Flow-Aktion dann Erfolg,
// die Kachel zeigte dank Schreibschutz zwei Minuten den neuen Wert und sprang
// danach kommentarlos zurück.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, extractMethod } = require('./helpers');
const {
  readBack, writeLogLine, faultyReading, hotWaterMaximum, clampHotWaterTarget, hotWaterTargetParameter,
  hotWaterDialMaximum,
} = require('../lib/luxtronik-codes');
const { PARAMETERS } = require('../lib/luxtronik-registers');

const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const device = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/device.js'), 'utf8');

const methods = {
  ...extractMethod('_write'),
  ...extractMethod('_writeChecked'),
  ...extractMethod('_writeAndReadBack', undefined, { readBack }),
  ...extractMethod('_recordWrite', undefined, { writeLogLine }),
  ...extractMethod('_notAccepted'),
};

// Gerät mit nachgebautem Regler: Er hält für P47 erst 650 und meldet nach dem
// Schreiben `held`, also den geschriebenen Wert oder weiter den alten. `held`
// als Error lässt das Zurücklesen scheitern.
function makeDevice(held) {
  const settings = {};
  const calls = [];
  const dev = {
    ...methods,
    calls,
    settings,
    _writeQueue: Promise.resolve(),
    _writeProtectUntil: { tdi_target_temperature: Date.now() + 120000 },
    _rawParameters: Object.assign([], { 47: 650 }),
    _writeNow: async (parameter, value) => ({ msg: 'write ok', echo: parameter, parameter, value }),
    _readParameters: async () => {
      if (held instanceof Error) throw held;
      return Object.assign([], { 47: held });
    },
    _sleep: async () => {},
    _startPolling: () => calls.push('startPolling'),
    _schedulePollAfterWrite: () => calls.push('schedulePoll'),
    log: () => {},
    error: () => {},
    getName: () => 'Wärmepumpe',
    homey: {
      __: (key, tags) => `${key} ${JSON.stringify(tags)}`,
      settings: { get: (key) => settings[key], set: (key, value) => { settings[key] = value; } },
    },
  };
  return dev;
}

test('eine Flow-Aktion scheitert, wenn der Regler den Wert verwirft', async () => {
  const dev = makeDevice(650);
  await assert.rejects(dev._write(47, 750), (e) => e.notAccepted === true && /errors\.not_accepted .*47/.test(e.message));
  // Der Schreibschutz ist weg: Die nächste Abfrage zeigt wieder den echten Wert.
  assert.deepStrictEqual(dev._writeProtectUntil, {});
  assert.deepStrictEqual(dev.calls, ['startPolling', 'schedulePoll'], 'Polling läuft nach dem Zurücklesen wieder');
  const [entry] = dev.settings.luxtronik_writes;
  assert.deepStrictEqual(
    [entry.parameter, entry.before, entry.sent, entry.actual, entry.accepted, entry.device],
    [47, 650, 750, 650, false, 'Wärmepumpe'],
  );
});

test('ein übernommener Wert kommt durch, der Schreibschutz bleibt', async () => {
  const dev = makeDevice(750);
  const result = await dev._write(47, 750);
  assert.deepStrictEqual([result.parameter, result.value, result.accepted], [47, 750, true]);
  assert.ok(dev._writeProtectUntil.tdi_target_temperature);
  assert.strictEqual(dev.settings.luxtronik_writes[0].accepted, true);
});

test('scheitert nur das Zurücklesen, gilt der Schreibvorgang nicht als gescheitert', async () => {
  // Geschrieben ist geschrieben, nur die Kontrolle fehlt.
  const dev = makeDevice(new Error('heatpump busy'));
  const result = await dev._write(47, 750);
  assert.strictEqual(result.accepted, null);
  assert.strictEqual(dev.settings.luxtronik_writes[0].accepted, null);
  assert.deepStrictEqual(dev.calls, ['startPolling', 'schedulePoll']);
});

test('ein gescheiterter Schreibvorgang startet das Polling trotzdem wieder', async () => {
  const dev = makeDevice(750);
  dev._writeNow = async () => { throw new Error('Write-Timeout'); };
  await assert.rejects(dev._write(47, 750), /Write-Timeout/);
  assert.deepStrictEqual(dev.calls, ['startPolling', 'schedulePoll']);
  // Die Warteschlange bricht nicht ab.
  dev._writeNow = async (parameter, value) => ({ parameter, value });
  assert.strictEqual((await dev._write(47, 750)).accepted, true);
});

test('das Protokoll behält die letzten 20 Schreibvorgänge, neueste zuerst', async () => {
  const dev = makeDevice(750);
  for (let i = 0; i < 22; i++) await dev._write(47, 750);
  dev._readParameters = async () => Object.assign([], { 47: 760 });
  await dev._write(47, 760);
  assert.strictEqual(dev.settings.luxtronik_writes.length, 20);
  assert.strictEqual(dev.settings.luxtronik_writes[0].sent, 760);
});

test('das Warmwasser-Soll geht in das Register, das die Firmware auswertet', async () => {
  // Bis x.88.2 wertet der Regler P0002 aus, ab x.88.3 P0105. Vorher schrieb
  // die App immer beide und galt als erfolgreich, sobald eines den Wert hielt —
  // auch wenn es das war, das der Regler gar nicht beachtet. Auf alter Firmware
  // kommt P0105 dazu, der Wunschwert, zu dem der Regler P0002 nach einer
  // Absenkung zurückführt; ob die Aktion gelingt, entscheidet dort P0002.
  const setter = {
    ...extractMethod('_setWarmwaterTargetTemperature', undefined,
      { hotWaterMaximum, clampHotWaterTarget, hotWaterTargetParameter, PARAMETERS }),
    ...extractMethod('_setWriteProtect'),
  };
  const INDEX = { warmwater_target_temperature: 2, temperature_hot_water_target: 105 };
  // Nachgebauter Regler mit beiden Registern auf 48 °C und `maximum` in P0973.
  // Einen höheren Wert setzt er wie der echte auf die Grenze herab. Register in
  // `rejects` behalten ihren Wert, bei denen in `fails` scheitert schon das Schreiben.
  const make = (firmware, { maximum = 600, rejects = [], fails = [] } = {}) => {
    const registers = { 2: 480, 105: 480, 973: maximum };
    const dev = {
      ...makeDevice(0),
      ...setter,
      registers,
      written: [],
      shown: [],
      _writeProtectUntil: {},
      _rawParameters: Object.assign([], registers),
      getCapabilityValue: (id) => (id === 'firmware_version' ? firmware : null),
      setCapabilityValue: async (id, value) => { dev.shown.push(value); },
      _writeNow: async (name, value) => {
        const index = INDEX[name];
        dev.written.push(index);
        if (fails.includes(index)) throw new Error('Write-Timeout');
        const raw = Math.round(value * 10);
        if (!rejects.includes(index)) registers[index] = maximum > 0 ? Math.min(raw, maximum) : raw;
        return { parameter: index, value: raw };
      },
      _readParameters: async () => Object.assign([], registers),
    };
    return dev;
  };

  for (const [firmware, written] of [['V3.79', [2, 105]], ['V2.88.2', [2, 105]], ['V2.88.3', [105]], ['V1.89.0', [105]], [null, [105]]]) {
    const dev = make(firmware);
    await dev._setWarmwaterTargetTemperature(50);
    assert.deepStrictEqual(dev.written, written, String(firmware));
    assert.deepStrictEqual([dev.registers[2], dev.registers[105]], [written.includes(2) ? 500 : 480, 500], String(firmware));
    assert.ok(dev._writeProtectUntil.target_temperature > Date.now(), 'die nächste Abfrage zeigt nicht den alten Wert');
  }

  // "Max. WW-Temp." 55 °C: Der Regler machte aus 60 °C selbst 55 °C, und das
  // Zurücklesen meldete "nicht übernommen".
  const capped = make('V1.89.0', { maximum: 550 });
  await capped._setWarmwaterTargetTemperature(60);
  assert.deepStrictEqual([capped.registers[105], capped.shown], [550, [55]]);
  assert.ok(!(capped._writeProtectUntil.target_temperature > Date.now()), 'die nächste Abfrage zeigt den begrenzten Wert');
  // Ohne P0973 (ältere Firmware, oder 0) gelten nur die 30–65 °C.
  const open = make('V1.89.0', { maximum: 0 });
  await open._setWarmwaterTargetTemperature(60);
  assert.strictEqual(open.registers[105], 600);

  // Verwirft der Regler das ausgewertete Register, scheitert die Aktion und nennt es.
  await assert.rejects(make('V3.79', { rejects: [2, 105] })._setWarmwaterTargetTemperature(50), (e) => e.notAccepted && /"parameter":2\b/.test(e.message));
  await assert.rejects(make('V1.89.0', { rejects: [105] })._setWarmwaterTargetTemperature(50), (e) => e.notAccepted && /"parameter":105\b/.test(e.message));
  // Am Wunschwert P0105 allein scheitert sie auf alter Firmware nicht.
  await make('V3.79', { rejects: [105] })._setWarmwaterTargetTemperature(50);
  await make('V3.79', { fails: [105] })._setWarmwaterTargetTemperature(50);
});

test('der Drehregler des Warmwasser-Thermostats endet bei der "Max. WW-Temp."', async () => {
  // Bei einer LWC mit V1.89.0 bot er bis 65 °C an, der Regler hielt höchstens 52 °C.
  const { _syncHotWaterDial } = extractMethod('_syncHotWaterDial', undefined, { hotWaterDialMaximum, hotWaterMaximum });
  const DEFAULTS = { min: 30, max: 65, step: 0.5, title: { en: 'Hot Water Setpoint' }, preventInsights: true, preventTag: true };
  const make = (options) => {
    const dev = {
      _syncHotWaterDial,
      _hotWaterDialMax: undefined,
      _rawParameters: Object.assign([], { 973: 520 }),
      options,
      calls: [],
      driver: { id: 'luxtronik-heatpump' },
      homey: { manifest: { drivers: [{ id: 'luxtronik-heatpump', capabilitiesOptions: { target_temperature: DEFAULTS } }] } },
      log: () => {},
      error: () => {},
      getCapabilityOptions: () => dev.options,
      setCapabilityOptions: async (id, opts) => { dev.calls.push([id, opts]); dev.options = opts; },
    };
    return dev;
  };

  // Was das Gerät sonst an Optionen hat, bleibt, auch wenn es vom Treiber abweicht.
  const dev = make({ ...DEFAULTS, step: 1, decimals: 1 });
  await dev._syncHotWaterDial(51);
  assert.deepStrictEqual(dev.calls, [['target_temperature', { ...DEFAULTS, step: 1, decimals: 1, max: 52 }]]);
  // Unverändert: kein weiterer Aufruf, der die Flow-Karten neu aufbaut.
  await dev._syncHotWaterDial(51);
  assert.strictEqual(dev.calls.length, 1);
  // Ein Soll über der Grenze, etwa nach dem Senken der Grenze, bleibt erreichbar.
  await dev._syncHotWaterDial(54);
  assert.strictEqual(dev.calls[1][1].max, 54);
  dev._rawParameters[973] = 550;
  await dev._syncHotWaterDial(51);
  assert.strictEqual(dev.calls[2][1].max, 55);
  // Ohne Parameterliste bleibt alles, wie es ist.
  dev._rawParameters = null;
  await dev._syncHotWaterDial(51);
  assert.strictEqual(dev.calls.length, 3);

  // Liefert getCapabilityOptions() nichts mit, kommen Bereich, Schrittweite und Titel aus dem Treiber.
  const bare = make({});
  await bare._syncHotWaterDial(51);
  assert.deepStrictEqual(bare.calls[0][1], { ...DEFAULTS, max: 52 });
  // Ohne P0973 gilt der volle Bereich, und der gilt schon.
  const full = make({ ...DEFAULTS });
  full._rawParameters = new Array(900).fill(0);
  await full._syncHotWaterDial(51);
  assert.strictEqual(full.calls.length, 0);
  // Ein gescheiterter Aufruf wird nicht bei jeder Abfrage wiederholt.
  const failing = make({ ...DEFAULTS });
  let attempts = 0;
  failing.setCapabilityOptions = async () => { attempts++; throw new Error('Rate-Limit'); };
  await failing._syncHotWaterDial(51);
  await failing._syncHotWaterDial(51);
  assert.strictEqual(attempts, 1);
});

test('der Warmwasser-Thermostat zeigt das Register, das die App schreibt', () => {
  // Die Bibliothek nennt P0002 warmwater_temperature und P0105
  // temperature_hot_water_target. Vertauscht zeigte der Thermostat das
  // Register, das der Regler nicht auswertet; mit einer anderen Firmwarequelle
  // als beim Schreiben könnten Anzeige und Schreiben auseinanderlaufen.
  const src = device.replace(/\r\n/g, '\n');
  assert.match(src, /const ww105 = this\._n\(p\.temperature_hot_water_target\);/);
  assert.match(src, /const ww2\s+= this\._n\(p\.warmwater_temperature\);/);
  assert.match(src, /const wwSetpoint = hotWaterSetpoint\(this\.getCapabilityValue\('firmware_version'\), ww2, ww105\);/);
  assert.match(src, /this\._syncHotWaterDial\(wwSetpoint\)/);
  assert.match(src, /hotWaterTargetParameter\(this\.getCapabilityValue\('firmware_version'\)\)/);
});

test('Geräteeinstellungen melden, was der Regler nicht übernommen hat', async () => {
  // Homey zeigt den Text, den onSettings zurückgibt, als Meldung an. Ohne sie
  // sprang die Einstellung nur nach der nächsten Abfrage zurück.
  const { onSettings } = extractMethod('onSettings');
  const { _settingLabel } = extractMethod('_settingLabel');
  const rejected = Object.assign(new Error('nicht übernommen'), { notAccepted: true });
  const dev = {
    onSettings,
    _settingLabel,
    driver: { id: app.drivers[0].id },
    homey: {
      manifest: app,
      i18n: { getLanguage: () => 'de' },
      __: (key, tags) => `${key}: ${tags.settings}`,
    },
    _firstPollDone: true,
    getCapabilityValue: () => 65,
    hasCapability: () => false,
    _meterPowerActive: () => false,
    _setTdiTargetTemperature: async () => { throw rejected; },
    _setHeatingLimit: async () => {},
    _stopPolling: () => {}, _ensurePump: () => true, _resetPump: () => {},
    _doPoll: async () => {}, _startPolling: () => {}, _startWatchdog: () => {},
    error: () => {}, log: () => {},
  };
  const message = await dev.onSettings({
    newSettings: { ip: '10.0.0.2', port: 8889, poll_interval: 60, tdi_setpoint_setting: 75, heating_limit_setting: 16 },
    changedKeys: ['tdi_setpoint_setting', 'heating_limit_setting'],
  });
  const label = dev._settingLabel('tdi_setpoint_setting');
  assert.notStrictEqual(label, 'tdi_setpoint_setting', 'Beschriftung aus dem Manifest');
  assert.strictEqual(message, `errors.settings_not_accepted: ${label}`);
  // Ohne verworfene Werte keine Meldung.
  dev._setTdiTargetTemperature = async () => {};
  assert.strictEqual(await dev.onSettings({
    newSettings: { ip: '10.0.0.2', port: 8889, poll_interval: 60, tdi_setpoint_setting: 65 },
    changedKeys: ['tdi_setpoint_setting'],
  }), undefined);
});

test('das Zurücklesen wartet eine laufende Abfrage ab und belegt die Verbindung', async () => {
  // Der Regler verträgt nur eine Verbindung. Läuft noch ein Poll, etwa der
  // Bestätigungs-Poll eines vorigen Schreibvorgangs, wartet das Zurücklesen;
  // solange es selbst liest, überspringt ein Poll seinen Durchgang.
  const { _readParameters } = extractMethod('_readParameters', undefined, { faultyReading });
  const events = [];
  const dev = {
    _readParameters,
    _polling: true,
    _pollTimeoutSec: () => 30,
    _ensurePump: () => true,
    _guardSocket: () => {},
    _resetPump: () => {},
    _sleep: async () => { events.push('wartet'); dev._polling = false; },
    _pump: {
      readRaw: (callback) => {
        events.push(`liest, Verbindung belegt: ${dev._polling}`);
        callback(null, { values: '[215,0,3]', parameters: '[0,25,3]' });
      },
    },
  };
  const parameters = await dev._readParameters();
  assert.deepStrictEqual(parameters, [0, 25, 3]);
  assert.deepStrictEqual(events, ['wartet', 'liest, Verbindung belegt: true']);
  assert.strictEqual(dev._polling, false, 'Verbindung danach wieder frei');
  assert.deepStrictEqual(dev._rawParameters, [0, 25, 3], 'neuester Stand, auch fürs nächste Protokoll');

  // Ein Lesefehler gibt die Verbindung ebenso frei.
  dev._pump.readRaw = (callback) => callback(new Error('heatpump busy'));
  await assert.rejects(dev._readParameters(), /heatpump busy/);
  assert.strictEqual(dev._polling, false);

  // Eine Abfrage aus lauter Nullen beweist nichts und zählt wie ein
  // Lesefehler: Sonst gälte jeder geschriebene Wert als nicht übernommen.
  dev._pump.readRaw = (callback) => callback(null, { values: '[0,0,0]', parameters: '[0,0,0]' });
  await assert.rejects(dev._readParameters(), /Abfrage verworfen/);
  assert.strictEqual(dev._polling, false);
});

test('kein Schreibvorgang geht am Zurücklesen vorbei', () => {
  // _writeNow schickt den Wert nur ab. Riefe ihn noch etwas anderes auf als
  // _writeAndReadBack, liefe dieser Weg wieder ohne Kontrolle.
  const calls = device.match(/this\._writeNow\(/g) || [];
  assert.strictEqual(calls.length, 1, '_writeNow() ausserhalb von _writeAndReadBack()');
  assert.match(String(methods._writeAndReadBack), /this\._writeNow\(/);
  assert.match(String(methods._writeAndReadBack), /readBack\(/);
  assert.match(String(methods._writeChecked), /this\._writeAndReadBack\(/);
  assert.match(String(methods._write), /this\._writeChecked\(/);
});
