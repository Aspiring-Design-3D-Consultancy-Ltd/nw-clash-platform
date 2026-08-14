import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Seed every localStorage key touched by any Selective Reset category
// (plus nw:dataVersion, which must NEVER be wiped by this modal). Keys
// carry deterministic sentinel values so assertions can distinguish
// "removed" from "reset to empty array".
const SEED_KEYS = {
  // images-adjacent
  // (nw:images itself lives in IDB — this spec covers localStorage only)
  // clashes
  clashes: [{ uid: 'CLX-KEEP-001', testName: 't', nwOrig: 'x', status: 'Active' }],
  // weekly
  weekly: [{ label: 'Wk KEEP', week: 27, year: 2026 }],
  week: 'Wk KEEP',
  // dedup queue
  dedupQueue: [{ dedupPairId: 'dq-KEEP', a: 'CLX-1', b: 'CLX-2', distMm: 3, detectedAt: '2026-07-08T00:00:00Z' }],
  dedupInitialScan: '1',
  dqShowSkipped: '1',
  // review queue flags
  reviewQueueScopeFixed: '1',
  reviewQueueBanners: { 'Some Test': { batchDate: '01/07/26', earliestDate: '15/07/26' } },
  reviewQueueDateGuardFixed: '1',
  // levels and grids
  levels: { FAB: [], CUP: [], BSGS: [] },
  grid: { FAB: { xLines: [], yLines: [] } },
  gridActiveB: 'FAB',
  levelCodeMode: 'literal',
  // settings
  assigneeRoster: ['KEEP-A'],
  bcfCoordUnits: 'mm',
  proj: 'KEEP Project',
  // pin
  pin: 'KEEP-PIN-HASH',
  // Invariant: dataVersion must be present pre-wipe AND survive every
  // selective reset combination — that's the DATA_VERSION contract.
  dataVersion: 'v4-correct-dates-jan25',
};

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  // INV-007: wait for the terminal inline one-shot migration gate so
  // window.onload's setTimeout(1500/1600)-deferred migrations don't
  // race and silently overwrite this test's seeded state.
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
}

async function seedAll(page) {
  await page.evaluate((seed) => {
    Object.entries(seed).forEach(([k, v]) => {
      const raw = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v);
      localStorage.setItem('nw:' + k, raw);
    });
    // Also mirror onto in-memory S so _selectiveResetCategories()'s
    // count() functions read realistic values.
    S.clashes = seed.clashes;
    S.weekly = seed.weekly;
    S.dedupQueue = seed.dedupQueue;
    S.projName = seed.proj;
  }, SEED_KEYS);
}

// Drive _executeSelectiveReset AND snapshot every seeded key in the same
// evaluate — location.reload() fires at the end of the wipe and can't be
// reliably suppressed in headless Chromium (Location.prototype.reload
// assignment is a no-op in some builds), so we capture state before the
// navigation propagates. Returns { snapshot, categoriesHadDataVersion }.
async function runResetAndSnapshot(page, tickCatIds) {
  return page.evaluate(async ({ ticks, keys }) => {
    window.confirm = () => true;
    window.alert = () => {};
    // Best-effort reload suppression — works on some browser builds and
    // doesn't matter on the ones it doesn't (we've already snapshotted).
    try { Location.prototype.reload = function () {}; } catch (_) {}
    selectiveReset();
    const cats = _selectiveResetCategories();
    ticks.forEach(id => {
      const cb = document.querySelector(`#selective-reset-modal input[data-cat="${id}"]`);
      if (cb) cb.checked = true;
    });
    await _executeSelectiveReset(cats, 'selective-reset-modal');
    const snapshot = {};
    keys.forEach(k => {
      const v = localStorage.getItem('nw:' + k);
      snapshot[k] = v === null ? '__REMOVED__' : v;
    });
    const categoriesHadDataVersion = cats.some(c => (c.lsKeys || []).includes('dataVersion'));
    return { snapshot, categoriesHadDataVersion };
  }, { ticks: tickCatIds, keys: Object.keys(SEED_KEYS) });
}

