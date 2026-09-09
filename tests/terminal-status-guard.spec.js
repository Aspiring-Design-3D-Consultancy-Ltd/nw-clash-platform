import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A1-TERMINAL-STATUS-GUARD contract (DEC-021):
   Terminal statuses (Approved/Resolved) must not be downgraded by XML re-imports.

   Decision table (exist.status × incoming c.mappedSt):
   T1: exist non-terminal (New/Active/Reviewed) × anything
       → unchanged from today (PR-03-CLOCK2 path)
   T2: exist Approved × New/Active/Reviewed
       → no status change, no statusHistory entry. Other field refreshes proceed.
   T3: exist Approved × Approved
       → no change
   T4: exist Resolved × Approved
       → exist.status='Approved'; pushStatusHistory with source:'Import'
   T5: exist Resolved × New/Active/Reviewed
       → HOLD case: status stays Resolved. Append to exist.reappearances[].
         Do NOT refresh weekTag/weekDate (per DEC-020).
   T6: exist Resolved × Resolved
       → no change

   Scenarios T1, T4 demonstrate status changes + history entries (normal PR-03-CLOCK2 behavior).
   Scenarios T2, T3, T6 demonstrate terminal-status protection.
   Scenario T5 demonstrates HOLD case with reappearances tracking.
*/

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
    // Nav to bcf tab to ensure DOM elements exist for bparse/importToRegister
    nav('bcf');
  });
  await page.waitForSelector('#bxml', { timeout: 5000 }).catch(() => {});
}

function buildXml(testName, clashName, status) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="m">
  <batchtest units="m">
    <clashtest name="${testName}" units="m">
      <clashresult name="${clashName}" distance="0.01">
        <resultstatus>${status}</resultstatus>
        <clashpoint><pos3f x="1" y="2" z="3"/></clashpoint>
        <createddate><date year="2026" month="1" day="15" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <objectattribute><name>Element ID</name><value>EID-A-1</value></objectattribute>
        </clashobject>
        <clashobject>
          <objectattribute><name>Element ID</name><value>EID-B-1</value></objectattribute>
        </clashobject>
      </clashresult>
    </clashtest>
  </batchtest>
</exchange>`;
}

test.describe('PR-A1-TERMINAL-STATUS-GUARD — terminal statuses blocked from downgrade', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('T2 — Approved re-imported as Active blocks downgrade, no history entry', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Seed initial clash as Approved
      S.clashes = [{
        uid: 1,
        testName: 'TestT2',
        nwName: 'Clash1',
        status: 'Approved',
        statusHistory: [{week: 23, year: 2026, status: 'Approved'}],
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

      // Re-import as Active (should be blocked by guard)
      _bcfC = [{
        testName: 'TestT2',
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

    expect(result.status).toBe('Approved'); // Status unchanged (guarded)
    expect(result.historyLen).toBe(1); // No new history entry
    expect(result.weekTag).toBe('week-260608'); // Other fields refreshed
  });

  test('T3 — Approved re-imported as Approved no change', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.clashes = [{
        uid: 1,
        testName: 'TestT3',
        nwName: 'Clash1',
        status: 'Approved',
        statusHistory: [{week: 23, year: 2026, status: 'Approved'}],
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
        testName: 'TestT3',
        nwName: 'Clash1',
        mappedSt: 'Approved',
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

    expect(result.status).toBe('Approved');
    expect(result.historyLen).toBe(1);
  });

  test('T4 — Resolved re-imported as Approved allows upgrade, new history entry', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.clashes = [{
        uid: 1,
        testName: 'TestT4',
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
        testName: 'TestT4',
        nwName: 'Clash1',
        mappedSt: 'Approved',
        depMm: 0.01,
        x: 1, y: 2, z: 3,
        eA: {id: 'EID-A-1'},
        eB: {id: 'EID-B-1'},
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
        history1Status: (c.statusHistory || [])[1]?.status
      };
    });

    expect(result.status).toBe('Approved');
    expect(result.historyLen).toBe(2);
    expect(result.history1Status).toBe('Approved');
  });

  test('T5 — Resolved re-imported as Active (HOLD case) appends reappearances[], skips weekTag refresh', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.clashes = [{
        uid: 1,
        testName: 'TestT5',
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
      _rqBatch = 'bat-test-batch-id';

      _bcfC = [{
        testName: 'TestT5',
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
        weekTag: c.weekTag,
        weekDate: c.weekDate,
        reappCount: (c.reappearances || []).length,
        reapBatch: (c.reappearances || [])[0]?.batch
      };
    });

    expect(result.status).toBe('Resolved'); // Status held (not downgraded)
    expect(result.historyLen).toBe(1); // No new history entry
    expect(result.weekTag).toBe('week-260601'); // NOT refreshed (DEC-020)
    expect(result.weekDate).toBe('2026-06-01'); // NOT refreshed (DEC-020)
    expect(result.reappCount).toBe(1);
    expect(result.reapBatch).toBe('bat-test-batch-id');
  });
});
