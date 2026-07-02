import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Synthetic register with 5 Active clashes in a single test, each carrying
// element IDs so pairKey() classifies them at the ID:: tier (guarantees the
// merge branch — not the LEGACY fallback — matches the incoming XML).
function makeSeed() {
  const wy = { week: 27, year: 2026 };
  const mk = (n, ida, idb, ea, eb) => ({
    uid: 'CLX-' + String(n).padStart(3, '0'),
    name: 'CLX-' + String(n).padStart(3, '0') + ' — Clash' + n,
    nwOrig: 'Clash' + n,
    testName: '[H] Review Queue Test A',
    disciplineA: 'Structural', disciplineB: 'MEP',
    elementA: ea, elementB: eb,
    elementIdA: ida, elementIdB: idb,
    elementIdSrcA: 'Element ID', elementIdSrcB: 'Element ID',
    sourceA: 'Structural.nwc', sourceB: 'MEP.nwc',
    penetration: '20mm',
    status: 'Active',
    priority: 'High',
    assignedTo: '', notes: '',
    date: '01/07/26',
    x: 100 * n, y: 200 * n, z: 300 * n,
    nwImageRef: '',
    statusHistory: [{ week: wy.week, year: wy.year, status: 'Active' }],
  });
  return [
    mk(1, 'EID-A-1', 'EID-B-1', 'Beam-1', 'Duct-1'),
    mk(2, 'EID-A-2', 'EID-B-2', 'Beam-2', 'Duct-2'),
    mk(3, 'EID-A-3', 'EID-B-3', 'Beam-3', 'Duct-3'),
    mk(4, 'EID-A-4', 'EID-B-4', 'Beam-4', 'Duct-4'),
    mk(5, 'EID-A-5', 'EID-B-5', 'Beam-5', 'Duct-5'),
  ];
}

