'use strict';

const { Driver } = require('homey');
const luxtronik  = require('../../lib/luxtronik2/luxtronik');
const { discover } = require('../../lib/luxtronik-discovery');

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

  /**
   * Sucht Regler im Netz und liefert sie an pair.html.
   *
   * Zwei Quellen, weil beide für sich Lücken haben:
   * - Homeys MAC-Erkennung findet die Netzwerkkarte. Sie ist zuverlässig und
   *   hält die Adresse später aktuell, kann aber nicht wissen, ob dahinter
   *   wirklich eine Luxtronik steckt — die Hersteller-Präfixe gehören Siemens.
   * - Der UDP-Broadcast beweist es, weil nur eine Luxtronik darauf antwortet,
   *   und liefert den Datenport gleich mit. Er findet ausserdem Regler, deren
   *   Netzwerkkarte kein bekanntes Präfix hat.
   *
   * Antwortet ein per MAC gefundenes Gerät auch auf den Broadcast, gilt es als
   * bestätigt; sonst bleibt es als Kandidat stehen, damit man es trotzdem
   * auswählen kann.
   */
  async _findOnNetwork() {
    const byAddress = new Map();

    try {
      for (const result of Object.values(this.getDiscoveryStrategy().getDiscoveryResults())) {
        if (!result || !result.address) continue;
        byAddress.set(result.address, {
          address: result.address,
          port: null,
          mac: result.id || null,
          confirmed: false,
        });
      }
    } catch (e) {
      this.error('MAC-Erkennung nicht verfügbar:', e.message);
    }

    try {
      for (const found of await discover()) {
        const existing = byAddress.get(found.address);
        byAddress.set(found.address, {
          address: found.address,
          port: found.port,
          mac: existing ? existing.mac : null,
          confirmed: true,
        });
      }
    } catch (e) {
      this.error('Broadcast-Suche fehlgeschlagen:', e.message);
    }

    const list = [...byAddress.values()];
    this.log(`Netzwerksuche: ${list.length} Gerät(e), davon ${list.filter((d) => d.confirmed).length} bestätigt`);
    return list;
  }

  async onPair(session) {

    // Von pair.html über Homey.emit('discover') aufgerufen.
    session.setHandler('discover', async () => this._findOnNetwork());

    // Called by pair.html via Homey.emit('connect', { ip, port })
    // Returns the device object on success, or false on failure
    session.setHandler('connect', async (data) => {
      const ip   = (data.ip   || '').trim();
      const port = parseInt(data.port, 10) || 8889;

      if (!ip) throw new Error('Keine IP-Adresse angegeben.');

      this.log(`Testing connection to ${ip}:${port}...`);

      let heatpumpType = null;

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
          pump.read((err, data) => {
            if (err) {
              this.error('Pair connection test failed:', err.message);
              finish(false);
            } else {
              // Der Verbindungstest liest ohnehin einmal alles; das Modell
              // daraus mitzunehmen kostet nichts und ergibt einen Gerätenamen,
              // der etwas über das Gerät sagt.
              heatpumpType = (data && data.values) ? data.values.typeHeatpump : null;
              this.log(`Pair connection test OK: ${ip}:${port} (${heatpumpType || 'type unknown'})`);
              finish(true);
            }
          });
        } catch (e) {
          this.error('Pair connection exception:', e.message);
          finish(false);
        }
      });

      if (!connected) return false;

      // Gerätename ohne IP-Adresse: die steht in den Geräteeinstellungen und
      // gehört nicht in den Namen — sie ändert sich mit dem DHCP-Lease, und
      // keine andere Integration schreibt sie in die Kachel. Stattdessen das
      // Modell, sofern die Steuerung eines meldet; `createHeatPumptTypeString`
      // liefert für unbekannte Codes 'Unbekannter Typ', was als Name nichts
      // taugt.
      const model = (heatpumpType && heatpumpType !== 'Unbekannter Typ') ? heatpumpType : null;

      // Die MAC merken, sofern die Netzwerksuche eine geliefert hat. Nur damit
      // kann das Gerät später eine Discovery-Meldung als die eigene erkennen
      // und seine Adresse nachführen, wenn der DHCP-Lease wechselt.
      // Die data.id bleibt bewusst adressbasiert: sie ändern hiesse, jedes
      // bereits eingerichtete Gerät verwaisen zu lassen.
      const store = {};
      if (data && typeof data.mac === 'string' && data.mac) store.mac = data.mac;

      // Return the full device descriptor for Homey.createDevice()
      return {
        name: model ? `Luxtronik ${model}` : 'Luxtronik',
        data: {
          id: `luxtronik-${ip.replace(/\./g, '-')}-${port}`,
        },
        store,
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
