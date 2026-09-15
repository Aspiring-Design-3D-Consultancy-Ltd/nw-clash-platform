import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Seeds clashes directly in the shape DEC-020/PR-03-CLOCK2-STATUS-TRANSITIONS
// already produces on a Resolved->New/Active/Reviewed HOLD during import (see
// the HOLD branch in importToRegister's merge loop, working.html ~L11900).
// REAPPEARED-QUEUE reads that data — it does not create it — so seeding the
// resulting shape directly is the correct unit boundary for this spec; the
// import-time HOLD logic itself is covered by approve-terminal-and-audit.spec.js
// and its siblings.
function makeSeed() {
  const mk = (n, opts = {}) => ({
    uid: 'CLX-' + String(n).padStart(3, '0'),
    name: 'CLX-' + String(n).padStart(3, '0') + ' — Clash' + n,
    nwOrig: 'Clash' + n,
    testName: opts.testName || '[H] Reappeared Test A',
    disciplineA: 'Structural', disciplineB: 'MEP',
    elementA: 'Beam-' + n, elementB: 'Duct-' + n,
    penetration: '20mm',
    status: opts.status || 'Resolved',
    priority: 'High',
    assignedTo: '', notes: '',
    date: '01/07/26',
    x: 100 * n, y: 200 * n, z: 300 * n,
    nwImageRef: '',
    statusHistory: opts.statusHistory || [
      { week: 20, year: 2026, status: 'Active' },
      { week: 25, year: 2026, status: 'Resolved' },
    ],
    reappearances: opts.reappearances,
  });
  return [
    // CLX-001: open reappearance -> should be IN the queue.
    mk(1, {
      reappearances: [{
        weekTag: 'week-260901', weekDate: '2026-09-01',
        lastSeenWeekTag: 'week-260714', lastSeenWeekDate: '2026-07-14',
        batch: 'bat-1', at: '2026-09-01T09:00:00.000Z', open: true,
      }],
    }),
    // CLX-002: same test, also open -> IN the queue (group count = 2).
    mk(2, {
      reappearances: [{
        weekTag: 'week-260908', weekDate: '2026-09-08',
        lastSeenWeekTag: 'week-260721', lastSeenWeekDate: '2026-07-21',
        batch: 'bat-2', at: '2026-09-08T09:00:00.000Z', open: true,
      }],
    }),
    // CLX-003: reappearances exists but the entry is already closed
    // (previously actioned) -> must NOT appear in the live queue.
    mk(3, {
      testName: '[H] Reappeared Test B',
      reappearances: [{
        weekTag: 'week-260825', weekDate: '2026-08-25',
        lastSeenWeekTag: 'week-260707', lastSeenWeekDate: '2026-07-07',
        batch: 'bat-0', at: '2026-08-25T09:00:00.000Z', open: false,
        closedAt: '2026-08-26T09:00:00.000Z', resolution: 'keptResolved',
      }],
    }),
    // CLX-004: ordinary Active clash, no reappearances at all -> untouched
    // by queue generation, sanity control for the "filters correctly" test.
    Object.assign(mk(4, { status: 'Active' }), { reappearances: undefined }),
  ];
}

async function seed(page) {
  await page.evaluate((rows) => {
    S.clashes = rows;
    sv('clashes', S.clashes);
  }, makeSeed());
}

