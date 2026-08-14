import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Five Active clashes in one testName, each carrying element IDs so
// pairKey() classifies at the ID:: tier (guarantees the merge branch
// matches on re-import). Same shape as review-queue.spec.js.
function makeSeed() {
  const wy = { week: 27, year: 2026 };
  const mk = (n, ida, idb, ea, eb) => ({
    uid: 'CLX-' + String(n).padStart(3, '0'),
    name: 'CLX-' + String(n).padStart(3, '0') + ' — Clash' + n,
    nwOrig: 'Clash' + n,
    testName: '[H] Approve Action Test A',
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

// XML re-imports 3 of the 5 (Clash1..Clash3). Clash4 + Clash5 disappear
// → REVIEW-QUEUE-DETECT flags them pendingReview.
const XML_PARTIAL = `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="[H] Approve Action Test A">
      <clashresult name="Clash1" distance="-0.02">
        <clashpoint><pos3f x="100" y="200" z="300"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="7" day="15" hour="10" minute="0" second="0"/></createddate>
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
        <createddate><date year="2026" month="7" day="15" hour="10" minute="0" second="0"/></createddate>
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
        <createddate><date year="2026" month="7" day="15" hour="10" minute="0" second="0"/></createddate>
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

async function seedAndImport(page) {
  await page.evaluate((seed) => {
    S.clashes = seed.slice();
    const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
    _uid = mx;
    sv('clashes', S.clashes);
    nav('bcf');
  }, makeSeed());
  await page.waitForSelector('#bxml');
  await page.evaluate((xml) => {
    document.getElementById('bxml').value = xml;
    bparse();
    window._skipCrossTestDupes = true;
    importToRegister('append');
  }, XML_PARTIAL);
  // Sanity: CLX-004 + CLX-005 are now pendingReview.
  const flagged = await page.evaluate(() =>
    (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid).sort()
  );
  expect(flagged).toEqual(['CLX-004', 'CLX-005']);
}

test.describe('APPROVE-ACTION — Review Queue only', () => {
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
    });
  });

  test('handler is exposed on window and both Review Queue Approve buttons are visible', async ({ page }) => {
    const handlerType = await page.evaluate(() => typeof window._markClashesAsApproved);
    expect(handlerType).toBe('function');
    const markGroupType = await page.evaluate(() => typeof window.reviewQueueMarkApproved);
    expect(markGroupType).toBe('function');
    const approveGroupType = await page.evaluate(() => typeof window.reviewQueueApproveGroup);
    expect(approveGroupType).toBe('function');

    await seedAndImport(page);
    await page.evaluate(() => {
      _rqOpen['[H] Approve Action Test A'] = true;
      nav('review');
    });
    await expect(page.locator('button', { hasText: 'Mark selected as Approved' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Approve all in this test' })).toBeVisible();
  });

  test('bottom-bar Mark selected as Approved: flips status, writes audit entry, clears queue flags, badge decrements', async ({ page }) => {
    await seedAndImport(page);

    const result = await page.evaluate(() => {
      _rqOpen['[H] Approve Action Test A'] = true;
      nav('review');
      const chk = document.querySelector('input.rq-chk[data-uid="CLX-004"]');
      if (!chk) return { error: 'checkbox not found' };
      chk.checked = true;
      reviewQueueMarkApproved();
      return { ok: true };
    });
    expect(result).toEqual({ ok: true });
    await page.waitForFunction(() =>
      (S.clashes || []).some(c => c.uid === 'CLX-004' && c.status === 'Approved')
    );

    const after = await page.evaluate(() => {
      const c = (S.clashes || []).find(x => x.uid === 'CLX-004');
      return {
        status: c.status,
        pendingReview: c.pendingReview,
        disappearedAt: c.disappearedAt,
        disappearedInBatch: c.disappearedInBatch,
        // Audit entry with approvedAt + actor + ReviewQueue source
        hasApproveEntry: (c.statusHistory || []).some(h =>
          h.status === 'Approved' && h.approvedAt && h.actor && h.source === 'ReviewQueue'
        ),
        // Weekly status snapshot entry from pushStatusHistory
        hasWeeklyEntry: (c.statusHistory || []).some(h =>
          h.status === 'Approved' && typeof h.week === 'number' && typeof h.year === 'number' && !h.source
        ),
      };
    });
    expect(after.status).toBe('Approved');
    expect(after.pendingReview).toBeUndefined();
    expect(after.disappearedAt).toBeUndefined();
    expect(after.disappearedInBatch).toBeUndefined();
    expect(after.hasApproveEntry).toBe(true);
    expect(after.hasWeeklyEntry).toBe(true);

    await expect(page.locator('#na-review-badge')).toHaveText('1');
  });

  test('per-test bulk Approve all in this test: approves every pendingReview in the group and empties the queue', async ({ page }) => {
    await seedAndImport(page);

    const result = await page.evaluate(() => {
      _rqOpen['[H] Approve Action Test A'] = true;
      nav('review');
      reviewQueueApproveGroup('[H] Approve Action Test A');
      return { ok: true };
    });
    expect(result).toEqual({ ok: true });
    await page.waitForFunction(() =>
      (S.clashes || []).filter(c => c.status === 'Approved').length === 2
    );

    const state = await page.evaluate(() => {
      const approved = (S.clashes || []).filter(c => c.status === 'Approved').map(c => c.uid).sort();
      const stillPending = (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid);
      const others = (S.clashes || []).filter(c => !['CLX-004', 'CLX-005'].includes(c.uid));
      return {
        approved,
        stillPending,
        othersAllActive: others.every(c => c.status === 'Active'),
      };
    });
    expect(state.approved).toEqual(['CLX-004', 'CLX-005']);
    expect(state.stillPending).toEqual([]);
    expect(state.othersAllActive).toBe(true);
    await expect(page.locator('#na-review-badge')).toBeHidden();
  });

  test('handler is a no-op when clashIds is empty or missing', async ({ page }) => {
    const results = await page.evaluate(() => ({
      empty: _markClashesAsApproved([]),
      undef: _markClashesAsApproved(undefined),
      notArray: _markClashesAsApproved('CLX-001'),
    }));
    expect(results.empty).toBe(0);
    expect(results.undef).toBe(0);
    expect(results.notArray).toBe(0);
  });
});
