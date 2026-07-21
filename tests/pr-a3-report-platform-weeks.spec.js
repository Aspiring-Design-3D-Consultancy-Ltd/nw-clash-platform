import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A3-EXPORT-PLATFORM-WEEKS contract:
   exportReport (PDF) and exportPPTX (PPT) must source their weekly-
   coordination table and clash-test-breakdown rows from
   _platformWeeks + reconstruction primitives, not from S.weekly
   (which includes phantom pre-platform buckets) or wd.tests (a
   frozen aggregate).

   Fixture reproduces the live-register regression state:
     - 11 distinct testNames in S.clashes (Exyte CM_v_08_AMHS as the
       post-freeze test with 8 Active clashes)
     - S.weekly[last].tests seeded with only 10 pre-freeze tests
     - S.weekly bloated with 24 phantom pre-platform buckets
       (W1/2026 → W22/2026) + 8 real platform buckets (W23-W30)
       = 32 rows total
     - regenWeeklyFromRegister stubbed to no-op so the seeded
       frozen aggregate survives — same trap PR #48 tests hit and
       had to solve with a stub.

   Pre-fix (main): exportReport HTML weekly table has 32 rows, test
   breakdown has 10 rows, Exyte CM absent. Post-fix: weekly table
   has 8 rows, test breakdown 11 rows, Exyte CM present.

   Test-the-test evidence: check out main, comment the stub, run
   spec → all four assertions fail on the row counts / row
   presence. Restore fix → all green. */

const PLATFORM_WEEKS = 8;     // W23-W30 2026
const PRE_FREEZE_TESTS = [
  '01_ARC_v_08_AMHS','02_STR_v_08_AMHS','03_GAS_v_08_AMHS',
  '04_LSW_v_08_AMHS','05_HVA_v_08_AMHS','06_ELE_v_08_AMHS',
  '07_MEC_v_08_AMHS','12_GMS_v_08_AMHS',
  'EXYTE CSA_v_08_AMHS','[H] AMHS-E-MECH vs AMHS-E-STRUCT',
];
const POST_FREEZE_TEST = 'Exyte CM_v_08_AMHS';

async function seedFixture(page) {
  await page.evaluate(({ PRE_FREEZE_TESTS, POST_FREEZE_TEST }) => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';

    let uid = 0;
    const mk = (testName, weekNum) => {
      const day = String(weekNum).padStart(2, '0');
      const isoDate = '2026-06-' + day;
      return {
        uid: 'CLX-' + String(++uid).padStart(4, '0'),
        name: 'CLX-' + String(uid).padStart(4, '0') + ' — c',
        testName,
        disciplineA: 'S', disciplineB: 'M',
        elementA: 'a', elementB: 'b',
        penetration: '10mm', priority: 'High',
        status: 'Active',
        date: '01/07/26',
        x: 0, y: 0, z: 0,
        weekTag: 'week-2606' + day, weekDate: isoDate,
        firstSeenWeekTag: 'week-2606' + day, firstSeenWeekDate: isoDate,
        statusHistory: [{ week: 22 + Math.min(weekNum, 8), year: 2026, status: 'Active' }],
      };
    };
    // 10 clashes across 10 pre-freeze tests, each in a different
    // platform week W23-W30 so _platformWeeks() returns 8 tuples.
    const preFreeze = PRE_FREEZE_TESTS.map((t, i) => mk(t, (i % 8) + 1));
    // 8 clashes for the post-freeze test, all in W23 for a clean
    // 8/0/0/0/0 row assertion.
    const postFreeze = Array.from({length: 8}, () => mk(POST_FREEZE_TEST, 1));
    S.clashes = [...preFreeze, ...postFreeze];
    sv('clashes', S.clashes);

    // S.weekly bloated: 24 phantom pre-platform buckets (weeks
    // 41/2025 → 22/2026, disjoint from real W23-W30/2026 so the
    // _labelForPlatformWeek(y,w) lookup never collides with a
    // phantom label of the same tuple) + 8 real buckets.
    const phantom = Array.from({length: 24}, (_, i) => {
      // Weeks 41..52 in 2025, then 1..12 in 2026.
      const wk = i < 12 ? (41 + i) : (i - 11);
      const yr = i < 12 ? 2025 : 2026;
      return {
        week: wk, year: yr,
        label: 'Phantom Wk ' + wk,
        new: 99, active: 99, reviewed: 0, approved: 0, resolved: 0,
        critical: 99, high: 0, medium: 0, low: 0,
        tests: [],
      };
    });
    const real = Array.from({length: 8}, (_, i) => {
      const wk = 23 + i;
      // Frozen aggregate for the LAST real week: only 10 pre-freeze
      // tests present (Exyte CM absent — the post-freeze condition).
      const isLast = i === 7;
      return {
        week: wk, year: 2026,
        label: 'Wk ' + wk + ' — real',
        new: 0, active: isLast ? 10 : 1, reviewed: 0, approved: 0, resolved: 0,
        critical: 0, high: isLast ? 10 : 1, medium: 0, low: 0,
        tests: isLast ? PRE_FREEZE_TESTS.map(name => ({
          name, new: 0, active: 1, reviewed: 0, approved: 0, resolved: 0,
          critical: 0, rate: 0,
        })) : [],
      };
    });
    S.weekly = [...phantom, ...real];
    sv('weekly', S.weekly);

    // Stub regen so the seeded frozen aggregate survives into the
    // export path — mimics live production where the last frozen
    // bucket predates the newest imported test.
    window.regenWeeklyFromRegister = () => {};
    // Prevent window.open popup / URL.createObjectURL blob-navigation
    // side effects.
    window.open = () => null;
  }, { PRE_FREEZE_TESTS, POST_FREEZE_TEST });
}

