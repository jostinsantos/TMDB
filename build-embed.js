/**
 * Genera index.embedded.js = index.js + __EXTRACTOR_SOURCES con el código
 * de sources/* para runtimes que solo cargan un archivo.
 *
 * Uso: node build-embed.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const sourcesDir = path.join(root, 'sources');

// Auto-detecta todas las carpetas en sources/
const names = fs.existsSync(sourcesDir)
  ? fs
      .readdirSync(sourcesDir)
      .filter((n) => fs.existsSync(path.join(sourcesDir, n, 'index.js')))
      .sort()
  : [];

const map = {};
for (const n of names) {
  const p = path.join(sourcesDir, n, 'index.js');
  map[n] = fs.readFileSync(p, 'utf8');
  console.log('embed', n, map[n].length, 'bytes');
}

const header =
  '/* auto-generated extractors (' +
  names.length +
  ') */\n' +
  'var __EXTRACTOR_SOURCES = ' +
  JSON.stringify(map) +
  ';\n\n';

const main = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const out = path.join(root, 'index.embedded.js');
fs.writeFileSync(out, header + main);
console.log('wrote', out, (header + main).length, 'bytes', '· sources:', names.join(','));
