#!/usr/bin/env node
/**
 * PAIR-ID-MERGE diagnostic — Phase A of the zero-elementIdB investigation.
 *
 * Suspicion: register shows 0% Element ID coverage on side B, ~32% on side A.
 * This script mirrors working.html's parser 1 (line ~6626) logic — same
 * querySelectorAll paths, same bgatr() behaviour — and dumps everything it sees
 * on both sides for every clash so the user can determine whether the XML
 * contains Element ID on side B at all (data limitation) or under a different
 * tag structure that bgatr() misses (parser bug).
 *
 * Usage:
 *   cd scripts
 *   npm install
 *   node diag-pair-id.mjs /path/to/sample.xml [/path/to/another.xml ...]
 *
 * Defaults to /tmp/sample_clash.xml if no argument is given.
 *
 * Emits:
 *   diag-pair-id-report.csv       — one row per clash
 *   diag-pair-id-report.txt       — summary block (per-test coverage, side-B
 *                                    objectattribute name sets, source patterns)
 *
 * Does not modify working.html. Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

const inputs = process.argv.slice(2);
if (!inputs.length) inputs.push('/tmp/sample_clash.xml');

const missing = inputs.filter(p => !fs.existsSync(p));
if (missing.length) {
  console.error('Missing input file(s):\n  ' + missing.join('\n  '));
  console.error('\nDrop the archived clash XML at /tmp/sample_clash.xml or pass paths as args.');
  process.exit(2);
}

// Mirror working.html bgatr() at line ~5944 exactly. Two accepted shapes:
//   NW 2027:  <objectattribute><name>X</name><value>Y</value></objectattribute>
//   Legacy:   <objectattribute name="X">text</objectattribute>
function bgatr(el, n) {
  if (!el) return '';
  for (const a of el.querySelectorAll('objectattribute')) {
    const nm = a.querySelector('name');
    if (nm && nm.textContent.trim() === n) {
      const v = a.querySelector('value');
      return v ? v.textContent.trim() : '';
    }
    if (a.getAttribute('name') === n) return a.textContent.trim();
  }
  return '';
}

// Enumerate every objectattribute name present on an element — regardless of
// which structural shape it uses. Used to answer "is 'Element ID' truly absent
// from side B, or is it hiding under a different name?"
function allAttrNames(el) {
  if (!el) return [];
  const names = new Set();
  for (const a of el.querySelectorAll('objectattribute')) {
    const nm = a.querySelector('name');
    if (nm && nm.textContent.trim()) names.add(nm.textContent.trim());
    const attrN = a.getAttribute('name');
    if (attrN) names.add(attrN);
  }
  return [...names].sort();
}

// Same source-resolution as parser 1 uses (via bgetSource at ~5962), simplified.
function bgetSource(el) {
  if (!el) return '';
  const paths = el.querySelectorAll('path node');
  const items = [...paths].map(n => n.textContent.trim()).filter(Boolean);
  // Prefer the deepest .nwc; fall back to .nwd, else last node.
  const nwc = items.filter(x => /\.nwc$/i.test(x)).pop();
  if (nwc) return nwc;
  const nwd = items.filter(x => /\.nwd$/i.test(x)).pop();
  if (nwd) return nwd;
  return items[items.length - 1] || '';
}

const rows = [];
const perTest = new Map();          // testName -> {total, sideA, sideB}
const sideBAttrNameSets = new Map();// serialised name-set (side B, no Element ID) -> count
const sideBSources = new Map();     // .nwc name -> count

for (const inputPath of inputs) {
  const xml = fs.readFileSync(inputPath, 'utf8');
  const { document } = parseHTML(xml);

  // Parser 1 tolerates either clashtest or batchtest as the batch element.
  let batches = [...document.querySelectorAll('clashtest')];
  if (!batches.length) batches = [...document.querySelectorAll('batchtest')];

  for (const batch of batches) {
    const testName = batch.getAttribute('name') || path.basename(inputPath, '.xml');
    // XML-GROUPS-FIX — clashresult first, else clashgroup.
    let clashes = [...batch.querySelectorAll('clashresult')];
    if (!clashes.length) clashes = [...batch.querySelectorAll('clashgroup')];

    for (const c of clashes) {
      const nwName = c.getAttribute('name') || '';
      const obs = [...c.querySelectorAll('clashobject')];
      const oA = obs[0] || null;
      const oB = obs[1] || null;

      const idA = bgatr(oA, 'Element ID');
      const idB = bgatr(oB, 'Element ID');
      const namesA = allAttrNames(oA);
      const namesB = allAttrNames(oB);
      const srcA = bgetSource(oA);
      const srcB = bgetSource(oB);

      rows.push({
        file: path.basename(inputPath),
        testName,
        nwName,
        hasObsA: !!oA,
        hasObsB: !!oB,
        elementIdA: idA,
        elementIdB: idB,
        attrNamesA: namesA.join('|'),
        attrNamesB: namesB.join('|'),
        sourceA: srcA,
        sourceB: srcB,
      });

      const pt = perTest.get(testName) || { total: 0, sideA: 0, sideB: 0 };
      pt.total++;
      if (idA) pt.sideA++;
      if (idB) pt.sideB++;
      perTest.set(testName, pt);

      if (!idB && oB) {
        const key = namesB.join('|') || '(no objectattributes)';
        sideBAttrNameSets.set(key, (sideBAttrNameSets.get(key) || 0) + 1);
        const nwcKey = srcB || '(no source)';
        sideBSources.set(nwcKey, (sideBSources.get(nwcKey) || 0) + 1);
      }
    }
  }
}

const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const csvPath = path.join(outDir, 'diag-pair-id-report.csv');
const txtPath = path.join(outDir, 'diag-pair-id-report.txt');

// CSV
const csvHeader = [
  'file','testName','nwName','hasObsA','hasObsB','elementIdA','elementIdB',
  'attrNamesA','attrNamesB','sourceA','sourceB'
];
const csvEsc = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csv = [csvHeader.join(',')]
  .concat(rows.map(r => csvHeader.map(k => csvEsc(r[k])).join(',')))
  .join('\n');
fs.writeFileSync(csvPath, csv + '\n');

// Summary
const lines = [];
lines.push('PAIR-ID-MERGE diagnostic — Phase A');
lines.push('='.repeat(60));
lines.push(`Inputs:      ${inputs.length} file(s)`);
lines.push(`Total clashes parsed: ${rows.length}`);
const totA = rows.filter(r => r.elementIdA).length;
const totB = rows.filter(r => r.elementIdB).length;
const pct = (n) => rows.length ? (100 * n / rows.length).toFixed(1) + '%' : '0%';
lines.push(`Side A Element ID coverage: ${totA} / ${rows.length}  (${pct(totA)})`);
lines.push(`Side B Element ID coverage: ${totB} / ${rows.length}  (${pct(totB)})`);
lines.push('');
lines.push('Per-test coverage');
lines.push('-'.repeat(60));
const testRows = [...perTest.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [tn, pt] of testRows) {
  const a = pt.total ? (100 * pt.sideA / pt.total).toFixed(1) : '0.0';
  const b = pt.total ? (100 * pt.sideB / pt.total).toFixed(1) : '0.0';
  lines.push(`  ${tn}  n=${pt.total}  A=${pt.sideA} (${a}%)  B=${pt.sideB} (${b}%)`);
}
lines.push('');
lines.push('Side-B objectattribute name sets when Element ID is missing');
lines.push('-'.repeat(60));
lines.push('(each row = a distinct set of attribute names seen on the missing-ID side)');
const attrRows = [...sideBAttrNameSets.entries()].sort((a, b) => b[1] - a[1]);
for (const [k, v] of attrRows) {
  lines.push(`  n=${v}  { ${k} }`);
}
lines.push('');
lines.push('Side-B source-file distribution when Element ID is missing');
lines.push('-'.repeat(60));
const srcRows = [...sideBSources.entries()].sort((a, b) => b[1] - a[1]);
for (const [k, v] of srcRows) {
  lines.push(`  n=${v}  ${k}`);
}
lines.push('');
lines.push('Root cause interpretation');
lines.push('-'.repeat(60));
if (totB === 0 && attrRows.every(([k]) => !/element id/i.test(k))) {
  lines.push('B1 candidate: no clashobject on side B carries an "Element ID"');
  lines.push('objectattribute in ANY of the shapes bgatr() understands.');
  lines.push('The data does not contain the identifier — a composite pair key');
  lines.push('(PAIR-ID-COMPOSITE) is the correct remedy, not a parser change.');
} else if (attrRows.some(([k]) => /element id/i.test(k))) {
  lines.push('B2 candidate: "Element ID" (or a case/spacing variant) appears in');
  lines.push('the side-B objectattribute name set, but bgatr() is not returning it.');
  lines.push('Investigate the exact tag name (case, whitespace, alias) and scope');
  lines.push('a BGATR-B-SIDE-FIX to match it explicitly.');
} else {
  lines.push('Neither B1 nor B2 signature is unambiguous. Inspect the CSV rows.');
}

fs.writeFileSync(txtPath, lines.join('\n') + '\n');

console.log(lines.join('\n'));
console.log('\nWrote:');
console.log('  ' + csvPath);
console.log('  ' + txtPath);
