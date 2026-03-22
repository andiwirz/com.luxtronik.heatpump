'use strict';

const { Device } = require('homey');
const luxtronik = require('luxtronik2');

// Betriebsmodus-Bezeichnungen
const OPERATION_MODE_LABELS = {
  0: 'Automatic',
  1: 'Second Heat Source',
  2: 'Party',
  3: 'Holidays',
  4: 'Off',
};

// Wärmepumpen-Status aus heatpump_state1
const HEATPUMP_STATE_MAP = {
  0:  'off',
  1:  'heating',
  2:  'hotwater',
  3:  'swimming',
  4:  'provider_lock',
  5:  'defrost',
  6:  'standby',
  7:  'external',
  8:  'cooling',
};

class LuxtronikHeatpumpDevice extends Device {

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async onInit() {
    this.log('LuxtronikHeatpumpDevice init:', this.getName());

    // ── Capability-Migration: alte Namen → neue Namen ────────────────────────
    const CAPABILITY_RENAMES = {
      'luxtronik_temp_outdoor':         'measure_temp_outdoor',
      'luxtronik_temp_outdoor_avg':     'measure_temp_outdoor_avg',
      'luxtronik_temp_flow':            'measure_temp_flow',
      'luxtronik_temp_return':          'measure_temp_return',
      'luxtronik_temp_return_target':   'measure_temp_return_target',
      'luxtronik_temp_hotgas':          'measure_temp_hotgas',
      'luxtronik_temp_hotwater':        'measure_temp_hotwater',
      'luxtronik_temp_hotwater_target': 'measure_temp_hotwater_target',
      'luxtronik_temp_source_in':       'measure_temp_source_in',
      'luxtronik_temp_source_out':      'measure_temp_source_out',
      'luxtronik_temp_suction_air':     'measure_temp_suction_air',
      'luxtronik_temp_room':            'measure_temp_room',
      'luxtronik_temp_room_target':     'measure_temp_room_target',
      'luxtronik_energy_heating':       'meter_energy_heating',
      'luxtronik_energy_hotwater':      'meter_energy_hotwater',
      'luxtronik_energy_total':         'meter_energy_total',
      'luxtronik_hours_compressor':     'measure_hours_compressor',
      'luxtronik_hours_heating':        'measure_hours_heating',
      'luxtronik_hours_hotwater':       'measure_hours_hotwater',
      'luxtronik_volume_flow':          'measure_volume_flow',
      'alarm_generic.error':            'alarm_generic',
    };

    for (const [oldCap, newCap] of Object.entries(CAPABILITY_RENAMES)) {
      if (this.hasCapability(oldCap)) {
        this.log(`Migriere Capability: ${oldCap} -> ${newCap}`);
        try {
          if (!this.hasCapability(newCap)) {
            await this.addCapability(newCap);
          }
          await this.removeCapability(oldCap);
        } catch (e) {
          this.error(`Migration fehlgeschlagen (${oldCap} -> ${newCap}):`, e.message);
        }
      }
    }
    // ── Neue Capabilities hinzufügen falls noch nicht vorhanden ─────────────────
    const NEW_CAPABILITIES = ['hotwater_boost'];
    for (const cap of NEW_CAPABILITIES) {
      if (!this.hasCapability(cap)) {
        this.log(`Füge neue Capability hinzu: ${cap}`);
        try { await this.addCapability(cap); }
        catch (e) { this.error(`Capability ${cap} konnte nicht hinzugefügt werden:`, e.message); }
      }
    }
    // ── Ende Migration ────────────────────────────────────────────────────────

    const s = this.getSettings();
    this._ip           = s.ip;
    this._port         = Number(s.port) || 8889;
    this._pollInterval = (Number(s.poll_interval) || 60) * 1000;
    this._pump         = null;
    this._timer        = null;
    this._lastState    = null;
    this._lastHeatingMode   = null;
    this._lastWarmwaterMode = null;
    // Timestamp map: nach einem Write diese Capability für 2 Polls nicht überschreiben
    this._writeProtectUntil = {};
    // Schnelladungs-Timer
    this._boostTimer = null;

    // Flow-Trigger
    this._triggerHeatingModeChanged  = this.homey.flow.getDeviceTriggerCard('heating_operation_mode_changed');
    this._triggerWarmwaterModeChanged = this.homey.flow.getDeviceTriggerCard('warmwater_operation_mode_changed');
    this._triggerStateChanged         = this.homey.flow.getDeviceTriggerCard('heatpump_state_changed');
    this._triggerErrorOccurred        = this.homey.flow.getDeviceTriggerCard('error_occurred');
    this._triggerBoostEnded           = this.homey.flow.getDeviceTriggerCard('hotwater_boost_ended');

    // Flow-Bedingungen
    this.homey.flow.getConditionCard('heating_operation_mode_is')
      .registerRunListener((args) => String(this.getCapabilityValue('heating_operation_mode')) === String(args.mode));

    this.homey.flow.getConditionCard('warmwater_operation_mode_is')
      .registerRunListener((args) => String(this.getCapabilityValue('warmwater_operation_mode')) === String(args.mode));

    this.homey.flow.getConditionCard('heatpump_state_is')
      .registerRunListener((args) => this.getCapabilityValue('heatpump_state') === args.state);

    // Flow-Aktionen
    this.homey.flow.getActionCard('set_heating_operation_mode')
      .registerRunListener(async (args) => this._setHeatingOperationMode(parseInt(args.mode, 10)));

    this.homey.flow.getActionCard('set_warmwater_operation_mode')
      .registerRunListener(async (args) => this._setWarmwaterOperationMode(parseInt(args.mode, 10)));

    this.homey.flow.getActionCard('set_heating_temperature_correction')
      .registerRunListener(async (args) => this._setHeatingTemperatureCorrection(parseFloat(args.value)));

    this.homey.flow.getActionCard('set_warmwater_target_temperature')
      .registerRunListener(async (args) => this._setWarmwaterTargetTemperature(parseFloat(args.value)));

    this.homey.flow.getActionCard('start_hotwater_boost')
      .registerRunListener(async (args) => this._startHotwaterBoost(parseInt(args.duration, 10)));

    this.homey.flow.getActionCard('stop_hotwater_boost')
      .registerRunListener(async () => this._stopHotwaterBoost());

    // Capability-Listener (UI)
    this.registerCapabilityListener('heating_operation_mode',        async (v) => this._setHeatingOperationMode(parseInt(v, 10)));
    this.registerCapabilityListener('warmwater_operation_mode',       async (v) => this._setWarmwaterOperationMode(parseInt(v, 10)));
    this.registerCapabilityListener('heating_temperature_correction', async (v) => this._setHeatingTemperatureCorrection(parseFloat(v)));
    this.registerCapabilityListener('warmwater_target_temperature',   async (v) => this._setWarmwaterTargetTemperature(parseFloat(v)));
    this.registerCapabilityListener('hotwater_boost',                  async (v) => {
      if (v) {
        const s = this.getSettings();
        await this._startHotwaterBoost(Number(s.hotwater_boost_duration) || 60);
      } else {
        await this._stopHotwaterBoost();
      }
    });

    this._connectPump();
    await this._doPoll();
    this._startPolling();
  }

