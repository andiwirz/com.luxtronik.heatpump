'use strict';

const { Driver } = require('homey');
const luxtronik  = require('../../lib/luxtronik2/luxtronik');

// Obergrenze für den Verbindungstest beim Pairing. Ein vollständiger Lesevorgang
// dauert auf einem gesunden Controller rund 0,2 s. Ohne Deckel hängt der Dialog
// dagegen unbegrenzt, sobald die Bibliothek ihren Callback nicht aufruft - dann
// steht im Log nur "Testing connection to ..." und der Nutzer sieht einen
// endlos drehenden Knopf ohne Fehlermeldung. 15 s lassen auch einem langsamen
// Controller reichlich Luft und liefern trotzdem eine Aussage.
const PAIR_TIMEOUT_MS = 15000;

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
        let settled = false;
        let timer = null;
        let pump = null;

        // Hängenden Socket schliessen. luxtronik2 setzt selbst kein Timeout:
        // antwortet der Regler nach dem Verbindungsaufbau nicht mehr, bleibt der
        // Socket offen. Der Regler nimmt nur eine Verbindung gleichzeitig an —
        // ein liegengelassener Socket würde also den sofortigen zweiten Versuch
        // des Nutzers ebenfalls scheitern lassen.
        const closeSocket = () => {
          const sock = pump && pump.client;
          if (!sock) return;
          try { sock.removeAllListeners(); sock.destroy(); }
          catch (e) { this.error('Pair socket cleanup failed:', e.message); }
        };

        // Gibt den Test auf jedem Pfad frei, auch wenn der Callback ausbleibt.
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          if (timer) { clearTimeout(timer); timer = null; }
          if (!ok) closeSocket();
          resolve(ok);
        };

        timer = setTimeout(() => {
          this.error(`Pair connection test timed out after ${PAIR_TIMEOUT_MS} ms: ${ip}:${port}`);
          finish(false);
        }, PAIR_TIMEOUT_MS);

        try {
          pump = new luxtronik.createConnection(ip, port);
          pump.read((err) => {
            if (err) {
              this.error('Pair connection test failed:', err.message);
              finish(false);
            } else {
              this.log(`Pair connection test OK: ${ip}:${port}`);
              finish(true);
            }
          });
        } catch (e) {
          this.error('Pair connection exception:', e.message);
          finish(false);
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
