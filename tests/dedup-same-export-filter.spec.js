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

// Register: T1 clashes all share test, source pair and element strings so the
// scan pairs any two within 1..500mm. Import log: CLX-1..3 first appeared in
// week-260803, CLX-10..11 in week-260810. CLX-99 was never logged.
const SEED = `
const mk = (uid, x) => ({ uid, name: uid, testName: 'T1', rawTestName: 'T1', sourceA: 'a.nwc', sourceB: 'b.nwc',
  elementA: 'Duct-1', elementB: 'Beam-1', status: 'Active', priority: 'High', date: '03/08/26', x, y: 0, z: 0, statusHistory: [] });
// x in millimetres: the scan pairs 1mm < distance <= 500mm.
S.clashes = [mk('CLX-1', 0), mk('CLX-2', 50), mk('CLX-3', 100), mk('CLX-10', 150), mk('CLX-11', 200), mk('CLX-99', 250)];
S.weekly = [
  { week: 32, year: 2026, imports: [{ at: '2026-08-03T09:00:00Z', weekTag: 'week-260803', weekDate: '2026-08-03', testsIncluded: ['T1'], clashUidsPresent: ['CLX-1', 'CLX-2', 'CLX-3'] }] },
  { week: 33, year: 2026, imports: [{ at: '2026-08-10T09:00:00Z', weekTag: 'week-260810', weekDate: '2026-08-10', testsIncluded: ['T1'], clashUidsPresent: ['CLX-1', 'CLX-2', 'CLX-3', 'CLX-10', 'CLX-11'] }] },
];
S.dedupQueue = [];
const pairIds = () => S.dedupQueue.map(p => p.dedupPairId).sort();
`;

