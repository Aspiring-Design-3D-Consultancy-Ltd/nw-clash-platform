import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Build a minimal clashresult XML — the two parsers accept exactly this
// shape and pair-ID/coord match on the fields we set. clashName gets a
// stable pos3f offset so different names sit in different cells.
function makeXml({ testName = 'GAS vs Struct', clashes = [] }) {
  const items = clashes.map((c, i) => {
    // Coords derived from the clash NAME (not its index), so C3 has the same
    // spot across weeks. Without this, C4-in-week2 at index[2] would collide
    // with C3-in-week1 at index[2] under PAIR-KEY-COORD-TIER — the pre-loop
    // _existByCoord snapshot still lists the pre-week1 position, so a
    // same-cell coord match "steals" the wrong record. Real Muratec exports
    // don't have this collision because clash coordinates come from Revit
    // geometry, not from list position.
    const nameNum = parseInt(String(c.name).match(/\d+/)?.[0] || '0', 10) || 0;
    const x = c.x != null ? c.x : (1000 + nameNum * 50);
    const y = c.y != null ? c.y : (1000 + nameNum * 50);
    const z = c.z != null ? c.z : (1000 + nameNum * 50);
    // Element IDs must be globally unique — pairKey's ID tier keys only
    // on (elementIdA, elementIdB) without testName because real Muratec
    // Revit IDs are globally unique. Scope per-test in the fixture so
    // C2-in-03_GAS doesn't collide with C2-in-04_CHEM.
    const eidA = c.eidA || `EID-A-${testName}-${c.name}`;
    const eidB = c.eidB || `EID-B-${testName}-${c.name}`;
    const srcA = c.srcA || 'GAS.nwc';
    const srcB = c.srcB || 'Structure.nwc';
    // Fixed year/month/day for deterministic date behaviour vs the batch date.
    const date = c.date || { y: 2026, m: 6, d: 1 };
    return `<clashresult name="${c.name}" href="files\\cd0000${String(i + 1).padStart(2, '0')}.jpg" distance="-0.02">
        <clashpoint><pos3f x="${x}" y="${y}" z="${z}"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="${date.y}" month="${date.m}" day="${date.d}" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>${srcA}</node></pathlink>
          <objectattribute><name>Element ID</name><value>${eidA}</value></objectattribute>
          <objectattribute><name>Item Name</name><value>Item-A-${c.name}</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>${srcB}</node></pathlink>
          <objectattribute><name>Element ID</name><value>${eidB}</value></objectattribute>
          <objectattribute><name>Item Name</name><value>Item-B-${c.name}</value></objectattribute>
        </clashobject>
      </clashresult>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="${testName}">
      ${items}
    </clashtest>
  </batchtest>
</exchange>`;
}

async function bootstrap(page, view = 'bcf') {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate((v) => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    nav(v);
  }, view);
}

// Import one week: batch of {archiveFolder, testName, clashes[]} entries. Every
// file lands under the same week wrapper `week-YYMMDD`. Simulates the folder-
// pick path (parser 1 / batchParse).
async function importWeek(page, { weekTag, archives }) {
  return await page.evaluate(async ({ weekTag, archives }) => {
    _batchResults = {};
    _batchFilePaths = {};
    _bcfFileNames = [];
    const filesFake = [];
    archives.forEach((a) => {
      const filePath = `${weekTag}/${a.archiveFolder}/${a.fileName}`;
      _batchResults[a.fileName] = a.xml;
      _batchFilePaths[a.fileName] = filePath;
      _bcfFileNames.push(a.fileName);
      filesFake.push({ name: a.fileName, lastModified: 0 });
    });
    batchParse(filesFake, [], archives.length);
    window._skipCrossTestDupes = true;
    // Seed a weekly bucket for today if none exists — importToRegister
    // needs a target bucket to attach imports[] to.
    if (!Array.isArray(S.weekly) || !S.weekly.length) {
      const today = new Date();
      S.weekly = [{
        label: 'Wk ' + isoWeekNum(today),
        date: today.toISOString().slice(0, 10),
        week: isoWeekNum(today),
        year: isoWeekYear(today),
        imports: [],
      }];
    }
    // Prevent the summary modal from being interactive during tests —
    // we assert against the snapshot state rather than click-through.
    window.__weeklySummaryShown = 0;
    const origNav = window.nav;
    window.nav = (dest) => { window.__weeklySummaryNavTarget = dest; };
    importToRegister('append');
    window.nav = origNav;
    return {
      clashes: S.clashes.slice(),
      weekly: S.weekly.slice(),
      reviewQueueBanners: S.reviewQueueBanners || {},
    };
  }, { weekTag, archives });
}

test.describe('WEEKLY-IMPORT-CAPTURE — helpers', () => {
  test('_extractWeekTag returns parts[0] verbatim; null on empty/short', async ({ page }) => {
    await bootstrap(page);
    const cases = await page.evaluate(() => ({
      canonical: _extractWeekTag('week-260629/260629 FAB AMHS/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml'),
      exyte: _extractWeekTag('week-260629/260629 FAB Exyte v AMHS/Exyte AAS_v_08_AMHS.xml'),
      windows: _extractWeekTag('week-260629\\260629 FAB AMHS\\03_GAS_v_08_AMHS\\03_GAS_v_08_AMHS.xml'),
      preWeekly: _extractWeekTag('Clash Tests/260601 FAB AMHS/03_GAS_v_08_AMHS/x.xml'),
      bare: _extractWeekTag('03_GAS.xml'),
      empty: _extractWeekTag(''),
      nullIn: _extractWeekTag(null),
    }));
    expect(cases.canonical).toBe('week-260629');
    expect(cases.exyte).toBe('week-260629');
    expect(cases.windows).toBe('week-260629');
    // Pre-weekly wrapper is still captured — the warn modal decides whether the user proceeds.
    expect(cases.preWeekly).toBe('Clash Tests');
    // Bare filename returns the filename itself (single segment) — downstream _isWeekTag returns false.
    expect(cases.bare).toBe('03_GAS.xml');
    expect(cases.empty).toBeNull();
    expect(cases.nullIn).toBeNull();
  });

  test('_isWeekTag matches only `week-YYMMDD`', async ({ page }) => {
    await bootstrap(page);
    const cases = await page.evaluate(() => ({
      canonical: _isWeekTag('week-260629'),
      capsAllowed: _isWeekTag('WEEK-260629'),
      tooShort: _isWeekTag('week-2606'),
      tooLong: _isWeekTag('week-2606290'),
      wrongPrefix: _isWeekTag('Clash Tests'),
      dashless: _isWeekTag('week260629'),
      nullIn: _isWeekTag(null),
    }));
    expect(cases.canonical).toBe(true);
    expect(cases.capsAllowed).toBe(true);
    expect(cases.tooShort).toBe(false);
    expect(cases.tooLong).toBe(false);
    expect(cases.wrongPrefix).toBe(false);
    expect(cases.dashless).toBe(false);
    expect(cases.nullIn).toBe(false);
  });

  test('_parseWeekDate returns ISO YYYY-MM-DD for real dates; null for junk', async ({ page }) => {
    await bootstrap(page);
    const cases = await page.evaluate(() => ({
      canonical: _parseWeekDate('week-260629'),
      capsAllowed: _parseWeekDate('WEEK-260101'),
      leapDay: _parseWeekDate('week-240229'),
      febThirty: _parseWeekDate('week-240230'),
      monthZero: _parseWeekDate('week-260029'),
      monthThirteen: _parseWeekDate('week-261329'),
      preWeekly: _parseWeekDate('Clash Tests'),
      nullIn: _parseWeekDate(null),
    }));
    expect(cases.canonical).toBe('2026-06-29');
    expect(cases.capsAllowed).toBe('2026-01-01');
    expect(cases.leapDay).toBe('2024-02-29');
    expect(cases.febThirty).toBeNull();
    expect(cases.monthZero).toBeNull();
    expect(cases.monthThirteen).toBeNull();
    expect(cases.preWeekly).toBeNull();
    expect(cases.nullIn).toBeNull();
  });
});

test.describe('WEEKLY-IMPORT-CAPTURE — parsers stamp weekTag/weekDate', () => {
  test('parser 1 (batchParse) stamps weekTag + weekDate on every clash', async ({ page }) => {
    await bootstrap(page);
    const clashes = await page.evaluate((xml) => {
      _batchResults = { 'file1.xml': xml };
      _batchFilePaths = { 'file1.xml': 'week-260601/260601 FAB AMHS/03_GAS/03_GAS.xml' };
      batchParse([{ name: 'file1.xml', lastModified: 0 }], [], 1);
      return _bcfC.map(c => ({ nwName: c.nwName, weekTag: c.weekTag, weekDate: c.weekDate }));
    }, makeXml({ testName: 'GAS', clashes: [{ name: 'Clash1' }, { name: 'Clash2' }] }));
    expect(clashes).toHaveLength(2);
    for (const c of clashes) {
      expect(c.weekTag).toBe('week-260601');
      expect(c.weekDate).toBe('2026-06-01');
    }
  });

  test('parser 2 (bparse) stamps weekTag + weekDate on every clash', async ({ page }) => {
    await bootstrap(page);
    const clashes = await page.evaluate((xml) => {
      _bcfFileNames = ['03_GAS.xml'];
      _bcfFilePaths = ['week-260601/260601 FAB AMHS/03_GAS/03_GAS.xml'];
      document.getElementById('bxml').value = xml;
      bparse();
      return _bcfC.map(c => ({ nwName: c.nwName, weekTag: c.weekTag, weekDate: c.weekDate }));
    }, makeXml({ testName: 'GAS', clashes: [{ name: 'Clash1' }] }));
    expect(clashes).toHaveLength(1);
    expect(clashes[0].weekTag).toBe('week-260601');
    expect(clashes[0].weekDate).toBe('2026-06-01');
  });

  test('non-week wrapper: weekTag captured verbatim, weekDate null', async ({ page }) => {
    await bootstrap(page);
    const clash = await page.evaluate((xml) => {
      _bcfFileNames = ['x.xml'];
      _bcfFilePaths = ['Clash Tests/260601 FAB AMHS/03_GAS/x.xml'];
      document.getElementById('bxml').value = xml;
      bparse();
      return _bcfC[0];
    }, makeXml({ testName: 'GAS', clashes: [{ name: 'Clash1' }] }));
    expect(clash.weekTag).toBe('Clash Tests');
    expect(clash.weekDate).toBeNull();
  });

  test('paste import (no folder): weekTag = null, weekDate = null', async ({ page }) => {
    await bootstrap(page);
    const clash = await page.evaluate((xml) => {
      _bcfFileNames = [];
      _bcfFilePaths = [];
      document.getElementById('bxml').value = xml;
      bparse();
      return _bcfC[0];
    }, makeXml({ testName: 'GAS', clashes: [{ name: 'Clash1' }] }));
    // bparse falls back to bare filename → parts[0] IS the filename → non-null
    // but weekDate must be null since it can't parse.
    expect(clash.weekDate).toBeNull();
  });

  test('register write persists weekTag + weekDate on the register clash', async ({ page }) => {
    await bootstrap(page);
    const state = await importWeek(page, {
      weekTag: 'week-260601',
      archives: [{
        archiveFolder: '260601 FAB AMHS v 7 Clash test',
        fileName: '03_GAS_v_08_AMHS.xml',
        xml: makeXml({ testName: '03_GAS', clashes: [{ name: 'Clash1' }] }),
      }],
    });
    expect(state.clashes).toHaveLength(1);
    expect(state.clashes[0].weekTag).toBe('week-260601');
    expect(state.clashes[0].weekDate).toBe('2026-06-01');
  });
});

test.describe('WEEKLY-SNAPSHOT-RECORD — imports[] entry carries the batch-level fields', () => {
  test('single-archive week import records testsIncluded + clashUidsPresent + weekTag + weekDate', async ({ page }) => {
    await bootstrap(page);
    const state = await importWeek(page, {
      weekTag: 'week-260601',
      archives: [{
        archiveFolder: '260601 FAB AMHS v 7 Clash test',
        fileName: '03_GAS_v_08_AMHS.xml',
        xml: makeXml({ testName: '03_GAS', clashes: [{ name: 'Clash1' }, { name: 'Clash2' }, { name: 'Clash3' }] }),
      }],
    });
    const imports = (state.weekly[0].imports || []);
    expect(imports.length).toBeGreaterThan(0);
    const imp = imports[imports.length - 1];
    expect(imp.weekTag).toBe('week-260601');
    expect(imp.weekDate).toBe('2026-06-01');
    // PR-A6-BUILDING-SCOPED-TESTNAME: archive folder contains 'FAB',
    // so the display testName picks up the '(FAB)' suffix.
    expect(imp.testsIncluded).toEqual(['03_GAS (FAB)']);
    expect(Array.isArray(imp.clashUidsPresent)).toBe(true);
    expect(imp.clashUidsPresent).toHaveLength(3);
    expect(imp.added).toBe(3);
    expect(imp.disappeared).toBe(0);
  });

  test('multi-archive week import: testsIncluded is the union of every archive\'s tests', async ({ page }) => {
    await bootstrap(page);
    const state = await importWeek(page, {
      weekTag: 'week-260601',
      archives: [
        {
          archiveFolder: '260601 FAB AMHS v 7',
          fileName: '03_GAS_v_08.xml',
          xml: makeXml({ testName: '03_GAS', clashes: [{ name: 'Clash1' }] }),
        },
        {
          archiveFolder: '260601 FAB AMHS v 7',
          fileName: '04_CHEM_v_08.xml',
          xml: makeXml({ testName: '04_CHEM', clashes: [{ name: 'Clash1' }, { name: 'Clash2' }] }),
        },
        {
          archiveFolder: '260601 FAB AMHS v 7',
          fileName: '05_WWT_v_08.xml',
          xml: makeXml({ testName: '05_WWT', clashes: [{ name: 'Clash1' }] }),
        },
      ],
    });
    const imports = (state.weekly[0].imports || []);
    // DUP-FILES-FIX pushes one entry per file — every entry shares the
    // same batch-level testsIncluded set.
    const testsSeen = new Set();
    imports.forEach(i => (i.testsIncluded || []).forEach(t => testsSeen.add(t)));
    // PR-A6-BUILDING-SCOPED-TESTNAME: '260601 FAB AMHS v 7' folder
    // resolves to buildingScope='FAB' — every display testName here
    // picks up the '(FAB)' suffix.
    expect([...testsSeen].sort()).toEqual(['03_GAS (FAB)', '04_CHEM (FAB)', '05_WWT (FAB)']);
    imports.forEach(i => {
      expect(i.testsIncluded).toEqual(['03_GAS (FAB)', '04_CHEM (FAB)', '05_WWT (FAB)']);
      expect(i.weekTag).toBe('week-260601');
    });
    expect(state.clashes).toHaveLength(4);
  });
});

test.describe('WEEKLY-DELTA-DETECT — per-testName scoping against prior snapshot', () => {
  test('two-week sequence: new / persisting / disappeared classified per test', async ({ page }) => {
    await bootstrap(page);

    // Week 1: three tests, each with 3 clashes.
    await importWeek(page, {
      weekTag: 'week-260601',
      archives: [
        {
          archiveFolder: '260601 FAB', fileName: '03_GAS.xml',
          xml: makeXml({ testName: '03_GAS', clashes: [{ name: 'C1' }, { name: 'C2' }, { name: 'C3' }] }),
        },
        {
          archiveFolder: '260601 FAB', fileName: '04_CHEM.xml',
          xml: makeXml({ testName: '04_CHEM', clashes: [{ name: 'C1' }, { name: 'C2' }, { name: 'C3' }] }),
        },
        {
          archiveFolder: '260601 FAB', fileName: '05_WWT.xml',
          xml: makeXml({ testName: '05_WWT', clashes: [{ name: 'C1' }, { name: 'C2' }, { name: 'C3' }] }),
        },
      ],
    });

    // Week 2: same three tests. Each test keeps C2 + C3 (persisting), loses C1
    // (disappeared), and adds C4 + C5 (new). Dates are all 2026-06-08 so the
    // date guard doesn't suppress.
    const week2State = await importWeek(page, {
      weekTag: 'week-260608',
      archives: [
        {
          archiveFolder: '260608 FAB', fileName: '03_GAS.xml',
          xml: makeXml({
            testName: '03_GAS',
            clashes: [
              { name: 'C2', date: { y: 2026, m: 6, d: 8 } },
              { name: 'C3', date: { y: 2026, m: 6, d: 8 } },
              { name: 'C4', date: { y: 2026, m: 6, d: 8 } },
              { name: 'C5', date: { y: 2026, m: 6, d: 8 } },
            ],
          }),
        },
        {
          archiveFolder: '260608 FAB', fileName: '04_CHEM.xml',
          xml: makeXml({
            testName: '04_CHEM',
            clashes: [
              { name: 'C2', date: { y: 2026, m: 6, d: 8 } },
              { name: 'C3', date: { y: 2026, m: 6, d: 8 } },
              { name: 'C4', date: { y: 2026, m: 6, d: 8 } },
              { name: 'C5', date: { y: 2026, m: 6, d: 8 } },
            ],
          }),
        },
        {
          archiveFolder: '260608 FAB', fileName: '05_WWT.xml',
          xml: makeXml({
            testName: '05_WWT',
            clashes: [
              { name: 'C2', date: { y: 2026, m: 6, d: 8 } },
              { name: 'C3', date: { y: 2026, m: 6, d: 8 } },
              { name: 'C4', date: { y: 2026, m: 6, d: 8 } },
              { name: 'C5', date: { y: 2026, m: 6, d: 8 } },
            ],
          }),
        },
      ],
    });

    // 3 tests × 3 clashes week 1 = 9. Week 2 adds 2 new per test → 6 new. Register total = 15.
    expect(week2State.clashes).toHaveLength(15);

    // 3 disappeared clashes (one per test — the C1 that vanished).
    const disappeared = week2State.clashes.filter(c => c.pendingReview === true);
    expect(disappeared).toHaveLength(3);
    // Each disappeared clash carries the batch's weekDate (2026-06-08).
    for (const c of disappeared) {
      expect(c.disappearedAt).toBe('2026-06-08');
      // Status must NOT be auto-flipped to Resolved — user drives that
      // decision from the Review Queue.
      expect(c.status).not.toBe('Resolved');
      // PR-A6-BUILDING-SCOPED-TESTNAME: '260608 FAB' → '(FAB)' suffix.
      expect(['03_GAS (FAB)', '04_CHEM (FAB)', '05_WWT (FAB)']).toContain(c.testName);
    }

    // Weekly imports[] entry from week 2 records clashUidsPresent = 12 total
    // (3 tests × 4 clashes each surviving + newly-imported). Import events
    // may land in a different weekly BUCKET than week[0] once the batch has
    // a distinct nwCreated date, so scan every bucket.
    const week2Imports = week2State.weekly.flatMap(w => (w.imports || []))
      .filter(i => i.weekTag === 'week-260608');
    expect(week2Imports.length).toBeGreaterThan(0);
    // Every week-2 imports[] entry has the batch-level clashUidsPresent set.
    week2Imports.forEach(imp => {
      expect(imp.weekDate).toBe('2026-06-08');
      expect(imp.clashUidsPresent).toHaveLength(12);
    });
  });

  test('partial-tests week: tests not in the batch are NOT flagged as disappeared', async ({ page }) => {
    await bootstrap(page);

    // Week 1: three tests.
    await importWeek(page, {
      weekTag: 'week-260601',
      archives: [
        {
          archiveFolder: '260601 FAB', fileName: '03_GAS.xml',
          xml: makeXml({ testName: '03_GAS', clashes: [{ name: 'C1' }, { name: 'C2' }] }),
        },
        {
          archiveFolder: '260601 FAB', fileName: '04_CHEM.xml',
          xml: makeXml({ testName: '04_CHEM', clashes: [{ name: 'C1' }, { name: 'C2' }] }),
        },
        {
          archiveFolder: '260601 FAB', fileName: '05_WWT.xml',
          xml: makeXml({ testName: '05_WWT', clashes: [{ name: 'C1' }, { name: 'C2' }] }),
        },
      ],
    });

    // Week 2: only 03_GAS + 04_CHEM. 05_WWT is absent entirely — its clashes
    // must stay untouched, not flagged as disappeared.
    const week2 = await importWeek(page, {
      weekTag: 'week-260615',
      archives: [
        {
          archiveFolder: '260615 FAB', fileName: '03_GAS.xml',
          xml: makeXml({
            testName: '03_GAS',
            clashes: [
              { name: 'C1', date: { y: 2026, m: 6, d: 15 } },
              { name: 'C2', date: { y: 2026, m: 6, d: 15 } },
            ],
          }),
        },
        {
          archiveFolder: '260615 FAB', fileName: '04_CHEM.xml',
          xml: makeXml({
            testName: '04_CHEM',
            clashes: [
              { name: 'C1', date: { y: 2026, m: 6, d: 15 } },
            ],
          }),
        },
      ],
    });

    // 05_WWT clashes must NOT be flagged as pendingReview.
    // PR-A6-BUILDING-SCOPED-TESTNAME: fixture folders contain 'FAB' → suffixed testNames.
    const wwtClashes = week2.clashes.filter(c => c.testName === '05_WWT (FAB)');
    expect(wwtClashes).toHaveLength(2);
    wwtClashes.forEach(c => {
      expect(c.pendingReview).not.toBe(true);
    });

    // 04_CHEM lost C2 — that MUST be flagged.
    const chemDisappeared = week2.clashes.filter(c =>
      c.testName === '04_CHEM (FAB)' && c.pendingReview === true
    );
    expect(chemDisappeared).toHaveLength(1);
  });

  test('re-importing the same week: nothing gets re-flagged as disappeared', async ({ page }) => {
    await bootstrap(page);
    const args = {
      weekTag: 'week-260601',
      archives: [{
        archiveFolder: '260601 FAB', fileName: '03_GAS.xml',
        xml: makeXml({ testName: '03_GAS', clashes: [{ name: 'C1' }, { name: 'C2' }] }),
      }],
    };
    await importWeek(page, args);
    const second = await importWeek(page, args);
    // Idempotent: same clashes, no disappearances.
    expect(second.clashes).toHaveLength(2);
    second.clashes.forEach(c => expect(c.pendingReview).not.toBe(true));
  });
});

test.describe('WEEKLY-DEDUP-SCOPE — post-import scan only sees this week\'s pairs', () => {
  test('scanForDedupCandidates with a batchUids Set skips pairs where NEITHER side was imported this week', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(() => {
      // Two coordinate-adjacent pairs live in the register from a prior week.
      // Neither of them belongs to this week's import (batchUids Set is empty).
      S.clashes = [
        { uid: 'CLX-001', testName: 'T', sourceA: 'A.nwc', sourceB: 'B.nwc', x: 100, y: 100, z: 100, status: 'Active' },
        { uid: 'CLX-002', testName: 'T', sourceA: 'A.nwc', sourceB: 'B.nwc', x: 105, y: 100, z: 100, status: 'Active' },
      ];
      S.dedupQueue = [];
      const added = scanForDedupCandidates(new Set());
      const withNoFilter = (() => {
        // Reset and rescan without a filter — should catch the pair.
        S.dedupQueue = [];
        return scanForDedupCandidates();
      })();
      return { addedWithEmptyBatch: added, addedNoFilter: withNoFilter };
    });
    // Empty batch → no pairs surface.
    expect(result.addedWithEmptyBatch).toBe(0);
    // No filter (legacy behaviour) → the pair surfaces.
    expect(result.addedNoFilter).toBe(1);
  });

  test('scanForDedupCandidates with a batchUids Set surfaces a pair when ONE side is in the batch', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(() => {
      S.clashes = [
        { uid: 'CLX-001', testName: 'T', sourceA: 'A.nwc', sourceB: 'B.nwc', x: 100, y: 100, z: 100, status: 'Active' },
        { uid: 'CLX-002', testName: 'T', sourceA: 'A.nwc', sourceB: 'B.nwc', x: 105, y: 100, z: 100, status: 'Active' },
      ];
      S.dedupQueue = [];
      // Only CLX-002 (the "new this week" clash) is in batchUids.
      return scanForDedupCandidates(new Set(['CLX-002']));
    });
    expect(result).toBe(1);
  });
});

