/**
 * Script di riproduzione vulnerabilità #69 (brace-expansion) e #71 (qs)
 * Eseguire con: node repro-vulnerabilities.cjs
 */

// ============================================================
// BUG #71 — qs.stringify: TypeError con arrayFormat:comma +
//           encodeValuesOnly su array con null/undefined
// ============================================================
console.log('\n=== BUG #71: qs TypeError (arrayFormat:comma + encodeValuesOnly) ===');

const qs = require('qs');
console.log('qs version:', require('./node_modules/qs/package.json').version);

const testCases = [
  { label: 'Array normale [x, y]',              val: ['x', 'y'] },
  { label: 'Array con null [x, null, y]',       val: ['x', null, 'y'] },
  { label: 'Array con undefined [x, undef, y]', val: ['x', undefined, 'y'] },
  { label: 'Array solo null [null]',             val: [null] },
];

let qs71Crashed = false;
for (const { label, val } of testCases) {
  try {
    const result = qs.stringify({ a: val }, { arrayFormat: 'comma', encodeValuesOnly: true });
    console.log(`  OK    ${label}: "${result}"`);
  } catch (e) {
    qs71Crashed = true;
    console.log(`  CRASH ${label}: ${e.constructor.name}: ${e.message}`);
  }
}

if (qs71Crashed) {
  console.log('\n[BUG #71 CONFERMATO] qs.stringify crasha con null/undefined + comma+encodeValuesOnly');
} else {
  console.log('\n[BUG #71 FIXATO] Nessun crash');
}

// ============================================================
// BUG #69 — brace-expansion: max applicato troppo tardi,
//           genera TUTTI gli elementi prima del limite
// ============================================================
console.log('\n=== BUG #69: brace-expansion DoS (max applicato tardi) ===');

const bePath = '../node_modules/brace-expansion/dist/commonjs/index.js';
let beVersion = 'N/A';
try {
  beVersion = require('../node_modules/brace-expansion/package.json').version;
} catch(_) {}
console.log('brace-expansion version:', beVersion);

let beModule;
try {
  beModule = require(bePath);
} catch(e) {
  console.log('brace-expansion non trovato:', e.message);
  process.exit(0);
}

const { expand } = beModule;

// Caso piccolo — atteso funzionamento
const small = expand('{1..5}');
console.log('  expand("{1..5}"):', small);

// Caso con max basso e range grande: misura overhead
const RANGE = '{1..500000}';
const MAX = 10;
const memBefore = process.memoryUsage().heapUsed;
const t0 = Date.now();
const result = expand(RANGE, { max: MAX });
const elapsed = Date.now() - t0;
const memAfter = process.memoryUsage().heapUsed;
const memDeltaMB = ((memAfter - memBefore) / 1024 / 1024).toFixed(1);

console.log(`  expand("${RANGE}", { max: ${MAX} }):`);
console.log(`    Elementi ritornati : ${result.length} (attesi: <= ${MAX})`);
console.log(`    Tempo              : ${elapsed} ms`);
console.log(`    Memoria allocata   : ~${memDeltaMB} MB`);

if (elapsed > 200 || parseFloat(memDeltaMB) > 20) {
  console.log(`\n[BUG #69 CONFERMATO] Overhead elevato (${elapsed}ms, ${memDeltaMB}MB) nonostante max=${MAX}`);
} else {
  console.log('\n[BUG #69 FIXATO] Nessun overhead significativo');
}
