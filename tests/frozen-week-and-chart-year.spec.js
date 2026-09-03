import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

test.describe('FROZEN-WEEK-TERMINAL-REFRESH + CHART year-aware fixes', () => {
  test.beforeEach(async ({ page }) => {
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
      _ROLE = 'admin';
      // INV-010: isolate the register. Clearing nw:* keys does not empty the
      // in-memory demo dataset (104 clashes dated Jan 2025), and rDash() calls
      // regenWeeklyFromRegister(), which adds one snapshot per ISO week that
      // has clashes (WEEKLY-SNAP-PER-CLASH-BUCKET). With the demo register
      // present the two CHART-PERIOD-YEAR-AWARE tests saw 2025-W02..W05
      // prepended to their seeded weeks and _chartFrom came back 202502
      // instead of 202541 — on every run, not on a date boundary. Same
      // in-memory reset INV-007 / KI-005 applied to the folder-import specs.
      S.clashes = [];
      S.weekly = [];
    });
  });

  test('FROZEN-WEEK-TERMINAL-REFRESH — approving a clash whose c.date is in a frozen week updates snap.approved', async ({ page }) => {
    // Seed: one clash in Wk 25 2026, one Active. Manually build a frozen
    // weekly snap for that week with capturedAt set so regen treats it
    // as historical.
    await page.evaluate(() => {
      S.clashes = [{
        uid: 'CLX-401',
        name: 'CLX-401 — Frozen bucket approve',
        testName: 'FrozenTest',
        disciplineA: 'S', disciplineB: 'M',
        elementA: 'a', elementB: 'b',
        penetration: '10mm', priority: 'High',
        status: 'Active',
        // 15/06/26 is inside ISO Wk 25 2026.
        date: '15/06/26',
        x: 1, y: 2, z: 3,
        statusHistory: [{ week: 25, year: 2026, status: 'Active' }],
      }];
      S.weekly = [{
        week: 25, year: 2026, label: 'Wk 25 — 15 Jun 2026', date: '15 Jun 2026',
        new: 0, active: 1, reviewed: 0, approved: 0, resolved: 0,
        critical: 0, high: 1, medium: 0, low: 0,
        tests: [{ name: 'FrozenTest', new: 0, active: 1, reviewed: 0, approved: 0, resolved: 0, critical: 0, high: 1, medium: 0, low: 0, rate: 0 }],
        capturedAt: '2026-06-22T00:00:00.000Z',
      }];
      sv('clashes', S.clashes);
      sv('weekly', S.weekly);
    });

    // Approve the clash today. Handler triggers regenWeeklyFromRegister
    // internally on status change.
    await page.evaluate(() => {
      _markClashesAsApproved(['CLX-401'], 'ClashRegister');
    });

    const snap = await page.evaluate(() => {
      const w = (S.weekly || []).find(x => x.week === 25 && x.year === 2026);
      return {
        capturedAt: w && w.capturedAt,      // must remain (frozen preserved)
        active: w && w.active,               // historical, unchanged
        approved: w && w.approved,           // terminal, refreshed
        testApproved: w && w.tests && w.tests[0] && w.tests[0].approved,
        testActive: w && w.tests && w.tests[0] && w.tests[0].active,
        testRate: w && w.tests && w.tests[0] && w.tests[0].rate,
      };
    });
    // Frozen flag preserved.
    expect(snap.capturedAt).toBe('2026-06-22T00:00:00.000Z');
    // Historical open-lifecycle fields unchanged.
    expect(snap.active).toBe(1);
    // Terminal field refreshed to reflect the approve.
    expect(snap.approved).toBe(1);
    // Per-test terminal + rate refreshed; historical .active kept.
    expect(snap.testApproved).toBe(1);
    expect(snap.testActive).toBe(1);
    // Maturity rate = (approved+resolved)/(new+active+reviewed+approved+resolved) = 1/2 = 50%.
    expect(snap.testRate).toBe(50);
  });

  test('FROZEN-WEEK-TERMINAL-REFRESH — historical new/active/priorities on frozen snap NOT mutated', async ({ page }) => {
    // Seed a frozen week with distinctive historical values that MUST stay
    // frozen. Add a clash to that week and change its status — historical
    // counts must not shift.
    await page.evaluate(() => {
      S.clashes = [{
        uid: 'CLX-402',
        name: 'CLX-402',
        testName: 'FrozenTest',
        disciplineA: 'S', disciplineB: 'M',
        elementA: 'a', elementB: 'b',
        penetration: '10mm', priority: 'Critical',
        status: 'Reviewed',
        date: '15/06/26',
        x: 1, y: 2, z: 3,
        statusHistory: [{ week: 25, year: 2026, status: 'Reviewed' }],
      }];
      S.weekly = [{
        week: 25, year: 2026, label: 'Wk 25', date: '15 Jun 2026',
        new: 3, active: 5, reviewed: 2, approved: 0, resolved: 0,
        critical: 4, high: 2, medium: 1, low: 3,
        tests: [{ name: 'FrozenTest', new: 3, active: 5, reviewed: 2, approved: 0, resolved: 0, critical: 4, high: 2, medium: 1, low: 3, rate: 0 }],
        capturedAt: '2026-06-22T00:00:00.000Z',
      }];
      sv('clashes', S.clashes);
      sv('weekly', S.weekly);
      regenWeeklyFromRegister();
    });
    const snap = await page.evaluate(() => (S.weekly || []).find(x => x.week === 25 && x.year === 2026));
    // Historical fields — must equal seed.
    expect(snap.new).toBe(3);
    expect(snap.active).toBe(5);
    expect(snap.critical).toBe(4);
    expect(snap.high).toBe(2);
    expect(snap.medium).toBe(1);
    expect(snap.low).toBe(3);
    // Terminal-refresh fields — reflect the single Reviewed clash in the register.
    expect(snap.reviewed).toBe(1);
    expect(snap.approved).toBe(0);
    expect(snap.resolved).toBe(0);
    // capturedAt preserved.
    expect(snap.capturedAt).toBe('2026-06-22T00:00:00.000Z');
  });

  test('CHART-PERIOD-YEAR-AWARE — default range spans a year boundary correctly', async ({ page }) => {
    // Seed S.weekly with entries crossing 2025 → 2026. Previously
    // _chartFrom=Math.max(week, 14) with week=41 gave _chartFrom=41,
    // _chartTo=28 → impossible range → getDisplayWds() returned [].
    await page.evaluate(() => {
      S.weekly = [
        { week: 41, year: 2025, label: 'Wk 41 — 06 Oct 2025', date: '06 Oct 2025', new: 1, active: 0, reviewed: 0, approved: 0, resolved: 0, tests: [] },
        { week: 52, year: 2025, label: 'Wk 52 — 22 Dec 2025', date: '22 Dec 2025', new: 2, active: 1, reviewed: 0, approved: 0, resolved: 0, tests: [] },
        { week: 1,  year: 2026, label: 'Wk 1 — 29 Dec 2025',  date: '29 Dec 2025', new: 3, active: 2, reviewed: 0, approved: 0, resolved: 0, tests: [] },
        { week: 14, year: 2026, label: 'Wk 14 — 30 Mar 2026', date: '30 Mar 2026', new: 4, active: 3, reviewed: 0, approved: 0, resolved: 0, tests: [] },
        { week: 28, year: 2026, label: 'Wk 28 — 06 Jul 2026', date: '06 Jul 2026', new: 5, active: 4, reviewed: 0, approved: 0, resolved: 0, tests: [] },
      ];
      sv('weekly', S.weekly);
      nav('dashboard');
    });
    // Wait for chart infra to run — rDash sets _chartFrom / _chartTo.
    await page.waitForFunction(() => typeof _chartFrom === 'number' && _chartFrom > 0);
    const state = await page.evaluate(() => ({
      chartFrom: _chartFrom,
      chartTo: _chartTo,
      dispCount: getDisplayWds().length,
      firstDisp: getDisplayWds()[0] && ((getDisplayWds()[0].year || 0) * 100 + getDisplayWds()[0].week),
      lastDisp: getDisplayWds().slice(-1)[0] && ((getDisplayWds().slice(-1)[0].year || 0) * 100 + getDisplayWds().slice(-1)[0].week),
    }));
    // Encoded ordinals.
    expect(state.chartFrom).toBe(2025 * 100 + 41);
    expect(state.chartTo).toBe(2026 * 100 + 28);
    // Every seeded week visible.
    expect(state.dispCount).toBe(5);
    expect(state.firstDisp).toBe(2025 * 100 + 41);
    expect(state.lastDisp).toBe(2026 * 100 + 28);
  });

  test('CHART-PERIOD-YEAR-AWARE — resetChartRange restores full range and clears manual narrowing', async ({ page }) => {
    await page.evaluate(() => {
      S.weekly = [
        { week: 41, year: 2025, label: 'Wk 41 25', date: '06 Oct 2025', new: 1, active: 0, reviewed: 0, approved: 0, resolved: 0, tests: [] },
        { week: 14, year: 2026, label: 'Wk 14 26', date: '30 Mar 2026', new: 4, active: 3, reviewed: 0, approved: 0, resolved: 0, tests: [] },
      ];
      sv('weekly', S.weekly);
      nav('dashboard');
    });
    await page.waitForFunction(() => typeof _chartFrom === 'number' && _chartFrom > 0);
    // Manually narrow to one week only.
    await page.evaluate(() => {
      _chartFrom = 2026 * 100 + 14;
      _chartTo = 2026 * 100 + 14;
    });
    let disp = await page.evaluate(() => getDisplayWds().length);
    expect(disp).toBe(1);
    // Reset — should snap back to full range.
    await page.evaluate(() => resetChartRange());
    const state = await page.evaluate(() => ({
      chartFrom: _chartFrom,
      chartTo: _chartTo,
      dispCount: getDisplayWds().length,
    }));
    expect(state.chartFrom).toBe(2025 * 100 + 41);
    expect(state.chartTo).toBe(2026 * 100 + 14);
    expect(state.dispCount).toBe(2);
  });

  test('CHART-XAXIS-YEAR-LABEL — plain "Wk N" for single-year datasets, "Wk N/YY" when spanning years', async ({ page }) => {
    const singleYear = await page.evaluate(() => {
      const wds = [
        { week: 22, year: 2026 }, { week: 23, year: 2026 }, { week: 24, year: 2026 },
      ];
      return wds.map(w => _wkLabelFor(w, wds));
    });
    expect(singleYear).toEqual(['Wk 22', 'Wk 23', 'Wk 24']);

    const twoYears = await page.evaluate(() => {
      const wds = [
        { week: 51, year: 2025 }, { week: 52, year: 2025 }, { week: 1, year: 2026 }, { week: 2, year: 2026 },
      ];
      return wds.map(w => _wkLabelFor(w, wds));
    });
    expect(twoYears).toEqual(['Wk 51/25', 'Wk 52/25', 'Wk 1/26', 'Wk 2/26']);

    const empty = await page.evaluate(() => _wkLabelFor(null, []));
    expect(empty).toBe('');
  });
});
