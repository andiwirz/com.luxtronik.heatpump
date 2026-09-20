'use strict';

// Prüfungen gegen das gebaute Manifest. Diese hätten mehrere Fehler gefangen,
// die in dieser App tatsächlich passiert sind: eine Flow-Karte ohne
// Registrierung, eine Capability, die niemand beschreibt, ein Icon, das dem
// Farbschema nicht folgt, und eine Methode, die nie aufgerufen wurde.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./helpers');

const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const drv = app.drivers[0];
const device = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/device.js'), 'utf8');

test('jede Flow-Karte im Manifest ist im Code registriert', () => {
  const missing = [];
  for (const kind of ['triggers', 'conditions', 'actions']) {
    for (const card of app.flow[kind] || []) {
      if (!device.includes(`'${card.id}'`)) missing.push(`${kind}/${card.id}`);
    }
  }
  assert.deepStrictEqual(missing, []);
});

test('jede Capability im Manifest wird vom Code auch beschrieben', () => {
  const missing = drv.capabilities.filter((c) => {
    const base = c.split('.')[0];
    return !device.includes(`'${c}'`) && !device.includes(`'${base}'`);
  });
  assert.deepStrictEqual(missing, []);
});

test('jede setzbare Capability hat einen Listener', () => {
  const setable = drv.capabilities.filter((c) => {
    const def = app.capabilities[c.split('.')[0]];
    return def && def.setable === true;
  });
  const without = setable.filter((c) => !device.includes(`registerCapabilityListener('${c}'`));
  assert.deepStrictEqual(without, [], 'setzbar, aber nichts nimmt den Wert an');
});

test('keine private Methode ist unerreichbar', () => {
  // _startWatchdog() war fünf Monate definiert, aber nie aufgerufen — die
  // beiden Watchdog-Einstellungen waren dadurch wirkungslos.
  // Von Homey aufgerufen, nicht von der App — hier also erwartbar ohne
  // Aufrufstelle im eigenen Code.
  const lifecycle = [
    'onInit', 'onDeleted', 'onSettings', 'onAdded', 'onRenamed', 'onUninit',
    'onDiscoveryResult', 'onDiscoveryAvailable', 'onDiscoveryAddressChanged', 'onDiscoveryLastSeenChanged',
  ];
  const methods = [...device.matchAll(/^ {2}(?:async )?([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)].map((m) => m[1]);
  const dead = methods.filter((m) => {
    if (lifecycle.includes(m)) return false;
    // Auf `this.name` prüfen, nicht auf `this.name(`: die Schreibmethoden werden
    // in CONTROLLER_SETTINGS als Referenz übergeben und erst dort aufgerufen.
    return !new RegExp(`this\\.${m}\\b`).test(device);
  });
  assert.deepStrictEqual(dead, [], 'definiert, aber nie aufgerufen');
});

test('jedes Capability-Icon folgt dem Farbschema und skaliert', () => {
  // Icons ohne currentColor wurden immer schwarz gezeichnet und sahen dadurch
  // in der Homey-App anders aus als im Web.
  const dir = path.join(ROOT, 'assets/capabilities');
  const problems = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(dir, file), 'utf8');
    const root = (svg.match(/<svg[^>]*>/) || [''])[0];
    if (!/currentColor/.test(svg)) problems.push(`${file}: kein currentColor`);
    if (/(?:fill|stroke)\s*[:=]\s*["']?(?:#[0-9a-fA-F]{3,8}|rgba?\(|black|white)/i.test(svg)) problems.push(`${file}: harte Farbe`);
    if (/\swidth\s*=/.test(root) || /\sheight\s*=/.test(root)) problems.push(`${file}: width/height am <svg>`);
    if (!/viewBox/.test(root)) problems.push(`${file}: kein viewBox`);
    // Ein Outline-Icon ohne fill="none" wird flächig gefüllt.
    if (/stroke\s*[:=]\s*["']?currentColor/.test(svg) && !/fill\s*[:=]\s*["']?none/.test(svg)) {
      problems.push(`${file}: stroke ohne fill="none"`);
    }
  }
  assert.deepStrictEqual(problems, []);
});

test('Version und Changelog passen zusammen', () => {
  const compose = JSON.parse(fs.readFileSync(path.join(ROOT, '.homeycompose/app.json'), 'utf8'));
  const changelog = JSON.parse(fs.readFileSync(path.join(ROOT, '.homeychangelog.json'), 'utf8'));
  assert.strictEqual(app.version, compose.version, 'app.json ist nicht neu gebaut');
  assert.ok(changelog[app.version], `kein Changelog-Eintrag für ${app.version}`);
  // Seit 2.0.43 sind alle vier Sprachen gepflegt.
  for (const lang of ['en', 'de', 'nl', 'fr']) {
    assert.ok(changelog[app.version][lang], `Changelog ${app.version}: ${lang} fehlt`);
  }
});

test('die Registertabelle bleibt in sich schlüssig', () => {
  // Der Zahlenwert steckt im Schlüsselnamen; driften die auseinander, liest die
  // App am falschen Register.
  const regs = require('../lib/luxtronik-registers');
  const problems = [];
  for (const table of ['CALCULATIONS', 'PARAMETERS', 'VISIBILITIES']) {
    for (const [key, index] of Object.entries(regs[table])) {
      const m = key.match(/^[CPV](\d+)/);
      if (m && Number(m[1]) !== index) problems.push(`${table}.${key} = ${index}`);
    }
  }
  assert.deepStrictEqual(problems, []);
});
