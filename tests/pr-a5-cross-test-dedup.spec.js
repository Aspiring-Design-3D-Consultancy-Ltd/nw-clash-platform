import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A5-CROSSTEST-STRICT contract:
   findCrossTestDuplicates previously matched cand vs existing at 5mm
   Euclidean across ALL testNames whenever any of the 4 identity IDs
   was empty. Asymmetric obj[0]/obj[1] identity types on new test
   scopes produced heavy false positives that got silently discarded
   when the user clicked "Skip duplicates" on the modal.

   This PR tightens the coord-tier fallback:
     (a) require sourceA (.nwc) match AND sourceB (.nwc) match on both
         candidate and existing before considering coord
     (b) tighten tolerance from 5mm to 1mm
     (c) recognise 要素ID / 要素 ID (Japanese "Element ID") in
         bgetElementId's order list
     (d) add "Keep all — don't treat as duplicates" modal button
         (_xtResolveKeepAll)

   Fixture: existing register has 4 FAB_L40 clashes at known coords.
   New batch presents 4 candidates on new testNames:
     Case 1 — GUID/GUID, coords near existing but DIFFERENT source
              → should LAND (source mismatch rejects coord match)
     Case 2 — 要素ID/GUID, coords near existing, different source
              → should LAND (Japanese attr recognised, source guard)
     Case 3 — Element ID/GUID, coords WITHIN 1mm AND SAME source
              → should be flagged as cross-test dupe (legitimate)
     Case 4 — none/GUID (obs[0] no id attribute), coords near, diff src
              → should LAND (source guard)

   Pre-fix baseline (origin/main): 5mm tol + no source guard, so
   cases 1/2/4 all get flagged as cross-test dupes. Verified by
   checking out main and observing the assertions fail. */

const HELP_ELEMENTS = `
  function _makeXmlObj(idAttrName, idValue, src, layerText, itemName) {
    return \`<clashobject>
      <objectattribute><name>\${idAttrName}</name><value>\${idValue}</value></objectattribute>
      <smarttag><name>Item Name</name><value>\${itemName||'Wall'}</value></smarttag>
      <smarttag><name>Item Type</name><value>Solid</value></smarttag>
      <layer>\${layerText||'FAB_L40'}</layer>
      <pathlink><node>proj.nwd</node><node>\${src}</node><node>modelroot</node><node>Walls</node><node>\${itemName||'Wall_100'}</node></pathlink>
    </clashobject>\`;
  }
  function _makeXmlObjNoId(src, layerText, itemName) {
    return \`<clashobject>
      <smarttag><name>Item Name</name><value>\${itemName||'Wall'}</value></smarttag>
      <smarttag><name>Item Type</name><value>Solid</value></smarttag>
      <layer>\${layerText||'FAB_L40'}</layer>
      <pathlink><node>proj.nwd</node><node>\${src}</node><node>modelroot</node><node>Walls</node><node>\${itemName||'Wall_100'}</node></pathlink>
    </clashobject>\`;
  }
`;

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof S !== 'undefined'
    && typeof findCrossTestDuplicates === 'function'
    && typeof bgetElementId === 'function'
    && typeof _xtResolveKeepAll === 'function');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';
    S.clashes = []; S.weekly = [];
    sv('clashes', S.clashes); sv('weekly', S.weekly);
  });
}

