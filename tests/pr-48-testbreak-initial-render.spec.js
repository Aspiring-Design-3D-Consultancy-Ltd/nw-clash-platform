import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-48-TESTBREAK-INITIAL-RENDER contract:
   On initial dashboard nav (with no user interaction), the Test
   Breakdown table must reflect the PR-A2 reconstruction — i.e.
   every distinct testName in the register, per-cell counts derived
   via clashStatusAt at the latest platform week. Prior to PR #48,
   only rDash's inline template ran on first paint, populated from
   S.weekly[last].tests (the frozen regenWeeklyFromRegister
   aggregate); newly-imported tests absent from that frozen bucket
   never appeared.

   Fixture mimics the live-register regression: 11 distinct
   testNames in nw:clashes, but S.weekly[last].tests only holds 10
   (Exyte CM_v_08_AMHS is post-freeze and absent from the
   aggregate). Under the pre-#48 static template, the table
   renders 10 rows summing to X; under the fix, 11 rows summing to
   the register total.

   This test is the mandatory path-discriminator that PR #47's tests
   lacked — it verifies buildTestBreakdown actually ran, not just
   that rDash's inline template produced compatible output by
   coincidence. If it passes against pre-#48 main, the test is
   wrong. */

test.describe('PR-48-TESTBREAK-INITIAL-RENDER — reconstruction fires on first paint', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof buildTestBreakdown === 'function' && typeof _platformWeeks === 'function' && typeof clashStatusAt === 'function');
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

  test('Fixture: 11 testNames in register but only 10 in S.weekly[last].tests — dashboard shows all 11 rows', async ({ page }) => {
    await page.evaluate(() => {
      // Mimics the live-register state that surfaced the regression:
      // 11 distinct testNames present, but the frozen weekly aggregate
      // only knows about 10 of them (Exyte CM_v_08_AMHS was imported
      // after the last regenWeeklyFromRegister freeze).
      const TEN_TESTS = [
        '01_ARC_v_08_AMHS','02_STR_v_08_AMHS','03_GAS_v_08_AMHS',
        '04_LSW_v_08_AMHS','05_HVA_v_08_AMHS','06_ELE_v_08_AMHS',
        '07_MEC_v_08_AMHS','12_GMS_v_08_AMHS',
        'EXYTE CSA_v_08_AMHS','[H] AMHS-E-MECH vs AMHS-E-STRUCT',
      ];
      const POST_FREEZE_TEST = 'Exyte CM_v_08_AMHS';
      const mk = (testName, uidN, weekNum) => ({
        uid: 'CLX-' + String(uidN).padStart(4, '0'),
        name: 'CLX-' + String(uidN).padStart(4, '0') + ' — c',
        testName,
        disciplineA: 'S', disciplineB: 'M',
        elementA: 'a', elementB: 'b',
        penetration: '10mm', priority: 'High',
        status: 'Active',
        date: '01/07/26',
        x: 0, y: 0, z: 0,
        weekTag: 'week-2606' + String(weekNum).padStart(2, '0'),
        weekDate: '2026-06-' + String(weekNum).padStart(2, '0'),
        firstSeenWeekTag: 'week-2606' + String(weekNum).padStart(2, '0'),
        firstSeenWeekDate: '2026-06-' + String(weekNum).padStart(2, '0'),
        statusHistory: [{ week: 23, year: 2026, status: 'Active' }],
      });
      // 10 clashes across the 10 pre-freeze tests, one each. Plus 8
      // clashes for the post-freeze test (matches the brief's numbers).
      let uid = 0;
      const preFreeze = TEN_TESTS.map(t => mk(t, ++uid, 1));
      const postFreeze = Array.from({length: 8}, () => mk(POST_FREEZE_TEST, ++uid, 8));
      S.clashes = [...preFreeze, ...postFreeze];
      sv('clashes', S.clashes);

      // S.weekly[last].tests: contains ONLY the 10 pre-freeze tests
      // (as regenWeeklyFromRegister would produce for the frozen
      // clock-1 last-week bucket that predates the post-freeze
      // import). Absent: Exyte CM_v_08_AMHS.
      S.weekly = [{
        week: 23, year: 2026, label: 'Wk 23 — 01 Jun 2026', date: '01 Jun 2026',
        new: 0, active: 10, reviewed: 0, approved: 0, resolved: 0,
        critical: 0, high: 10, medium: 0, low: 0,
        tests: TEN_TESTS.map(name => ({
          name, new: 0, active: 1, reviewed: 0, approved: 0, resolved: 0,
          critical: 0, rate: 0,
        })),
      }];
      sv('weekly', S.weekly);
    });

    // First paint — the discriminator: no user interaction after nav,
    // no chart-range change, no toggleTrend, no scope/building filter
    // click. Pre-#48 this renders rDash's inline template only.
    await page.evaluate(() => {
      S.dashScope = 'all';
      S.dashBuilding = 'all';
      // rDash calls regenWeeklyFromRegister() on entry which re-buckets
      // S.clashes into S.weekly by c.date. That would rebuild our
      // seeded S.weekly[last].tests and eliminate the frozen-aggregate
      // condition the test is trying to reproduce. Stub to no-op so
      // the seeded 10-test aggregate survives into rDash's static
      // template render — exactly mimicking the live production
      // scenario where the frozen last-week bucket predates the
      // newest imported test (Exyte CM_v_08_AMHS).
      window.regenWeeklyFromRegister = () => {};
      nav('dashboard');
    });
    await page.waitForSelector('#test-breakdown-body table');

    const stats = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#test-breakdown-body tbody tr')];
      const parse = tr => {
        const cells = [...tr.querySelectorAll('td')];
        return {
          name: cells[0].textContent.trim(),
          n: parseInt(cells[1].textContent, 10) || 0,
          a: parseInt(cells[2].textContent, 10) || 0,
          r: parseInt(cells[3].textContent, 10) || 0,
          ap: parseInt(cells[4].textContent, 10) || 0,
          re: parseInt(cells[5].textContent, 10) || 0,
        };
      };
      const parsed = rows.map(parse);
      const sum = parsed.reduce((acc, x) => acc + x.n + x.a + x.r + x.ap + x.re, 0);
      const registerTotal = (S.clashes || []).length;
      const distinctTests = new Set((S.clashes || []).map(c => c.testName || c.name || 'Untitled test')).size;
      const exyteCM = parsed.find(r => r.name === 'Exyte CM_v_08_AMHS');
      return {
        rowCount: rows.length,
        sum,
        registerTotal,
        distinctTests,
        exyteCM,
        names: parsed.map(r => r.name).sort(),
      };
    });

    // Row count: 11 (10 pre-freeze + 1 post-freeze). Pre-#48 shows 10.
    expect(stats.rowCount).toBe(11);
    expect(stats.rowCount).toBe(stats.distinctTests);
    // Sum equals register total. Pre-#48 shows 10 (only the frozen
    // aggregate's counts, one per pre-freeze test).
    expect(stats.registerTotal).toBe(18); // 10 + 8
    expect(stats.sum).toBe(18);
    expect(stats.sum).toBe(stats.registerTotal);
    // Exyte CM_v_08_AMHS row is present with 8 Active. Pre-#48 the
    // row does not exist at all (row lookup returns undefined).
    expect(stats.exyteCM).toBeDefined();
    expect(stats.exyteCM.a).toBe(8);
    expect(stats.exyteCM.n).toBe(0);
    expect(stats.exyteCM.r).toBe(0);
    expect(stats.exyteCM.ap).toBe(0);
    expect(stats.exyteCM.re).toBe(0);
  });

  test('Cell values match clashStatusAt(latest platform week) for Exyte CM cohort', async ({ page }) => {
    // Same fixture as above, but this test asserts the cells match
    // what an independent clashStatusAt walk would produce — proving
    // the render came from reconstruction (not the frozen aggregate,
    // which doesn't include the row at all).
    await page.evaluate(() => {
      const testName = 'Exyte CM_v_08_AMHS';
      // Seed 8 clashes for the post-freeze test, staggered statuses
      // so we can verify each cell independently.
      const STATUSES = ['Active','Active','Active','Reviewed','Approved','Resolved','Active','Active'];
      S.clashes = STATUSES.map((st, i) => ({
        uid: 'CLX-CM-' + String(i+1).padStart(2, '0'),
        name: 'CLX-CM ' + (i+1),
        testName,
        disciplineA: 'S', disciplineB: 'M',
        elementA: 'a', elementB: 'b',
        penetration: '10mm', priority: 'High',
        status: st,
        date: '01/07/26',
        x: 0, y: 0, z: 0,
        weekTag: 'week-260601', weekDate: '2026-06-01',
        firstSeenWeekTag: 'week-260601', firstSeenWeekDate: '2026-06-01',
        statusHistory: [{ week: 23, year: 2026, status: st }],
      }));
      sv('clashes', S.clashes);
      // S.weekly[last].tests entirely absent for this test (matches
      // the post-freeze condition — Exyte CM not in frozen aggregate).
      S.weekly = [{
        week: 23, year: 2026, label: 'Wk 23',
        new: 0, active: 0, reviewed: 0, approved: 0, resolved: 0,
        critical: 0, high: 0, medium: 0, low: 0,
        tests: [], // ← the key condition
      }];
      sv('weekly', S.weekly);
    });
    await page.evaluate(() => {
      S.dashScope = 'all';
      S.dashBuilding = 'all';
      // rDash calls regenWeeklyFromRegister() on entry which re-buckets
      // S.clashes into S.weekly by c.date. That would rebuild our
      // seeded S.weekly[last].tests and eliminate the frozen-aggregate
      // condition the test is trying to reproduce. Stub to no-op so
      // the seeded 10-test aggregate survives into rDash's static
      // template render — exactly mimicking the live production
      // scenario where the frozen last-week bucket predates the
      // newest imported test (Exyte CM_v_08_AMHS).
      window.regenWeeklyFromRegister = () => {};
      nav('dashboard');
    });
    await page.waitForSelector('#test-breakdown-body table');
    const cells = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#test-breakdown-body tbody tr')];
      const cmRow = rows.find(tr => tr.querySelector('td').textContent.trim() === 'Exyte CM_v_08_AMHS');
      if (!cmRow) return null;
      const c = [...cmRow.querySelectorAll('td')];
      return {
        n: parseInt(c[1].textContent, 10) || 0,
        a: parseInt(c[2].textContent, 10) || 0,
        r: parseInt(c[3].textContent, 10) || 0,
        ap: parseInt(c[4].textContent, 10) || 0,
        re: parseInt(c[5].textContent, 10) || 0,
      };
    });
    expect(cells).not.toBeNull();
    // Independent count from the fixture's status distribution:
    // 5 Active, 1 Reviewed, 1 Approved, 1 Resolved.
    expect(cells.n).toBe(0);
    expect(cells.a).toBe(5);
    expect(cells.r).toBe(1);
    expect(cells.ap).toBe(1);
    expect(cells.re).toBe(1);
    // Sanity: sum equals the 8 clashes.
    expect(cells.n + cells.a + cells.r + cells.ap + cells.re).toBe(8);
  });
});
