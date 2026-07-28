import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A6-BUILDING-SCOPED-TESTNAME contract:
   W31 incident: 29 XMLs across 4 subfolders on disk (CUP AMHS / CUP
   Exyte / FAB AMHS / FAB Exyte) shared many leaf names (e.g.
   03_GAS_v_08_AMHS.xml existed in both CUP-AMHS and FAB-AMHS
   folders). Under leaf-keyed _batchResults / _batchFilePaths the
   second-read file silently overwrote the first — Object.entries in
   batchParse only saw one entry per leaf, so FAB's XML was entirely
   lost.

   Fixture: 4 File objects with distinct webkitRelativePath, arranged
   as 2 same-leaf pairs across CUP + FAB subfolders:
     week-260727/260727 CUP AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml    (2 clashresults)
     week-260727/260727 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml    (62 clashresults)
     week-260727/260727 CUP Exyte v AMHS Clash test/Exyte CSA_v_08_AMHS.xml  (11 clashresults)
     week-260727/260727 FAB Exyte v AMHS Clash test/Exyte CSA_v_08_AMHS.xml  (529 clashresults)

   Post-fix expectations:
     - _batchResults has 4 distinct entries (path-keyed)
     - _bcfC.length === 604 (2 + 62 + 11 + 529)
     - S.clashes has 4 distinct display testNames:
         "03_GAS_v_08_AMHS (CUP)": 2
         "03_GAS_v_08_AMHS (FAB)": 62
         "Exyte CSA_v_08_AMHS (CUP)": 11
         "Exyte CSA_v_08_AMHS (FAB)": 529
     - Every clash has non-null buildingScope
     - rawTestName preserved separately

   Pre-fix (origin/main): leaf-keying loses two of the four files;
   S.clashes ends up with either 2 or 531 clashes on 2 testName
   values (order-dependent). */

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof S !== 'undefined'
    && typeof batchLoad === 'function'
    && typeof batchParse === 'function'
    && typeof importToRegister === 'function'
    && typeof _extractBuildingScope === 'function');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';
    S.clashes = []; S.weekly = [];
    sv('clashes', S.clashes); sv('weekly', S.weekly);
    // Suppress the cross-test dedup modal (PR-A5) so importToRegister
    // completes without user interaction — the fixture doesn't
    // introduce cross-test dupes anyway (register is empty).
    window._skipCrossTestDupes = true;
    window.confirm = () => true;
    window.alert = () => {};
    window.open = () => null;
    // batchLoad reads DOM elements that only exist on the BCF tab;
    // nav there so the elements render before we invoke batchLoad.
    if (typeof nav === 'function') nav('bcf');
  });
  // Wait for the BCF tab DOM elements batchLoad depends on.
  await page.waitForSelector('#b-file-chips', { timeout: 5000 }).catch(() => {});
}

