'use strict';

const { Driver } = require('homey');
const luxtronik  = require('luxtronik2');

class LuxtronikHeatpumpDriver extends Driver {

  async onInit() {
    this.log('LuxtronikHeatpumpDriver has been initialized');
  }

  async onPair(session) {

    // Called by pair.html via Homey.emit('connect', { ip, port })
    // Returns the device object on success, or false on failure
    session.setHandler('connect', async (data) => {
      const ip   = (data.ip   || '').trim();
      const port = parseInt(data.port, 10) || 8889;

      if (!ip) throw new Error('Keine IP-Adresse angegeben.');

      this.log(`Testing connection to ${ip}:${port}...`);

      const connected = await new Promise((resolve) => {
        try {
          const pump = new luxtronik.createConnection(ip, port);
          pump.read((err) => {
            if (err) {
              this.error('Pair connection test failed:', err.message);
              resolve(false);
            } else {
              this.log(`Pair connection test OK: ${ip}:${port}`);
              resolve(true);
            }
          });
        } catch (e) {
          this.error('Pair connection exception:', e.message);
          resolve(false);
        }
      });

      if (!connected) return false;

      // Return the full device descriptor for Homey.createDevice()
      return {
        name: `Luxtronik @ ${ip}`,
        data: {
          id: `luxtronik-${ip.replace(/\./g, '-')}-${port}`,
        },
        settings: {
          ip,
          port,
          poll_interval: 60,
        },
      };
    });

  }

}

module.exports = LuxtronikHeatpumpDriver;
