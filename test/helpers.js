'use strict';

// Minimaler Testrahmen auf Basis von node:test — kein zusätzliches Paket nötig,
// die Suite läuft mit `npm test` auf jeder Node-Version, die Homey mitbringt.
//
// Die Tests hier prüfen bewusst nur Dinge, die ohne Homey-Laufzeit prüfbar sind:
// reine Umrechnungen, Tabellen und das Protokollverhalten der Bibliothek gegen
// einen nachgebauten Regler. Alles, was `this.homey` braucht, bleibt aussen vor.

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

/**
 * Liest eine Methode aus device.js als eigenständige Funktion heraus.
 *
 * device.js kann nicht importiert werden, weil `require('homey')` nur auf der
 * Homey-Laufzeit existiert. Die reinen Helfer hängen aber an keinem Zustand, so
 * dass sie sich einzeln herausschneiden und auswerten lassen. Bricht das
 * Herausschneiden, schlägt der Test fehl — das ist gewollt, dann hat sich die
 * Signatur geändert und der Test muss mitwandern.
 */
function extractMethod(name) {
  const src = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/device.js'), 'utf8');
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.match(new RegExp('^  (?:async )?' + name + '\\s*\\(')));
  if (start < 0) throw new Error(`Methode ${name} nicht in device.js gefunden`);
  let depth = 0;
  const body = [];
  for (let i = start; i < lines.length; i++) {
    body.push(lines[i]);
    depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
    if (i > start && depth <= 0) break;
  }
  // Einzeilige Modulkonstanten mitnehmen: _temp und _energyMetered greifen auf
  // UNWIRED_SENSOR_TEMPERATURE bzw. ENERGY_METER_MIN_HOURS zu, die ausserhalb
  // der Methode stehen.
  const scope = [...src.matchAll(/^const ([A-Z][A-Z0-9_]*)\s*=\s*(-?[\d.]+|'[^']*'|"[^"]*"|true|false);\s*$/gm)]
    .map((m) => `const ${m[1]} = ${m[2]};`)
    .join('\n');
  // Als Objektmethode auswerten, damit `this` funktioniert.
  // eslint-disable-next-line no-new-func
  return new Function(`${scope}\nreturn { ${body.join('\n')} };`)();
}

/** Konstanten auf Modulebene aus device.js lesen (z. B. UNWIRED_SENSOR_TEMPERATURE). */
function extractConst(name) {
  const src = fs.readFileSync(path.join(ROOT, 'drivers/luxtronik-heatpump/device.js'), 'utf8');
  const m = src.match(new RegExp('^const ' + name + '\\s*=\\s*(.+?);\\s*$', 'm'));
  if (!m) throw new Error(`Konstante ${name} nicht in device.js gefunden`);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${m[1]});`)();
}

module.exports = { ROOT, extractMethod, extractConst };