test.describe('DEDUP-SAME-EXPORT-FILTER — pairs proven to come from one export never enter the queue', () => {
  test('whole-register scan: same-export pairs suppressed, cross-export pairs surfaced, unjudgeable pairs surfaced', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      const added = scanForDedupCandidates();
      return { added, ids: pairIds() };
    })()`);
    // Same export (both week-260803): 1-2, 1-3, 2-3 suppressed. Same export (both week-260810 first): 10-11 suppressed.
    // Cross export: 1-10, 1-11, 2-10, 2-11, 3-10, 3-11 surfaced. CLX-99 never logged: all 5 pairs with it surface.
    expect(r.ids).not.toContain('dq-CLX-1-CLX-2');
    expect(r.ids).not.toContain('dq-CLX-1-CLX-3');
    expect(r.ids).not.toContain('dq-CLX-2-CLX-3');
    expect(r.ids).not.toContain('dq-CLX-10-CLX-11');
    for (const id of ['dq-CLX-1-CLX-10', 'dq-CLX-1-CLX-11', 'dq-CLX-2-CLX-10', 'dq-CLX-2-CLX-11', 'dq-CLX-3-CLX-10', 'dq-CLX-3-CLX-11']) expect(r.ids).toContain(id);
    for (const id of ['dq-CLX-1-CLX-99', 'dq-CLX-2-CLX-99', 'dq-CLX-3-CLX-99', 'dq-CLX-10-CLX-99', 'dq-CLX-11-CLX-99']) expect(r.ids).toContain(id);
    expect(r.added).toBe(11);
  });

  test('import-time scan: two uids created by the same batch are suppressed; a persisted uid paired with a new one surfaces', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      // Simulate the post-import scan for a batch that re-observed CLX-1 (persisted,
      // logged in week-260803) and created CLX-20 and CLX-21 (no log entry yet).
      const mk2 = (uid, x) => Object.assign(mk(uid, x));
      S.clashes.push(mk2('CLX-20', 300), mk2('CLX-21', 350));
      const batch = new Set(['CLX-1', 'CLX-20', 'CLX-21']);
      const created = new Set(['CLX-20', 'CLX-21']);
      const added = scanForDedupCandidates(batch, null, created);
      return { added, ids: pairIds() };
    })()`);
    expect(r.ids).not.toContain('dq-CLX-20-CLX-21');      // both created by this export
    expect(r.ids).toContain('dq-CLX-1-CLX-20');            // persisted (week-260803) + new: different exports
    expect(r.ids).toContain('dq-CLX-1-CLX-21');
  });

  test('without the created-uid set (older callers), same-batch new uids are unjudgeable and surface as before', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      S.clashes.push(mk('CLX-20', 300), mk('CLX-21', 350));
      scanForDedupCandidates(new Set(['CLX-20', 'CLX-21']), null);
      return pairIds();
    })()`);
    expect(r).toContain('dq-CLX-20-CLX-21');
  });

  test('a same-export pair already in the queue is not removed by a rescan (new candidates only)', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      S.dedupQueue = [{ dedupPairId: 'dq-CLX-1-CLX-2', a: 'CLX-1', b: 'CLX-2', distMm: 50, detectedAt: '2026-08-03T10:00:00Z', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null }];
      scanForDedupCandidates();
      return pairIds();
    })()`);
    expect(r).toContain('dq-CLX-1-CLX-2');
  });

  test('the rule never fires on a pair with one unlogged side, even when the other side is logged', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      const fiw = _dedupFirstImportWeekMap();
      return {
        logged: _dedupSameExport('CLX-1', 'CLX-2', null, fiw),
        cross: _dedupSameExport('CLX-1', 'CLX-10', null, fiw),
        oneUnlogged: _dedupSameExport('CLX-1', 'CLX-99', null, fiw),
        bothUnloggedNoBatch: _dedupSameExport('CLX-98', 'CLX-99', null, fiw),
        bothUnloggedBothNew: _dedupSameExport('CLX-98', 'CLX-99', new Set(['CLX-98', 'CLX-99']), fiw),
        bothUnloggedOneNew: _dedupSameExport('CLX-98', 'CLX-99', new Set(['CLX-98']), fiw),
        mapSize: fiw.size,
      };
    })()`);
    expect(r).toEqual({ logged: true, cross: false, oneUnlogged: false, bothUnloggedNoBatch: false, bothUnloggedBothNew: true, bothUnloggedOneNew: false, mapSize: 5 });
  });

  test('replay tool reports merges surfaced/suppressed and keep-separates suppressed against the decided history, read-only', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      S.dedupQueue = [
        { dedupPairId: 'dq-CLX-1-CLX-2', a: 'CLX-1', b: 'CLX-2', distMm: 50, resolved: true, resolvedAction: 'keep-separate' },   // same export → suppressed
        { dedupPairId: 'dq-CLX-1-CLX-10', a: 'CLX-1', b: 'CLX-10', distMm: 150, resolved: true, resolvedAction: 'keep-separate' }, // cross → surfaced
        { dedupPairId: 'dq-CLX-2-CLX-11', a: 'CLX-2', b: 'CLX-11', distMm: 20, resolved: true, resolvedAction: 'merge' },          // cross → surfaced
      ];
      localStorage.setItem('nw:dedupActionHistory', JSON.stringify([
        { type: 'action', action: 'merge', pairId: 'dq-CLX-10-CLX-11', aClashId: 'CLX-10', bClashId: 'CLX-11', distMm: 50 },       // same export → suppressed (the 7310-7312 shape)
        { type: 'action', action: 'keep-separate', pairId: 'dq-CLX-3-CLX-99', aClashId: 'CLX-3', bClashId: 'CLX-99', distMm: 50 },  // unjudgeable → surfaced
      ]));
      const snap = () => JSON.stringify({ q: S.dedupQueue, c: S.clashes, w: S.weekly, h: localStorage.getItem('nw:dedupActionHistory') });
      const before = snap();
      const out = await _dedupSameExportReplay();
      return { out, same: before === snap() };
    })()`);
    expect(r.out.merges).toMatchObject({ total: 2, surfaced: 1, suppressed: 1, unjudgeable: 0, suppressedIds: ['dq-CLX-10-CLX-11'] });
    expect(r.out.keepSeparate).toMatchObject({ total: 3, surfaced: 2, suppressed: 1, unjudgeable: 1 });
    expect(r.same).toBe(true);
  });
});
