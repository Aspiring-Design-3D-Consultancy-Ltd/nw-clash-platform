import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PAIR-ID-RESOLVED-COUNT-PHASE2 contract:
   When a previously-Resolved clash reappears in a re-import with lower status
   (New/Active/Reviewed), auto-flip it back to Resolved instead of allowing
   the downgrade. Show a toast with undo option. Undo reverts to the incoming
   status. */

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof S !== 'undefined'
    && typeof importToRegister === 'function'
    && typeof pushStatusHistory === 'function'
    && typeof _undoPhase2Resolve === 'function');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';
    S.clashes = []; S.weekly = [];
    sv('clashes', S.clashes); sv('weekly', S.weekly);
    window._skipCrossTestDupes = true;
    window.confirm = () => true;
    window.alert = () => {};
    nav('bcf');
  });
  await page.waitForSelector('#bxml', { timeout: 5000 }).catch(() => {});
}

test.describe('PAIR-ID-RESOLVED-COUNT-PHASE2 — auto-flip Resolved when reappearing', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('Phase2-A — Resolved re-imported as Active: auto-kept, not downgraded', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Seed initial clash as Resolved
      S.clashes = [{
        uid: 1,
        testName: 'TestP2A',
        nwName: 'Clash1',
        status: 'Resolved',
        statusHistory: [{week: 23, year: 2026, status: 'Resolved'}],
        penetration: '0mm',
        x: 1, y: 2, z: 3,
        eA: {id: 'EID-A-1'},
        eB: {id: 'EID-B-1'},
        nwCreated: '15/01/26',
        weekTag: 'week-260601',
        weekDate: '2026-06-01',
        firstSeenWeekTag: 'week-260601'
      }];
      sv('clashes', S.clashes);
      _uid = 1;

      // Re-import as Active (Phase 2 should hold it Resolved, not downgrade)
      _bcfC = [{
        testName: 'TestP2A',
        nwName: 'Clash1',
        mappedSt: 'Active',
        depMm: 0.01,
        x: 1, y: 2, z: 3,
        eA: {id: 'EID-A-1'},
        eB: {id: 'EID-B-1'},
        nwCreated: '15/01/26',
        weekTag: 'week-260608',
        weekDate: '2026-06-08'
      }];

      window._skipCrossTestDupes = true;
      importToRegister('append');

      const c = (S.clashes || [])[0];
      return {
        status: c.status,
        historyLen: (c.statusHistory || []).length,
        history1Source: (c.statusHistory || [])[1]?.source
      };
    });

    expect(result.status).toBe('Resolved'); // Status held (not downgraded)
    expect(result.historyLen).toBe(2); // New history entry added
    expect(result.history1Source).toBe('Resolved-Reappearance'); // Tracked as reappearance
  });

  test('Phase2-B — Undo reverts held clash back to incoming status', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Seed and re-import same as Phase2-A
      S.clashes = [{
        uid: 1,
        testName: 'TestP2B',
        nwName: 'Clash1',
        status: 'Resolved',
        statusHistory: [{week: 23, year: 2026, status: 'Resolved'}],
        penetration: '0mm',
        x: 1, y: 2, z: 3,
        eA: {id: 'EID-A-1'},
        eB: {id: 'EID-B-1'},
        nwCreated: '15/01/26',
        weekTag: 'week-260601',
        weekDate: '2026-06-01'
      }];
      sv('clashes', S.clashes);
      _uid = 1;

      _bcfC = [{
        testName: 'TestP2B',
        nwName: 'Clash1',
        mappedSt: 'Reviewed',
        depMm: 0.01,
        x: 1, y: 2, z: 3,
        eA: {id: 'EID-A-1'},
        eB: {id: 'EID-B-1'},
        nwCreated: '15/01/26',
        weekTag: 'week-260608',
        weekDate: '2026-06-08'
      }];

      window._skipCrossTestDupes = true;
      importToRegister('append');

      const c = (S.clashes || [])[0];
      // At this point status is Resolved (held)
      const statusAfterHold = c.status;

      // Now undo — this should revert to 'Reviewed' (incoming status)
      _undoPhase2Resolve([{
        uid: 1,
        testName: 'TestP2B',
        nwName: 'Clash1',
        incomingStatus: 'Reviewed',
        priorStatus: 'Resolved'
      }]);

      const cAfterUndo = (S.clashes || [])[0];
      return {
        statusAfterHold: statusAfterHold,
        statusAfterUndo: cAfterUndo.status,
        historyLenAfterUndo: (cAfterUndo.statusHistory || []).length,
        lastHistorySource: (cAfterUndo.statusHistory || [])[2]?.source
      };
    });

    expect(result.statusAfterHold).toBe('Resolved');
    expect(result.statusAfterUndo).toBe('Reviewed'); // Reverted to incoming
    expect(result.historyLenAfterUndo).toBe(3); // Undo entry added
    expect(result.lastHistorySource).toBe('Resolved-Reappearance-Undo');
  });

  test('Phase2-C — Non-terminal status unchanged allowed downgrade (not Phase 2 case)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Seed clash as Active (not Resolved)
      S.clashes = [{
        uid: 1,
        testName: 'TestP2C',
        nwName: 'Clash1',
        status: 'Active',
        statusHistory: [{week: 23, year: 2026, status: 'New'}],
        penetration: '0mm',
        x: 1, y: 2, z: 3,
        eA: {id: 'EID-A-1'},
        eB: {id: 'EID-B-1'},
        nwCreated: '15/01/26',
        weekTag: 'week-260601',
        weekDate: '2026-06-01'
      }];
      sv('clashes', S.clashes);
      _uid = 1;

      // Re-import with different (still non-terminal) status
      _bcfC = [{
        testName: 'TestP2C',
        nwName: 'Clash1',
        mappedSt: 'Reviewed',
        depMm: 0.01,
        x: 1, y: 2, z: 3,
        eA: {id: 'EID-A-1'},
        eB: {id: 'EID-B-1'},
        nwCreated: '15/01/26',
        weekTag: 'week-260608',
        weekDate: '2026-06-08'
      }];

      window._skipCrossTestDupes = true;
      importToRegister('append');

      const c = (S.clashes || [])[0];
      return {
        status: c.status,
        historyLen: (c.statusHistory || []).length
      };
    });

    // Phase 2 doesn't apply to non-Resolved clashes, so this should allow downgrade
    expect(result.status).toBe('Reviewed');
  });
});
