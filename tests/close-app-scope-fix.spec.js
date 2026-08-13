import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* CLOSEAPP-DATA-SCOPE-FIX contract (INV-002):
   closeApp() must REMOVE only known-defunct/superseded nw:* keys
   (grpZTol, legacy manager/viewer singular fields) and PRESERVE every
   other persisted key — including the 18 keys confirmed missing from
   the old validKeys allow list (Dedup Queue, Review Queue, Delta
   Analysis config, grid/level state, assignee roster, migration gate
   flags, audit log entries).
   Coverage: the defunct-key removal + the full preserve-list survival,
   mirroring tests/clear-all-data-scope-fix.spec.js's seed/assert shape. */
test.describe('CLOSEAPP-DATA-SCOPE-FIX — closeApp() removal-list scope', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof closeApp === 'function');
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      _ROLE = 'admin';
    });
  });

  test('removes only defunct keys; preserves the 18 previously-missing persisted keys plus all existing whitelist keys', async ({ page }) => {
    const result = await page.evaluate(() => {
      // DEFUNCT keys — must be gone after closeApp().
      localStorage.setItem('nw:grpZTol', '5');
      localStorage.setItem('nw:managerPin', 'legacyhash');
      localStorage.setItem('nw:managerName', 'Legacy Manager');
      localStorage.setItem('nw:managerEmail', 'legacy@example.com');
      localStorage.setItem('nw:viewerPin', 'legacyviewerhash');
      localStorage.setItem('nw:viewerName', 'Legacy Viewer');
      localStorage.setItem('nw:viewerEmail', 'legacyviewer@example.com');

      // PRESERVE — keys already in the old validKeys allow list.
      localStorage.setItem('nw:apikey', JSON.stringify('key123'));
      localStorage.setItem('nw:bcfCoordUnits', JSON.stringify('mm'));
      localStorage.setItem('nw:bcfGroupKeys', JSON.stringify(['a']));
      localStorage.setItem('nw:clashes', JSON.stringify([{ uid: 'CLX-1' }]));
      localStorage.setItem('nw:cnLocType', JSON.stringify('literal'));
      localStorage.setItem('nw:cnLocVal', JSON.stringify('L1'));
      localStorage.setItem('nw:dataVersion', JSON.stringify('v4-correct-dates-jan25'));
      localStorage.setItem('nw:grid', JSON.stringify({ FAB: {} }));
      localStorage.setItem('nw:grpRadius', JSON.stringify(500));
      localStorage.setItem('nw:grpUseGridCell', JSON.stringify(true));
      localStorage.setItem('nw:grpUseSpatial', JSON.stringify(true));
      localStorage.setItem('nw:iso', JSON.stringify(['ISO-1']));
      localStorage.setItem('nw:levelCodeMode', JSON.stringify('literal'));
      localStorage.setItem('nw:managers', JSON.stringify([{ name: 'Mallory' }]));
      localStorage.setItem('nw:pin', JSON.stringify('deadbeefcafedeadbeefcafedeadbeef'));
      localStorage.setItem('nw:proj', JSON.stringify('KEEP Project'));
      localStorage.setItem('nw:projectManager', JSON.stringify({ name: 'PM' }));
      localStorage.setItem('nw:viewers', JSON.stringify([{ name: 'Viewer' }]));
      localStorage.setItem('nw:week', JSON.stringify('Wk 27'));
      localStorage.setItem('nw:weekly', JSON.stringify([{ week: 27 }]));

      // closeApp() step 1 re-persists these keys FROM in-memory S before
      // the removal-list runs (sv('clashes',S.clashes||[]), etc.) — mirror
      // the seeded localStorage onto S so step 1 doesn't clobber them with
      // stale in-memory defaults.
      S.clashes = [{ uid: 'CLX-1' }];
      S.weekly = [{ week: 27 }];
      S.pin = 'deadbeefcafedeadbeefcafedeadbeef';
      S.projName = 'KEEP Project';
      S.projWeek = 'Wk 27';
      S.iso = ['ISO-1'];
      S.managers = [{ name: 'Mallory' }];
      S.viewers = [{ name: 'Viewer' }];
      S.projectManager = { name: 'PM' };
      S.apiKey = 'key123';

      // PRESERVE — the 18 keys QA confirmed missing from the old allow
      // list (INV-002 Confirmed Missing Keys list).
      localStorage.setItem('nw:assigneeRoster', JSON.stringify(['Alice', 'Bob']));
      localStorage.setItem('nw:gridActiveB', JSON.stringify('FAB'));
      localStorage.setItem('nw:levels', JSON.stringify({ FAB: [] }));
      localStorage.setItem('nw:dedupQueue', JSON.stringify([{ dedupPairId: 'dq-1' }]));
      localStorage.setItem('nw:reviewQueueBanners', JSON.stringify({ TestA: {} }));
      localStorage.setItem('nw:reviewQueueNoDateBanner', 'true');
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
      localStorage.setItem('nw:dedupInitialScan', '1');
      localStorage.setItem('nw:designedConditionPatterns', JSON.stringify([{ name: 'MIMO' }]));
      localStorage.setItem('nw:designedConditionPatternsV2Seeded', '1');
      localStorage.setItem('nw:republishToleranceMm', '25');
      localStorage.setItem('nw:reviewQueueDeltaAnalysisMigrated', '1');
      localStorage.setItem('nw:dedupActionHistory', JSON.stringify([{ ts: '2026-07-01' }]));
      localStorage.setItem('nw:dedupIncidentLog:20260713:v1', 'true');
      localStorage.setItem('nw:dedupRetroCleanup:v1', 'true');
      localStorage.setItem('nw:dqShowSkipped', '1');
      localStorage.setItem('nw:pendingIdbWipe', '1');

      // Stub interactive gates so closeApp() runs straight through
      // without actually closing the tab or replacing the DOM.
      window.confirm = () => true;
      window.close = () => {};

      const snapshotKeysOf = (prefixedKeys) => {
        const out = {};
        prefixedKeys.forEach(k => { out[k] = localStorage.getItem('nw:' + k); });
        return out;
      };

      const DEFUNCT = ['grpZTol', 'managerPin', 'managerName', 'managerEmail', 'viewerPin', 'viewerName', 'viewerEmail'];
      const PRESERVE_EXISTING = ['apikey', 'bcfCoordUnits', 'bcfGroupKeys', 'clashes', 'cnLocType', 'cnLocVal',
        'dataVersion', 'grid', 'grpRadius', 'grpUseGridCell', 'grpUseSpatial', 'iso', 'levelCodeMode',
        'managers', 'pin', 'proj', 'projectManager', 'viewers', 'week', 'weekly'];
      const PRESERVE_PREVIOUSLY_MISSING = ['assigneeRoster', 'gridActiveB', 'levels', 'dedupQueue',
        'reviewQueueBanners', 'reviewQueueNoDateBanner', 'reviewQueueScopeFixed', 'reviewQueueDateGuardFixed',
        'dedupInitialScan', 'designedConditionPatterns', 'designedConditionPatternsV2Seeded',
        'republishToleranceMm', 'reviewQueueDeltaAnalysisMigrated', 'dedupActionHistory',
        'dedupIncidentLog:20260713:v1', 'dedupRetroCleanup:v1', 'dqShowSkipped', 'pendingIdbWipe'];

      closeApp();

      return {
        defunct: snapshotKeysOf(DEFUNCT),
        preserveExisting: snapshotKeysOf(PRESERVE_EXISTING),
        preservePreviouslyMissing: snapshotKeysOf(PRESERVE_PREVIOUSLY_MISSING),
      };
    });

    // Defunct keys removed.
    Object.values(result.defunct).forEach(v => expect(v).toBeNull());

    // Pre-existing whitelist keys survive unchanged.
    expect(result.preserveExisting.apikey).toBe(JSON.stringify('key123'));
    expect(result.preserveExisting.clashes).toBe(JSON.stringify([{ uid: 'CLX-1' }]));
    expect(result.preserveExisting.dataVersion).toBe(JSON.stringify('v4-correct-dates-jan25'));
    expect(result.preserveExisting.pin).toBe(JSON.stringify('deadbeefcafedeadbeefcafedeadbeef'));
    Object.values(result.preserveExisting).forEach(v => expect(v).not.toBeNull());

    // The 18 previously-missing keys now survive — this is the core
    // regression guard for INV-002.
    Object.entries(result.preservePreviouslyMissing).forEach(([k, v]) => {
      expect(v, `nw:${k} should survive closeApp()`).not.toBeNull();
    });
    expect(result.preservePreviouslyMissing.dedupQueue).toBe(JSON.stringify([{ dedupPairId: 'dq-1' }]));
    expect(result.preservePreviouslyMissing.assigneeRoster).toBe(JSON.stringify(['Alice', 'Bob']));
    expect(result.preservePreviouslyMissing.pendingIdbWipe).toBe('1');
  });

  test('cancelling the confirm dialog leaves every key untouched', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('nw:grpZTol', '5');
      localStorage.setItem('nw:dedupQueue', JSON.stringify([{ dedupPairId: 'dq-1' }]));
      window.confirm = () => false;
      window.close = () => { throw new Error('window.close should not be called when confirm is cancelled'); };
      closeApp();
      return {
        grpZTol: localStorage.getItem('nw:grpZTol'),
        dedupQueue: localStorage.getItem('nw:dedupQueue'),
      };
    });
    expect(result.grpZTol).toBe('5');
    expect(result.dedupQueue).toBe(JSON.stringify([{ dedupPairId: 'dq-1' }]));
  });

  test('an unknown/unrecognized nw: key not on any list survives closeApp() (removal-list safety property)', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Simulates a future feature's key that nobody has added to any
      // list yet — the whole point of the removal-list model is that
      // this survives by construction instead of being silently wiped.
      localStorage.setItem('nw:someBrandNewFeatureFlag', '1');
      window.confirm = () => true;
      window.close = () => {};
      closeApp();
      return localStorage.getItem('nw:someBrandNewFeatureFlag');
    });
    expect(result).toBe('1');
  });
});
