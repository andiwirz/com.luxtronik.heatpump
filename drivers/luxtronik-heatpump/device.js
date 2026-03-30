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

// heatpump_state3 = Extended State (Detailstatus der Wärmepumpe)
// Quelle: luxtronik2/types.js → extendetStateMessages
const HEATPUMP_STATE_MAP = {
  0:  'heating',        // Heizbetrieb
  1:  'standby',        // Keine Anforderung
  2:  'standby',        // Netz Einschaltverzögerung
  3:  'standby',        // Schaltspielzeit
  4:  'provider_lock',  // EVU Sperrzeit
  5:  'hotwater',       // Brauchwasser
  6:  'standby',        // Estrich Programm
  7:  'defrost',        // Abtauen
  8:  'standby',        // Pumpenvorlauf
  9:  'hotwater',       // Thermische Desinfektion
  10: 'cooling',        // Kühlbetrieb
  12: 'swimming',       // Schwimmbad / Photovoltaik
  13: 'external',       // Heizen Ext.
  14: 'external',       // Brauchwasser Ext.
  16: 'standby',        // Durchflussüberwachung
  17: 'heating',        // Elektrische Zusatzheizung
  19: 'hotwater',       // Warmwasser Nachheizung
};

// heatpump_state1 = Grob-Status (0=läuft, 1=steht, 4=Fehler)
// Nur für Fehlerkennung verwendet
const HEATPUMP_STATE1_ERROR = 4;

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
    const NEW_CAPABILITIES = ['hotwater_boost', 'firmware_version', 'thermal_disinfection_continuous', 'hotwater_boost_party', 'target_temperature', 'measure_temperature', 'heating_state_string', 'hotwater_state_string', 'target_temperature.heating', 'measure_temperature.heating', 'last_poll'];
    for (const cap of NEW_CAPABILITIES) {
      if (!this.hasCapability(cap)) {
        this.log(`Füge neue Capability hinzu: ${cap}`);
        try { await this.addCapability(cap); }
        catch (e) { this.error(`Capability ${cap} konnte nicht hinzugefügt werden:`, e.message); }
      }
    }
    // ── Cleanup: unerwünschte Capabilities entfernen ────────────────────────────
    const REMOVE_CAPABILITIES = ['thermal_disinfection', 'warmwater_target_temperature', 'heating_temperature_correction', 'measure_temp_flow'];
    for (const cap of REMOVE_CAPABILITIES) {
      if (this.hasCapability(cap)) {
        this.log(`Entferne Capability: ${cap}`);
        try { await this.removeCapability(cap); }
        catch (e) { this.error(`removeCapability ${cap} fehlgeschlagen:`, e.message); }
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
    this._lastErrorState    = false;
    // Timestamp map: nach einem Write diese Capability für 2 Polls nicht überschreiben
    this._writeProtectUntil = {};
    // Schnelladungs-Timer
    this._boostTimer      = null;
    this._boostPartyTimer = null;
    this._lastSuccessfulPoll = null;
    this._watchdogTimer      = null;
    this._pollTimeout        = null;

    // Flow-Trigger
    this._triggerHeatingModeChanged  = this.homey.flow.getDeviceTriggerCard('heating_operation_mode_changed');
    this._triggerWarmwaterModeChanged = this.homey.flow.getDeviceTriggerCard('warmwater_operation_mode_changed');
    this._triggerStateChanged         = this.homey.flow.getDeviceTriggerCard('heatpump_state_changed');
    this._triggerErrorOccurred        = this.homey.flow.getDeviceTriggerCard('error_occurred');
    this._triggerBoostEnded           = this.homey.flow.getDeviceTriggerCard('hotwater_boost_ended');
    this._triggerBoostPartyEnded          = this.homey.flow.getDeviceTriggerCard('hotwater_boost_party_ended');
    this._triggerDeviceUnavailable        = this.homey.flow.getDeviceTriggerCard('device_unavailable');
    this._triggerDeviceAvailable          = this.homey.flow.getDeviceTriggerCard('device_available');
    this._triggerThermalDisinfEnded       = this.homey.flow.getDeviceTriggerCard('thermal_disinfection_ended');
    this._triggerErrorCleared             = this.homey.flow.getDeviceTriggerCard('error_cleared');
    this._triggerOutdoorTempDroppedBelow  = this.homey.flow.getDeviceTriggerCard('outdoor_temp_dropped_below')
      .registerRunListener((args, state) => state.temperature <= args.temperature);
    this._triggerOutdoorTempRoseAbove     = this.homey.flow.getDeviceTriggerCard('outdoor_temp_rose_above')
      .registerRunListener((args, state) => state.temperature >= args.temperature);

    // Flow-Bedingungen
    this.homey.flow.getConditionCard('heating_operation_mode_is')
      .registerRunListener((args) => String(this.getCapabilityValue('heating_operation_mode')) === String(args.mode));

    this.homey.flow.getConditionCard('warmwater_operation_mode_is')
      .registerRunListener((args) => String(this.getCapabilityValue('warmwater_operation_mode')) === String(args.mode));

    this.homey.flow.getConditionCard('heatpump_state_is')
      .registerRunListener((args) => this.getCapabilityValue('heatpump_state') === args.state);

    this.homey.flow.getConditionCard('thermal_disinfection_is_active')
      .registerRunListener(() => this.getCapabilityValue('thermal_disinfection_continuous') === true);

    this.homey.flow.getConditionCard('hotwater_boost_is_active')
      .registerRunListener(() => this.getCapabilityValue('hotwater_boost') === true);

    this.homey.flow.getConditionCard('hotwater_boost_party_is_active')

    this.homey.flow.getConditionCard('device_is_available')
      .registerRunListener(() => this.getAvailable());

    this.homey.flow.getConditionCard('heating_state_is')
      .registerRunListener((args) => {
        const current = this.getCapabilityValue('heating_state_string') || '';
        return current.toLowerCase().includes(args.state.toLowerCase());
      });

    this.homey.flow.getConditionCard('hotwater_state_is')
      .registerRunListener((args) => {
        const current = this.getCapabilityValue('hotwater_state_string') || '';
        return current === args.state;
      });

    this.homey.flow.getConditionCard('outdoor_temp_above')
      .registerRunListener((args) => {
        const temp = this.getCapabilityValue('measure_temp_outdoor');
        return temp !== null && temp > args.temperature;
      });

    this.homey.flow.getConditionCard('outdoor_temp_below')
      .registerRunListener((args) => {
        const temp = this.getCapabilityValue('measure_temp_outdoor');
        return temp !== null && temp < args.temperature;
      });

    this.homey.flow.getConditionCard('hotwater_boost_party_is_active')
      .registerRunListener(() => this.getCapabilityValue('hotwater_boost_party') === true);

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

    this.homey.flow.getActionCard('start_hotwater_boost_party')
      .registerRunListener(async (args) => this._startHotwaterBoostParty(parseInt(args.duration, 10)));

    this.homey.flow.getActionCard('stop_hotwater_boost_party')
      .registerRunListener(async () => this._stopHotwaterBoostParty());

    this.homey.flow.getActionCard('set_warmwater_target_temperature_relative')
      .registerRunListener(async (args) => {
        const current = this.getCapabilityValue('target_temperature') ?? this.getCapabilityValue('warmwater_target_temperature') ?? 50;
        await this._setWarmwaterTargetTemperature(current + parseFloat(args.offset));
      });

    this.homey.flow.getActionCard('enable_thermal_disinfection')
      .registerRunListener(async () => this._setThermalDisinfectionContinuous(true));

    this.homey.flow.getActionCard('disable_thermal_disinfection')
      .registerRunListener(async () => this._setThermalDisinfectionContinuous(false));

    // Capability-Listener (UI)
    this.registerCapabilityListener('heating_operation_mode',        async (v) => this._setHeatingOperationMode(parseInt(v, 10)));
    this.registerCapabilityListener('warmwater_operation_mode',       async (v) => this._setWarmwaterOperationMode(parseInt(v, 10)));
    if (this.hasCapability('heating_temperature_correction')) this.registerCapabilityListener('heating_temperature_correction', async (v) => this._setHeatingTemperatureCorrection(parseFloat(v)));
    this.registerCapabilityListener('target_temperature',               async (v) => this._setWarmwaterTargetTemperature(parseFloat(v)));
    this.registerCapabilityListener('target_temperature.heating',      async (v) => this._setHeatingTemperatureCorrection(parseFloat(v)));
    if (this.hasCapability('warmwater_target_temperature')) this.registerCapabilityListener('warmwater_target_temperature',   async (v) => this._setWarmwaterTargetTemperature(parseFloat(v)));
    this.registerCapabilityListener('hotwater_boost_party',             async (v) => {
      const s = await this.getSettings();
      if (v) {
        await this._startHotwaterBoostParty(Number(s.hotwater_boost_duration) || 60);
      } else {
        await this._stopHotwaterBoostParty();
      }
    });

    this.registerCapabilityListener('thermal_disinfection_continuous', async (v) => {
      await this._setThermalDisinfectionContinuous(v);
    });

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
    if (this._boostTimer)      { clearTimeout(this._boostTimer);      this._boostTimer      = null; }
    if (this._boostPartyTimer) { clearTimeout(this._boostPartyTimer); this._boostPartyTimer = null; }
    if (this._watchdogTimer)   { clearInterval(this._watchdogTimer);  this._watchdogTimer   = null; }
    if (this._pollTimeout)     { clearTimeout(this._pollTimeout);     this._pollTimeout     = null; }
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

  _startWatchdog() {
    if (this._watchdogTimer) { clearInterval(this._watchdogTimer); this._watchdogTimer = null; }
    // Watchdog prüft alle 60s ob ein erfolgreicher Poll stattgefunden hat
    // Schwellwert: 3x Polling-Intervall
    const checkIntervalSec = Number(this.getSetting('watchdog_check_interval')) || 60;
    this._watchdogTimer = setInterval(() => {
      if (!this._lastSuccessfulPoll) return;
      const elapsed = Date.now() - this._lastSuccessfulPoll.getTime();
      const watchdogFactor = Number(this.getSetting('watchdog_threshold')) || 3;
      const threshold = this._pollInterval * watchdogFactor;
      if (elapsed > threshold) {
        const minutes = Math.round(elapsed / 60000);
        this.error(`Watchdog: Kein erfolgreicher Poll seit ${minutes} Minuten`);
        this.setUnavailable(
          (this.homey.__('errors.watchdog') || `Keine Verbindung seit ${minutes} Min.`)
        ).catch(() => {});
      }
    }, checkIntervalSec * 1000);
  }

  _startPolling() {
    this._stopPolling();
    this._timer = setInterval(() => this._doPoll(), this._pollInterval);
  }

  _stopPolling() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  async _doPoll() {
    if (!this._pump) { this._connectPump(); if (!this._pump) return; }

    // Poll-Timeout: wenn keine Antwort nach 30s → Fehler
    if (this._pollTimeout) { clearTimeout(this._pollTimeout); }
    const timeoutSec = Number((await this.getSettings()).watchdog_timeout) || 30;
    this._pollTimeout = setTimeout(() => {
      this._pollTimeout = null;
      this.error(`Poll-Timeout: Keine Antwort von der Wärmepumpe nach ${timeoutSec}s`);
      this.setUnavailable(this.homey.__('errors.timeout') || `Keine Antwort (Timeout nach ${timeoutSec}s)`).catch(() => {});
    }, timeoutSec * 1000);

    return new Promise((resolve) => {
      this._pump.read((err, data) => {
        if (err) {
          this.error('Poll-Fehler:', err.message || err);
          const wasAvail = this.getAvailable();
      this.setUnavailable(err.message || 'Verbindungsfehler').catch(() => {});
      if (wasAvail) {
        this._triggerDeviceUnavailable.trigger(this, {}).catch(() => {});
      }
          resolve();
          return;
        }
        const wasUnavail = !this.getAvailable();
        this.setAvailable().catch(() => {});
        if (wasUnavail) {
          this._triggerDeviceAvailable.trigger(this, {}).catch(() => {});
        }
        // Watchdog: Zeitstempel aktualisieren und Timeout zurücksetzen
        this._lastSuccessfulPoll = new Date();
        if (this._pollTimeout) { clearTimeout(this._pollTimeout); this._pollTimeout = null; }
        const tz = this.homey.clock.getTimezone();
        const timeStr = this._lastSuccessfulPoll.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz, hour12: false });
        this._setIfValid('last_poll', timeStr).catch(() => {});
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
    const outdoorTemp = this._n(v.temperature_outside);
    if (outdoorTemp !== null && this._lastOutdoorTemp !== null) {
      if (this._lastOutdoorTemp >= 0 && outdoorTemp < 0 ||
          this._lastOutdoorTemp > outdoorTemp) {
        await this._triggerOutdoorTempDroppedBelow.trigger(this, {}, { temperature: outdoorTemp }).catch(() => {});
      }
      if (this._lastOutdoorTemp <= 0 && outdoorTemp > 0 ||
          this._lastOutdoorTemp < outdoorTemp) {
        await this._triggerOutdoorTempRoseAbove.trigger(this, {}, { temperature: outdoorTemp }).catch(() => {});
      }
    }
    if (outdoorTemp !== null) this._lastOutdoorTemp = outdoorTemp;
    await this._setIfValid('measure_temp_outdoor',      outdoorTemp);
    await this._setIfValid('measure_temp_outdoor_avg',  this._n(v.temperature_outside_avg));
    await this._setIfValid('measure_temp_flow',         this._n(v.temperature_supply));
    await this._setIfValid('measure_temp_return',       this._n(v.temperature_return));
    await this._setIfValid('measure_temp_return_target',this._n(v.temperature_target_return));
    await this._setIfValid('measure_temp_hotgas',       this._n(v.temperature_hot_gas));
    await this._setIfValid('measure_temp_hotwater',     this._n(v.temperature_hot_water));
    // Mirror → built-in measure_temperature (Thermostat-Widget Ist-Wert, kein Insights-Duplikat)
    await this._setIfValid('measure_temperature', this._n(v.temperature_hot_water));
    // Thermische Desinfektion Dauerbetrieb: Wert aus Controller lesen
    if (p.thermal_desinfection_continuous_operation !== undefined) {
      const contActive = p.thermal_desinfection_continuous_operation === 1;
      await this._setIfValid('thermal_disinfection_continuous', contActive);
    }
    // Brauchwasser Schnellladung (Zuheizung): automatisch beenden wenn Zieltemperatur erreicht
    if (this._boostTimer && this.getCapabilityValue('hotwater_boost') === true) {
      const currentTemp = this._n(v.temperature_hot_water);
      const targetTemp  = this.hasCapability('warmwater_target_temperature') ? this.getCapabilityValue('warmwater_target_temperature') : this.getCapabilityValue('target_temperature');
      if (currentTemp !== null && targetTemp !== null && currentTemp >= targetTemp) {
        this.log(`Schnelladung: Zieltemperatur ${targetTemp}°C erreicht (${currentTemp}°C) — beende automatisch`);
        await this._stopHotwaterBoost();
        await this._triggerBoostEnded.trigger(this, {}).catch(() => {});
      }
    }
    // Brauchwasser Schnellladung (Party): automatisch beenden wenn Zieltemperatur erreicht
    if (this._boostPartyTimer && this.getCapabilityValue('hotwater_boost_party') === true) {
      const currentTempP = this._n(v.temperature_hot_water);
      const targetTempP  = this.hasCapability('warmwater_target_temperature') ? this.getCapabilityValue('warmwater_target_temperature') : this.getCapabilityValue('target_temperature');
      if (currentTempP !== null && targetTempP !== null && currentTempP >= targetTempP) {
        this.log(`Schnellladung (Party): Zieltemperatur ${targetTempP}°C erreicht (${currentTempP}°C) — beende automatisch`);
        await this._stopHotwaterBoostParty();
        await this._triggerBoostPartyEnded.trigger(this, {}).catch(() => {});
      }
    }
    // Thermische Desinfektion: automatisch deaktivieren wenn Zieltemperatur erreicht
    if (this.getCapabilityValue('thermal_disinfection_continuous') === true) {
      const currentTemp = this._n(v.temperature_hot_water);
      const tdiTarget   = Number((await this.getSettings()).thermal_disinfection_target_temp) || 65;
      if (currentTemp !== null && currentTemp >= tdiTarget) {
        this.log(`Thermische Desinfektion: ${tdiTarget}°C erreicht (${currentTemp}°C) — deaktiviere Dauerbetrieb`);
        await this._setThermalDisinfectionContinuous(false).catch((e) => this.error('TDI auto-off fehlgeschlagen:', e.message));
        await this._triggerThermalDisinfEnded.trigger(this, {}).catch(() => {});
      }
    }

    await this._setIfValid('measure_temp_hotwater_target', this._n(v.temperature_hot_water_target));
    await this._setIfValid('measure_temp_source_in',    this._n(v.temperature_heat_source_in));
    await this._setIfValid('measure_temp_source_out',   this._n(v.temperature_heat_source_out));
    // Ansaugluft / Zuluft (Luft-WP)
    // Ansaugluft nur bei Luft-WP vorhanden → nur anzeigen wenn Wert > 0
    const suctionAirTemp = this._n(v.Temp_Lueftung_Zuluft);
    await this._setCapabilityConditional('measure_temp_suction_air', suctionAirTemp, suctionAirTemp !== null && suctionAirTemp > 0);
    // Raumtemperatur (nur mit RBE-Raumdisplay — Capability nur anzeigen wenn Wert > 0)
    const roomTemp       = this._n(v.Temperatur_RFV);
    const roomTempTarget = this._n(v.Temperatur_RFV2);
    await this._setCapabilityConditional('measure_temp_room',        roomTemp,       roomTemp !== null && roomTemp > 0);
    await this._setCapabilityConditional('measure_temp_room_target', roomTempTarget, roomTempTarget !== null && roomTempTarget > 0);

    // ── Volumenstrom ─────────────────────────────────────────────────────────
    // Durchfluss_WQ: Rohwert vom Controller direkt in l/h (keine Umrechnung nötig)
    // flowRate (Index 155): ebenfalls direkt in l/h
    const flowRaw = v.Durchfluss_WQ;
    if (flowRaw !== undefined && flowRaw !== 'no') {
      await this._setIfValid('measure_volume_flow', this._n(flowRaw));
    } else if (v.flowRate !== undefined && v.flowRate !== 'no' && v.flowRate !== 'inconsistent') {
      await this._setIfValid('measure_volume_flow', this._n(v.flowRate));
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
    // state3 = detaillierter Betriebsstatus; state1 = grober Status (für Fehler)
    const rawState  = v.heatpump_state3;
    const state1    = v.heatpump_state1;
    const stateSlug = (state1 === HEATPUMP_STATE1_ERROR)
      ? 'off'
      : (HEATPUMP_STATE_MAP[rawState] ?? 'unknown');
    if (stateSlug !== this._lastState) {
      await this._setIfValid('heatpump_state', stateSlug);
      if (this._lastState !== null) {
        await this._triggerStateChanged.trigger(this, { state: stateSlug }).catch(() => {});
      }
      this._lastState = stateSlug;
    }

    // ── Fehler ───────────────────────────────────────────────────────────────
    // heatpump_state1 === 4 bedeutet: Steuerung befindet sich AKTUELL im Fehlerzustand
    // v.errors enthält die letzten 5 Fehler aus dem Protokoll (auch alte, behobene Fehler)
    // → nur state1 === 4 ist zuverlässig für einen aktiven Fehler
    const hasError = (v.heatpump_state1 === 4);
    await this._setIfValid('alarm_generic', hasError);
    // Heizung Status (Extended State String)
    if (v.heatpump_extendet_state_string !== undefined) {
      await this._setIfValid('heating_state_string', String(v.heatpump_extendet_state_string));
    }
    // Warmwasser Status
    if (v.opStateHotWaterString !== undefined) {
      await this._setIfValid('hotwater_state_string', String(v.opStateHotWaterString));
    }
    if (hasError && !this._lastErrorState) {
      // Fehlermeldung aus dem Protokoll holen
      const msg = Array.isArray(v.errors) && v.errors.length > 0
        ? v.errors.map((e) => (typeof e === 'object' ? JSON.stringify(e) : String(e))).join(', ')
        : 'Fehler (state1=4)';
      await this._triggerErrorOccurred.trigger(this, { error: msg }).catch(() => {});
    }
    if (!hasError && this._lastErrorState === true) {
      await this._triggerErrorCleared.trigger(this, {}).catch(() => {});
    }
    this._lastErrorState = hasError;

    // ── Firmware-Version ─────────────────────────────────────────────────────
    if (v.firmware && v.firmware !== '') {
      await this._setIfValid('firmware_version', String(v.firmware));
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
    const heatingCorr = this._n(p.heating_temperature);
    await this._setIfValid('heating_temperature_correction', heatingCorr);
    // Mirror → target_temperature.heating (Thermostat-Widget Heizung Soll)
    await this._setIfValid('target_temperature.heating', heatingCorr);

    // Brauchwasser-Solltemperatur: p.warmwater_temperature oder p.temperature_hot_water_target
    const wwTarget = p.warmwater_temperature ?? p.temperature_hot_water_target;
    await this._setIfValid('warmwater_target_temperature', this._n(wwTarget));
    // Mirror → built-in target_temperature (Thermostat-Widget, mit Write-Schutz)
    await this._setIfValid('target_temperature', this._n(wwTarget));
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
    this._setWriteProtect('target_temperature.heating', 120000);
    await this._write('heating_target_temperature', clamped);
    await this.setCapabilityValue('heating_temperature_correction', clamped).catch(() => {});
    await this.setCapabilityValue('target_temperature.heating', clamped).catch(() => {});
  }


  async _setWarmwaterTargetTemperature(value) {
    const clamped = Math.min(65, Math.max(30, value));
    this.log(`Setze Brauchwasser Soll-Temperatur: ${clamped} °C`);
    // Sofort UI-Wert setzen, dann Write-Schutz, dann senden
    await this.setCapabilityValue('warmwater_target_temperature', clamped).catch(() => {});
    await this.setCapabilityValue('target_temperature', clamped).catch(() => {});
    this._setWriteProtect('warmwater_target_temperature', 120000);
    this._setWriteProtect('target_temperature', 120000);
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

    // Zuheizer-Modus setzen
    await this._setWarmwaterOperationMode(1);
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

  async _startHotwaterBoostParty(durationMinutes) {
    const duration = Math.min(480, Math.max(5, durationMinutes || 60));
    this.log(`Schnellladung (Party) starten: ${duration} Minuten`);
    if (this._boostPartyTimer) {
      clearTimeout(this._boostPartyTimer);
      this._boostPartyTimer = null;
    }
    // Party-Modus setzen
    await this._setWarmwaterOperationMode(2);
    await this.setCapabilityValue('hotwater_boost_party', true);
    // Auto-Reset nach konfigurierbarer Zeit
    this._boostPartyTimer = setTimeout(async () => {
      this.log(`Schnellladung (Party) beendet (${duration} min), schalte zurück auf Automatik`);
      this._boostPartyTimer = null;
      await this._setWarmwaterOperationMode(0).catch((e) => this.error('Party-Boost-Reset fehlgeschlagen:', e.message));
      await this.setCapabilityValue('hotwater_boost_party', false).catch(() => {});
      await this._triggerBoostPartyEnded.trigger(this, {}).catch(() => {});
    }, duration * 60 * 1000);
  }

  async _stopHotwaterBoostParty() {
    this.log('Schnellladung (Party) manuell gestoppt');
    if (this._boostPartyTimer) {
      clearTimeout(this._boostPartyTimer);
      this._boostPartyTimer = null;
    }
    await this._setWarmwaterOperationMode(0);
    await this.setCapabilityValue('hotwater_boost_party', false);
  }

  async _setThermalDisinfectionContinuous(enabled) {
    const value = enabled ? 1 : 0;
    this.log(`Thermische Desinfektion Dauerbetrieb: ${enabled ? 'ein' : 'aus'}`);
    await new Promise((resolve, reject) => {
      this._pump.writeRaw(27, value, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    await this.setCapabilityValue('thermal_disinfection_continuous', enabled);
    this.log(`Thermische Desinfektion Dauerbetrieb erfolgreich gesetzt: ${value}`);
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