test.describe('REAPPEARED-QUEUE', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
    // INV-007: wait for the terminal inline one-shot migration gate so
    // window.onload's setTimeout-deferred migrations don't race and
    // silently overwrite this test's seeded state.
    await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
    });
  });

  test('data layer: _generateReappearedQueue filters to open reappearances only, sorted oldest reappearance first', async ({ page }) => {
    await seed(page);
    const queue = await page.evaluate(() => _generateReappearedQueue().map(c => c.uid));
    expect(queue).toEqual(['CLX-001', 'CLX-002']);

    const weeksSince = await page.evaluate(() => _weeksSinceReappearance('week-260901'));
    expect(typeof weeksSince).toBe('number');
    expect(weeksSince).toBeGreaterThanOrEqual(0);

    expect(await page.evaluate(() => _weeksSinceReappearance(null))).toBeNull();
    expect(await page.evaluate(() => _weeksSinceReappearance('not-a-week-tag'))).toBeNull();
  });

  test('nav + badge: Reappeared Queue tab renders both open cards grouped by test, badge shows 2', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => nav('reappeared'));
    await expect(page.locator('#na-reappeared-badge')).toHaveText('2');
    await expect(page.locator('[data-rpq-group="[H] Reappeared Test A"]')).toBeVisible();
    await expect(page.locator('[data-rpq-group="[H] Reappeared Test A"]')).toContainText('2 held');
    // CLX-003's entry is closed and CLX-004 has no reappearances — neither
    // test group for them should render.
    await expect(page.locator('[data-rpq-group="[H] Reappeared Test B"]')).toHaveCount(0);
  });

  test('empty state renders when no clash has an open reappearance', async ({ page }) => {
    await page.evaluate(() => {
      S.clashes = [{ uid: 'CLX-900', testName: 'Empty Test', status: 'Active', statusHistory: [] }];
      sv('clashes', S.clashes);
      nav('reappeared');
    });
    await expect(page.locator('#na-reappeared-badge')).toBeHidden();
    await expect(page.getByText('Reappeared Queue is empty')).toBeVisible();
  });

  test('_queueReopen: flips status to Active, appends an audited history entry, closes the reappearance entry', async ({ page }) => {
    await seed(page);
    const result = await page.evaluate(() => _queueReopen('CLX-001'));
    expect(result).toBe(1);

    const after = await page.evaluate(() => {
      const c = (S.clashes || []).find(x => x.uid === 'CLX-001');
      return {
        status: c.status,
        entryOpen: c.reappearances[0].open,
        resolution: c.reappearances[0].resolution,
        hasAuditEntry: (c.statusHistory || []).some(h =>
          h.status === 'Active' && h.reopenedAt && h.source === 'ReappearedQueue'
        ),
        hasWeeklySnapshotEntry: (c.statusHistory || []).some(h =>
          h.status === 'Active' && typeof h.week === 'number' && typeof h.year === 'number' && !h.source
        ),
      };
    });
    expect(after.status).toBe('Active');
    expect(after.entryOpen).toBe(false);
    expect(after.resolution).toBe('reopened');
    expect(after.hasAuditEntry).toBe(true);
    expect(after.hasWeeklySnapshotEntry).toBe(true);
  });

  test('_queueKeepResolved: status stays Resolved, no status-history status flip, closes the reappearance entry', async ({ page }) => {
    await seed(page);
    const before = await page.evaluate(() =>
      (S.clashes || []).find(x => x.uid === 'CLX-002').statusHistory.length
    );
    const result = await page.evaluate(() => _queueKeepResolved('CLX-002'));
    expect(result).toBe(1);

    const after = await page.evaluate(() => {
      const c = (S.clashes || []).find(x => x.uid === 'CLX-002');
      return {
        status: c.status,
        entryOpen: c.reappearances[0].open,
        resolution: c.reappearances[0].resolution,
        historyLen: c.statusHistory.length,
        lastEntry: c.statusHistory[c.statusHistory.length - 1],
      };
    });
    expect(after.status).toBe('Resolved');
    expect(after.entryOpen).toBe(false);
    expect(after.resolution).toBe('keptResolved');
    // Exactly one audit-only entry appended — no pushStatusHistory snapshot
    // since the status didn't change.
    expect(after.historyLen).toBe(before + 1);
    expect(after.lastEntry.status).toBe('Resolved');
    expect(after.lastEntry.source).toBe('ReappearedQueue');
    expect(after.lastEntry.keptResolvedAt).toBeTruthy();
  });

  test('handlers are no-ops for an unknown uid or a clash with no open reappearance', async ({ page }) => {
    await seed(page);
    expect(await page.evaluate(() => _queueReopen('CLX-999'))).toBe(0);
    expect(await page.evaluate(() => _queueKeepResolved('CLX-999'))).toBe(0);
    // CLX-003's entry is already closed.
    expect(await page.evaluate(() => _queueReopen('CLX-003'))).toBe(0);
    expect(await page.evaluate(() => _queueKeepResolved('CLX-003'))).toBe(0);
    // CLX-004 has no reappearances array at all.
    expect(await page.evaluate(() => _queueReopen('CLX-004'))).toBe(0);
  });

  test('UI wrappers: Reopen removes the card and decrements the badge; count updates live', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => nav('reappeared'));
    await expect(page.locator('#na-reappeared-badge')).toHaveText('2');

    await page.evaluate(() => reappearedQueueReopen('CLX-001'));
    await page.waitForFunction(() =>
      (S.clashes || []).find(c => c.uid === 'CLX-001').status === 'Active'
    );
    await expect(page.locator('#na-reappeared-badge')).toHaveText('1');
    const queueAfter = await page.evaluate(() => _generateReappearedQueue().map(c => c.uid));
    expect(queueAfter).toEqual(['CLX-002']);
  });

  test('UI wrappers: Keep Resolved removes the card and decrements the badge; last card hides the tab badge', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => nav('reappeared'));

    await page.evaluate(() => reappearedQueueKeepResolved('CLX-001'));
    await expect(page.locator('#na-reappeared-badge')).toHaveText('1');

    await page.evaluate(() => reappearedQueueKeepResolved('CLX-002'));
    await expect(page.locator('#na-reappeared-badge')).toBeHidden();
    const queueAfter = await page.evaluate(() => _generateReappearedQueue());
    expect(queueAfter).toEqual([]);
    await expect(page.getByText('Reappeared Queue is empty')).toBeVisible();
  });
});
