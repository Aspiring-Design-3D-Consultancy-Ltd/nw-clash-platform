import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Seed pendingReview clashes pre-tagged with a _bucket so
// reviewQueueBulkApplyDelta's per-bucket filter picks them up without
// needing a full XML re-import to trigger REVIEW-QUEUE-DETECT + the
// delta-analysis classifier. This isolates the test to the approval
// source-tagging path itself (the defect under test — B3 bulk-apply must
// stamp source: 'ReviewQueueBulkDelta', not 'ClashRegister'), not the
// bucket classification logic (already covered elsewhere).
function makeSeed(bucketByN) {
  const wy = { week: 27, year: 2026 };
  const mk = (n) => ({
    uid: 'CLX-' + String(n).padStart(3, '0'),
    name: 'CLX-' + String(n).padStart(3, '0') + ' — Clash' + n,
    testName: '[H] RQ Bulk Delta Test A',
    disciplineA: 'Structural', disciplineB: 'MEP',
    elementA: 'Beam-' + n, elementB: 'Duct-' + n,
    penetration: '20mm',
    status: 'Active', priority: 'High',
    assignedTo: '', notes: '',
    date: '01/07/26',
    x: 10 * n, y: 20 * n, z: 30 * n,
    pendingReview: true,
    disappearedAt: '2026-07-14',
    disappearedInBatch: 'bat-rq-bulk-delta-test',
    _bucket: bucketByN[n],
    statusHistory: [{ week: wy.week, year: wy.year, status: 'Active' }],
  });
  return Object.keys(bucketByN).map(n => mk(Number(n)));
}

async function seedRegister(page, bucketByN) {
  await page.evaluate((seed) => {
    S.clashes = seed.slice();
    const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
    _uid = mx;
    sv('clashes', S.clashes);
  }, makeSeed(bucketByN));
}



test.describe('REVIEW-QUEUE-BULK-DELTA — approve source tagging', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      _ROLE = 'admin';
    });
    // REVIEW-QUEUE-BULK-DELTA-TEST-RACE-FIX: window.onload schedules
    // several one-shot background timers (backfillStatusHistory,
    // _rqdaMigrateSeedPatternsV2, _rqdaMigrate at ~1500-1600ms) that
    // read/write S.clashes. If any of them fire mid-test (after this
    // suite's seedRegister() call, before assertions), they can mutate
    // the seeded clashes out from under the test. Wait out the full
    // 1600ms window here, before any per-test seeding happens, so
    // those timers are done firing and seedRegister()'s writes are the
    // last word.
    await page.waitForTimeout(1700);
  });


  test('B3 bulk-apply via reviewQueueBulkApplyDelta stamps source: "ReviewQueueBulkDelta", not "ClashRegister"', async ({ page }) => {
    // All 5 clashes are B3 (Designed Condition) — the bucket that routes
    // through the shared type-APPROVE modal via _crApproveOpen(uids, null,
    // 'ReviewQueueBulkDelta').
    await seedRegister(page, { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 });

    await page.evaluate(() => { reviewQueueBulkApplyDelta('[H] RQ Bulk Delta Test A', 3); });
    await expect(page.locator('#cr-approve-modal')).toBeVisible();
    await expect(page.locator('#cr-approve-title')).toHaveText('Approve 5 clashes');

    // Scope the post-confirm wait/assertions to the seeded UIDs only.
    // S.clashes may also contain the built-in demo dataset (loaded before
    // this test's S.clashes = seed.slice() assignment ran) — an unscoped
    // .every()/.length check across the whole array can never resolve
    // since demo clashes are never touched by this action, causing a
    // 30s timeout unrelated to the source-tagging behaviour under test.
    const seededUids1 = ['CLX-001', 'CLX-002', 'CLX-003', 'CLX-004', 'CLX-005'];
    await page.fill('#cr-approve-input', 'APPROVE');
    await page.click('#cr-approve-confirm-btn');
    await page.waitForFunction((uids) =>
      (S.clashes || []).filter(c => uids.includes(c.uid)).every(c => c.status === 'Approved'),
      seededUids1
    );

    const result = await page.evaluate((uids) => {
      return (S.clashes || [])
        .filter(c => uids.includes(c.uid))
        .map(c => {
          const last = (c.statusHistory || []).slice().reverse().find(h => h.approvedAt);
          return { uid: c.uid, status: c.status, source: last && last.source, pendingReview: c.pendingReview };
        });
    }, seededUids1);

    expect(result.every(r => r.status === 'Approved')).toBe(true);
    expect(result.every(r => r.source === 'ReviewQueueBulkDelta')).toBe(true);
    expect(result.every(r => r.pendingReview === undefined)).toBe(true);
  });

  test('bucket isolation: B3 bulk-apply only touches B3 clashes; B1/B2 in the same test are untouched', async ({ page }) => {
    // Mixed buckets within one testName: CLX-001/002 = B1, CLX-003/004 = B2,
    // CLX-005/006/007 = B3. Bulk-applying bucket 3 must not affect B1/B2 at
    // all, and must not mis-tag them with the ReviewQueueBulkDelta source.
    await seedRegister(page, { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3 });

    await page.evaluate(() => { reviewQueueBulkApplyDelta('[H] RQ Bulk Delta Test A', 3); });
    await expect(page.locator('#cr-approve-modal')).toBeVisible();
    await expect(page.locator('#cr-approve-title')).toHaveText('Approve 3 clashes');

    // Scope to seeded UIDs only — see the comment in the first test for why
    // an unscoped check against S.clashes can hang against demo-data noise.
    const seededUids2 = ['CLX-001', 'CLX-002', 'CLX-003', 'CLX-004', 'CLX-005', 'CLX-006', 'CLX-007'];
    await page.fill('#cr-approve-input', 'APPROVE');
    await page.click('#cr-approve-confirm-btn');
    await page.waitForFunction((uids) =>
      (S.clashes || []).filter(c => uids.includes(c.uid) && c.status === 'Approved').length === 3,
      seededUids2
    );

    const state = await page.evaluate((uids) => {
      const seeded = (S.clashes || []).filter(c => uids.includes(c.uid));
      const approved = seeded
        .filter(c => c.status === 'Approved')
        .map(c => {
          const last = (c.statusHistory || []).slice().reverse().find(h => h.approvedAt);
          return { uid: c.uid, source: last && last.source };
        })
        .sort((a, b) => a.uid.localeCompare(b.uid));
      const untouched = seeded
        .filter(c => c.status !== 'Approved')
        .map(c => ({ uid: c.uid, status: c.status, pendingReview: c.pendingReview }))
        .sort((a, b) => a.uid.localeCompare(b.uid));
      return { approved, untouched };
    }, seededUids2);


    expect(state.approved.map(a => a.uid)).toEqual(['CLX-005', 'CLX-006', 'CLX-007']);
    expect(state.approved.every(a => a.source === 'ReviewQueueBulkDelta')).toBe(true);
    // B1/B2 clashes remain Active and still pendingReview — bulk-apply(3)
    // must not touch them at all.
    expect(state.untouched).toEqual([
      { uid: 'CLX-001', status: 'Active', pendingReview: true },
      { uid: 'CLX-002', status: 'Active', pendingReview: true },
      { uid: 'CLX-003', status: 'Active', pendingReview: true },
      { uid: 'CLX-004', status: 'Active', pendingReview: true },
    ]);
  });
});