  async onDeleted() {
    this._stopPolling();
    if (this._boostTimer) { clearTimeout(this._boostTimer); this._boostTimer = null; }
  }

  async onSettings({ newSettings }) {
    this._stopPolling();
    this._ip           = newSettings.ip;
    this._port         = Number(newSettings.port) || 8889;
    this._pollInterval = (Number(newSettings.poll_interval) || 60) * 1000;
    this._connectPump();
    await this._doPoll();
    this._startPolling();
  }

  // ─── Verbindung ────────────────────────────────────────────────────────────

  _connectPump() {
    try {
      this._pump = new luxtronik.createConnection(this._ip, this._port);
      this.log(`Verbunden mit ${this._ip}:${this._port}`);
    } catch (err) {
      this.error('Verbindung fehlgeschlagen:', err.message);
      this._pump = null;
    }
  }

  // ─── Polling ───────────────────────────────────────────────────────────────

  _startPolling() {
    this._stopPolling();
    this._timer = setInterval(() => this._doPoll(), this._pollInterval);
  }

  _stopPolling() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  async _doPoll() {
    if (!this._pump) { this._connectPump(); if (!this._pump) return; }

    return new Promise((resolve) => {
      this._pump.read((err, data) => {
        if (err) {
          this.error('Poll-Fehler:', err.message || err);
          this.setUnavailable(err.message || 'Verbindungsfehler').catch(() => {});
          resolve();
          return;
        }
        this.setAvailable().catch(() => {});
        this._processData(data).then(resolve).catch((e) => {
          this.error('Fehler bei Datenverarbeitung:', e.message);
          resolve();
        });
      });
    });
  }