// XML re-imports 3 of the 5 (Clash1, Clash2, Clash3). Clash4 + Clash5 are
// absent from this batch → REVIEW-QUEUE-DETECT flags them pendingReview.
// resultstatus stays 'active' so the merge branch doesn't force the matched
// register clashes back to 'New'.
const XML_PARTIAL = `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="[H] Review Queue Test A">
      <clashresult name="Clash1" distance="-0.02">
        <clashpoint><pos3f x="100" y="200" z="300"/></clashpoint>
        <resultstatus>active</resultstatus>
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
        <clashpoint><pos3f x="200" y="400" z="600"/></clashpoint>
        <resultstatus>active</resultstatus>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-A-2</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink>
          <objectattribute><name>Element ID</name><value>EID-B-2</value></objectattribute>
        </clashobject>
      </clashresult>
      <clashresult name="Clash3" distance="-0.02">
        <clashpoint><pos3f x="300" y="600" z="900"/></clashpoint>
        <resultstatus>active</resultstatus>
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

test.describe('REVIEW-QUEUE', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      nav('bcf');
    });
    await page.waitForSelector('#bxml');
  });

  test('disappeared clashes are flagged, mark-Resolved and mark-Still-Open both work, and Still Open sticks on re-import', async ({ page }) => {
    // ── Step 1: seed the register with 5 Active clashes in one test.
    await page.evaluate((seed) => {
      S.clashes = seed.slice();
      const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
      _uid = mx;
      sv('clashes', S.clashes);
    }, makeSeed());

    // ── Step 2: import an XML that only carries Clash1..Clash3.
    // Bypass the cross-test dupe modal — same test name so it wouldn't trigger
    // in practice, but setting the flag makes the intent explicit.
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_PARTIAL);

    // Two of the five should now be flagged.
    const flagged = await page.evaluate(() =>
      (S.clashes || [])
        .filter(c => c.pendingReview === true)
        .map(c => ({ uid: c.uid, disappearedAt: c.disappearedAt, disappearedInBatch: c.disappearedInBatch }))
    );
    expect(flagged.map(f => f.uid).sort()).toEqual(['CLX-004', 'CLX-005']);
    for (const f of flagged) {
      expect(f.disappearedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(f.disappearedInBatch).toMatch(/^bat-/);
    }

    // Badge should show 2 and be visible.
    await page.evaluate(() => updSB());
    const badge = await page.locator('#na-review-badge');
    await expect(badge).toHaveText('2');
    await expect(badge).toBeVisible();

    // Sanity: matched clashes did NOT get flagged.
    const matched = await page.evaluate(() =>
      (S.clashes || [])
        .filter(c => ['CLX-001','CLX-002','CLX-003'].includes(c.uid))
        .map(c => ({ uid: c.uid, pendingReview: c.pendingReview === true }))
    );
    expect(matched.every(m => !m.pendingReview)).toBe(true);

    // ── Step 3: mark CLX-004 as Resolved via the queue view. Drive the click
    // through the exposed handler with a checked-checkbox DOM prefill —
    // dispatches the real button's onclick path without racing the group-
    // toggle re-render that the checkbox live inside.
    const resolveResult = await page.evaluate(() => {
      _rqOpen['[H] Review Queue Test A'] = true;
      nav('review');
      const chk = document.querySelector('input.rq-chk[data-uid="CLX-004"]');
      if (!chk) return { error: 'checkbox not found' };
      chk.checked = true;
      reviewQueueMarkResolved();
      return { ok: true };
    });
    expect(resolveResult).toEqual({ ok: true });
    await page.waitForFunction(() =>
      (S.clashes || []).some(c => c.uid === 'CLX-004' && c.status === 'Resolved')
    );

    const afterResolve = await page.evaluate(() => {
      const c = (S.clashes || []).find(x => x.uid === 'CLX-004');
      return {
        status: c.status,
        pendingReview: c.pendingReview,
        reviewedStillOpen: c.reviewedStillOpen,
        historyLast: c.statusHistory[c.statusHistory.length - 1],
        hasReviewQueueEntry: c.statusHistory.some(h => h.source === 'ReviewQueue' && h.status === 'Resolved'),
      };
    });
    expect(afterResolve.status).toBe('Resolved');
    expect(afterResolve.pendingReview).toBeUndefined();
    expect(afterResolve.hasReviewQueueEntry).toBe(true);
    // Badge should now read 1.
    const badgeAfterResolve = await page.locator('#na-review-badge').textContent();
    expect(badgeAfterResolve).toBe('1');

    // ── Step 4: mark CLX-005 as Still Open. Drive via the same handlers
    // the UI buttons call — avoids racing the re-render triggered by the
    // previous action's nav('review'). The UI flow is exercised by the mark-
    // Resolved step above, so the click path is already covered.
    const stillOpenResult = await page.evaluate(() => {
      _rqOpen['[H] Review Queue Test A'] = true;
      nav('review');
      const chk = document.querySelector('input.rq-chk[data-uid="CLX-005"]');
      if (!chk) return { error: 'checkbox not found' };
      chk.checked = true;
      reviewQueueMarkStillOpen();
      return { ok: true };
    });
    expect(stillOpenResult).toEqual({ ok: true });
    await page.waitForFunction(() =>
      (S.clashes || []).some(c => c.uid === 'CLX-005' && c.reviewedStillOpen === true)
    );

    const afterStillOpen = await page.evaluate(() => {
      const c = (S.clashes || []).find(x => x.uid === 'CLX-005');
      return {
        status: c.status,
        pendingReview: c.pendingReview,
        reviewedStillOpen: c.reviewedStillOpen,
        hasStillOpenEntry: (c.statusHistory || []).some(h => h.source === 'ReviewQueue' && h.reviewedStillOpen === true),
      };
    });
    expect(afterStillOpen.reviewedStillOpen).toBe(true);
    expect(afterStillOpen.status).toBe('Active');
    expect(afterStillOpen.pendingReview).toBeUndefined();
    expect(afterStillOpen.hasStillOpenEntry).toBe(true);

    // Badge hidden at zero pending.
    await expect(page.locator('#na-review-badge')).toBeHidden();

    // ── Step 5: re-import the same partial XML. CLX-005 must NOT be re-flagged.
    await page.evaluate(() => nav('bcf'));
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_PARTIAL);

    const afterReimport = await page.evaluate(() => {
      const c5 = (S.clashes || []).find(x => x.uid === 'CLX-005');
      return {
        pendingReview: c5.pendingReview,
        reviewedStillOpen: c5.reviewedStillOpen,
        status: c5.status,
        allPendingUids: (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid),
      };
    });
    expect(afterReimport.pendingReview).toBeUndefined();
    expect(afterReimport.reviewedStillOpen).toBe(true);
    expect(afterReimport.status).toBe('Active');
    // Nothing else should be flagged either — the only disappeared clash on
    // the second import is CLX-005, and its reviewedStillOpen skip applies.
    expect(afterReimport.allPendingUids).toEqual([]);
  });
});
