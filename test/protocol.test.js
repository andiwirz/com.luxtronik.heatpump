'use strict';

// Die gebündelte Bibliothek gegen einen nachgebauten Regler. Jeder Test hier
// deckt einen Fehler ab, der in freier Wildbahn aufgetreten ist.

const { test } = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const luxtronik = require('../lib/luxtronik2/luxtronik');

function i32(n) { const b = Buffer.alloc(4); b.writeInt32BE(n, 0); return b; }

/**
 * Regler-Attrappe, die das echte 3003/3004/3005-Protokoll spricht.
 * `opts.paramCount` usw. steuern, wie viele Register sie meldet;
 * `opts.silent` lässt sie nach dem Verbindungsaufbau verstummen.
 */
function fakeController(opts = {}) {
  const { paramCount = 950, valueCount = 300, visCount = 300, silent = false, chunkHeader = false } = opts;
  return new Promise((resolve) => {
    let accepted = 0;
    const sockets = [];
    const server = net.createServer((sock) => {
      accepted++;
      sockets.push(sock);
      sock.on('error', () => {});
      sock.resume();
      if (silent) return;
      let buf = Buffer.alloc(0);
      sock.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        while (buf.length >= 8) {
          const cmd = buf.readInt32BE(0);
          buf = buf.slice(8);
          let reply;
          if (cmd === 3003) reply = Buffer.concat([i32(3003), i32(paramCount), Buffer.alloc(paramCount * 4)]);
          else if (cmd === 3004) reply = Buffer.concat([i32(3004), i32(0), i32(valueCount), Buffer.alloc(valueCount * 4)]);
          else if (cmd === 3005) reply = Buffer.concat([i32(3005), i32(visCount), Buffer.alloc(visCount)]);
          else continue;
          if (chunkHeader) {
            // Regler, die Kommando-Echo und Zähler als zwei 4-Byte-Segmente
            // schicken — daran scheiterte das Zusammensetzen früher.
            sock.write(reply.slice(0, 4));
            sock.write(reply.slice(4, 8));
            sock.write(reply.slice(8));
          } else {
            sock.write(reply);
          }
        }
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({
      port: server.address().port,
      accepted: () => accepted,
      close: () => { sockets.forEach((s) => s.destroy()); server.close(); },
    }));
  });
}

function read(port, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const pump = luxtronik.createConnection('127.0.0.1', port);
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const timer = setTimeout(() => finish({ timedOut: true, pump }), timeoutMs);
    pump.read((err, data) => { clearTimeout(timer); finish({ err, data, pump }); });
  });
}

test('kurze Parameterliste stürzt die App nicht ab', async () => {
  // Gemeldeter Fehler: TypeError bei heatpumpParameters[874].toString() und
  // RangeError in secondsToTimeString(). Beides lief über process.nextTick und
  // war damit eine unbehandelte Ausnahme, die die ganze App beendete.
  const crashes = [];
  const onCrash = (e) => crashes.push(e);
  process.on('uncaughtException', onCrash);
  try {
    for (const paramCount of [0, 1, 100, 605, 873, 875, 950]) {
      const srv = await fakeController({ paramCount });
      const { err, data } = await read(srv.port);
      srv.close();
      assert.strictEqual(err, null, `paramCount ${paramCount}: Fehler ${err && err.message}`);
      assert.ok(data && data.parameters, `paramCount ${paramCount}: keine Daten`);
      assert.deepStrictEqual(crashes, [], `paramCount ${paramCount}: ${crashes[0] && crashes[0].message}`);
    }
  } finally {
    process.removeListener('uncaughtException', onCrash);
  }
});

test('typeSerial ist null statt eines Absturzes, wenn Register 874/875 fehlen', async () => {
  const srv = await fakeController({ paramCount: 100 });
  const { data } = await read(srv.port);
  srv.close();
  assert.strictEqual(data.parameters.typeSerial, null);
});

test('Antwort über mehrere TCP-Segmente wird vollständig zusammengesetzt', async () => {
  // Regler wie die Alpha Innotec L1H schicken den Kopf in zwei 4-Byte-Stücken.
  // Vorher verwarf die Bibliothek das dritte Segment und rief den Callback nie auf.
  const srv = await fakeController({ chunkHeader: true });
  const { err, data, timedOut } = await read(srv.port);
  srv.close();
  assert.ok(!timedOut, 'Callback kam nicht — Segmente wurden verworfen');
  assert.strictEqual(err, null);
  assert.ok(Object.keys(data.values).length > 100);
});

test('ein verstummter Regler lässt den Socket nicht offen', async () => {
  // Die Bibliothek setzt selbst kein Timeout. Ohne eines bleibt der Socket für
  // immer offen — und da der Regler nur einen Client bedient, blockiert jedes
  // Leck den nächsten Versuch. device.js setzt daher selbst eines.
  const srv = await fakeController({ silent: true });
  const pump = luxtronik.createConnection('127.0.0.1', srv.port);
  let called = false;
  pump.read(() => { called = true; });

  // Nachbau von _guardSocket() aus device.js
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(pump.client, 'Socket sollte nach read() vorhanden sein');
  pump.client.setTimeout(300, () => {
    // destroy(err) statt destroy(): nur mit Fehlerargument emittiert der Socket
    // 'error', worauf die Bibliothek den Callback aufruft.
    pump.client.destroy(new Error('Socket-Timeout'));
  });

  await new Promise((r) => setTimeout(r, 800));
  srv.close();
  assert.ok(called, 'read-Callback kam nicht, obwohl der Socket geschlossen wurde');
});