  // ─── Datenverarbeitung ─────────────────────────────────────────────────────
  //
  // Echte Feldnamen des luxtronik2 npm-Pakets (snake_case):
  //   data.values.*       → Berechnete Werte / Sensoren
  //   data.parameters.*   → Einstellbare Parameter

  async _processData(data) {
    const v = data.values     || {};
    const p = data.parameters || {};

    // Debug: vollständige Daten einmalig loggen
    if (!this._dataDumped) {
      this.log('=== Luxtronik Daten (Erstabfrage) ===');
      this.log('values:', JSON.stringify(v, null, 2));
      this.log('parameters:', JSON.stringify(p, null, 2));
      this._dataDumped = true;
    }

    // ── Temperaturen (data.values) ───────────────────────────────────────────
    await this._setIfValid('measure_temp_outdoor',      this._n(v.temperature_outside));
    await this._setIfValid('measure_temp_outdoor_avg',  this._n(v.temperature_outside_avg));
    await this._setIfValid('measure_temp_flow',         this._n(v.temperature_supply));
    await this._setIfValid('measure_temp_return',       this._n(v.temperature_return));
    await this._setIfValid('measure_temp_return_target',this._n(v.temperature_target_return));
    await this._setIfValid('measure_temp_hotgas',       this._n(v.temperature_hot_gas));
    await this._setIfValid('measure_temp_hotwater',     this._n(v.temperature_hot_water));
    await this._setIfValid('measure_temp_hotwater_target', this._n(v.temperature_hot_water_target));
    await this._setIfValid('measure_temp_source_in',    this._n(v.temperature_heat_source_in));
    await this._setIfValid('measure_temp_source_out',   this._n(v.temperature_heat_source_out));
    // Ansaugluft / Zuluft (Luft-WP)
    await this._setIfValid('measure_temp_suction_air',  this._n(v.Temp_Lueftung_Zuluft));
    // Raumtemperatur (nur mit RBE-Raumdisplay — Capability nur anzeigen wenn Wert > 0)
    const roomTemp       = this._n(v.Temperatur_RFV);
    const roomTempTarget = this._n(v.Temperatur_RFV2);
    await this._setCapabilityConditional('measure_temp_room',        roomTemp,       roomTemp !== null && roomTemp > 0);
    await this._setCapabilityConditional('measure_temp_room_target', roomTempTarget, roomTempTarget !== null && roomTempTarget > 0);

    // ── Volumenstrom ─────────────────────────────────────────────────────────
    // Durchfluss_WQ in l/min → Homey in l/h, oder flowRate direkt
    const flowRaw = v.Durchfluss_WQ;
    if (flowRaw !== undefined && flowRaw !== 'no') {
      // Einheit prüfen: luxtronik2 liefert l/min (×60 = l/h)
      await this._setIfValid('measure_volume_flow', this._n(flowRaw) * 60);
    } else if (v.flowRate !== undefined && v.flowRate !== 'no') {
      await this._setIfValid('measure_volume_flow', this._n(v.flowRate) * 60);
    }

    // ── Energie (kWh) ────────────────────────────────────────────────────────
    await this._setIfValid('meter_energy_heating',  this._n(v.thermalenergy_heating));
    await this._setIfValid('meter_energy_hotwater', this._n(v.thermalenergy_warmwater));
    await this._setIfValid('meter_energy_total',    this._n(v.thermalenergy_total));

    // ── Betriebsstunden ──────────────────────────────────────────────────────
    // luxtronik2 liefert Stunden direkt als Zahl
    await this._setIfValid('measure_hours_compressor', this._n(v.hours_compressor1));
    await this._setIfValid('measure_hours_heating',    this._n(v.hours_heating));
    await this._setIfValid('measure_hours_hotwater',   this._n(v.hours_warmwater));

    // ── Wärmepumpen-Status ───────────────────────────────────────────────────
    const rawState  = v.heatpump_state1;
    const stateSlug = HEATPUMP_STATE_MAP[rawState] ?? 'unknown';
    if (stateSlug !== this._lastState) {
      await this._setIfValid('heatpump_state', stateSlug);
      if (this._lastState !== null) {
        await this._triggerStateChanged.trigger(this, { state: stateSlug }).catch(() => {});
      }
      this._lastState = stateSlug;
    }

    // ── Fehler ───────────────────────────────────────────────────────────────
    const hasError = Array.isArray(v.errors) && v.errors.length > 0;
    await this._setIfValid('alarm_generic', hasError);
    if (hasError) {
      const msg = v.errors.map((e) => (typeof e === 'object' ? JSON.stringify(e) : String(e))).join(', ');
      await this._triggerErrorOccurred.trigger(this, { error: msg }).catch(() => {});
    }

    // ── Betriebsmodus aus data.parameters ────────────────────────────────────
    const heatingMode = this._int(p.heating_operation_mode);
    if (heatingMode !== null) {
      const modeStr = String(heatingMode);
      await this._setIfValid('heating_operation_mode', modeStr);
      if (this._lastHeatingMode !== null && this._lastHeatingMode !== modeStr) {
        await this._triggerHeatingModeChanged.trigger(this, { mode: OPERATION_MODE_LABELS[heatingMode] ?? modeStr }).catch(() => {});
      }
      this._lastHeatingMode = modeStr;
    }

    const warmwaterMode = this._int(p.warmwater_operation_mode);
    if (warmwaterMode !== null) {
      const modeStr = String(warmwaterMode);
      await this._setIfValid('warmwater_operation_mode', modeStr);
      if (this._lastWarmwaterMode !== null && this._lastWarmwaterMode !== modeStr) {
        await this._triggerWarmwaterModeChanged.trigger(this, { mode: OPERATION_MODE_LABELS[warmwaterMode] ?? modeStr }).catch(() => {});
      }
      this._lastWarmwaterMode = modeStr;
    }

    // Heizungs-Temperaturkorrektur: p.heating_temperature (lesen), schreiben mit 'heating_target_temperature'
    await this._setIfValid('heating_temperature_correction', this._n(p.heating_temperature));

    // Brauchwasser-Solltemperatur: p.warmwater_temperature oder p.temperature_hot_water_target
    const wwTarget = p.warmwater_temperature ?? p.temperature_hot_water_target;
    await this._setIfValid('warmwater_target_temperature', this._n(wwTarget));
  }