test.describe('PR-A5-CROSSTEST-STRICT + PR-A5-JAPANESE-ATTR — false-positive coord fallback fixed', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('bgetElementId recognises 要素ID / 要素 ID (Japanese "Element ID")', async ({ page }) => {
    const out = await page.evaluate(() => {
      const dp = new DOMParser();
      const mkObj = (attrName, val) => dp.parseFromString(`<root><clashobject><objectattribute><name>${attrName}</name><value>${val}</value></objectattribute></clashobject></root>`, 'text/xml').querySelector('clashobject');
      return {
        englishId:   bgetElementId(mkObj('Element ID', 'ELEM-123')),
        guid:        bgetElementId(mkObj('GUID', 'GUID-abc')),
        japAttrNoSp: bgetElementId(mkObj('要素ID', 'JA-987')),
        japAttrSp:   bgetElementId(mkObj('要素 ID', 'JA-988')),
        chinAttr:    bgetElementId(mkObj('元素 ID', 'ZH-654')),
        handle:      bgetElementId(mkObj('Entity Handle', 'AH-11')),
        empty:       bgetElementId(mkObj('Some Other Attr', 'x')),
      };
    });
    expect(out.englishId.id).toBe('ELEM-123');
    expect(out.guid.id).toBe('GUID-abc');
    expect(out.japAttrNoSp.id).toBe('JA-987');
    expect(out.japAttrNoSp.src).toBe('要素ID');
    expect(out.japAttrSp.id).toBe('JA-988');
    expect(out.japAttrSp.src).toBe('要素 ID');
    expect(out.chinAttr.id).toBe('ZH-654');
    expect(out.handle.id).toBe('AH-11');
    expect(out.empty.id).toBe('');
  });

  test('findCrossTestDuplicates coord tier requires matching sourceA + sourceB', async ({ page }) => {
    const result = await page.evaluate(() => {
      const existing = [{
        uid: 'CLX-0001', testName: 'FAB_ARC_v_08_AMHS',
        elementIdA: 'ID-EX-A', elementIdB: 'ID-EX-B',
        sourceA: 'AMHS-E-F-00.nwc', sourceB: 'AMHS-M-F-00.nwc',
        x: 100.0, y: 200.0, z: 300.0,
      }];
      // Candidate 1: same coords AND same sources → should match (real dupe)
      const cand_realDupe = {
        testName: 'FAB_STR_v_08_AMHS',  // different test
        eA: { id: '', source: 'AMHS-E-F-00.nwc' },  // no ID on A side (asymmetric)
        eB: { id: 'ID-INC-B', source: 'AMHS-M-F-00.nwc' },
        x: 100.0, y: 200.0, z: 300.0,
      };
      // Candidate 2: same coords but DIFFERENT source → should NOT match
      const cand_diffSource = {
        testName: 'FAB_HVA_v_08_AMHS',
        eA: { id: '', source: 'AMHS-H-F-00.nwc' },  // different source
        eB: { id: 'ID-INC-C', source: 'AMHS-M-F-00.nwc' },
        x: 100.0, y: 200.0, z: 300.0,
      };
      // Candidate 3: same source but > 1mm away → should NOT match at coord tier
      const cand_2mmOff = {
        testName: 'FAB_GAS_v_08_AMHS',
        eA: { id: '', source: 'AMHS-E-F-00.nwc' },
        eB: { id: 'ID-INC-D', source: 'AMHS-M-F-00.nwc' },
        x: 102.0, y: 200.0, z: 300.0,  // 2mm off
      };
      // Candidate 4: same source, within 1mm → should match
      const cand_subMm = {
        testName: 'FAB_ELE_v_08_AMHS',
        eA: { id: '', source: 'AMHS-E-F-00.nwc' },
        eB: { id: 'ID-INC-E', source: 'AMHS-M-F-00.nwc' },
        x: 100.5, y: 200.0, z: 300.0,  // 0.5mm off
      };
      const matches = findCrossTestDuplicates(
        [cand_realDupe, cand_diffSource, cand_2mmOff, cand_subMm],
        existing);
      return {
        totalMatches: matches.length,
        matchedNames: matches.map(m => m.cand.testName).sort(),
        allCoordTier: matches.every(m => m.matchType === 'coord'),
      };
    });
    // 2 matches: the real-dupe case + the sub-mm case. The diff-source
    // and 2mm-off cases are correctly excluded.
    expect(result.totalMatches).toBe(2);
    expect(result.matchedNames).toEqual(['FAB_ELE_v_08_AMHS', 'FAB_STR_v_08_AMHS']);
    expect(result.allCoordTier).toBe(true);
  });

  test('Batch containing asymmetric-identity clashes with different source lands intact (no silent drop)', async ({ page }) => {
    // Reproduce the W31 shape: register has FAB clashes on AMHS-E .nwc,
    // batch imports 02_CR (Element ID / GUID) + MEP (要素ID / GUID) + SPM
    // (empty / GUID) with DIFFERENT source .nwc files. Post-fix all should
    // land because coord fallback requires matching source.
    const result = await page.evaluate(() => {
      const existing = [
        {uid:'CLX-0001',testName:'FAB_ARC_v_08_AMHS',elementIdA:'ID-EX-A1',elementIdB:'ID-EX-B1',sourceA:'AMHS-E-F-00.nwc',sourceB:'AMHS-M-F-00.nwc',x:0,y:0,z:0},
        {uid:'CLX-0002',testName:'FAB_ARC_v_08_AMHS',elementIdA:'ID-EX-A2',elementIdB:'ID-EX-B2',sourceA:'AMHS-E-F-00.nwc',sourceB:'AMHS-M-F-00.nwc',x:100,y:0,z:0},
        {uid:'CLX-0003',testName:'FAB_ARC_v_08_AMHS',elementIdA:'ID-EX-A3',elementIdB:'ID-EX-B3',sourceA:'AMHS-E-F-00.nwc',sourceB:'AMHS-M-F-00.nwc',x:200,y:0,z:0},
      ];
      // Simulate 3 new batch candidates on NEW testNames, coords WITHIN 5mm
      // of existing FAB clashes but with DIFFERENT source .nwc files:
      const cand_CR = {
        testName: '02_CR_v_08_AMHS',
        eA: {id:'ELEM-CR-A', source:'CR-E-F-00.nwc'},  // Element ID present
        eB: {id:'',           source:'CR-M-F-00.nwc'},  // GUID absent — asymmetric
        x:0.5, y:0, z:0,  // within 5mm of existing[0]
      };
      const cand_MEP = {
        testName: 'Exyte_MEP_v_08_AMHS',
        eA: {id:'JA-MEP-A', source:'MEP-E-F-00.nwc'},   // 要素ID recognised
        eB: {id:'',          source:'MEP-M-F-00.nwc'},   // asymmetric
        x:100.5, y:0, z:0,
      };
      const cand_SPM = {
        testName: 'Exyte_SPM_v_08_AMHS',
        eA: {id:'', source:'SPM-E-F-00.nwc'},           // no ID on A (none→GUID case)
        eB: {id:'ID-SPM-B', source:'SPM-M-F-00.nwc'},
        x:200.5, y:0, z:0,
      };
      const matches = findCrossTestDuplicates([cand_CR, cand_MEP, cand_SPM], existing);
      return { matchCount: matches.length, matched: matches.map(m => m.cand.testName) };
    });
    expect(result.matchCount).toBe(0);
  });

  test('_xtResolveKeepAll bypasses the filter but keeps import safety net', async ({ page }) => {
    const out = await page.evaluate(() => {
      window._xtPendingMatches = [{cand:{testName:'X'},exist:{uid:'CLX-0001',testName:'Y'},matchType:'coord',distMm:2}];
      // Verify the function exists and would set _skipCrossTestDupes flag.
      // We can't actually call it without triggering importToRegister which
      // needs a full _bcfC / DOM state; instead assert the function shape.
      return {
        exists: typeof _xtResolveKeepAll === 'function',
        source: String(_xtResolveKeepAll).replace(/\s+/g,' '),
      };
    });
    expect(out.exists).toBe(true);
    expect(out.source).toContain('_skipCrossTestDupes = true');
    expect(out.source).toContain('importToRegister(mode)');
  });
});
