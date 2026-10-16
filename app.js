'use strict';

const { App } = require('homey');
const { PARAMETER_NAMES } = require('./lib/luxtronik-codes');

class LuxtronikApp extends App {

  async onInit() {
    this.log('Luxtronik Heat Pump App has been initialized');
    // App-Version für die Debug-Seite in den Settings speichern
    try {
      this.homey.settings.set('app_version', this.homey.manifest.version);
    } catch (_e) { /* ignore */ }
    // Registernamen für die Rohliste im Debug-Tab. Einmal pro Start statt mit
    // jeder Abfrage: Die Namen ändern sich nie, das Gerät schreibt pro Poll nur
    // die Zahlen.
    try {
      this.homey.settings.set('luxtronik_parameter_names', PARAMETER_NAMES);
    } catch (_e) { /* ignore */ }
  }

}

module.exports = LuxtronikApp;