  // ─── Setzer ────────────────────────────────────────────────────────────────

  async _setHeatingOperationMode(mode) {
    if (mode < 0 || mode > 4) throw new Error(`Ungültiger Heizungs-Modus: ${mode}`);
    await this._write('heating_operation_mode', mode);
    await this.setCapabilityValue('heating_operation_mode', String(mode));
    await this._triggerHeatingModeChanged.trigger(this, { mode: OPERATION_MODE_LABELS[mode] ?? String(mode) }).catch(() => {});
  }

  async _setWarmwaterOperationMode(mode) {
    if (mode < 0 || mode > 4) throw new Error(`Ungültiger Brauchwasser-Modus: ${mode}`);
    await this._write('warmwater_operation_mode', mode);
    await this.setCapabilityValue('warmwater_operation_mode', String(mode));
    await this._triggerWarmwaterModeChanged.trigger(this, { mode: OPERATION_MODE_LABELS[mode] ?? String(mode) }).catch(() => {});
  }

  async _setHeatingTemperatureCorrection(value) {
    const clamped = Math.min(5, Math.max(-5, Math.round(value * 2) / 2));
    this.log(`Setze Heizungs-Temperaturkorrektur: ${clamped} °C`);
    this._setWriteProtect('heating_temperature_correction', 120000);
    await this._write('heating_target_temperature', clamped);
    await this.setCapabilityValue('heating_temperature_correction', clamped);
  }

  async _setWarmwaterTargetTemperature(value) {
    const clamped = Math.min(65, Math.max(30, value));
    this.log(`Setze Brauchwasser Soll-Temperatur: ${clamped} °C`);
    // Sofort UI-Wert setzen, dann Write-Schutz, dann senden
    await this.setCapabilityValue('warmwater_target_temperature', clamped);
    this._setWriteProtect('warmwater_target_temperature', 120000);
    await this._write('warmwater_target_temperature', clamped);
    this.log(`Brauchwasser Soll-Temperatur erfolgreich gesendet: ${clamped} °C`);
  }