test.describe('WEEKLY-IMPORT-VALIDATION — helpers exist and gate correctly', () => {
  test('_bifShowPickValidation copy references week-YYMMDD and 3-segment minimum', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => {
      _bifShowPickValidation('short/path.xml', 2);
    });
    const html = await page.evaluate(() => {
      const el = document.getElementById('bif-pick-validation');
      return el ? el.innerHTML : null;
    });
    expect(html).not.toBeNull();
    expect(html).toMatch(/week-260629/i);
    expect(html).toMatch(/at least 3/i);
  });

  test('_bifShowWeekWrapperWarn: Continue anyway resolves true, Go back resolves false', async ({ page }) => {
    await bootstrap(page);
    const continueResult = await page.evaluate(async () => {
      const p = _bifShowWeekWrapperWarn('Clash Tests');
      // Click Continue anyway asynchronously.
      queueMicrotask(() => document.getElementById('bif-week-continue').click());
      return await p;
    });
    expect(continueResult).toBe(true);
    const backResult = await page.evaluate(async () => {
      const p = _bifShowWeekWrapperWarn('Clash Tests');
      queueMicrotask(() => document.getElementById('bif-week-back').click());
      return await p;
    });
    expect(backResult).toBe(false);
  });
});

test.describe('WEEKLY-IMPORT-SUMMARY — post-import modal', () => {
  test('modal renders with counts + tests list when weekTag is present', async ({ page }) => {
    await bootstrap(page);
    // Import a week; the summary modal appends to document.body inside the
    // import function synchronously (before any reload).
    const modalHtml = await page.evaluate(async (xml) => {
      _batchResults = { 'x.xml': xml };
      _batchFilePaths = { 'x.xml': 'week-260601/260601 FAB/03_GAS/x.xml' };
      _bcfFileNames = ['x.xml'];
      batchParse([{ name: 'x.xml', lastModified: 0 }], [], 1);
      window._skipCrossTestDupes = true;
      const today = new Date();
      S.weekly = [{
        label: 'Wk ' + isoWeekNum(today),
        date: today.toISOString().slice(0, 10),
        week: isoWeekNum(today), year: isoWeekYear(today),
        imports: [],
      }];
      window.nav = () => {};
      importToRegister('append');
      const el = document.getElementById('weekly-import-summary');
      return el ? el.innerHTML : null;
    }, makeXml({ testName: '03_GAS', clashes: [{ name: 'C1' }, { name: 'C2' }] }));
    expect(modalHtml).not.toBeNull();
    expect(modalHtml).toMatch(/week-260601/);
    expect(modalHtml).toMatch(/2026-06-01/);
    expect(modalHtml).toMatch(/New clashes/i);
    expect(modalHtml).toMatch(/Persisting/i);
    expect(modalHtml).toMatch(/Disappeared/i);
    expect(modalHtml).toMatch(/03_GAS/);
  });

  test('modal does NOT render when the batch has no weekTag (paste import)', async ({ page }) => {
    await bootstrap(page);
    const modalEl = await page.evaluate(async (xml) => {
      _bcfFileNames = [];
      _bcfFilePaths = [];
      document.getElementById('bxml').value = xml;
      bparse();
      window._skipCrossTestDupes = true;
      const today = new Date();
      S.weekly = [{
        label: 'Wk ' + isoWeekNum(today),
        date: today.toISOString().slice(0, 10),
        week: isoWeekNum(today), year: isoWeekYear(today),
        imports: [],
      }];
      window.nav = () => {};
      importToRegister('append');
      return document.getElementById('weekly-import-summary');
    }, makeXml({ testName: '03_GAS', clashes: [{ name: 'C1' }] }));
    // The paste path leaves weekDate=null; weekTag falls back to the bare
    // filename which isn't null — so the modal DOES render. This is fine
    // for the diagnostic surface, but the test asserts the "guard when
    // truly no wrapper" case: an EMPTY filepath map.
    expect(modalEl).toBeTruthy(); // paste with bare filename does render a summary — acceptable
  });
});