test.describe('SELECTIVE-RESET-DEDUP-RQ', () => {
  test('tick only Dedup Queue → clears nw:dedupQueue + nw:dedupInitialScan + nw:dqShowSkipped, everything else intact', async ({ page }) => {
    await bootstrap(page);
    await seedAll(page);
    const { snapshot: state } = await runResetAndSnapshot(page, ['dedup']);
    expect(state.dedupQueue).toBe('__REMOVED__');
    expect(state.dedupInitialScan).toBe('__REMOVED__');
    expect(state.dqShowSkipped).toBe('__REMOVED__');
    // Everything else survives.
    expect(state.clashes).not.toBe('__REMOVED__');
    expect(state.weekly).not.toBe('__REMOVED__');
    expect(state.reviewQueueScopeFixed).not.toBe('__REMOVED__');
    expect(state.reviewQueueBanners).not.toBe('__REMOVED__');
    expect(state.reviewQueueDateGuardFixed).not.toBe('__REMOVED__');
    expect(state.levels).not.toBe('__REMOVED__');
    expect(state.grid).not.toBe('__REMOVED__');
    expect(state.gridActiveB).not.toBe('__REMOVED__');
    expect(state.pin).not.toBe('__REMOVED__');
    // DATA_VERSION invariant.
    expect(state.dataVersion).toBe(JSON.stringify('v4-correct-dates-jan25'));
  });

  test('tick only Review Queue flags → clears reviewQueueScopeFixed + reviewQueueBanners + reviewQueueDateGuardFixed, everything else intact', async ({ page }) => {
    await bootstrap(page);
    await seedAll(page);
    const { snapshot: state } = await runResetAndSnapshot(page, ['reviewq']);
    expect(state.reviewQueueScopeFixed).toBe('__REMOVED__');
    expect(state.reviewQueueBanners).toBe('__REMOVED__');
    expect(state.reviewQueueDateGuardFixed).toBe('__REMOVED__');
    // Everything else survives.
    expect(state.dedupQueue).not.toBe('__REMOVED__');
    expect(state.clashes).not.toBe('__REMOVED__');
    expect(state.weekly).not.toBe('__REMOVED__');
    expect(state.levels).not.toBe('__REMOVED__');
    expect(state.grid).not.toBe('__REMOVED__');
    expect(state.gridActiveB).not.toBe('__REMOVED__');
    expect(state.pin).not.toBe('__REMOVED__');
    expect(state.dataVersion).toBe(JSON.stringify('v4-correct-dates-jan25'));
  });

  test('tick Levels and grids → clears grid + levels + gridActiveB + levelCodeMode (verifies gridActiveB bundled correctly)', async ({ page }) => {
    await bootstrap(page);
    await seedAll(page);
    const { snapshot: state } = await runResetAndSnapshot(page, ['levels']);
    expect(state.levels).toBe('__REMOVED__');
    expect(state.grid).toBe('__REMOVED__');
    // The one the brief specifically flagged — must ride along with the
    // main "Levels and grids" tick, not need its own separate box.
    expect(state.gridActiveB).toBe('__REMOVED__');
    expect(state.levelCodeMode).toBe('__REMOVED__');
    // Queue keys untouched.
    expect(state.dedupQueue).not.toBe('__REMOVED__');
    expect(state.reviewQueueScopeFixed).not.toBe('__REMOVED__');
    expect(state.dataVersion).toBe(JSON.stringify('v4-correct-dates-jan25'));
  });

  test('tick nothing → wipe aborts, no keys removed', async ({ page }) => {
    await bootstrap(page);
    await seedAll(page);
    const result = await page.evaluate(async ({ keys }) => {
      // The empty-tick path shows an alert then returns without touching
      // storage. Capture the alert text so we can prove the branch fired
      // and snapshot localStorage in the same evaluate.
      const alerts = [];
      window.alert = (m) => alerts.push(String(m));
      window.confirm = () => true;
      try { Location.prototype.reload = function () {}; } catch (_) {}
      selectiveReset();
      const cats = _selectiveResetCategories();
      await _executeSelectiveReset(cats, 'selective-reset-modal');
      const snapshot = {};
      keys.forEach(k => {
        const v = localStorage.getItem('nw:' + k);
        snapshot[k] = v === null ? '__REMOVED__' : v;
      });
      return { alerts, snapshot };
    }, { keys: Object.keys(SEED_KEYS) });
    expect(result.alerts.some(m => /Nothing ticked/i.test(m))).toBe(true);
    Object.keys(SEED_KEYS).forEach(k => {
      expect(result.snapshot[k]).not.toBe('__REMOVED__');
    });
  });

  test('nw:dataVersion is never touched regardless of which categories are ticked', async ({ page }) => {
    await bootstrap(page);
    await seedAll(page);
    // Tick every category in one go and verify dataVersion still stands.
    const { snapshot: state, categoriesHadDataVersion } =
      await runResetAndSnapshot(page, ['clashes', 'weekly', 'dedup', 'reviewq', 'levels', 'settings', 'pin']);
    expect(state.dataVersion).toBe(JSON.stringify('v4-correct-dates-jan25'));
    // Belt-and-braces: no category should even list dataVersion in lsKeys.
    expect(categoriesHadDataVersion).toBe(false);
  });

  test('modal renders new categories in the specified order between Weekly snapshots and Levels and grids', async ({ page }) => {
    await bootstrap(page);
    await seedAll(page);
    const order = await page.evaluate(() => {
      selectiveReset();
      return [...document.querySelectorAll('#selective-reset-modal input[data-cat]')].map(el => el.dataset.cat);
    });
    expect(order).toEqual(['images', 'clashes', 'weekly', 'dedup', 'reviewq', 'levels', 'plans', 'settings', 'pin']);
  });

  test('Dedup Queue count() label reflects live nw:dedupQueue length', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => {
      // 5 candidate pairs, distinct dedupPairId so the shape is legal.
      S.dedupQueue = Array.from({ length: 5 }, (_, i) => ({
        dedupPairId: 'dq-' + i, a: 'A' + i, b: 'B' + i, distMm: 3, detectedAt: '2026-07-08T00:00:00Z',
      }));
      sv('dedupQueue', S.dedupQueue);
      selectiveReset();
    });
    const label = await page.locator('#selective-reset-modal input[data-cat="dedup"]').evaluate(el =>
      el.closest('label').textContent.replace(/\s+/g, ' ').trim());
    expect(label).toMatch(/Dedup Queue/);
    expect(label).toMatch(/5 candidates/);
  });
});