// Build a minimal XML string with N clashresults, all populated with
// enough attributes for the parser to accept + persist them.
function buildXml(testName, count) {
  const results = Array.from({length: count}, (_, i) => `
      <clashresult name="Clash${i+1}" status="new" distance="0.01">
        <clashpoint><pos3f x="${i}" y="0" z="0"/></clashpoint>
        <createddate><date year="2026" month="7" day="27" hour="0" minute="0" second="0"/></createddate>
        <clashobject>
          <objectattribute><name>GUID</name><value>GA-${testName}-${i+1}</value></objectattribute>
          <smarttag><name>Item Name</name><value>Wall_${i+1}</value></smarttag>
          <smarttag><name>Item Type</name><value>Solid</value></smarttag>
          <layer>FAB_L20</layer>
          <pathlink><node>proj.nwd</node><node>AMHS-E-F-00.nwc</node><node>modelroot</node><node>Walls</node><node>Wall_${i+1}</node></pathlink>
        </clashobject>
        <clashobject>
          <objectattribute><name>GUID</name><value>GB-${testName}-${i+1}</value></objectattribute>
          <smarttag><name>Item Name</name><value>Duct_${i+1}</value></smarttag>
          <smarttag><name>Item Type</name><value>Solid</value></smarttag>
          <layer>FAB_L20</layer>
          <pathlink><node>proj.nwd</node><node>AMHS-M-F-00.nwc</node><node>modelroot</node><node>Ducts</node><node>Duct_${i+1}</node></pathlink>
        </clashobject>
      </clashresult>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="m">
  <batchtest units="m">
    <clashtest name="${testName}" units="m">
      ${results}
    </clashtest>
  </batchtest>
</exchange>`;
}

test.describe('PR-A6-BUILDING-SCOPED-TESTNAME — same-leaf-across-folders lands as distinct testNames', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('_extractBuildingScope resolves folder-segment tokens (FAB, CUP, CUB→CUP)', async ({ page }) => {
    const out = await page.evaluate(() => ({
      fab_amhs:  _extractBuildingScope('week-260727/260727 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml'),
      fab_exyte: _extractBuildingScope('week-260727/260727 FAB Exyte v AMHS Clash test/Exyte CSA_v_08_AMHS.xml'),
      cup:       _extractBuildingScope('week-260727/260727 CUP AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml'),
      cub_norm:  _extractBuildingScope('week-260727/260727 CUB legacy folder/Test.xml'),
      backslash: _extractBuildingScope('week-260727\\260727 FAB AMHS v 7 Clash test\\03_GAS_v_08_AMHS.xml'),
      noWrap:    _extractBuildingScope('Test.xml'),
      empty:     _extractBuildingScope(''),
      no_token:  _extractBuildingScope('week-260727/misc folder/Test.xml'),
    }));
    expect(out.fab_amhs).toBe('FAB');
    expect(out.fab_exyte).toBe('FAB');
    expect(out.cup).toBe('CUP');
    expect(out.cub_norm).toBe('CUP');    // CUB → CUP
    expect(out.backslash).toBe('FAB');    // Windows separator
    expect(out.noWrap).toBeNull();
    expect(out.empty).toBeNull();
    expect(out.no_token).toBeNull();
  });

  test('batchLoad key collision — same-leaf files across subfolders each land in _batchResults', async ({ page }) => {
    // Construct 4 File objects with distinct webkitRelativePath.
    // In-browser `new File(...)` doesn't accept webkitRelativePath in
    // the options bag; use Object.defineProperty to attach it as a
    // read-only property (matches browser folder-picker semantics).
    const result = await page.evaluate(async ({ xmls }) => {
      function mkFile(name, content, relPath) {
        const f = new File([content], name, {type: 'text/xml'});
        Object.defineProperty(f, 'webkitRelativePath', {value: relPath, writable: false});
        return f;
      }
      const files = [
        mkFile('03_GAS_v_08_AMHS.xml',   xmls.cupGas,   'week-260727/260727 CUP AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml'),
        mkFile('03_GAS_v_08_AMHS.xml',   xmls.fabGas,   'week-260727/260727 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml'),
        mkFile('Exyte CSA_v_08_AMHS.xml', xmls.cupCsa,  'week-260727/260727 CUP Exyte v AMHS Clash test/Exyte CSA_v_08_AMHS.xml'),
        mkFile('Exyte CSA_v_08_AMHS.xml', xmls.fabCsa,  'week-260727/260727 FAB Exyte v AMHS Clash test/Exyte CSA_v_08_AMHS.xml'),
      ];
      // batchLoad reads asynchronously via FileReader. Kick it and
      // poll until all 4 reads have finished (progress counter hits 4).
      batchLoad(files);
      // Poll: _batchResults gets populated per file read. Wait until
      // Object.keys length reaches 4 or timeout.
      const start = Date.now();
      while (Object.keys(_batchResults).length < 4 && (Date.now() - start) < 5000) {
        await new Promise(r => setTimeout(r, 20));
      }
      return {
        keyCount: Object.keys(_batchResults).length,
        keys: Object.keys(_batchResults).sort(),
        filePathsCount: Object.keys(_batchFilePaths).length,
      };
    }, { xmls: {
      cupGas:  buildXml('03_GAS_v_08_AMHS', 2),
      fabGas:  buildXml('03_GAS_v_08_AMHS', 62),
      cupCsa:  buildXml('Exyte CSA_v_08_AMHS', 11),
      fabCsa:  buildXml('Exyte CSA_v_08_AMHS', 529),
    }});
    // All 4 files must survive — path-keyed maps preserve every distinct
    // webkitRelativePath. Pre-fix (leaf-keyed) the count is 2.
    expect(result.keyCount).toBe(4);
    expect(result.filePathsCount).toBe(4);
    expect(result.keys).toEqual([
      'week-260727/260727 CUP AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml',
      'week-260727/260727 CUP Exyte v AMHS Clash test/Exyte CSA_v_08_AMHS.xml',
      'week-260727/260727 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml',
      'week-260727/260727 FAB Exyte v AMHS Clash test/Exyte CSA_v_08_AMHS.xml',
    ]);
  });

  test('end-to-end: 4 same-leaf files import as 4 distinct display testNames with correct counts', async ({ page }) => {
    const state = await page.evaluate(async ({ xmls }) => {
      function mkFile(name, content, relPath) {
        const f = new File([content], name, {type: 'text/xml'});
        Object.defineProperty(f, 'webkitRelativePath', {value: relPath, writable: false});
        return f;
      }
      const files = [
        mkFile('03_GAS_v_08_AMHS.xml',   xmls.cupGas,  'week-260727/260727 CUP AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml'),
        mkFile('03_GAS_v_08_AMHS.xml',   xmls.fabGas,  'week-260727/260727 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml'),
        mkFile('Exyte CSA_v_08_AMHS.xml', xmls.cupCsa, 'week-260727/260727 CUP Exyte v AMHS Clash test/Exyte CSA_v_08_AMHS.xml'),
        mkFile('Exyte CSA_v_08_AMHS.xml', xmls.fabCsa, 'week-260727/260727 FAB Exyte v AMHS Clash test/Exyte CSA_v_08_AMHS.xml'),
      ];
      batchLoad(files);
      // Wait for all reads.
      const start = Date.now();
      while (Object.keys(_batchResults).length < 4 && (Date.now() - start) < 5000) {
        await new Promise(r => setTimeout(r, 20));
      }
      // Parse: batchParse expects (files, errors, readCount) but only
      // reads _batchResults + files for mtime — we pass files-array,
      // no errors, real read count.
      batchParse(files, [], files.length);
      const parsedCount = (_bcfC || []).length;
      // Import into empty register. _skipCrossTestDupes stub set in
      // bootstrap suppresses the modal. Cross-test dedup returns [] on
      // an empty register anyway.
      importToRegister('append');
      // Group by testName.
      const byTest = {};
      (S.clashes || []).forEach(c => {
        byTest[c.testName] = (byTest[c.testName] || 0) + 1;
      });
      // Every clash must carry buildingScope + rawTestName.
      const allHaveScope = (S.clashes || []).every(c => c.buildingScope === 'FAB' || c.buildingScope === 'CUP');
      const allHaveRaw = (S.clashes || []).every(c => c.rawTestName && !/\((FAB|CUP)\)/.test(c.rawTestName));
      return {
        parsedCount,
        total: (S.clashes || []).length,
        byTest,
        allHaveScope,
        allHaveRaw,
        distinctTests: Object.keys(byTest).sort(),
      };
    }, { xmls: {
      cupGas:  buildXml('03_GAS_v_08_AMHS', 2),
      fabGas:  buildXml('03_GAS_v_08_AMHS', 62),
      cupCsa:  buildXml('Exyte CSA_v_08_AMHS', 11),
      fabCsa:  buildXml('Exyte CSA_v_08_AMHS', 529),
    }});
    expect(state.parsedCount).toBe(2 + 62 + 11 + 529);
    expect(state.total).toBe(604);
    expect(state.distinctTests).toEqual([
      '03_GAS_v_08_AMHS (CUP)',
      '03_GAS_v_08_AMHS (FAB)',
      'Exyte CSA_v_08_AMHS (CUP)',
      'Exyte CSA_v_08_AMHS (FAB)',
    ]);
    expect(state.byTest['03_GAS_v_08_AMHS (CUP)']).toBe(2);
    expect(state.byTest['03_GAS_v_08_AMHS (FAB)']).toBe(62);
    expect(state.byTest['Exyte CSA_v_08_AMHS (CUP)']).toBe(11);
    expect(state.byTest['Exyte CSA_v_08_AMHS (FAB)']).toBe(529);
    expect(state.allHaveScope).toBe(true);
    expect(state.allHaveRaw).toBe(true);
  });

  test('clashBuildingGroup prefers c.buildingScope over legacy inference', async ({ page }) => {
    const out = await page.evaluate(() => {
      // A CUP-scoped clash whose level says FAB and whose testName/source say nothing
      // — buildingScope should win over the legacy inference.
      const c1 = { buildingScope: 'CUP', level: 'FAB_L20', testName: 'X', sourceA: 'x.nwc', sourceB: 'y.nwc' };
      const c2 = { buildingScope: 'FAB', level: '', testName: 'X', sourceA: '', sourceB: '' };
      // Legacy clash with no buildingScope — falls back to level parsing.
      const c3 = { level: 'FAB_L40', testName: 'X' };
      // Legacy clash with no scope, no level — falls back to metadata scan.
      const c4 = { level: '', testName: 'FAB Exyte CSA', sourceA: 'AMHS-F-00.nwc' };
      return {
        c1: clashBuildingGroup(c1),
        c2: clashBuildingGroup(c2),
        c3: clashBuildingGroup(c3),
        c4: clashBuildingGroup(c4),
      };
    });
    expect(out.c1).toBe('CUP');
    expect(out.c2).toBe('FAB');
    expect(out.c3).toBe('FAB');
    expect(out.c4).toBe('FAB');
  });
});