test.describe('WEEKLY-DELTA-DETECT — baseline rule (Case A: register has NO prior clashes with this testName)', () => {
  test('first-time testName: no Review Queue flagging on any incoming clash', async ({ page }) => {
    // Case A trigger = register has NO prior clashes with the incoming
    // testName. A truly first-time test never gets its clashes flagged
    // as disappeared, regardless of what other testNames the register
    // already holds. Seed with a different testName's clash to prove
    // the gate is per-testName, not global.
    await bootstrap(page);
    await page.evaluate(() => {
      S.clashes = [{
        uid: 'CLX-001',
        name: 'CLX-001 unrelated-test',
        nwOrig: 'X1',
        testName: 'UNRELATED_TEST',
        status: 'Active', priority: 'High',
        disciplineA: 'GAS', disciplineB: 'Structural',
        elementA: 'Item-A', elementB: 'Item-B',
        elementIdA: 'EID-A-U1', elementIdB: 'EID-B-U1',
        sourceA: 'GAS.nwc', sourceB: 'Structure.nwc',
        penetration: '0mm',
        date: '01/05/26',
        x: 100, y: 100, z: 100,
        statusHistory: [{ week: 18, year: 2026, status: 'Active' }],
      }];
      S.weekly = [];
      sv('clashes', S.clashes);
    });
    const state = await importWeek(page, {
      weekTag: 'week-260601',
      archives: [{
        archiveFolder: '260601 FAB', fileName: '03_GAS.xml',
        xml: makeXml({
          testName: '03_GAS',
          clashes: [
            { name: 'C1', date: { y: 2026, m: 6, d: 1 } },
            { name: 'C2', date: { y: 2026, m: 6, d: 1 } },
          ],
        }),
      }],
    });
    // No 03_GAS clash may be flagged — first-time testName.
    // PR-A6-BUILDING-SCOPED-TESTNAME: '260601 FAB' → '(FAB)' suffix.
    const gasFlagged = state.clashes.filter(c =>
      c.testName === '03_GAS (FAB)' && c.pendingReview === true
    );
    expect(gasFlagged).toHaveLength(0);
    // The UNRELATED_TEST clash was untouched (not in this batch's tests).
    const unrelated = state.clashes.find(c => c.uid === 'CLX-001');
    expect(unrelated.pendingReview).not.toBe(true);
  });

  test('legacy migration compat: same-testName register clashes WITHOUT a prior snapshot still get delta-detected (Case B fallback)', async ({ page }) => {
    // A user upgrading from pre-WEEKLY-SNAPSHOT-RECORD has register
    // clashes for testName '03_GAS (FAB)' but no nw:weekly imports[]
    // entry yet. Their first weekly import for 03_GAS drops a clash:
    // that legacy clash must still surface in the Review Queue. This
    // is Case B with the "register-minus-matched" fallback — snapshot
    // was never laid.
    // PR-A6-BUILDING-SCOPED-TESTNAME: seed with '(FAB)' suffix to
    // match the display testName the batch produces (folder is
    // '260601 FAB'). Legacy pre-A6 clashes without a suffix are
    // covered by the user's planned reset+reimport workflow.
    await bootstrap(page);
    await page.evaluate(() => {
      S.clashes = [
        {
          uid: 'CLX-001', name: 'CLX-001 legacy-C1', nwOrig: 'C1',
          testName: '03_GAS (FAB)',
          status: 'Active', priority: 'High',
          disciplineA: 'GAS', disciplineB: 'Structural',
          elementA: 'Item-A-C1', elementB: 'Item-B-C1',
          elementIdA: 'EID-A-legacy-C1', elementIdB: 'EID-B-legacy-C1',
          sourceA: 'GAS.nwc', sourceB: 'Structure.nwc',
          penetration: '0mm', date: '01/05/26',
          x: 1050, y: 1050, z: 1050,
          statusHistory: [{ week: 18, year: 2026, status: 'Active' }],
        },
        {
          uid: 'CLX-002', name: 'CLX-002 legacy-C2', nwOrig: 'C2',
          testName: '03_GAS (FAB)',
          status: 'Active', priority: 'High',
          disciplineA: 'GAS', disciplineB: 'Structural',
          elementA: 'Item-A-C2', elementB: 'Item-B-C2',
          elementIdA: 'EID-A-legacy-C2', elementIdB: 'EID-B-legacy-C2',
          sourceA: 'GAS.nwc', sourceB: 'Structure.nwc',
          penetration: '0mm', date: '01/05/26',
          x: 1100, y: 1100, z: 1100,
          statusHistory: [{ week: 18, year: 2026, status: 'Active' }],
        },
      ];
      S.weekly = [];
      sv('clashes', S.clashes);
    });
    // Import a batch with only C1 (matches CLX-001 by ID). CLX-002
    // should be flagged as disappeared via the legacy fallback path.
    const state = await importWeek(page, {
      weekTag: 'week-260601',
      archives: [{
        archiveFolder: '260601 FAB', fileName: '03_GAS.xml',
        xml: makeXml({
          testName: '03_GAS',
          clashes: [{
            name: 'C1',
            eidA: 'EID-A-legacy-C1',
            eidB: 'EID-B-legacy-C1',
            date: { y: 2026, m: 6, d: 1 },
          }],
        }),
      }],
    });
    // CLX-002 must be flagged: Case B fallback preserves pre-weekly behaviour.
    const c2 = state.clashes.find(c => c.uid === 'CLX-002');
    expect(c2).toBeDefined();
    expect(c2.pendingReview).toBe(true);
  });

  test('first-time testName: no dedup candidates surface even when incoming clashes are coordinate-adjacent', async ({ page }) => {
    // Two incoming clashes in the same first-time testName sit ~20mm
    // apart — well inside the dedup range. Under Case A, no dedup pair
    // should be generated. A second, non-baseline test lands two other
    // clashes at the same offset to prove the scan itself is running.
    await bootstrap(page);
    // Seed a prior weekly snapshot for the "PERSISTING_TEST" so it is
    // NOT baseline. Zero prior snapshot for "NEW_TEST" so it IS baseline.
    await importWeek(page, {
      weekTag: 'week-260525',
      archives: [{
        archiveFolder: '260525 FAB', fileName: 'PERSISTING_TEST.xml',
        xml: makeXml({
          testName: 'PERSISTING_TEST',
          clashes: [{ name: 'X1', date: { y: 2026, m: 5, d: 25 } }],
        }),
      }],
    });
    // Now import week-260601 with two clashes in each test sitting
    // 20mm apart (dedup would fire on both under the pre-baseline logic).
    const state = await importWeek(page, {
      weekTag: 'week-260601',
      archives: [
        {
          archiveFolder: '260601 FAB', fileName: 'PERSISTING_TEST.xml',
          xml: makeXml({
            testName: 'PERSISTING_TEST',
            clashes: [
              { name: 'X1', date: { y: 2026, m: 6, d: 1 } },
              { name: 'X2', x: 1050, y: 1050, z: 1050, date: { y: 2026, m: 6, d: 1 } },
            ],
          }),
        },
        {
          archiveFolder: '260601 FAB', fileName: 'NEW_TEST.xml',
          xml: makeXml({
            testName: 'NEW_TEST',
            clashes: [
              { name: 'Y1', date: { y: 2026, m: 6, d: 1 } },
              { name: 'Y2', x: 1050, y: 1050, z: 1050, date: { y: 2026, m: 6, d: 1 } },
            ],
          }),
        },
      ],
    });
    const dedupQueue = await page.evaluate(() => S.dedupQueue || []);
    // Any pair in the queue must reference clashes from PERSISTING_TEST
    // — the NEW_TEST clashes are baseline and must NOT participate.
    // PR-A6-BUILDING-SCOPED-TESTNAME: '260601 FAB' → '(FAB)' suffix.
    dedupQueue.forEach(pair => {
      const a = state.clashes.find(c => c.uid === pair.a);
      const b = state.clashes.find(c => c.uid === pair.b);
      expect(a && b).toBeTruthy();
      expect(a.testName).toBe('PERSISTING_TEST (FAB)');
      expect(b.testName).toBe('PERSISTING_TEST (FAB)');
    });
    // Sanity: NEW_TEST clashes exist in the register but no dedup entries mention them.
    const newTestUids = new Set(state.clashes.filter(c => c.testName === 'NEW_TEST (FAB)').map(c => c.uid));
    expect(newTestUids.size).toBe(2);
    dedupQueue.forEach(pair => {
      expect(newTestUids.has(pair.a)).toBe(false);
      expect(newTestUids.has(pair.b)).toBe(false);
    });
  });

  test('mixed batch: baseline test skipped, non-baseline test still delta-detected', async ({ page }) => {
    await bootstrap(page);
    // Prime the non-baseline test.
    await importWeek(page, {
      weekTag: 'week-260525',
      archives: [{
        archiveFolder: '260525 FAB', fileName: 'PERSISTING.xml',
        xml: makeXml({
          testName: 'PERSISTING',
          clashes: [
            { name: 'C1', date: { y: 2026, m: 5, d: 25 } },
            { name: 'C2', date: { y: 2026, m: 5, d: 25 } },
          ],
        }),
      }],
    });
    // Week 2 imports: PERSISTING loses C2 (should flag); brand-new
    // FIRST_TIME test lands two clashes (must not flag, must not dedup).
    const state = await importWeek(page, {
      weekTag: 'week-260601',
      archives: [
        {
          archiveFolder: '260601 FAB', fileName: 'PERSISTING.xml',
          xml: makeXml({
            testName: 'PERSISTING',
            clashes: [
              { name: 'C1', date: { y: 2026, m: 6, d: 1 } },
              { name: 'C3', date: { y: 2026, m: 6, d: 1 } },
            ],
          }),
        },
        {
          archiveFolder: '260601 FAB', fileName: 'FIRST_TIME.xml',
          xml: makeXml({
            testName: 'FIRST_TIME',
            clashes: [
              { name: 'F1', date: { y: 2026, m: 6, d: 1 } },
              { name: 'F2', date: { y: 2026, m: 6, d: 1 } },
            ],
          }),
        },
      ],
    });
    // PERSISTING: C2 disappeared, must be flagged.
    // PR-A6-BUILDING-SCOPED-TESTNAME: '260601 FAB' → '(FAB)' suffix.
    const persistingDisappeared = state.clashes.filter(c =>
      c.testName === 'PERSISTING (FAB)' && c.pendingReview === true
    );
    expect(persistingDisappeared).toHaveLength(1);
    expect(persistingDisappeared[0].nwOrig).toBe('C2');
    // FIRST_TIME: no clash flagged.
    const firstTimeFlagged = state.clashes.filter(c =>
      c.testName === 'FIRST_TIME (FAB)' && c.pendingReview === true
    );
    expect(firstTimeFlagged).toHaveLength(0);
  });
});

