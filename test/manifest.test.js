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
const driver = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/driver.js'), 'utf8');

test('Kacheln, Flow-Karten und Auswahlwerte gibt es in allen vier Sprachen', () => {
  // In einem niederländischen Homey standen 21 von 22 Kacheltiteln des Treibers
  // auf Englisch: Ihre capabilitiesOptions hatten nur EN und DE, und die
  // überschreiben den Titel der Capability-Definition.
  const missing = [];
  const check = (where, title) => {
    for (const lang of ['en', 'de', 'nl', 'fr']) if (!title || !title[lang]) missing.push(`${where} (${lang})`);
  };
  for (const [id, cap] of Object.entries(app.capabilities)) {
    check(`capability ${id}`, cap.title);
    for (const value of cap.values || []) check(`capability ${id}:${value.id}`, value.title);
  }
  for (const [id, options] of Object.entries(drv.capabilitiesOptions || {})) {
    if (options.title) check(`Kachel ${id}`, options.title);
  }
  for (const kind of ['triggers', 'conditions', 'actions']) {
    for (const card of app.flow[kind]) check(`${kind}/${card.id}`, card.title);
  }
  assert.deepStrictEqual(missing, []);
});

test('Geräteeinstellungen gibt es in allen vier Sprachen', () => {
  // 41 der 42 Einstellungen standen auf Niederländisch und Französisch nur auf
  // Englisch, und sieben englische Gruppennamen enthielten Deutsch.
  const missing = [];
  const walk = (items) => {
    for (const item of items) {
      const where = item.id || item.label.en;
      const texts = [['Beschriftung', item.label], ['Hinweis', item.hint], ...(item.values || []).map((v) => [`Wert ${v.id}`, v.label])];
      for (const [kind, text] of texts) {
        if (!text) continue;
        for (const lang of ['en', 'de', 'nl', 'fr']) if (!text[lang]) missing.push(`${where} ${kind} (${lang})`);
      }
      if (item.type === 'group' && /[äöüß]|Heiz|Warmwasser|Kühlung|Zuheizer|Absenkung/.test(item.label.en)) missing.push(`${where}: Deutsch im englischen Namen`);
      if (item.children) walk(item.children);
    }
  };
  walk(drv.settings);
  assert.deepStrictEqual(missing, []);
});

test('Kühlen heisst auf Französisch überall gleich', () => {
  // Kacheln und Flow-Karten sagten "refroidissement", Heizungsstatus, Abschalt-
  // gründe und Fehlertexte nach der Betriebsanleitung "rafraîchissement".
  const texts = [JSON.stringify(app), fs.readFileSync(path.join(ROOT, 'locales/fr.json'), 'utf8'), device,
    fs.readFileSync(path.join(ROOT, 'lib/luxtronik-codes.js'), 'utf8'), fs.readFileSync(path.join(ROOT, 'lib/luxtronik-errors.js'), 'utf8')];
  assert.deepStrictEqual(texts.flatMap((t) => t.match(/[Rr]efroidissement/g) || []), []);
});

test('der Titelabgleich erreicht auch Kacheln ohne eigene Definition', () => {
  // target_temperature.heating und die anderen System-Kacheln haben keine
  // Capability-Definition; ihr Titel steht nur in den capabilitiesOptions des
  // Treibers. Ohne diesen Rückgriff behielten bestehende Geräte die Titel ihrer
  // Kopplung — auf Niederländisch und Französisch also Englisch.
  const src = device.replace(/\r\n/g, '\n');
  const start = src.indexOf('  async onInit() {');
  assert.match(src.slice(start, src.indexOf('\n  }\n', start)), /driverOptions\[cap\] && driverOptions\[cap\]\.title/);
});

test('jede Flow-Karte im Manifest ist im Code registriert', () => {
  // Trigger löst jedes Gerät selbst aus; Bedingungen und Aktionen hängt der
  // Treiber einmal für alle Geräte ein.
  const registration = {
    triggers: [device, 'getDeviceTriggerCard'],
    conditions: [driver, 'getConditionCard'],
    actions: [driver, 'getActionCard'],
  };
  const missing = [];
  for (const [kind, [src, getter]] of Object.entries(registration)) {
    for (const card of app.flow[kind] || []) {
      if (!src.includes(`${getter}('${card.id}')`)) missing.push(`${kind}/${card.id}`);
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
    // Flow-Aktionen ruft der Treiber auf dem gewählten Gerät auf
    // (`args.device.name`), dort also auf `device.name` prüfen.
    return !new RegExp(`this\\.${m}\\b`).test(device) && !new RegExp(`\\bdevice\\.${m}\\b`).test(driver);
  });
  assert.deepStrictEqual(dead, [], 'definiert, aber nie aufgerufen');
});

// Capabilities, die onInit von alten Geräten entfernt, und alle übrigen, die
// Treiber oder Code verwenden.
const removedLine = (device.match(/const REMOVE_CAPABILITIES = \[[^\]]*\];/) || [''])[0];
const removedCapabilities = new Set((removedLine.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1)));
const usedCapabilities = new Set([
  ...drv.capabilities.map((c) => c.split('.')[0]),
  ...[...(device.replace(removedLine, '') + driver).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]),
]);

test('jede Capability-Definition wird verwendet oder von alten Geräten entfernt', () => {
  // cooling_enabled hing in 2.0.23 und 2.0.24 an Geräten und blieb danach als
  // Definition liegen, ohne dass etwas sie benutzte oder von den Geräten nahm.
  const orphans = Object.keys(app.capabilities).filter((id) => !usedCapabilities.has(id) && !removedCapabilities.has(id));
  assert.deepStrictEqual(orphans, []);
  assert.ok(removedCapabilities.has('cooling_enabled'));
});

test('jede sichtbare Kachel hat ein Icon', () => {
  // Fünf Kältekreis-Kacheln zeigten in der Homey-App nur Homeys Platzhalter,
  // ein gestricheltes Quadrat: Ihre Definitionen hatten kein Icon. Geprüft
  // wird, was der Treiber oder der Code verwendet und was als Kachel erscheint;
  // was onInit von alten Geräten entfernt, braucht keins.
  const missing = Object.entries(app.capabilities)
    .filter(([id, cap]) => usedCapabilities.has(id) && cap.uiComponent !== null)
    .filter(([, cap]) => !cap.icon || !fs.existsSync(path.join(ROOT, cap.icon)))
    .map(([id]) => id);
  assert.deepStrictEqual(missing, []);
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
