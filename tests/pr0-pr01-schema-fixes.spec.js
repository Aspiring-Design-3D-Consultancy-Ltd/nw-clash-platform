import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-0-SCHEMA-GUARD + PR-0-RESOLVE-STAMP contract:
   1. _appendStatusHistory rejects entries missing status/week/year.
   2. Marking a clash Resolved via the Review Queue handler stamps
      week + year on the audit entry (not just the primary status
      entry) — the 636 corrupt entries from the 17-Jul audit came
      from the audit push having no week/year.
   3. Marking a clash Still-Open stamps status + week + year on the
      audit entry (pre-fix it had none of those).
   4. The Approve handler continues to stamp correctly (it always did;
      the refactor is a no-op behaviourally). */
test.describe('PR-0 — Resolve stamp + schema guard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof _appendStatusHistory === 'function' && typeof _rqActionOnUids === 'function' && typeof _markClashesAsApproved === 'function');
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      _ROLE = 'admin';
    });
  });

  test('_appendStatusHistory rejects entries with missing week/year', async ({ page }) => {
    const rejected = await page.evaluate(() => {
      const captured = [];
      const orig = console.error;
      console.error = (...args) => { captured.push(args.join(' ')); };
      const c = { uid: 'CLX-T1', statusHistory: [] };
      _appendStatusHistory(c, { status: 'Test' });
      const afterMissing = c.statusHistory.length;
      _appendStatusHistory(c, { week: 29, year: 2026 });
      const afterMissingStatus = c.statusHistory.length;
      _appendStatusHistory(c, null);
      const afterNull = c.statusHistory.length;
      _appendStatusHistory(c, { status: 'Test', week: 29, year: 2026 });
      const afterValid = c.statusHistory.length;
      console.error = orig;
      return { afterMissing, afterMissingStatus, afterNull, afterValid, captured };
    });
    expect(rejected.afterMissing).toBe(0);
    expect(rejected.afterMissingStatus).toBe(0);
    expect(rejected.afterNull).toBe(0);
    expect(rejected.afterValid).toBe(1);
    expect(rejected.captured.join(' ')).toMatch(/missing week\/year/);
    expect(rejected.captured.join(' ')).toMatch(/missing\/invalid status/);
    expect(rejected.captured.join(' ')).toMatch(/non-object entry/);
  });

  test('Resolve handler stamps week + year on audit entry (fixes 636 audit)', async ({ page }) => {
    const snap = await page.evaluate(() => {
      S.clashes = [{
        uid: 'CLX-R1', status: 'Active', pendingReview: true,
        disappearedInBatch: 'bat-abc', disappearedAt: '2026-07-15',
        statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
      }];
      _rqActionOnUids(['CLX-R1'], 'resolved');
      const c = S.clashes[0];
      const last = c.statusHistory[c.statusHistory.length - 1];
      return {
        status: c.status,
        historyLen: c.statusHistory.length,
        lastHasWeek: typeof last.week === 'number',
        lastHasYear: typeof last.year === 'number',
        lastStatus: last.status,
        lastReviewedInBatch: last.reviewedInBatch,
      };
    });
    expect(snap.status).toBe('Resolved');
    // History has: original Active, primary Resolved stamp, audit entry.
    expect(snap.historyLen).toBe(3);
    // The 636-audit bug specifically: last entry was missing week/year.
    expect(snap.lastHasWeek).toBe(true);
    expect(snap.lastHasYear).toBe(true);
    expect(snap.lastStatus).toBe('Resolved');
    expect(snap.lastReviewedInBatch).toBe('bat-abc');
  });

  test('Still-Open handler stamps status + week + year on audit entry', async ({ page }) => {
    const snap = await page.evaluate(() => {
      S.clashes = [{
        uid: 'CLX-S1', status: 'Reviewed', pendingReview: true,
        statusHistory: [{ week: 27, year: 2026, status: 'Reviewed' }],
      }];
      _rqActionOnUids(['CLX-S1'], 'stillOpen');
      const c = S.clashes[0];
      const last = c.statusHistory[c.statusHistory.length - 1];
      return {
        reviewedStillOpen: c.reviewedStillOpen,
        historyLen: c.statusHistory.length,
        lastHasStatus: typeof last.status === 'string' && last.status.length > 0,
        lastHasWeek: typeof last.week === 'number',
        lastHasYear: typeof last.year === 'number',
        lastReviewedStillOpen: last.reviewedStillOpen,
      };
    });
    expect(snap.reviewedStillOpen).toBe(true);
    // History has: original Reviewed + Still-Open audit entry.
    expect(snap.historyLen).toBe(2);
    expect(snap.lastHasStatus).toBe(true);
    expect(snap.lastHasWeek).toBe(true);
    expect(snap.lastHasYear).toBe(true);
    expect(snap.lastReviewedStillOpen).toBe(true);
  });

  test('Approve handler still stamps week + year (no behavioural change)', async ({ page }) => {
    const snap = await page.evaluate(() => {
      S.clashes = [{
        uid: 'CLX-A1', status: 'Active', pendingReview: true,
        statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
      }];
      _markClashesAsApproved(['CLX-A1'], 'ClashRegister');
      const c = S.clashes[0];
      const last = c.statusHistory[c.statusHistory.length - 1];
      return {
        status: c.status,
        lastHasWeek: typeof last.week === 'number',
        lastHasYear: typeof last.year === 'number',
        lastStatus: last.status,
        lastApprovedAt: last.approvedAt,
      };
    });
    expect(snap.status).toBe('Approved');
    expect(snap.lastHasWeek).toBe(true);
    expect(snap.lastHasYear).toBe(true);
    expect(snap.lastStatus).toBe('Approved');
    expect(typeof snap.lastApprovedAt).toBe('string');
  });
});

