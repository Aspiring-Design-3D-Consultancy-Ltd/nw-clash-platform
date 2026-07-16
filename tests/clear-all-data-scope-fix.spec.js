import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* CLEAR-ALL-DATA-SCOPE-FIX contract:
   Clear All Data must WIPE clash-test data only and PRESERVE everything
   else (PIN, patterns, audit logs, settings, migration flags).
   Coverage: the wipe list emptying + the preserve list surviving.
   Auto-confirm every window.confirm and stub location.reload so we can
   inspect the post-wipe state synchronously without a real reload. */
test.describe('CLEAR-ALL-DATA-SCOPE-FIX — whitelist wipe scope', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof clearAll === 'function');
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      _ROLE = 'admin';
    });
  });

  test('wipes clash register + weekly + dedup + review-queue transient state; preserves everything else', async ({ page }) => {
    // Seed a wide slice of state so the assertion covers both lists.
    await page.evaluate(() => {
      // WIPE-target keys — must be gone (or empty array) after clearAll.
      localStorage.setItem('nw:clashes',
        JSON.stringify([{ uid: 'CLX-501', status: 'Active' }, { uid: 'CLX-502', status: 'Reviewed' }]));
      localStorage.setItem('nw:weekly',
        JSON.stringify([{ week: 27, year: 2026, active: 2 }]));
      localStorage.setItem('nw:dedupQueue',
        JSON.stringify([{ uidA: 'CLX-501', uidB: 'CLX-502' }]));
      localStorage.setItem('nw:reviewQueueBanners',
        JSON.stringify({ 'TestA': { batchDate: '01/07/26', earliestDate: '15/06/26' } }));
      localStorage.setItem('nw:reviewQueueNoDateBanner', 'true');

      // PRESERVE-target keys — must survive with unchanged values.
      localStorage.setItem('nw:pin', JSON.stringify('deadbeefcafedeadbeefcafedeadbeef'));
      localStorage.setItem('nw:designedConditionPatterns',
        JSON.stringify([{ name: 'MIMO', aRegex: 'MIMO', bRegex: '.*', enabled: true }]));
      localStorage.setItem('nw:designedConditionPatternsV2Seeded', '1');
      localStorage.setItem('nw:dedupActionHistory',
        JSON.stringify([{ ts: '2026-07-01', action: 'skip', uidA: 'X', uidB: 'Y' }]));
      localStorage.setItem('nw:dedupIncidentLog:20260713:v1', 'true');
      localStorage.setItem('nw:dedupInitialScan', '1');
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
      localStorage.setItem('nw:reviewQueueDeltaAnalysisMigrated', '1');
      localStorage.setItem('nw:proj', JSON.stringify('ESMC — Muratec'));
      localStorage.setItem('nw:week', JSON.stringify('Wk 27 — 01 Jul 2026'));
      localStorage.setItem('nw:grid', JSON.stringify({ FAB: { originX: 0, originY: 0 } }));
      localStorage.setItem('nw:gridActiveB', JSON.stringify('FAB'));
      localStorage.setItem('nw:assigneeRoster', JSON.stringify(['Alice', 'Bob']));
      localStorage.setItem('nw:managers', JSON.stringify([{ name: 'Mallory', pinHash: 'aaa' }]));
      localStorage.setItem('nw:levelCodeMode', JSON.stringify('literal'));
      localStorage.setItem('nw:bcfCoordUnits', JSON.stringify('mm'));

      // Stub interactive gates so clearAll() runs straight through.
      window.confirm = () => true;
      // location.reload is a non-configurable native method — snapshot the
      // wipe outcome BEFORE it fires by capturing localStorage state inside
      // the last-alert stub (which runs immediately before reload). Any
      // subsequent navigation is harmless; we've already read what we need.
      window._postWipeSnapshot = null;
      window.alert = () => {
        window._reloadInvoked = true;
        const g = k => localStorage.getItem('nw:' + k);
        window._postWipeSnapshot = {
          clashes: g('clashes'),
          weekly: g('weekly'),
          dedupQueue: g('dedupQueue'),
          reviewQueueBanners: g('reviewQueueBanners'),
          reviewQueueNoDateBanner: g('reviewQueueNoDateBanner'),
          pin: g('pin'),
          patterns: g('designedConditionPatterns'),
          patternsV2Seeded: g('designedConditionPatternsV2Seeded'),
          dedupActionHistory: g('dedupActionHistory'),
          dedupIncidentLog: g('dedupIncidentLog:20260713:v1'),
          dedupInitialScan: g('dedupInitialScan'),
          rqScopeFixed: g('reviewQueueScopeFixed'),
          rqDateGuardFixed: g('reviewQueueDateGuardFixed'),
          rqDeltaMigrated: g('reviewQueueDeltaAnalysisMigrated'),
          proj: g('proj'),
          week: g('week'),
          grid: g('grid'),
          gridActiveB: g('gridActiveB'),
          assigneeRoster: g('assigneeRoster'),
          managers: g('managers'),
          levelCodeMode: g('levelCodeMode'),
          bcfCoordUnits: g('bcfCoordUnits'),
          dataVersion: g('dataVersion'),
        };
        // Block the actual reload so nothing throws in the test runner.
        throw new Error('__test_block_reload__');
      };
    });

    // Invoke clearAll — expect the thrown reload block inside the alert.
    await page.evaluate(async () => {
      try { await clearAll(); }
      catch (e) { if (!/__test_block_reload__/.test(e.message)) throw e; }
    });
    // Sanity: the alert (which captured state) must have fired.
    expect(await page.evaluate(() => window._reloadInvoked)).toBe(true);

    const state = await page.evaluate(() => window._postWipeSnapshot);

    // WIPED — clashes/weekly reset to '[]' so launch()'s demo fallback skips;
    // dedupQueue + reviewQueue transient keys fully removed.
    expect(state.clashes).toBe('[]');
    expect(state.weekly).toBe('[]');
    expect(state.dedupQueue).toBeNull();
    expect(state.reviewQueueBanners).toBeNull();
    expect(state.reviewQueueNoDateBanner).toBeNull();

    // PRESERVED — unchanged.
    expect(state.pin).toBe(JSON.stringify('deadbeefcafedeadbeefcafedeadbeef'));
    expect(state.patterns).toBe(JSON.stringify([{ name: 'MIMO', aRegex: 'MIMO', bRegex: '.*', enabled: true }]));
    expect(state.patternsV2Seeded).toBe('1');
    expect(state.dedupActionHistory).toBe(JSON.stringify([{ ts: '2026-07-01', action: 'skip', uidA: 'X', uidB: 'Y' }]));
    expect(state.dedupIncidentLog).toBe('true');
    expect(state.dedupInitialScan).toBe('1');
    expect(state.rqScopeFixed).toBe('1');
    expect(state.rqDateGuardFixed).toBe('1');
    expect(state.rqDeltaMigrated).toBe('1');
    expect(state.proj).toBe(JSON.stringify('ESMC — Muratec'));
    expect(state.week).toBe(JSON.stringify('Wk 27 — 01 Jul 2026'));
    expect(state.grid).toBe(JSON.stringify({ FAB: { originX: 0, originY: 0 } }));
    expect(state.gridActiveB).toBe(JSON.stringify('FAB'));
    expect(state.assigneeRoster).toBe(JSON.stringify(['Alice', 'Bob']));
    expect(state.managers).toBe(JSON.stringify([{ name: 'Mallory', pinHash: 'aaa' }]));
    expect(state.levelCodeMode).toBe(JSON.stringify('literal'));
    expect(state.bcfCoordUnits).toBe(JSON.stringify('mm'));
    // dataVersion may or may not have been seeded — belt-and-braces sv()
    // reasserts it. Contract is just that it exists post-wipe.
    expect(state.dataVersion).not.toBeNull();
  });

  test('cancelling the first confirm short-circuits — nothing changes', async ({ page }) => {
    // Pre-fix behaviour: even cancelling wiped things. Guard against it
    // by asserting the register survives a Cancel click.
    await page.evaluate(() => {
      localStorage.setItem('nw:clashes',
        JSON.stringify([{ uid: 'CLX-999', status: 'Active' }]));
      localStorage.setItem('nw:pin', JSON.stringify('preserved-pin'));
      window.confirm = () => false;
      window.alert = () => {};
    });
    await page.evaluate(async () => { await clearAll(); });
    const state = await page.evaluate(() => ({
      clashes: localStorage.getItem('nw:clashes'),
      pin: localStorage.getItem('nw:pin'),
    }));
    expect(state.clashes).toBe(JSON.stringify([{ uid: 'CLX-999', status: 'Active' }]));
    expect(state.pin).toBe(JSON.stringify('preserved-pin'));
  });
});
