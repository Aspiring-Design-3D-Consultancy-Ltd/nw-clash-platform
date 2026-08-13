import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* R1-DATA-RESURRECTION-FIX contract (Option A):
   clearAll() and _executeSelectiveReset() must clear the corresponding
   S.* in-memory fields at the same time the persisted nw:* keys are
   removed. Pre-fix, both functions only wiped localStorage — the
   in-memory S object kept its pre-wipe values. Any later code path
   that re-persisted S.* verbatim (sv('clashes',S.clashes) inside a
   nav/render call, a retry, or — most concretely — a second call into
   the same function without an intervening real page reload) wrote
   the "wiped" data straight back into localStorage, resurrecting it.
   These specs simulate that resurrection vector directly: run the
   reset, then call sv() again with the CURRENT in-memory S.* value
   (exactly what closeApp()/nav()/render plumbing does elsewhere in the
   app) and assert the wipe still holds. */

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';
  });
}

test.describe('R1-DATA-RESURRECTION-FIX — clearAll()', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('S.clashes/S.weekly/S.dedupQueue/S.reviewQueueBanners/S.reviewQueueNoDateBanner are cleared in memory, not just in storage', async ({ page }) => {
    // clearAll() ends with alert()+location.reload(); a real navigation
    // destroys the page context before a follow-up evaluate can read it.
    // Mirror the existing clearAll/clear-all-idb-nonblocking pattern:
    // capture the in-memory state INSIDE the alert stub (which fires
    // immediately before reload) and throw to abort before reload runs.
    const state = await page.evaluate(async () => {
      S.clashes = [{ uid: 'CLX-STALE-1', testName: 't', nwOrig: 'x', status: 'Active' }];
      S.weekly = [{ label: 'Wk STALE', week: 1, year: 2026 }];
      S.dedupQueue = [{ dedupPairId: 'dq-stale', a: 'CLX-STALE-1', b: 'CLX-STALE-2', distMm: 3, detectedAt: '2026-07-08T00:00:00Z' }];
      S.reviewQueueBanners = { 'Stale Test': { batchDate: '01/07/26', earliestDate: '15/07/26' } };
      S.reviewQueueNoDateBanner = true;
      sv('clashes', S.clashes);
      sv('weekly', S.weekly);
      sv('dedupQueue', S.dedupQueue);
      sv('reviewQueueBanners', S.reviewQueueBanners);
      sv('reviewQueueNoDateBanner', S.reviewQueueNoDateBanner);
      window.confirm = () => true;
      window._wipeIdbWithVerify = () => Promise.resolve();
      let captured = null;
      window.alert = () => {
        captured = {
          clashesLen: S.clashes.length,
          weeklyLen: S.weekly.length,
          dedupQueueLen: S.dedupQueue.length,
          reviewQueueBanners: S.reviewQueueBanners,
          reviewQueueNoDateBanner: S.reviewQueueNoDateBanner,
        };
        throw new Error('__test_block_reload__');
      };
      try { await clearAll(); }
      catch (e) { if (!/__test_block_reload__/.test(e.message)) throw e; }
      return captured;
    });
    expect(state).not.toBeNull();
    expect(state.clashesLen).toBe(0);
    expect(state.weeklyLen).toBe(0);
    expect(state.dedupQueueLen).toBe(0);
    expect(state.reviewQueueBanners).toEqual({});
    expect(state.reviewQueueNoDateBanner).toBe(false);
  });

  test('resurrection vector: re-persisting S.* after clearAll() no longer brings back the wiped data', async ({ page }) => {
    // Same reload-blocking approach as above: run clearAll() AND the
    // resurrection-simulating re-persist INSIDE the alert stub, all in
    // the same evaluate, before the real reload can tear down the page.
    const result = await page.evaluate(async () => {
      S.clashes = [{ uid: 'CLX-STALE-1', testName: 't', nwOrig: 'x', status: 'Active' }];
      S.weekly = [{ label: 'Wk STALE', week: 1, year: 2026 }];
      S.dedupQueue = [{ dedupPairId: 'dq-stale', a: 'CLX-STALE-1', b: 'CLX-STALE-2', distMm: 3, detectedAt: '2026-07-08T00:00:00Z' }];
      sv('clashes', S.clashes);
      sv('weekly', S.weekly);
      sv('dedupQueue', S.dedupQueue);
      window.confirm = () => true;
      window._wipeIdbWithVerify = () => Promise.resolve();
      let captured = null;
      window.alert = () => {
        // Resurrection vector: some later plumbing (nav/render, a retry,
        // closeApp()) calls sv() with the CURRENT in-memory value. Pre-
        // fix this re-wrote the stale array because S.* was never
        // cleared. Post-fix S.* is already empty, so this is a no-op.
        sv('clashes', S.clashes);
        sv('weekly', S.weekly);
        sv('dedupQueue', S.dedupQueue);
        captured = {
          clashes: localStorage.getItem('nw:clashes'),
          weekly: localStorage.getItem('nw:weekly'),
          dedupQueue: localStorage.getItem('nw:dedupQueue'),
        };
        throw new Error('__test_block_reload__');
      };
      try { await clearAll(); }
      catch (e) { if (!/__test_block_reload__/.test(e.message)) throw e; }
      return captured;
    });
    expect(result).not.toBeNull();
    expect(result.clashes).toBe('[]');
    expect(result.weekly).toBe('[]');
    expect(result.dedupQueue).toBe('[]');
  });
});