test.describe('PR-A3-EXPORT-PLATFORM-WEEKS — report/PPTX read from platform reconstruction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof exportReport === 'function' && typeof _reportWeeklyRows === 'function' && typeof _reportTestBreakdownRows === 'function');
    await seedFixture(page);
  });

  test('helpers reconstruct correctly against fixture', async ({ page }) => {
    const out = await page.evaluate(() => ({
      platformCount: _platformWeeks().length,
      weeklyRows: _reportWeeklyRows().length,
      testRows: _reportTestBreakdownRows().length,
      testNames: _reportTestBreakdownRows().map(r => r.name).sort(),
      exyteCM: _reportTestBreakdownRows().find(r => r.name === 'Exyte CM_v_08_AMHS'),
    }));
    expect(out.platformCount).toBe(PLATFORM_WEEKS);
    expect(out.weeklyRows).toBe(PLATFORM_WEEKS);
    expect(out.testRows).toBe(11);
    expect(out.testNames).toContain(POST_FREEZE_TEST);
    expect(out.exyteCM).toBeDefined();
    expect(out.exyteCM.active).toBe(8);
    expect(out.exyteCM.new).toBe(0);
    expect(out.exyteCM.reviewed).toBe(0);
    expect(out.exyteCM.approved).toBe(0);
    expect(out.exyteCM.resolved).toBe(0);
  });

  test('exportReport HTML weekly table has 8 rows + test breakdown has 11 rows with Exyte CM', async ({ page }) => {
    const html = await page.evaluate(async () => {
      // Patch URL.createObjectURL to capture the blob; suppress
      // window.open so the popup doesn't try to navigate.
      const blobs = [];
      const origCreate = URL.createObjectURL;
      URL.createObjectURL = (b) => { blobs.push(b); return 'blob:mock'; };
      try { exportReport('pdf'); } catch(e) {}
      URL.createObjectURL = origCreate;
      const blob = blobs[0];
      return blob ? await blob.text() : null;
    });
    expect(html).not.toBeNull();

    const stats = await page.evaluate((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const findTableAfter = (h2Text) => {
        const h2s = [...doc.querySelectorAll('h2')];
        const anchor = h2s.find(h => (h.textContent || '').trim() === h2Text);
        if (!anchor) return null;
        let sib = anchor.nextElementSibling;
        while (sib && sib.tagName !== 'TABLE') sib = sib.nextElementSibling;
        return sib;
      };
      const wkTable = findTableAfter('Weekly Coordination Data');
      const tbTable = findTableAfter('Clash Test Breakdown');
      const wkRows = wkTable ? [...wkTable.querySelectorAll('tbody tr')] : [];
      const tbRows = tbTable ? [...tbTable.querySelectorAll('tbody tr')] : [];
      const parseTb = tr => {
        const cs = [...tr.querySelectorAll('td')];
        return {
          name: cs[0] ? cs[0].textContent.trim() : '',
          new: parseInt(cs[1] && cs[1].textContent, 10) || 0,
          active: parseInt(cs[2] && cs[2].textContent, 10) || 0,
          reviewed: parseInt(cs[3] && cs[3].textContent, 10) || 0,
          approved: parseInt(cs[4] && cs[4].textContent, 10) || 0,
          resolved: parseInt(cs[5] && cs[5].textContent, 10) || 0,
        };
      };
      const tb = tbRows.map(parseTb);
      const tbNames = tb.map(r => r.name).sort();
      const cm = tb.find(r => r.name === 'Exyte CM_v_08_AMHS');
      const tbSum = tb.reduce((acc, r) => acc + r.new + r.active + r.reviewed + r.approved + r.resolved, 0);
      const wkLabels = wkRows.map(tr => {
        const cs = [...tr.querySelectorAll('td')];
        return cs[0] ? cs[0].textContent.trim() : '';
      });
      return { wkCount: wkRows.length, tbCount: tbRows.length, tbNames, cm, tbSum, registerTotal: (S.clashes || []).length, wkLabels };
    }, html);

    // Weekly Coordination Data table: exactly 8 rows (platform weeks
    // W23-W30). Pre-fix would show 32 rows (24 phantom + 8 real).
    expect(stats.wkCount).toBe(PLATFORM_WEEKS);
    // Labels reference the real weeks (not "Phantom Wk N").
    stats.wkLabels.forEach(lbl => {
      expect(lbl).not.toMatch(/Phantom/);
    });
    // Test breakdown has 11 rows including Exyte CM. Pre-fix would
    // show 10 (from wd.tests frozen aggregate).
    expect(stats.tbCount).toBe(11);
    expect(stats.tbNames).toContain(POST_FREEZE_TEST);
    expect(stats.cm).toBeDefined();
    expect(stats.cm.active).toBe(8);
    // Sum equals register total (every clash counted at latest
    // platform week's reconstruction).
    expect(stats.registerTotal).toBe(18);
    expect(stats.tbSum).toBe(stats.registerTotal);
  });

  test('exportPPTX weekly-slide + test-breakdown slide receive platform-reconstructed rows', async ({ page }) => {
    // Stub PptxGenJS with a minimal shim that records addTable calls
    // so we can assert the row source without hitting the CDN.
    const captured = await page.evaluate(async () => {
      const tables = [];
      const slideStub = () => ({
        background: {},
        addText: () => {},
        addShape: () => {},
        addImage: () => {},
        addChart: () => {},
        addTable: (rows /*, opts*/) => { tables.push(rows); },
      });
      class StubPptx {
        constructor(){
          this.ShapeType = { rect: 'rect' };
          this.ChartType = { line: 'line', bar: 'bar', pie: 'pie', doughnut: 'doughnut', column: 'column' };
          this.layout = ''; this.author = ''; this.company = ''; this.title = ''; this.subject = '';
        }
        defineSlideMaster(){}
        addSlide(){ return slideStub(); }
        writeFile(){ return Promise.resolve(); }
      }
      window.PptxGenJS = StubPptx;
      window.confirm = () => true;
      window.alert = () => {};
      try { await exportPPTX(); } catch(e) { console.warn('[PR-A3-TEST] exportPPTX threw:', e.message); }
      return tables;
    });
    // Weekly table row shape: [header, ...body] where each row is an
    // array of pptx cells. Find the two we care about by row count.
    // Weekly table has 1 header + up to WK_MAX=6 body rows =
    // len 7 in our fixture. Test breakdown has 1 header + up to
    // TB_MAX=10 body rows = len 11.
    const weeklyTable = captured.find(t => t.length >= 2 && t.length <= 9 && t[0] && t[0].length === 9);
    const tbTable = captured.find(t => t.length >= 2 && t[0] && t[0].length === 7);
    expect(weeklyTable).toBeDefined();
    expect(tbTable).toBeDefined();

    // Weekly-slide body: rows contain the 6 most-recent platform
    // weeks (WK_MAX cap). Each week's first cell text should NOT
    // reference the phantom label pattern.
    const weeklyBody = weeklyTable.slice(1);
    expect(weeklyBody.length).toBe(6);
    weeklyBody.forEach(row => {
      const label = row[0] && row[0].text;
      expect(String(label)).not.toMatch(/Phantom/);
    });

    // Test-breakdown slide body: TB_MAX caps at 10. But the SOURCE
    // has 11 rows including Exyte CM. Assert that the source (which
    // determines "Showing N of M tests" copy) reflects reconstruction.
    const tbSource = await page.evaluate(() => _reportTestBreakdownRows().length);
    expect(tbSource).toBe(11);
    // And the rendered body has 10 (TB_MAX cap) — layout preserved.
    expect(tbTable.slice(1).length).toBe(10);
  });
});
