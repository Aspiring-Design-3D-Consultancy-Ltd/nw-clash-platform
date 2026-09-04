import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    S.clashes = []; S.dedupQueue = []; S.weekly = [];
  });
}

// Two import weeks. CLX-1..3 arrived in week-260803, CLX-10..12 in week-260810.
// CLX-11 was merged into CLX-2 (deleted); the history still names it.
const SEED = `
const mk = (uid, o) => Object.assign({ uid, name: uid, testName: 'T1', rawTestName: 'T1', sourceA: 'a.nwc', sourceB: 'b.nwc',
  elementA: 'Duct-1', elementB: 'Beam-1', status: 'Active', priority: 'High', date: '03/08/26', x: 0, y: 0, z: 0,
  weekTag: 'week-260803', firstSeenWeekTag: 'week-260803', statusHistory: [] }, o);
S.clashes = [
  mk('CLX-1'), mk('CLX-2'), mk('CLX-3', { z: 3500 }),
  mk('CLX-10', { weekTag: 'week-260810', firstSeenWeekTag: 'week-260810', x: 0.05, date: '10/08/26' }),
  mk('CLX-12', { weekTag: 'week-260810', firstSeenWeekTag: 'week-260810', x: 0.3, elementB: 'Beam-2', status: 'Approved', date: '10/08/26' }),
];
S.weekly = [
  { week: 32, year: 2026, imports: [{ at: '2026-08-03T09:00:00Z', weekTag: 'week-260803', weekDate: '2026-08-03', testsIncluded: ['T1'], clashUidsPresent: ['CLX-1', 'CLX-2', 'CLX-3'] }] },
  { week: 33, year: 2026, imports: [{ at: '2026-08-10T09:00:00Z', weekTag: 'week-260810', weekDate: '2026-08-10', testsIncluded: ['T1'], clashUidsPresent: ['CLX-1', 'CLX-2', 'CLX-10', 'CLX-11', 'CLX-12'] }] },
];
S.dedupQueue = [
  // same-week neighbour, rejected
  { dedupPairId: 'dq-CLX-1-CLX-3', a: 'CLX-1', b: 'CLX-3', distMm: 3500, resolved: true, resolvedAction: 'keep-separate', skipped: false },
  // cross-week, 50mm, rejected (different elementB)
  { dedupPairId: 'dq-CLX-2-CLX-12', a: 'CLX-2', b: 'CLX-12', distMm: 300, resolved: true, resolvedAction: 'keep-separate', skipped: false },
  // cross-week, 50mm, merged (CLX-11 deleted)
  { dedupPairId: 'dq-CLX-2-CLX-11', a: 'CLX-2', b: 'CLX-11', distMm: 50, resolved: true, resolvedAction: 'merge', skipped: false },
];
localStorage.setItem('nw:dedupActionHistory', JSON.stringify([
  { type: 'action', action: 'merge', pairId: 'dq-CLX-2-CLX-11', aClashId: 'CLX-2', bClashId: 'CLX-11', aWeekTag: 'week-260810', distMm: 50 },
  { type: 'action', action: 'merge', pairId: 'dq-CLX-2-CLX-11', aClashId: 'CLX-2', bClashId: 'CLX-11', aWeekTag: 'week-260810', distMm: 50 },  // duplicate event
  { type: 'action', action: 'keep-separate', pairId: 'dq-CLX-1-CLX-10', aClashId: 'CLX-1', bClashId: 'CLX-10', distMm: 50 },              // history-only rejection, cross-week
]));
`;

test.describe('DEDUP-SCAN-YIELD — read-only merged-vs-rejected analysis', () => {
  test('gathers decided pairs from the queue and the history, de-duplicated, with week of first import from the import log', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED} return await _dedupScanYieldProbe(); })()`);
    expect(r.coverage).toMatchObject({ pairs: 4, merged: 1, keepSeparate: 3, importEvents: 2, uidsWithImportWeek: 6,
      mergedWeekKnown: 1, keepWeekKnown: 3, mergedBothExist: 0, keepBothExist: 3, historyMergeEvents: 2, distinctMergePairIds: 1 });
    const m = r.rows.find(x => x.pairId === 'dq-CLX-2-CLX-11');
    // The deleted CLX-11's week comes from the import log, not the register.
    expect(m).toMatchObject({ outcome: 'merge', weekA: 'week-260803', weekB: 'week-260810', weekRel: 'cross', weekGapDays: 7, bothExist: false, dz: null });
    expect(m.weekSrc).toBe('imports/imports');
  });

  test('distributions separate the two outcomes on each stored signal', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED} return await _dedupScanYieldProbe(); })()`);
    expect(r.distributions.weekRel.merged).toEqual({ cross: 1 });
    expect(r.distributions.weekRel.keepSeparate).toEqual({ same: 1, cross: 2 });
    expect(r.distributions.distBand.keepSeparate).toEqual({ '>500mm': 1, '250-500mm': 1, '25-100mm': 1 });
    expect(r.distributions.dzBand.keepSeparate).toEqual({ '>500mm': 1, '<=10mm': 2 });
    expect(r.distributions.elemBEqual.keepSeparate).toEqual({ 'true': 2, 'false': 1 });
    expect(r.distributions.statusPair.keepSeparate).toEqual({ 'Active/Active': 2, 'Active/Approved': 1 });
  });

  test('rule simulation reports merges kept versus rejections suppressed, never counting unknowns as suppressed', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED} return await _dedupScanYieldProbe(); })()`);
    const by = name => r.rules.find(x => x.rule === name);
    expect(by('cross-week only (first import weeks differ)')).toMatchObject({ mergesKept: 1, mergesSuppressed: 0, rejectionsSuppressed: 1, rejectionsKept: 2 });
    expect(by('distance <= 100mm')).toMatchObject({ mergesKept: 1, mergesSuppressed: 0, rejectionsSuppressed: 2, rejectionsKept: 1 });
    // dz needs both clashes: the merge is unknown, not suppressed.
    expect(by('dz <= 100mm (needs both clashes)')).toMatchObject({ mergesKept: 0, mergesSuppressed: 0, mergesUnknown: 1, rejectionsSuppressed: 1, rejectionsKept: 2 });
    // Rules that lose a merge sort below rules that keep them all.
    expect(by('distance <= 25mm')).toMatchObject({ mergesSuppressed: 1 });
    const firstLosing = r.rules.findIndex(x => x.mergesSuppressed > 0);
    const lastKeeping = r.rules.map(x => x.mergesSuppressed).lastIndexOf(0);
    expect(firstLosing).toBeGreaterThan(lastKeeping);
  });

  test('writes nothing — queue, register, weekly, history and every nw:* key are byte-identical afterwards', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      const snap = () => JSON.stringify({ q: S.dedupQueue, c: S.clashes, w: S.weekly,
        ls: Object.keys(localStorage).filter(k => k.startsWith('nw:')).sort().map(k => [k, localStorage.getItem(k)]) });
      const before = snap();
      await _dedupScanYieldProbe();
      return before === snap();
    })()`);
    expect(r).toBe(true);
  });

  test('an empty history produces an empty, well-formed report', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(async () => await _dedupScanYieldProbe());
    expect(r.coverage.pairs).toBe(0);
    expect(r.rows).toEqual([]);
    expect(r.rules.length).toBeGreaterThan(5);
    expect(r.rules.every(x => x.mergesKept === 0 && x.rejectionsSuppressed === 0)).toBe(true);
  });
});