test.describe('R1-DATA-RESURRECTION-FIX — _executeSelectiveReset()', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('ticking Dedup Queue clears S.dedupQueue in memory (not just nw:dedupQueue)', async ({ page }) => {
    const state = await page.evaluate(async () => {
      S.dedupQueue = [{ dedupPairId: 'dq-stale', a: 'CLX-1', b: 'CLX-2', distMm: 3, detectedAt: '2026-07-08T00:00:00Z' }];
      sv('dedupQueue', S.dedupQueue);
      window.confirm = () => true;
      window.alert = () => {};
      try { Location.prototype.reload = function () {}; } catch (_) {}
      selectiveReset();
      const cats = _selectiveResetCategories();
      document.querySelector('#selective-reset-modal input[data-cat="dedup"]').checked = true;
      await _executeSelectiveReset(cats, 'selective-reset-modal');
      return {
        dedupQueueLen: S.dedupQueue.length,
        persisted: localStorage.getItem('nw:dedupQueue'),
      };
    });
    expect(state.dedupQueueLen).toBe(0);
    expect(state.persisted).toBeNull();
  });

  test('resurrection vector: re-persisting S.dedupQueue after a Dedup-Queue-only reset no longer brings the candidate back', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.dedupQueue = [{ dedupPairId: 'dq-stale', a: 'CLX-1', b: 'CLX-2', distMm: 3, detectedAt: '2026-07-08T00:00:00Z' }];
      sv('dedupQueue', S.dedupQueue);
      window.confirm = () => true;
      window.alert = () => {};
      try { Location.prototype.reload = function () {}; } catch (_) {}
      selectiveReset();
      const cats = _selectiveResetCategories();
      document.querySelector('#selective-reset-modal input[data-cat="dedup"]').checked = true;
      await _executeSelectiveReset(cats, 'selective-reset-modal');
      // Resurrection vector: downstream plumbing re-persists the
      // in-memory value verbatim (same shape as closeApp()/nav()).
      sv('dedupQueue', S.dedupQueue);
      return localStorage.getItem('nw:dedupQueue');
    });
    expect(result).toBe('[]');
  });

  test('ticking Review Queue flags clears S.reviewQueueBanners in memory', async ({ page }) => {
    const state = await page.evaluate(async () => {
      S.reviewQueueBanners = { 'Stale Test': { batchDate: '01/07/26', earliestDate: '15/07/26' } };
      sv('reviewQueueBanners', S.reviewQueueBanners);
      window.confirm = () => true;
      window.alert = () => {};
      try { Location.prototype.reload = function () {}; } catch (_) {}
      selectiveReset();
      const cats = _selectiveResetCategories();
      document.querySelector('#selective-reset-modal input[data-cat="reviewq"]').checked = true;
      await _executeSelectiveReset(cats, 'selective-reset-modal');
      return {
        reviewQueueBanners: S.reviewQueueBanners,
        persisted: localStorage.getItem('nw:reviewQueueBanners'),
      };
    });
    expect(state.reviewQueueBanners).toEqual({});
    expect(state.persisted).toBeNull();
  });

  test('ticking Levels and grids clears S.levels/S.grid/S.gridActiveB/S.levelCodeMode in memory', async ({ page }) => {
    const state = await page.evaluate(async () => {
      S.levels = { FAB: [{ code: 'FAB_L20', z: 12.5 }], CUP: [], BSGS: [] };
      S.grid = { FAB: { xLines: [1, 2], yLines: [3, 4], configured: true } };
      S.gridActiveB = 'FAB';
      S.levelCodeMode = 'two-digit';
      sv('levels', S.levels);
      sv('grid', S.grid);
      sv('gridActiveB', S.gridActiveB);
      sv('levelCodeMode', S.levelCodeMode);
      window.confirm = () => true;
      window.alert = () => {};
      try { Location.prototype.reload = function () {}; } catch (_) {}
      selectiveReset();
      const cats = _selectiveResetCategories();
      document.querySelector('#selective-reset-modal input[data-cat="levels"]').checked = true;
      await _executeSelectiveReset(cats, 'selective-reset-modal');
      return {
        levels: S.levels,
        grid: S.grid,
        levelCodeMode: S.levelCodeMode,
        persistedLevels: localStorage.getItem('nw:levels'),
        persistedGrid: localStorage.getItem('nw:grid'),
        persistedGridActiveB: localStorage.getItem('nw:gridActiveB'),
        persistedLevelCodeMode: localStorage.getItem('nw:levelCodeMode'),
      };
    });
    expect(state.levels).toEqual({ FAB: [], CUP: [], BSGS: [] });
    expect(state.grid).toEqual({});
    expect(state.levelCodeMode).toBe('literal');
    expect(state.persistedLevels).toBeNull();
    expect(state.persistedGrid).toBeNull();
    expect(state.persistedGridActiveB).toBeNull();
    expect(state.persistedLevelCodeMode).toBeNull();
  });

  test('resurrection vector: re-persisting S.levels after a Levels-and-grids-only reset no longer brings the stale table back', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.levels = { FAB: [{ code: 'FAB_L20', z: 12.5 }], CUP: [], BSGS: [] };
      sv('levels', S.levels);
      window.confirm = () => true;
      window.alert = () => {};
      try { Location.prototype.reload = function () {}; } catch (_) {}
      selectiveReset();
      const cats = _selectiveResetCategories();
      document.querySelector('#selective-reset-modal input[data-cat="levels"]').checked = true;
      await _executeSelectiveReset(cats, 'selective-reset-modal');
      sv('levels', S.levels);
      return localStorage.getItem('nw:levels');
    });
    expect(result).toBe(JSON.stringify({ FAB: [], CUP: [], BSGS: [] }));
  });

  test('ticking Settings clears S.assigneeRoster/S.managers/S.viewers/S.projectManager/S.apiKey/S.projName/S.iso in memory', async ({ page }) => {
    const state = await page.evaluate(async () => {
      S.assigneeRoster = ['Stale Name'];
      S.managers = [{ name: 'Stale Manager' }];
      S.viewers = [{ name: 'Stale Viewer' }];
      S.projectManager = { name: 'Stale PM' };
      S.apiKey = 'stale-key';
      S.projName = 'Stale Project';
      S.iso.projCode = 'STALE';
      sv('assigneeRoster', S.assigneeRoster);
      sv('managers', S.managers);
      sv('viewers', S.viewers);
      sv('projectManager', S.projectManager);
      sv('apikey', S.apiKey);
      sv('proj', S.projName);
      sv('iso', S.iso);
      window.confirm = () => true;
      window.alert = () => {};
      try { Location.prototype.reload = function () {}; } catch (_) {}
      selectiveReset();
      const cats = _selectiveResetCategories();
      document.querySelector('#selective-reset-modal input[data-cat="settings"]').checked = true;
      await _executeSelectiveReset(cats, 'selective-reset-modal');
      return {
        assigneeRoster: S.assigneeRoster,
        managers: S.managers,
        viewers: S.viewers,
        projectManager: S.projectManager,
        apiKey: S.apiKey,
        projName: S.projName,
        isoProjCode: S.iso.projCode,
        persistedRoster: localStorage.getItem('nw:assigneeRoster'),
        persistedManagers: localStorage.getItem('nw:managers'),
        persistedIso: localStorage.getItem('nw:iso'),
      };
    });
    expect(state.assigneeRoster).toEqual([]);
    expect(state.managers).toEqual([]);
    expect(state.viewers).toEqual([]);
    expect(state.projectManager).toBeNull();
    expect(state.apiKey).toBe('');
    expect(state.projName).toBe('My Project');
    expect(state.isoProjCode).toBe('');
    expect(state.persistedRoster).toBeNull();
    expect(state.persistedManagers).toBeNull();
    expect(state.persistedIso).toBeNull();
  });

  test('ticking Admin PIN clears S.pin in memory', async ({ page }) => {
    const state = await page.evaluate(async () => {
      S.pin = 'stale-pin-hash';
      sv('pin', S.pin);
      window.confirm = () => true;
      window.alert = () => {};
      try { Location.prototype.reload = function () {}; } catch (_) {}
      selectiveReset();
      const cats = _selectiveResetCategories();
      document.querySelector('#selective-reset-modal input[data-cat="pin"]').checked = true;
      await _executeSelectiveReset(cats, 'selective-reset-modal');
      return {
        pin: S.pin,
        persisted: localStorage.getItem('nw:pin'),
      };
    });
    expect(state.pin).toBeNull();
    expect(state.persisted).toBeNull();
  });

  test('un-ticked categories leave their S.* fields untouched (symmetry: only the reset keys are cleared)', async ({ page }) => {
    const state = await page.evaluate(async () => {
      S.clashes = [{ uid: 'CLX-KEEP', testName: 't', nwOrig: 'x', status: 'Active' }];
      S.dedupQueue = [{ dedupPairId: 'dq-stale', a: 'CLX-1', b: 'CLX-2', distMm: 3, detectedAt: '2026-07-08T00:00:00Z' }];
      sv('clashes', S.clashes);
      sv('dedupQueue', S.dedupQueue);
      window.confirm = () => true;
      window.alert = () => {};
      try { Location.prototype.reload = function () {}; } catch (_) {}
      selectiveReset();
      const cats = _selectiveResetCategories();
      document.querySelector('#selective-reset-modal input[data-cat="dedup"]').checked = true;
      await _executeSelectiveReset(cats, 'selective-reset-modal');
      return {
        clashesLen: S.clashes.length,
        dedupQueueLen: S.dedupQueue.length,
      };
    });
    // Dedup Queue was ticked and wiped in memory...
    expect(state.dedupQueueLen).toBe(0);
    // ...but Clash records was NOT ticked, so S.clashes must survive.
    expect(state.clashesLen).toBe(1);
  });
});
