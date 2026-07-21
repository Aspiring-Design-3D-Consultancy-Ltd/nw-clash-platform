import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A contract:
   1. _platformWeeks() returns sorted ISO tuples for every week where a
      clash's firstSeenWeekDate lands (union with action-clock
      statusHistory weeks).
   2. scopedWds always reconstructs — the scope='all'/bldGroup='all'
      shortcut is gone. A phantom week (no clashes existing at that
      time) reconstructs to zero.
   3. getDisplayWds filters S.weekly to platform weeks only.
      Post-PR-A the phantom pre-platform buckets that
      regenWeeklyFromRegister still produces from c.date are hidden
      from the chart. */

test.describe('PR-A — chart snapshot reconstruction (Layer 1 + Layer 2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof _platformWeeks === 'function' && typeof scopedWds === 'function' && typeof getDisplayWds === 'function');
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

  test('_platformWeeks derives sorted ISO tuples from firstSeenWeekDate distribution', async ({ page }) => {
    const out = await page.evaluate(() => {
      S.clashes = [
        { uid: 'C1', firstSeenWeekDate: '2026-06-01', statusHistory: [{ week: 23, year: 2026, status: 'New' }] },  // W23
        { uid: 'C2', firstSeenWeekDate: '2026-06-08', statusHistory: [{ week: 24, year: 2026, status: 'New' }] },  // W24
        { uid: 'C3', firstSeenWeekDate: '2026-06-08', statusHistory: [{ week: 24, year: 2026, status: 'New' }] },  // W24 (dupe)
        { uid: 'C4', firstSeenWeekDate: '2026-07-13', statusHistory: [{ week: 29, year: 2026, status: 'New' }] },  // W29
      ];
      return _platformWeeks();
    });
    // Deduped + sorted.
    expect(out).toEqual([
      { year: 2026, week: 23 },
      { year: 2026, week: 24 },
      { year: 2026, week: 29 },
    ]);
  });

  test('_platformWeeks includes weeks with only action-clock statusHistory entries', async ({ page }) => {
    // Coordinator Approve/Resolve in a week with no XML import — a rare
    // real scenario. That week must still surface as platform-tracked so
    // the transition is visible on the chart.
    const out = await page.evaluate(() => {
      S.clashes = [{
        uid: 'C1',
        firstSeenWeekDate: '2026-06-01',
        statusHistory: [
          { week: 23, year: 2026, status: 'New' },
          { week: 30, year: 2026, status: 'Approved', approvedAt: '2026-07-20' },  // action-clock only
        ],
      }];
      return _platformWeeks();
    });
    expect(out).toEqual([
      { year: 2026, week: 23 },
      { year: 2026, week: 30 },
    ]);
  });

  test('scopedWds always reconstructs — phantom W41/2025 rebuilds to zero even at scope=all', async ({ page }) => {
    // Fixture: register has one clash first seen W23/2026. S.weekly
    // pre-fix would include a W41/2025 bucket (regenWeeklyFromRegister
    // buckets by c.date) with populated counts. scopedWds must now
    // reconstruct all those counts to zero regardless of scope.
    const out = await page.evaluate(() => {
      S.clashes = [{
        uid: 'C1',
        firstSeenWeekDate: '2026-06-01',
        status: 'Active',
        priority: 'Critical',
        statusHistory: [{ week: 23, year: 2026, status: 'New' }],
      }];
      const testWds = [
        { week: 41, year: 2025, new: 99, active: 99, reviewed: 99, approved: 99, resolved: 99, critical: 99, high: 99, medium: 99, low: 99, total: 99, label: 'Phantom' },
        { week: 23, year: 2026, new: 1, active: 0, reviewed: 0, approved: 0, resolved: 0, critical: 1, high: 0, medium: 0, low: 0, total: 1, label: 'W23' },
      ];
      const scoped = scopedWds(testWds, 'all', 'all');
      return { phantom: scoped[0], real: scoped[1] };
    });
    // Phantom W41/2025 reconstructed — clash didn't exist yet, so all zero.
    expect(out.phantom.new).toBe(0);
    expect(out.phantom.active).toBe(0);
    expect(out.phantom.reviewed).toBe(0);
    expect(out.phantom.approved).toBe(0);
    expect(out.phantom.resolved).toBe(0);
    expect(out.phantom.critical).toBe(0);
    expect(out.phantom.total).toBe(0);
    // Non-count fields preserved by Object.assign.
    expect(out.phantom.label).toBe('Phantom');
    // W23/2026 — clash existed and was New, so it should show up in the New bucket.
    expect(out.real.new).toBe(1);
    expect(out.real.total).toBe(1);
    expect(out.real.critical).toBe(1);
  });

  test('getDisplayWds filters S.weekly down to platform weeks after resetChartRange', async ({ page }) => {
    // Seed S.clashes with only W23 platform data, but stuff S.weekly
    // with a phantom pre-platform bucket + the real W23. getDisplayWds
    // must return only the W23 entry.
    const disp = await page.evaluate(() => {
      S.clashes = [{
        uid: 'C1',
        firstSeenWeekDate: '2026-06-01',
        status: 'Active',
        statusHistory: [{ week: 23, year: 2026, status: 'New' }],
      }];
      S.weekly = [
        { week: 41, year: 2025, new: 99, active: 99, reviewed: 0, approved: 0, resolved: 0, tests: [], label: 'Wk 41/25' },
        { week: 23, year: 2026, new: 1, active: 0, reviewed: 0, approved: 0, resolved: 0, tests: [], label: 'Wk 23/26' },
      ];
      resetChartRange();
      return getDisplayWds();
    });
    expect(disp.length).toBe(1);
    expect(disp[0].week).toBe(23);
    expect(disp[0].year).toBe(2026);
  });

  test('resetChartRange bounds to platform weeks (not S.weekly bounds)', async ({ page }) => {
    const out = await page.evaluate(() => {
      S.clashes = [
        { uid: 'C1', firstSeenWeekDate: '2026-06-01', statusHistory: [{ week: 23, year: 2026, status: 'New' }] },
        { uid: 'C2', firstSeenWeekDate: '2026-07-13', statusHistory: [{ week: 29, year: 2026, status: 'New' }] },
      ];
      S.weekly = [
        { week: 41, year: 2025, tests: [], label: 'Phantom W41/25' },
        { week: 23, year: 2026, tests: [], label: 'W23' },
        { week: 29, year: 2026, tests: [], label: 'W29' },
      ];
      resetChartRange();
      return { from: _chartFrom, to: _chartTo };
    });
    // Bounds derived from _platformWeeks: W23/2026 to W29/2026 (encoded as year*100+week).
    expect(out.from).toBe(2026 * 100 + 23);
    expect(out.to).toBe(2026 * 100 + 29);
  });

  test('empty register — _platformWeeks returns [] and getDisplayWds falls back to slider-only filter', async ({ page }) => {
    // Fresh install case. S.clashes is empty, S.weekly may or may not
    // hold demo data. getDisplayWds must not crash and should return
    // whatever the slider allows.
    const out = await page.evaluate(() => {
      S.clashes = [];
      S.weekly = [
        { week: 1, year: 2026, tests: [], label: 'W1' },
        { week: 2, year: 2026, tests: [], label: 'W2' },
      ];
      _chartFrom = 0;
      _chartTo = 999999;
      return { platform: _platformWeeks().length, disp: getDisplayWds().length };
    });
    expect(out.platform).toBe(0);
    // Fallback: platformSet.size===0 disables the platform filter, so
    // all wds within slider range pass through.
    expect(out.disp).toBe(2);
  });
});
