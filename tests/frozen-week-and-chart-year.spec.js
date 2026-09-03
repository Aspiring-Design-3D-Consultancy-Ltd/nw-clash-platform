import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

test.describe('KI-008 weekly projection + CHART year-aware fixes', () => {
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

  // KI-008 / DEC-015 (2026-09-03): every week's snapshot counts each clash once,
  // at the status it held at the END of that ISO week. This replaced
  // FROZEN-WEEK-TERMINAL-REFRESH, which kept a frozen week's historical
  // new/active counts but refreshed approved/reviewed/resolved from today's
  // status — so one clash could sit in two columns of the same row.
  const FROZEN_CLASH = (over) => Object.assign({
    uid: 'CLX-401',
    name: 'CLX-401 — Frozen bucket',
    testName: 'FrozenTest',
    disciplineA: 'S', disciplineB: 'M',
    elementA: 'a', elementB: 'b',
    penetration: '10mm', priority: 'High',
    status: 'Active',
    // 15/06/26 is inside ISO Wk 25 2026.
    date: '15/06/26',
    x: 1, y: 2, z: 3,
    statusHistory: [{ week: 25, year: 2026, status: 'Active' }],
  }, over || {});
  const FROZEN_SNAP = (over) => Object.assign({
    week: 25, year: 2026, label: 'Wk 25 — 15 Jun 2026', date: '15 Jun 2026',
    new: 0, active: 1, reviewed: 0, approved: 0, resolved: 0,
    critical: 0, high: 1, medium: 0, low: 0,
    tests: [{ name: 'FrozenTest', new: 0, active: 1, reviewed: 0, approved: 0, resolved: 0, critical: 0, high: 1, medium: 0, low: 0, rate: 0 }],
    capturedAt: '2026-06-22T00:00:00.000Z',
  }, over || {});

  test('KI-008 — a clash Active in a frozen week and Approved today is counted once, at its end-of-week status', async ({ page }) => {
    await page.evaluate(([clash, snap]) => {
      S.clashes = [clash];
      S.weekly = [snap];
      sv('clashes', S.clashes);
      sv('weekly', S.weekly);
    }, [FROZEN_CLASH(), FROZEN_SNAP()]);

    // Approve today. The handler calls regenWeeklyFromRegister on status change.
    await page.evaluate(() => { _markClashesAsApproved(['CLX-401'], 'ClashRegister'); });

    const r = await page.evaluate(() => {
      const w = (S.weekly || []).find(x => x.week === 25 && x.year === 2026);
      const now = _weekYearNow();
      const t = w.tests && w.tests[0];
      return {
        capturedAt: w.capturedAt,
        counters: { new: w.new, active: w.active, reviewed: w.reviewed, approved: w.approved, resolved: w.resolved },
        sum: w.new + w.active + w.reviewed + w.approved + w.resolved,
        test: t && { active: t.active, approved: t.approved, rate: t.rate },
        // The cumulative projection the charts and exports use: approved shows in the current week.
        nowApproved: statusCountsAt(now.week, now.year, 'all', 'all').approved,
        clashStatus: S.clashes[0].status,
      };
    });
    expect(r.clashStatus).toBe('Approved');
    expect(r.capturedAt).toBe('2026-06-22T00:00:00.000Z');
    // Once, as Active — the status it held at the end of week 25.
    expect(r.counters).toEqual({ new: 0, active: 1, reviewed: 0, approved: 0, resolved: 0 });
    expect(r.sum).toBe(1);
    expect(r.test).toEqual({ active: 1, approved: 0, rate: 0 });
    // The approval is visible where it belongs: the current week's cumulative point.
    expect(r.nowApproved).toBe(1);
  });

  test('KI-008 — frozen snapshot counters are rebuilt from the register; capturedAt, imports, label and date survive', async ({ page }) => {
    const r = await page.evaluate(([clash, snap]) => {
      S.clashes = [clash];
      S.weekly = [snap];
      sv('clashes', S.clashes);
      sv('weekly', S.weekly);
      regenWeeklyFromRegister();
      const w = (S.weekly || []).find(x => x.week === 25 && x.year === 2026);
      return w;
    }, [
      FROZEN_CLASH({ uid: 'CLX-402', status: 'Reviewed', priority: 'Critical', statusHistory: [{ week: 25, year: 2026, status: 'Reviewed' }] }),
      FROZEN_SNAP({
        // Stale archived numbers that no longer match the register.
        new: 3, active: 5, reviewed: 2, approved: 0, resolved: 0, critical: 4, high: 2, medium: 1, low: 3,
        tests: [{ name: 'FrozenTest', new: 3, active: 5, reviewed: 2, approved: 0, resolved: 0, critical: 4, high: 2, medium: 1, low: 3, rate: 0 }],
        imports: [{ date: '15/06/26', count: 1, added: 1, updated: 0 }],
      }),
    ]);
    // Derived from the one clash in the bucket, at its end-of-week status.
    expect([r.new, r.active, r.reviewed, r.approved, r.resolved]).toEqual([0, 0, 1, 0, 0]);
    expect([r.critical, r.high, r.medium, r.low]).toEqual([1, 0, 0, 0]);
    expect(r.tests).toEqual([{ name: 'FrozenTest', new: 0, active: 0, reviewed: 1, resolved: 0, approved: 0, critical: 1, high: 0, medium: 0, low: 0, rate: 0 }]);
    // What "frozen" still preserves.
    expect(r.capturedAt).toBe('2026-06-22T00:00:00.000Z');
    expect(r.imports).toEqual([{ date: '15/06/26', count: 1, added: 1, updated: 0 }]);
    expect(r.label).toBe('Wk 25 — 15 Jun 2026');
    expect(r.date).toBe('15 Jun 2026');
  });

  test('KI-008 — an unfrozen past week projects too: approved later, still Active in its own week', async ({ page }) => {
    const r = await page.evaluate((clash) => {
      S.clashes = [clash];
      S.weekly = [];
      sv('clashes', S.clashes);
      sv('weekly', S.weekly);
      regenWeeklyFromRegister();
      return (S.weekly || []).find(x => x.week === 25 && x.year === 2026);
    }, FROZEN_CLASH({ status: 'Approved', statusHistory: [{ week: 25, year: 2026, status: 'Active' }, { week: 30, year: 2026, status: 'Approved' }] }));
    expect(r.capturedAt).toBeUndefined();
    expect([r.new, r.active, r.reviewed, r.approved, r.resolved]).toEqual([0, 1, 0, 0, 0]);
    expect(r.tests[0].approved).toBe(0);
    expect(r.tests[0].active).toBe(1);
  });

  test('KI-008 — history that starts after the detection week falls back to the first recorded status, then c.status', async ({ page }) => {
    const r = await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.weekly = [];
      sv('clashes', S.clashes);
      sv('weekly', S.weekly);
      regenWeeklyFromRegister();
      return (S.weekly || []).find(x => x.week === 25 && x.year === 2026);
    }, [
      // Imported in week 30 (history starts there), detected in week 25, approved in week 36.
      FROZEN_CLASH({ uid: 'CLX-403', status: 'Approved', statusHistory: [{ week: 30, year: 2026, status: 'Active' }, { week: 36, year: 2026, status: 'Approved' }] }),
      // Legacy clash with no history at all: counts at its current status.
      FROZEN_CLASH({ uid: 'CLX-404', status: 'Reviewed', statusHistory: [] }),
    ]);
    expect([r.new, r.active, r.reviewed, r.approved, r.resolved]).toEqual([0, 1, 1, 0, 0]);
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
