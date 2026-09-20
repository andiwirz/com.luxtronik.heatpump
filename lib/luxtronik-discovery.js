'use strict';

// Suche nach Luxtronik-Reglern per UDP-Broadcast.
//
// Die Steuerung beantwortet ein Magic-Paket auf zwei festen Ports. Das ist die
// einzige Erkennung, die beweist, dass wirklich eine Luxtronik antwortet —
// Homeys eingebaute MAC-Erkennung findet nur die Netzwerkkarte und würde jedes
// andere Gerät desselben Herstellers mit anbieten.
//
// Protokoll übernommen aus python-luxtronik (MIT):
//   https://github.com/Bouni/python-luxtronik
//   luxtronik/discover.py und luxtronik/constants.py
//
// Ablauf: Broadcast raus, alles einsammeln was mit dem Antwort-Präfix beginnt.
// Die Antwort ist semikolongetrennt; das dritte Feld trägt den Datenport, den
// ältere Softwarestände allerdings weglassen — dann greift der Standardport.

const dgram = require('node:dgram');

const DISCOVERY_PORTS = [4444, 47808];
const MAGIC_PACKET = '2000;111;1;\0';
const RESPONSE_PREFIX = '2500;111;';
const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_DATA_PORT = 8889;

/**
 * Sucht auf einem Port und liefert die Antwortenden.
 * Lehnt nie ab: ein Port, den das Betriebssystem nicht hergibt (belegt, keine
 * Berechtigung), darf die Suche auf dem anderen nicht verhindern.
 */
function probePort(port, timeoutMs, broadcastAddress) {
  return new Promise((resolve) => {
    const found = new Map();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    let closed = false;

    const finish = () => {
      if (closed) return;
      closed = true;
      try { socket.close(); } catch (e) { /* bereits zu */ }
      resolve([...found.values()]);
    };

    socket.on('error', finish);

    socket.on('message', (msg, rinfo) => {
      const text = msg.toString('ascii');
      // Der eigene Broadcast kommt auf demselben Socket zurück.
      if (text.startsWith(MAGIC_PACKET.slice(0, 8))) return;
      if (!text.startsWith(RESPONSE_PREFIX)) return;

      const fields = text.split(';');
      const parsed = parseInt(fields[2], 10);
      const dataPort = (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535)
        ? parsed
        : DEFAULT_DATA_PORT;

      found.set(rinfo.address, { address: rinfo.address, port: dataPort, via: 'broadcast' });
    });

    socket.on('listening', () => {
      try {
        socket.setBroadcast(true);
        socket.send(Buffer.from(MAGIC_PACKET, 'ascii'), port, broadcastAddress);
      } catch (e) {
        finish();
      }
    });

    setTimeout(finish, timeoutMs);

    try {
      socket.bind(port);
    } catch (e) {
      finish();
    }
  });
}

/**
 * Sucht auf allen bekannten Ports parallel.
 *
 * `broadcastAddress` ist nur für Tests gedacht: auf die Loopback-Adresse
 * gesetzt bleibt die Suche auf dem Rechner und findet keine echte Anlage im
 * Netz — sonst hinge das Ergebnis davon ab, was gerade angeschlossen ist.
 *
 * @returns {Promise<Array<{address: string, port: number, via: string}>>}
 */
async function discover({ timeoutMs = DEFAULT_TIMEOUT_MS, broadcastAddress = '255.255.255.255' } = {}) {
  const lists = await Promise.all(DISCOVERY_PORTS.map((p) => probePort(p, timeoutMs, broadcastAddress)));
  // Derselbe Regler antwortet unter Umständen auf beiden Ports.
  const byAddress = new Map();
  for (const entry of lists.flat()) {
    if (!byAddress.has(entry.address)) byAddress.set(entry.address, entry);
  }
  return [...byAddress.values()];
}

module.exports = {
  discover,
  DISCOVERY_PORTS,
  MAGIC_PACKET,
  RESPONSE_PREFIX,
  DEFAULT_DATA_PORT,
};
