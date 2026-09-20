'use strict';

// Die UDP-Suche.
//
// Zwei Dinge lassen sich hier nicht gleichzeitig prüfen: Im echten Netz bindet
// die Suche denselben Port, an den sie sendet — der Regler antwortet an den
// Absender zurück. Auf einem einzelnen Rechner können Attrappe und Suche diesen
// Port aber nicht beide bekommen; das Paket erreicht dann nur eine von beiden.
//
// Deshalb schickt die Attrappe hier eine unaufgeforderte, gültige Antwort an
// den Suchport, statt ihn selbst zu belegen. Damit läuft genau der Pfad, auf
// den es ankommt: Empfangen, Prüfen, Auswerten. Dass das Magic-Paket
// tatsächlich hinausgeht, ist gegen echte Hardware bestätigt — eine reale
// Luxtronik antwortet darauf mit ihrer Adresse und ihrem Datenport.

const { test } = require('node:test');
const assert = require('node:assert');
const dgram = require('node:dgram');
const disc = require('../lib/luxtronik-discovery');

const LOOPBACK = '127.0.0.1';

test('Protokollkonstanten entsprechen python-luxtronik', () => {
  // Weichen sie ab, antwortet kein Regler — und die Suche schweigt still.
  assert.deepStrictEqual(disc.DISCOVERY_PORTS, [4444, 47808]);
  assert.strictEqual(disc.MAGIC_PACKET, '2000;111;1;\0');
  assert.strictEqual(disc.RESPONSE_PREFIX, '2500;111;');
  assert.strictEqual(disc.DEFAULT_DATA_PORT, 8889);
});

/** Schickt nach `delay` ms eine Antwort an den Suchport auf Loopback. */
function sendReply(reply, targetPort, delay = 150) {
  const sock = dgram.createSocket('udp4');
  const timer = setTimeout(() => {
    sock.send(Buffer.from(reply, 'ascii'), targetPort, LOOPBACK, () => {
      try { sock.close(); } catch (e) { /* bereits zu */ }
    });
  }, delay);
  return () => { clearTimeout(timer); try { sock.close(); } catch (e) { /* bereits zu */ } };
}

/** Sucht, ohne echte Hardware im Netz zu behelligen. */
function discoverLocal(timeoutMs = 700) {
  return disc.discover({ timeoutMs, broadcastAddress: LOOPBACK });
}

test('eine gültige Antwort wird erkannt und der Datenport übernommen', async () => {
  // Feld 3 trägt den Port, auf dem die Steuerung Daten liefert.
  const cancel = sendReply('2500;111;8889;', 47808);
  try {
    const found = await discoverLocal();
    assert.strictEqual(found.length, 1, `erwartet 1 Fund, bekommen: ${JSON.stringify(found)}`);
    assert.strictEqual(found[0].address, LOOPBACK);
    assert.strictEqual(found[0].port, 8889);
    assert.strictEqual(found[0].via, 'broadcast');
  } finally {
    cancel();
  }
});

test('fehlender Port in der Antwort fällt auf 8889 zurück', async () => {
  // Ältere Softwarestände liefern das Feld nicht mit.
  const cancel = sendReply('2500;111;', 47808);
  try {
    const found = await discoverLocal();
    assert.strictEqual(found.length, 1);
    assert.strictEqual(found[0].port, disc.DEFAULT_DATA_PORT);
  } finally {
    cancel();
  }
});

test('unsinniger Port in der Antwort fällt ebenfalls zurück', async () => {
  const cancel = sendReply('2500;111;99999;', 47808);
  try {
    const found = await discoverLocal();
    assert.strictEqual(found.length, 1);
    assert.strictEqual(found[0].port, disc.DEFAULT_DATA_PORT);
  } finally {
    cancel();
  }
});

test('fremde Antworten werden ignoriert', async () => {
  // Auf denselben Ports funkt auch anderes — 47808 ist der BACnet-Port.
  const cancel = sendReply('irgendwas anderes', 47808);
  try {
    assert.deepStrictEqual(await discoverLocal(), [], 'fremder Verkehr darf nicht als Regler gelten');
  } finally {
    cancel();
  }
});

test('der eigene Broadcast wird nicht als Fund gewertet', async () => {
  // Das gesendete Magic-Paket kommt auf demselben Socket zurück.
  const cancel = sendReply(disc.MAGIC_PACKET, 47808);
  try {
    assert.deepStrictEqual(await discoverLocal(), []);
  } finally {
    cancel();
  }
});

test('derselbe Regler auf beiden Ports ergibt einen Eintrag', async () => {
  const c1 = sendReply('2500;111;8889;', 4444);
  const c2 = sendReply('2500;111;8889;', 47808);
  try {
    const found = await discoverLocal();
    assert.strictEqual(found.length, 1, 'Antworten auf beiden Ports dürfen nicht doppelt zählen');
  } finally {
    c1(); c2();
  }
});

test('ohne Antwort endet die Suche leer statt zu hängen', async () => {
  const started = Date.now();
  assert.deepStrictEqual(await discoverLocal(500), []);
  // Beide Ports laufen parallel, nicht nacheinander.
  assert.ok(Date.now() - started < 1500, 'Suche läuft seriell statt parallel');
});

test('belegter Port verhindert die Suche auf dem anderen nicht', async () => {
  // Bindet etwas anderes bereits 4444, muss 47808 trotzdem durchlaufen.
  const blocker = dgram.createSocket({ type: 'udp4' });
  await new Promise((r) => blocker.bind(4444, r));
  const cancel = sendReply('2500;111;8889;', 47808);
  try {
    const found = await discoverLocal();
    assert.strictEqual(found.length, 1, 'ein belegter Port darf den anderen nicht mitreissen');
  } finally {
    cancel();
    try { blocker.close(); } catch (e) { /* bereits zu */ }
  }
});