/* PR-01-FIRST-SEEN contract:
   - New clash inserts populate firstSeenWeekTag + firstSeenWeekDate
     from the current import's weekTag/weekDate.
   - Existing clashes updated on subsequent imports do NOT touch
     firstSeenWeekTag/firstSeenWeekDate — the values must equal what
     the very first import stamped. weekTag/weekDate above them CAN
     change on re-import (existing last-seen semantics).
   XML fixtures use identical elementIds so PAIR-ID-MERGE matches on
   the second import — the "existing clash" case. */
const XML_WEEK_A = `<?xml version="1.0"?>
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
    </clashtest>
  </batchtest>
</exchange>`;

test.describe('PR-01 — firstSeenWeekTag / firstSeenWeekDate immutability', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof importToRegister === 'function');
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      _ROLE = 'admin';
      S.clashes = [];
      sv('clashes', []);
    });
  });

  test('new clash insert stamps firstSeenWeekTag = current import weekTag', async ({ page }) => {
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      // Simulate an import from week-260601 wrapper by stamping _bcfC entries
      // with weekTag/weekDate directly (parser normally derives these from
      // webkitRelativePath, which isn't available on textarea paste).
      document.getElementById('bxml').value = xml;
      bparse();
      _bcfC.forEach(c => { c.weekTag = 'week-260601'; c.weekDate = '2026-06-01'; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_WEEK_A);
    const state = await page.evaluate(() => {
      const c = (S.clashes || [])[0];
      return {
        count: (S.clashes || []).length,
        firstSeenWeekTag: c && c.firstSeenWeekTag,
        firstSeenWeekDate: c && c.firstSeenWeekDate,
        weekTag: c && c.weekTag,
        weekDate: c && c.weekDate,
      };
    });
    expect(state.count).toBe(1);
    expect(state.firstSeenWeekTag).toBe('week-260601');
    expect(state.firstSeenWeekDate).toBe('2026-06-01');
    expect(state.weekTag).toBe('week-260601');
    expect(state.weekDate).toBe('2026-06-01');
  });

  test('re-importing an existing clash under a later week preserves firstSeenWeekTag/Date', async ({ page }) => {
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    // Import 1: week-260601 — inserts a new clash.
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      _bcfC.forEach(c => { c.weekTag = 'week-260601'; c.weekDate = '2026-06-01'; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_WEEK_A);
    // Import 2: SAME clash (identical elementIds) under week-260608 — must
    // match the existing register clash via PAIR-ID-MERGE and update its
    // weekTag/weekDate but NOT touch firstSeenWeekTag/firstSeenWeekDate.
    // nav('bcf') again so #bxml is present after the first import may have
    // navigated elsewhere.
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      _bcfC.forEach(c => { c.weekTag = 'week-260608'; c.weekDate = '2026-06-08'; });
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_WEEK_A);
    const state = await page.evaluate(() => {
      const c = (S.clashes || [])[0];
      return {
        count: (S.clashes || []).length,
        firstSeenWeekTag: c && c.firstSeenWeekTag,
        firstSeenWeekDate: c && c.firstSeenWeekDate,
        weekTag: c && c.weekTag,
        weekDate: c && c.weekDate,
      };
    });
    // Still exactly one clash — merged into existing register entry.
    expect(state.count).toBe(1);
    // firstSeen fields must reflect the FIRST import (week 260601).
    expect(state.firstSeenWeekTag).toBe('week-260601');
    expect(state.firstSeenWeekDate).toBe('2026-06-01');
    // weekTag/weekDate reflect the LATEST import (week 260608) —
    // existing last-seen semantics preserved.
    expect(state.weekTag).toBe('week-260608');
    expect(state.weekDate).toBe('2026-06-08');
  });
});
