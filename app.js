'use strict';

const { App } = require('homey');

class LuxtronikApp extends App {

  async onInit() {
    this.log('Luxtronik Heat Pump App has been initialized');
  }

}

module.exports = LuxtronikApp;
