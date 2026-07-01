#!/usr/bin/env node
/**
 * PAIR-ID-MERGE diagnostic — Phase A of the zero-elementIdB investigation.
 *
 * Mirrors working.html parser 1's clashresult/clashgroup walk + bgatr() logic
 * (working.html:~5944, ~6626). Read-only — no changes to the parser or
 * DATA_VERSION.
 *
 * Accepts a single XML file OR a directory. When given a directory, walks it
 * recursively for .xml files (case-insensitive), skipping empty files and
 * Office lock filenames (contain '~' or '$'). Every clash gets enriched with
 * the parent folder's YYMMDD → exportDate and building (FAB / CUB→CUP / BSGS)
 * so the aggregate output is bucketed the way the user's archive is organised.
 *
 * Usage:
 *   cd scripts
 *   npm install
 *   node diag-pair-id.mjs /tmp/sample_clash.xml
 *   node diag-pair-id.mjs "/path/to/Clash Tests"
 *
 * Emits (in scripts/):
 *   diag-pair-id-report-detail.csv    — one row per clash
 *   diag-pair-id-report-summary.csv   — one row per (exportDate, building, testName)
 *
 * The console dump at end of run answers the B1-vs-B2 question:
 *   B1  side B carries no Element ID at all in the data → PAIR-ID-COMPOSITE
 *   B2  side B carries Element ID but under a variant name → BGATR-B-SIDE-FIX
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

const rawArgs = process.argv.slice(2);
if (!rawArgs.length) rawArgs.push('/tmp/sample_clash.xml');

// ── Input resolution: file OR directory ─────────────────────────────────────
function isSkippable(fname) {
  return /[~$]/.test(fname);
}

function walkXml(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    let st;
    try { st = fs.statSync(cur); } catch { continue; }
    if (st.isDirectory()) {
      let entries;
      try { entries = fs.readdirSync(cur); } catch { continue; }
      for (const e of entries) stack.push(path.join(cur, e));
    } else if (st.isFile()) {
      const base = path.basename(cur);
      if (!/\.xml$/i.test(base)) continue;
      if (isSkippable(base)) continue;
      if (st.size === 0) continue;
      out.push(cur);
    }
  }
  return out.sort();
}

const inputFiles = [];
const inputDirs = [];
const inputMissing = [];
for (const a of rawArgs) {
  if (!fs.existsSync(a)) { inputMissing.push(a); continue; }
  const s = fs.statSync(a);
  if (s.isDirectory()) inputDirs.push(a);
  else if (s.isFile()) inputFiles.push(a);
}
if (inputMissing.length) {
  console.error('Missing input path(s):\n  ' + inputMissing.join('\n  '));
  console.error('\nPass a file or a directory root (e.g. /tmp/sample_clash.xml or "/path/to/Clash Tests").');
  process.exit(2);
}

const discovered = [
  ...inputFiles,
  ...inputDirs.flatMap(d => walkXml(d)),
];
// De-dup while preserving first-seen order
const seen = new Set();
const xmlPaths = discovered.filter(p => (seen.has(p) ? false : (seen.add(p), true)));

// ── Folder-name enrichment ──────────────────────────────────────────────────
// YYMMDD prefix at positions 0-5. Building token FAB / CUB / CUP / BSGS anywhere.
// CUB is normalised to CUP per project taxonomy rules (CLAUDE.md).
function enrichFromFolder(folderName) {
  const out = { sourceFolder: folderName, exportDate: '', building: '' };
  const dm = folderName.match(/^(\d{2})(\d{2})(\d{2})/);
  if (dm) out.exportDate = `20${dm[1]}-${dm[2]}-${dm[3]}`;
  const bm = folderName.match(/\b(FAB|CUB|CUP|BSGS)\b/i);
  if (bm) {
    const b = bm[1].toUpperCase();
    out.building = (b === 'CUB') ? 'CUP' : b;
  }
  return out;
}

// ── Parser helpers — must mirror working.html bgatr() at ~5944 exactly ──────
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

function bgetSource(el) {
  if (!el) return '';
  const paths = el.querySelectorAll('path node');
  const items = [...paths].map(n => n.textContent.trim()).filter(Boolean);
  const nwc = items.filter(x => /\.nwc$/i.test(x)).pop();
  if (nwc) return nwc;
  const nwd = items.filter(x => /\.nwd$/i.test(x)).pop();
  if (nwd) return nwd;
  return items[items.length - 1] || '';
}

// ── Per-XML parse (never let one bad XML abort the whole run) ────────────────
const rows = [];
const failedFiles = [];
let processed = 0;
let skippedEmpty = 0;    // counted implicitly by walkXml; kept for symmetry

for (const p of xmlPaths) {
  const folder = path.basename(path.dirname(p));
  const enrich = enrichFromFolder(folder);
  try {
    const xml = fs.readFileSync(p, 'utf8');
    const { document } = parseHTML(xml);
    let batches = [...document.querySelectorAll('clashtest')];
    if (!batches.length) batches = [...document.querySelectorAll('batchtest')];
    for (const batch of batches) {
      const testName = batch.getAttribute('name') || path.basename(p, '.xml');
      let clashes = [...batch.querySelectorAll('clashresult')];
      if (!clashes.length) clashes = [...batch.querySelectorAll('clashgroup')];
      for (const c of clashes) {
        const nwName = c.getAttribute('name') || '';
        const obs = [...c.querySelectorAll('clashobject')];
        const oA = obs[0] || null;
        const oB = obs[1] || null;
        rows.push({
          file: path.basename(p),
          sourceFolder: enrich.sourceFolder,
          exportDate: enrich.exportDate,
          building: enrich.building,
          testName,
          nwName,
          hasObsA: !!oA,
          hasObsB: !!oB,
          elementIdA: bgatr(oA, 'Element ID'),
          elementIdB: bgatr(oB, 'Element ID'),
          attrNamesA: allAttrNames(oA).join('|'),
          attrNamesB: allAttrNames(oB).join('|'),
          sourceA: bgetSource(oA),
          sourceB: bgetSource(oB),
        });
      }
    }
    processed++;
  } catch (err) {
    failedFiles.push({ file: p, error: err.message });
  }
}

// ── CSV emit ────────────────────────────────────────────────────────────────
const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const detailCsv = path.join(outDir, 'diag-pair-id-report-detail.csv');
const summaryCsv = path.join(outDir, 'diag-pair-id-report-summary.csv');

const csvEsc = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const detailHeader = [
  'file','sourceFolder','exportDate','building','testName','nwName',
  'hasObsA','hasObsB','elementIdA','elementIdB',
  'attrNamesA','attrNamesB','sourceA','sourceB'
];
fs.writeFileSync(
  detailCsv,
  [detailHeader.join(',')]
    .concat(rows.map(r => detailHeader.map(k => csvEsc(r[k])).join(',')))
    .join('\n') + '\n'
);

// Summary — group by (exportDate, building, testName)
const groupMap = new Map();
for (const r of rows) {
  const key = `${r.exportDate}${r.building}${r.testName}`;
  let g = groupMap.get(key);
  if (!g) {
    g = {
      exportDate: r.exportDate,
      building: r.building,
      testName: r.testName,
      clashCount: 0,
      sideA: 0,
      sideB: 0,
      sideBSignatures: new Set(),
      sideBSources: new Set(),
    };
    groupMap.set(key, g);
  }
  g.clashCount++;
  if (r.elementIdA) g.sideA++;
  if (r.elementIdB) g.sideB++;
  else {
    g.sideBSignatures.add(r.attrNamesB || '(no objectattributes)');
    if (r.sourceB) g.sideBSources.add(r.sourceB);
  }
}
const pct = (a, b) => b ? ((100 * a / b).toFixed(1) + '%') : '0.0%';
const summaryHeader = [
  'exportDate','building','testName','clashCount',
  'sideACoveragePct','sideBCoveragePct',
  'distinctSideBObjAttrSignatures','distinctSideBSourceNwc'
];
fs.writeFileSync(
  summaryCsv,
  [summaryHeader.join(',')]
    .concat([...groupMap.values()]
      .sort((a, b) => (a.exportDate.localeCompare(b.exportDate)) ||
                       (a.building.localeCompare(b.building)) ||
                       (a.testName.localeCompare(b.testName)))
      .map(g => [
        g.exportDate, g.building, g.testName, g.clashCount,
        pct(g.sideA, g.clashCount), pct(g.sideB, g.clashCount),
        g.sideBSignatures.size, g.sideBSources.size,
      ].map(csvEsc).join(',')))
    .join('\n') + '\n'
);

// ── Console dump ────────────────────────────────────────────────────────────
const totalXmls = xmlPaths.length;
const totA = rows.filter(r => r.elementIdA).length;
const totB = rows.filter(r => r.elementIdB).length;

// Signature aggregation for B1-vs-B2 verdict
const sigCounts = new Map();
for (const r of rows) {
  if (r.elementIdB || !r.hasObsB) continue;
  const key = r.attrNamesB || '(no objectattributes)';
  sigCounts.set(key, (sigCounts.get(key) || 0) + 1);
}
const topSigs = [...sigCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

const bldCounts = new Map();
for (const r of rows) {
  const b = r.building || '(unknown)';
  bldCounts.set(b, (bldCounts.get(b) || 0) + 1);
}
const bldRows = [...bldCounts.entries()].sort((a, b) => b[1] - a[1]);

const out = [];
out.push('PAIR-ID-MERGE diagnostic — Phase A');
out.push('='.repeat(60));
out.push(`XMLs found:      ${totalXmls}`);
out.push(`XMLs processed:  ${processed}`);
out.push(`XMLs failed:     ${failedFiles.length}`);
out.push('');
out.push(`Total clashes parsed:          ${rows.length}`);
out.push(`Side A Element ID coverage:    ${totA} / ${rows.length}  (${pct(totA, rows.length)})`);
out.push(`Side B Element ID coverage:    ${totB} / ${rows.length}  (${pct(totB, rows.length)})`);
out.push('');
out.push('Top 5 distinct side-B objectattribute signatures (Element ID missing)');
out.push('-'.repeat(60));
if (!topSigs.length) out.push('  (none — either every side B had Element ID, or no clashes parsed)');
for (const [k, v] of topSigs) out.push(`  n=${v}  { ${k} }`);
out.push('');
out.push('Building distribution');
out.push('-'.repeat(60));
for (const [k, v] of bldRows) out.push(`  ${k.padEnd(10)}  ${v}`);
out.push('');
if (failedFiles.length) {
  out.push('Files that failed to parse');
  out.push('-'.repeat(60));
  for (const f of failedFiles) out.push(`  ${f.file}  — ${f.error}`);
  out.push('');
}
out.push('Root cause interpretation');
out.push('-'.repeat(60));
const sigHasElementIdVariant = topSigs.some(([k]) => /element\s*id/i.test(k));
if (rows.length === 0) {
  out.push('No clashes parsed — cannot classify. Check input paths.');
} else if (totB === 0 && !sigHasElementIdVariant) {
  out.push('B1 verdict: no clashobject on side B carries an "Element ID"');
  out.push('objectattribute in ANY shape bgatr() understands. The identifier is');
  out.push('absent from the archive — a composite pair key (PAIR-ID-COMPOSITE)');
  out.push('is the correct remedy, not a parser change.');
} else if (sigHasElementIdVariant) {
  out.push('B2 verdict: a case/spacing variant of "Element ID" appears in the');
  out.push('side-B objectattribute name set but bgatr() misses it. Scope a');
  out.push('targeted BGATR-B-SIDE-FIX to the exact variant seen.');
} else {
  out.push('Mixed signature — inspect the top signatures above and the detail');
  out.push('CSV before deciding between B1 and B2.');
}
out.push('');
out.push('Wrote:');
out.push('  ' + detailCsv);
out.push('  ' + summaryCsv);
console.log(out.join('\n'));