  // ─── Schnelladung ─────────────────────────────────────────────────────────────

  async _startHotwaterBoost(durationMinutes) {
    const duration = Math.min(480, Math.max(5, durationMinutes || 60));
    this.log(`Schnelladung starten: ${duration} Minuten`);

    // Laufenden Boost-Timer canceln falls aktiv
    if (this._boostTimer) {
      clearTimeout(this._boostTimer);
      this._boostTimer = null;
    }

    // Party-Modus setzen
    await this._setWarmwaterOperationMode(2);
    await this.setCapabilityValue('hotwater_boost', true);

    // Auto-Reset nach konfigurierbarer Zeit
    this._boostTimer = setTimeout(async () => {
      this.log(`Schnelladung beendet (${duration} min), schalte zurück auf Automatik`);
      this._boostTimer = null;
      await this._setWarmwaterOperationMode(0).catch((e) => this.error('Boost-Reset fehlgeschlagen:', e.message));
      await this.setCapabilityValue('hotwater_boost', false).catch(() => {});
      await this._triggerBoostEnded.trigger(this, {}).catch(() => {});
    }, duration * 60 * 1000);
  }

  async _stopHotwaterBoost() {
    this.log('Schnelladung manuell gestoppt');
    if (this._boostTimer) {
      clearTimeout(this._boostTimer);
      this._boostTimer = null;
    }
    await this._setWarmwaterOperationMode(0);
    await this.setCapabilityValue('hotwater_boost', false);
  }

  // ─── Low-level Write ───────────────────────────────────────────────────────

  _write(parameter, value) {
    return new Promise((resolve, reject) => {
      if (!this._pump) { reject(new Error('Nicht verbunden')); return; }

      // Polling stoppen damit keine konkurrierende TCP-Verbindung offen ist
      this._stopPolling();
      this.log(`_write: ${parameter} = ${value} (Polling pausiert)`);

      // Kurz warten bis eine laufende Poll-Verbindung geschlossen ist
      setTimeout(() => {
        this._pump.write(parameter, value, (err, res) => {
          // Polling nach dem Write immer neu starten
          this._startPolling();

          if (err) {
            const msg = (err && err.message) ? err.message : String(err);
            this.error(`Write-Fehler (${parameter}=${value}): ${msg}`);
            reject(new Error(msg));
          } else {
            this.log(`Write OK: ${parameter}=${value}`, JSON.stringify(res));
            resolve(res);
          }
        });
      }, 1500);
    });
  }

  // ─── Hilfsfunktionen ───────────────────────────────────────────────────────

  async _setCapabilityConditional(capability, value, condition) {
    if (condition) {
      // Wert vorhanden → Capability hinzufügen falls noch nicht da, dann setzen
      if (!this.hasCapability(capability)) {
        this.log(`Aktiviere Capability (Wert vorhanden): ${capability}`);
        try { await this.addCapability(capability); }
        catch (e) { this.error(`addCapability ${capability} fehlgeschlagen:`, e.message); return; }
      }
      await this._setIfValid(capability, value);
    } else {
      // Kein gültiger Wert → Capability entfernen falls vorhanden
      if (this.hasCapability(capability)) {
        this.log(`Deaktiviere Capability (kein Wert): ${capability}`);
        try { await this.removeCapability(capability); }
        catch (e) { this.error(`removeCapability ${capability} fehlgeschlagen:`, e.message); }
      }
    }
  }

  async _setIfValid(capability, value) {
    if (value === null || value === undefined || value === 'no' || Number.isNaN(value)) return;
    if (!this.hasCapability(capability)) return;
    // Write-Schutz: nach einem manuellen Schreiben kurz nicht überschreiben
    if (this._writeProtectUntil[capability] && Date.now() < this._writeProtectUntil[capability]) return;
    try { await this.setCapabilityValue(capability, value); }
    catch (e) { this.error(`Fehler beim Setzen von ${capability}:`, e.message); }
  }

  _setWriteProtect(capability, ms = 120000) {
    this._writeProtectUntil[capability] = Date.now() + ms;
  }

  _n(val) {
    if (val === null || val === undefined || val === 'no') return null;
    const n = parseFloat(val);
    return Number.isNaN(n) ? null : n;
  }

  _int(val) {
    if (val === null || val === undefined) return null;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? null : n;
  }
}

module.exports = LuxtronikHeatpumpDevice;
