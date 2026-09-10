import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof S !== 'undefined'
    && typeof importToRegister === 'function'
    && typeof pushStatusHistory === 'function'
    && typeof mapNWSt === 'function');
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

test.describe('PR-A1-TERMINAL-STATUS-GUARD — terminal statuses blocked from downgrade', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('T1 — Approved seed, Active import, guard blocks downgrade, history unchanged', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.clashes = [{
        uid: 1,
        testName: 'TestT1',
        nwOrig: 'Clash1',
        status: 'Approved',
        statusHistory: [{week: 23, year: 2026, status: 'Approved'}],
        penetration: '0mm',
        x: 1, y: 2, z: 3,
        elementIdA: 'EID-A-1',
        elementIdB: 'EID-B-1',
        eA: {id: 'EID-A-1'},
        eB: {id: 'EID-B-1'},
        nwCreated: '15/01/26',
        weekTag: 'week-260601',
        weekDate: '2026-06-01',
        firstSeenWeekTag: 'week-260601'
      }];
      sv('clashes', S.clashes);
      _uid = 1;

      _bcfC = [{
        tn: 'TestT1',
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
        weekTag: c.weekTag
      };
    });

    expect(result.status).toBe('Approved'); // Guard blocks downgrade on main too
    expect(result.historyLen).toBe(1); // No new entry
    expect(result.weekTag).toBe('week-260608'); // Other fields refresh
  });

  test('T2 — Approved seed, Approved import, no change', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.clashes = [{
        uid: 1,
        testName: 'TestT2',
        nwOrig: 'Clash1',
        status: 'Approved',
        statusHistory: [{week: 23, year: 2026, status: 'Approved'}],
        penetration: '0mm',
        x: 1, y: 2, z: 3,
        elementIdA: 'EID-A-2',
        elementIdB: 'EID-B-2',
        eA: {id: 'EID-A-2'},
        eB: {id: 'EID-B-2'},
        nwCreated: '15/01/26',
        weekTag: 'week-260601',
        weekDate: '2026-06-01'
      }];
      sv('clashes', S.clashes);
      _uid = 1;

      _bcfC = [{
        tn: 'TestT2',
        nwName: 'Clash1',
        mappedSt: 'Approved',
        depMm: 0.01,
        x: 1, y: 2, z: 3,
        eA: {id: 'EID-A-2'},
        eB: {id: 'EID-B-2'},
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

    expect(result.status).toBe('Approved');
    expect(result.historyLen).toBe(1);
  });

  test('T3 — Resolved seed, Approved import, upgrade with source tracking', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.clashes = [{
        uid: 1,
        testName: 'TestT3',
        nwOrig: 'Clash1',
        status: 'Resolved',
        statusHistory: [{week: 23, year: 2026, status: 'Resolved'}],
        penetration: '0mm',
        x: 1, y: 2, z: 3,
        elementIdA: 'EID-A-3',
        elementIdB: 'EID-B-3',
        eA: {id: 'EID-A-3'},
        eB: {id: 'EID-B-3'},
        nwCreated: '15/01/26',
        weekTag: 'week-260601',
        weekDate: '2026-06-01'
      }];
      sv('clashes', S.clashes);
      _uid = 1;

      _bcfC = [{
        tn: 'TestT3',
        nwName: 'Clash1',
        mappedSt: 'Approved',
        depMm: 0.01,
        x: 1, y: 2, z: 3,
        eA: {id: 'EID-A-3'},
        eB: {id: 'EID-B-3'},
        nwCreated: '15/01/26',
        weekTag: 'week-260608',
        weekDate: '2026-06-08',
        weekYear: {week: 24, year: 2026}
      }];

      window._skipCrossTestDupes = true;
      importToRegister('append');

      const c = (S.clashes || [])[0];
      return {
        status: c.status,
        historyLen: (c.statusHistory || []).length,
        history1Status: (c.statusHistory || [])[1]?.status,
        history1Source: (c.statusHistory || [])[1]?.source
      };
    });

    expect(result.status).toBe('Approved');
    expect(result.historyLen).toBe(2);
    expect(result.history1Status).toBe('Approved');
    expect(result.history1Source).toBe('Import');
  });

  test('T4 — Resolved seed, Active import, hold case with reappearances', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.clashes = [{
        uid: 1,
        testName: 'TestT4',
        nwOrig: 'Clash1',
        status: 'Resolved',
        statusHistory: [{week: 23, year: 2026, status: 'Resolved'}],
        penetration: '0mm',
        x: 1, y: 2, z: 3,
        elementIdA: 'EID-A-4',
        elementIdB: 'EID-B-4',
        eA: {id: 'EID-A-4'},
        eB: {id: 'EID-B-4'},
        nwCreated: '15/01/26',
        weekTag: 'week-260601',
        weekDate: '2026-06-01'
      }];
      sv('clashes', S.clashes);
      _uid = 1;
      _rqBatch = 'bat-test-batch-id';

      _bcfC = [{
        tn: 'TestT4',
        nwName: 'Clash1',
        mappedSt: 'Active',
        depMm: 0.01,
        x: 1, y: 2, z: 3,
        eA: {id: 'EID-A-4'},
        eB: {id: 'EID-B-4'},
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
        weekTag: c.weekTag,
        weekDate: c.weekDate,
        reappCount: (c.reappearances || []).length,
        reapBatch: (c.reappearances || [])[0]?.batch
      };
    });

    expect(result.status).toBe('Resolved');
    expect(result.historyLen).toBe(1);
    expect(result.weekTag).toBe('week-260601');
    expect(result.weekDate).toBe('2026-06-01');
    expect(result.reappCount).toBe(1);
    expect(result.reapBatch).toBe('bat-test-batch-id');
  });

  test('T5 — Active seed, Active import, identical on main and branch', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.clashes = [{
        uid: 1,
        testName: 'TestT5',
        nwOrig: 'Clash1',
        status: 'Active',
        statusHistory: [{week: 23, year: 2026, status: 'Active'}],
        penetration: '0mm',
        x: 1, y: 2, z: 3,
        elementIdA: 'EID-A-5',
        elementIdB: 'EID-B-5',
        eA: {id: 'EID-A-5'},
        eB: {id: 'EID-B-5'},
        nwCreated: '15/01/26',
        weekTag: 'week-260601',
        weekDate: '2026-06-01'
      }];
      sv('clashes', S.clashes);
      _uid = 1;

      _bcfC = [{
        tn: 'TestT5',
        nwName: 'Clash1',
        mappedSt: 'Active',
        depMm: 0.01,
        x: 1, y: 2, z: 3,
        eA: {id: 'EID-A-5'},
        eB: {id: 'EID-B-5'},
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

    expect(result.status).toBe('Active');
    expect(result.historyLen).toBe(1);
  });
});
