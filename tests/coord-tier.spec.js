import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Register clash at fixed (x,y,z) with element IDs blanked so pairKey lands on
// COMP or LEGACY only — that way we exercise the coord fall-through cleanly.
function seedClash(uid, x, y, z, sourceA = 'GAS_v_08_AMHS.nwc', sourceB = 'Structure.nwc', testName = '[H] Coord Tier Test') {
  return {
    uid,
    name: uid + ' — Coord',
    nwOrig: 'Clash-' + uid,
    testName,
    disciplineA: 'MEP', disciplineB: 'Structural',
    elementA: 'Duct-' + uid, elementB: 'Beam-' + uid,
    elementIdA: '', elementIdB: '', // force fall-through past ID tier
    elementIdSrcA: '', elementIdSrcB: '',
    sourceA, sourceB,
    penetration: '20mm',
    status: 'Active', priority: 'High',
    assignedTo: '', notes: '',
    date: '01/07/26',
    x, y, z,
    nwImageRef: '',
    statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
  };
}

// Build an XML with a single clash at (x,y,z) whose sources come through as
// c.eA.source / c.eB.source via the parser. Element IDs left absent so the
// merge falls past ID→COMP→LEGACY into the coord tier for identical-source
// same-XYZ imports.
function makeXml(x, y, z, sourceA = 'GAS_v_08_AMHS.nwc', sourceB = 'Structure.nwc', testName = '[H] Coord Tier Test', clashName = 'Fresh1') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="${testName}">
      <clashresult name="${clashName}" href="files\\cd000001.jpg" distance="-0.02">
        <clashpoint><pos3f x="${x}" y="${y}" z="${z}"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="7" day="15" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>${sourceA}</node></pathlink>
          <objectattribute><name>Item Name</name><value>Duct-fresh</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>${sourceB}</node></pathlink>
          <objectattribute><name>Item Name</name><value>Beam-fresh</value></objectattribute>
        </clashobject>
      </clashresult>
    </clashtest>
  </batchtest>
</exchange>`;
}

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  // INV-007: wait for the terminal inline one-shot migration gate so
  // window.onload's setTimeout(1500/1600)-deferred migrations don't
  // race and silently overwrite this test's seeded state.
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    nav('bcf');
  });
  await page.waitForSelector('#bxml');
}

async function seed(page, clashes) {
  await page.evaluate((clashes) => {
    S.clashes = clashes.slice();
    S.dedupQueue = [];
    const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
    _uid = mx;
    const today = new Date();
    S.weekly = [{
      label: 'Wk ' + isoWeekNum(today),
      date: today.toISOString().slice(0, 10),
      week: isoWeekNum(today), year: isoWeekYear(today),
      imports: [],
    }];
    sv('clashes', S.clashes);
    sv('weekly', S.weekly);
    sv('dedupQueue', S.dedupQueue);
  }, clashes);
}

async function importXml(page, xml) {
  await page.evaluate((xml) => {
    document.getElementById('bxml').value = xml;
    bparse();
    window._skipCrossTestDupes = true;
    importToRegister('append');
  }, xml);
}

test.describe('PAIR-KEY-COORD-TIER', () => {
  test('same test + sources + XYZ within 1mm → auto-merge, pairIdSource=coord, register stays at 1', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [seedClash('CLX-001', 100, 100, 100)]);

    // (100.5, 100.5, 100.5) is √0.75 ≈ 0.866 mm from (100,100,100). Under 1mm.
    await importXml(page, makeXml(100.5, 100.5, 100.5));

    const state = await page.evaluate(() => ({
      count: (S.clashes || []).length,
      first: S.clashes[0],
      dedupQueueLen: (S.dedupQueue || []).length,
    }));
    expect(state.count).toBe(1); // auto-merged, no new record added
    expect(state.first.pairIdSource).toBe('coord');
    // Coordinates refreshed to the incoming import's values so future
    // ≤1mm matches stay aligned as source models keep shifting.
    expect(state.first.x).toBeCloseTo(100.5, 3);
    expect(state.first.y).toBeCloseTo(100.5, 3);
    expect(state.first.z).toBeCloseTo(100.5, 3);
    // No dedup-queue candidate — that path is only for pairs > 1mm.
    expect(state.dedupQueueLen).toBe(0);
  });

  test('distance > 1mm but ≤ 500mm → NO auto-merge, register grows, dedup queue picks up 1 candidate', async ({ page }) => {
    await bootstrap(page);
    // Seed elements must match what the parser actually stamps on the
    // imported clash so DEDUP-SIGNATURE-FILTER lets the pair surface —
    // same physical intersection, coord fall-through above 1mm. The XML
    // in makeXml() carries no <smarttag>Item Name</smarttag> and no
    // <layer>, so parser falls through to elementA/B = 'Unknown'. Seed
    // to match.
    const seedC = seedClash('CLX-001', 100, 100, 100);
    seedC.elementA = 'Unknown';
    seedC.elementB = 'Unknown';
    await seed(page, [seedC]);

    // (105, 100, 100) is exactly 5mm from the seed. Above the strict
    // coord tier threshold, below the dedup ceiling.
    await importXml(page, makeXml(105, 100, 100));

    const state = await page.evaluate(() => ({
      count: (S.clashes || []).length,
      dedupQueue: S.dedupQueue,
    }));
    expect(state.count).toBe(2);
    expect(state.dedupQueue.length).toBe(1);
    expect(state.dedupQueue[0].distMm).toBeGreaterThan(1);
    expect(state.dedupQueue[0].distMm).toBeLessThanOrEqual(500);
    // Pair keys older-uid vs newer-uid so the candidate remains stable
    // across future scans.
    expect(state.dedupQueue[0].a).toBe('CLX-001');
    expect(state.dedupQueue[0].b).toMatch(/^CLX-/);
  });

  test('same XYZ but sourceA differs → NO auto-merge (strict source match required)', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [seedClash('CLX-001', 100, 100, 100, 'GAS_v_08_AMHS.nwc', 'Structure.nwc')]);

    // Same coordinates, but incoming has a different sourceA — the tier
    // must NOT auto-merge because the physical clash target changed.
    await importXml(page, makeXml(100, 100, 100, 'DIFFERENT_MEP.nwc', 'Structure.nwc'));

    const state = await page.evaluate(() => (S.clashes || []).length);
    expect(state).toBe(2);
  });

  test('basename-only source match (path prefix + case insensitivity ignored)', async ({ page }) => {
    await bootstrap(page);
    // Register carries the bare basename …
    await seed(page, [seedClash('CLX-001', 100, 100, 100, 'GAS_v_08_AMHS.nwc', 'Structure.nwc')]);
    // … incoming XML declares the same file but path-prefixed and
    // upper-cased — the coord tier normalises both sides to lowercase
    // basename so the merge still fires.
    await importXml(page, makeXml(100.2, 100.2, 100.2, 'C:\\Models\\GAS_V_08_AMHS.NWC', 'C:\\Models\\STRUCTURE.NWC'));

    const state = await page.evaluate(() => ({
      count: (S.clashes || []).length,
      first: S.clashes[0],
    }));
    expect(state.count).toBe(1);
    expect(state.first.pairIdSource).toBe('coord');
  });
});
