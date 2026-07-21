import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A2 contract:
   Surface 1 — Chart-range slider: on successful weekly import,
   _chartTo advances to max(_platformWeeks()) as ordinal; _chartFrom
   deliberately untouched (user's left-edge preserved).
   Surface 2 — Test Breakdown table: cohort + statusHistory walk
   cutoff both bound to latest platform week on every render (not on
   import). Sum across rows equals count of clashes existing at latest
   platform week (= register total in the normal case). Row count
   equals distinct testName count in scope+bld cohort. */

// XML fixtures: two clashes in TestA + one in TestB, all Active.
// Different weekTag stamps let us verify _chartTo advances on second
// import.
const XML_TEST_A_TWO = `<?xml version="1.0"?>
<exchange units="mm">
  <batchtest>
    <clashtest name="TestA">
      <clashresult name="Clash1" distance="-0.02">
        <clashpoint><pos3f x="1" y="2" z="3"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="6" day="1" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-A-1</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-B-1</value></objectattribute>
        </clashobject>
      </clashresult>
      <clashresult name="Clash2" distance="-0.02">
        <clashpoint><pos3f x="4" y="5" z="6"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="6" day="1" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-A-2</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-B-2</value></objectattribute>
        </clashobject>
      </clashresult>
    </clashtest>
    <clashtest name="TestB">
      <clashresult name="Clash1" distance="-0.02">
        <clashpoint><pos3f x="7" y="8" z="9"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="6" day="1" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-A-3</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-B-3</value></objectattribute>
        </clashobject>
      </clashresult>
    </clashtest>
  </batchtest>
</exchange>`;

// Same clashes, different date — simulates a re-import under a new week.
const XML_WEEK_2 = XML_TEST_A_TWO.replace(/month="6" day="1"/g, 'month="6" day="8"');

test.describe('PR-A2 — latest-week bounds', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof importToRegister === 'function' && typeof _platformWeeks === 'function' && typeof buildTestBreakdown === 'function');
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      _ROLE = 'admin';
      S.clashes = [];
      S.weekly = [];
      sv('clashes', []);
      sv('weekly', []);
    });
  });

  test('Surface 1 — _chartTo advances to max(_platformWeeks()) on weekly import', async ({ page }) => {
    // Import 1: weekDate 2026-06-01 (W23 2026).
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      _bcfC.forEach(c => { c.weekTag = 'week-260601'; c.weekDate = '2026-06-01'; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_TEST_A_TWO);
    const afterImport1 = await page.evaluate(() => ({
      chartTo: _chartTo,
      chartFrom: _chartFrom,
      platform: _platformWeeks().map(p => p.year*100+p.week),
    }));
    // W23/2026 ordinal.
    expect(afterImport1.chartTo).toBe(2026*100+23);
    expect(afterImport1.platform).toEqual([2026*100+23]);

    // Simulate user narrowing left edge to W23 manually (already there,
    // but re-set to prove _chartFrom is preserved after the second
    // import).
    await page.evaluate(() => { _chartFrom = 2026*100+23; });

    // Import 2: same clashes, weekDate 2026-06-08 (W24 2026).
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      _bcfC.forEach(c => { c.weekTag = 'week-260608'; c.weekDate = '2026-06-08'; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_WEEK_2);
    const afterImport2 = await page.evaluate(() => ({
      chartTo: _chartTo,
      chartFrom: _chartFrom,
      platform: _platformWeeks().map(p => p.year*100+p.week),
    }));
    // _chartTo advanced to W24/2026 max.
    expect(afterImport2.chartTo).toBe(2026*100+24);
    // _chartFrom preserved at user's W23 selection (NOT touched).
    expect(afterImport2.chartFrom).toBe(2026*100+23);
    // Platform weeks now include both W23 and W24 (statusHistory
    // captured the W24 status transition from Site 1 of PR-03).
    expect(afterImport2.platform).toContain(2026*100+23);
    expect(afterImport2.platform).toContain(2026*100+24);
  });

  test('Surface 2 — Test Breakdown row sum equals register total at latest platform week', async ({ page }) => {
    // Seed a register with 3 clashes across 2 tests at W23. All Active.
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      _bcfC.forEach(c => { c.weekTag = 'week-260601'; c.weekDate = '2026-06-01'; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_TEST_A_TWO);
    // Navigate to dashboard to render the Test Breakdown table.
    await page.evaluate(() => { S.dashScope = 'all'; S.dashBuilding = 'all'; nav('dashboard'); });
    await page.waitForSelector('#test-breakdown-body table');

    const stats = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#test-breakdown-body tbody tr')];
      const rowStats = rows.map(tr => {
        const cells = [...tr.querySelectorAll('td')];
        // Columns: Test, New, Active, Reviewed, Approved, Resolved, Maturity
        return {
          name: cells[0].textContent.trim(),
          n: parseInt(cells[1].textContent, 10) || 0,
          a: parseInt(cells[2].textContent, 10) || 0,
          r: parseInt(cells[3].textContent, 10) || 0,
          ap: parseInt(cells[4].textContent, 10) || 0,
          re: parseInt(cells[5].textContent, 10) || 0,
        };
      });
      const sum = rowStats.reduce((acc, x) => acc + x.n + x.a + x.r + x.ap + x.re, 0);
      const distinctTests = new Set((S.clashes || []).map(c => c.testName || c.name || 'Untitled test')).size;
      return {
        rowCount: rows.length,
        sum,
        registerTotal: (S.clashes || []).length,
        distinctTests,
        rowNames: rowStats.map(r => r.name).sort(),
      };
    });
    // Sum across all rows == register total (every clash counted once).
    expect(stats.sum).toBe(stats.registerTotal);
    // Row count == distinct testName count in register.
    expect(stats.rowCount).toBe(stats.distinctTests);
    // Both test names present.
    expect(stats.rowNames).toEqual(['TestA', 'TestB']);
    // Explicit: 3 clashes, 2 tests.
    expect(stats.registerTotal).toBe(3);
    expect(stats.rowCount).toBe(2);
    expect(stats.sum).toBe(3);
  });

  test('Surface 2 — Test Breakdown advances after new import (renders latest state, not stale snapshot)', async ({ page }) => {
    // Import week 1.
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      _bcfC.forEach(c => { c.weekTag = 'week-260601'; c.weekDate = '2026-06-01'; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_TEST_A_TWO);
    // View dashboard once so the first snapshot renders.
    await page.evaluate(() => { S.dashScope = 'all'; S.dashBuilding = 'all'; nav('dashboard'); });
    await page.waitForSelector('#test-breakdown-body table');
    // Mutate an existing clash's status to Reviewed via the uf()
    // handler — this pushes a new statusHistory entry at the ACTION
    // clock (wall-clock ISO week), which is what the Test Breakdown
    // must reflect on re-render. Note: uf writes clock-3 stamps; the
    // "latest platform week" in _platformWeeks() is now wall-clock
    // week (via the statusHistory union in _platformWeeks). So the
    // Test Breakdown reconstruction should reflect the status change.
    await page.evaluate(() => {
      const uid = (S.clashes[0] || {}).uid;
      if (uid) uf(uid, 'status', 'Reviewed');
      nav('dashboard');
    });
    await page.waitForSelector('#test-breakdown-body table');
    const stats = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#test-breakdown-body tbody tr')];
      const findByName = n => {
        const tr = rows.find(r => r.querySelector('td').textContent.trim() === n);
        if (!tr) return null;
        const cells = [...tr.querySelectorAll('td')];
        return {
          n: parseInt(cells[1].textContent, 10) || 0,
          a: parseInt(cells[2].textContent, 10) || 0,
          r: parseInt(cells[3].textContent, 10) || 0,
          ap: parseInt(cells[4].textContent, 10) || 0,
          re: parseInt(cells[5].textContent, 10) || 0,
        };
      };
      return { testA: findByName('TestA'), testB: findByName('TestB') };
    });
    // TestA has 2 clashes: one is now Reviewed, one still Active
    // (or New — depends on initial status stamping).
    const testASum = stats.testA.n + stats.testA.a + stats.testA.r + stats.testA.ap + stats.testA.re;
    expect(testASum).toBe(2);
    // Exactly one of TestA's clashes should now be in the Reviewed
    // column — proves the render read from statusHistory (not a
    // frozen aggregate).
    expect(stats.testA.r).toBe(1);
  });

  test('Surface 2 — Fresh install (empty platform weeks) falls back to wall-clock without crash', async ({ page }) => {
    // Reset to fully empty register. _platformWeeks() returns []. The
    // reconstruction path must fall back to wall-clock — no exception,
    // no console error, zero rows in the table.
    await page.evaluate(() => {
      S.clashes = [];
      S.weekly = [];
      S.dashScope = 'all';
      S.dashBuilding = 'all';
      nav('dashboard');
    });
    await page.waitForSelector('#test-breakdown-body table');
    const out = await page.evaluate(() => ({
      platformCount: _platformWeeks().length,
      rowCount: document.querySelectorAll('#test-breakdown-body tbody tr').length,
    }));
    expect(out.platformCount).toBe(0);
    expect(out.rowCount).toBe(0);
  });
});