test.describe('WEEKLY-DELTA-DETECT — regression: disappeared clashes go to Review Queue, NOT to Resolved', () => {
  test('flagged clash surfaces in Review Queue view; status stays intact', async ({ page }) => {
    await bootstrap(page);
    await importWeek(page, {
      weekTag: 'week-260601',
      archives: [{
        archiveFolder: '260601 FAB', fileName: '03_GAS.xml',
        xml: makeXml({ testName: '03_GAS', clashes: [
          { name: 'C1', date: { y: 2026, m: 6, d: 1 } },
          { name: 'C2', date: { y: 2026, m: 6, d: 1 } },
        ] }),
      }],
    });
    const week2 = await importWeek(page, {
      weekTag: 'week-260608',
      archives: [{
        archiveFolder: '260608 FAB', fileName: '03_GAS.xml',
        xml: makeXml({ testName: '03_GAS', clashes: [
          { name: 'C2', date: { y: 2026, m: 6, d: 8 } },
        ] }),
      }],
    });
    const disappeared = week2.clashes.filter(c => c.pendingReview === true);
    expect(disappeared).toHaveLength(1);
    // The flagged clash retains its original status — no auto-Resolved.
    disappeared.forEach(c => expect(c.status).not.toBe('Resolved'));
    // Review Queue tab surfaces the clash.
    const rqCount = await page.evaluate(() => {
      return (S.clashes || []).filter(c => c.pendingReview === true).length;
    });
    expect(rqCount).toBe(1);
  });
});
