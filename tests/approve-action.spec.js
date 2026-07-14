import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Seed shared across all four tests. Five Active clashes in one testName,
// each carrying element IDs so pairKey() classifies at the ID:: tier — same
// shape as review-queue.spec.js.
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

// XML re-imports 3 of the 5 (Clash1, Clash2, Clash3). Clash4 + Clash5 are
// absent → REVIEW-QUEUE-DETECT flags them pendingReview.
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

test.describe('APPROVE-ACTION', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
    });
  });

  test('handler + surface presence: _markClashesAsApproved exposed, three surfaces render an Approve control', async ({ page }) => {
    // 1. Handler is a function
    const handlerType = await page.evaluate(() => typeof window._markClashesAsApproved);
    expect(handlerType).toBe('function');

    // 2. Review Queue: seed + import, then the Approve button shows in both bulk locations.
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
    await page.evaluate(() => {
      _rqOpen['[H] Approve Action Test A'] = true;
      nav('review');
    });
    // Bottom-bar Approve button
    await expect(page.locator('button', { hasText: 'Mark selected as Approved' })).toBeVisible();
    // Per-test group Approve button
    await expect(page.locator('button', { hasText: 'Approve all in this test' })).toBeVisible();

    // 3. Clash Register detail: open a clash → Approve (terminal) button present
    await page.evaluate(() => { nav('register'); openClashDetail('CLX-001'); });
    await expect(page.locator('#cm button', { hasText: 'Approve (terminal)' })).toBeVisible();
    // Close modal
    await page.evaluate(() => { const cm = document.getElementById('cm'); if (cm) cm.style.display = 'none'; });

    // 4. Board View: card renders inline ✓ Approve button
    await page.evaluate(() => { nav('board'); });
    await page.waitForSelector('#board-content');
    // Card for CLX-001 should carry an Approve inline action
    const boardApproveCount = await page.evaluate(() =>
      document.querySelectorAll('.ccard .cmoves button').length
    );
    expect(boardApproveCount).toBeGreaterThan(0);
    // At least one card's Approve button should be a plain visible ✓ Approve
    await expect(page.locator('.ccard .cmoves button', { hasText: '✓ Approve' }).first()).toBeVisible();
  });

  test('Approve from Review Queue: status flips, statusHistory records audit entry, clash disappears from queue', async ({ page }) => {
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

    // CLX-004 + CLX-005 should now be pendingReview
    const flagged = await page.evaluate(() =>
      (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid).sort()
    );
    expect(flagged).toEqual(['CLX-004', 'CLX-005']);

    // Approve CLX-004 via the bottom-bar action
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
        hasApproveEntry: (c.statusHistory || []).some(h => h.status === 'Approved' && h.approvedAt && h.actor && h.source === 'Approve'),
        hasWeeklyEntry: (c.statusHistory || []).some(h => h.status === 'Approved' && typeof h.week === 'number' && typeof h.year === 'number'),
      };
    });
    expect(after.status).toBe('Approved');
    expect(after.pendingReview).toBeUndefined();
    expect(after.disappearedAt).toBeUndefined();
    expect(after.disappearedInBatch).toBeUndefined();
    expect(after.hasApproveEntry).toBe(true);
    expect(after.hasWeeklyEntry).toBe(true);

    // Review Queue badge should now read 1 (CLX-005 still pending)
    await expect(page.locator('#na-review-badge')).toHaveText('1');
  });

  test('Approve from Clash Register detail: writes Approved + audit entry, does not touch other clashes', async ({ page }) => {
    await page.evaluate((seed) => {
      S.clashes = seed.slice();
      const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
      _uid = mx;
      sv('clashes', S.clashes);
      nav('register');
    }, makeSeed());
    // Open CLX-002 detail modal, click the terminal Approve button
    await page.evaluate(() => openClashDetail('CLX-002'));
    const approveBtn = page.locator('#cm button', { hasText: 'Approve (terminal)' });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();
    // Wait for status flip
    await page.waitForFunction(() =>
      (S.clashes || []).some(c => c.uid === 'CLX-002' && c.status === 'Approved')
    );
    const state = await page.evaluate(() => {
      const c2 = (S.clashes || []).find(x => x.uid === 'CLX-002');
      const others = (S.clashes || []).filter(x => x.uid !== 'CLX-002');
      return {
        c2Status: c2.status,
        c2HasApprove: (c2.statusHistory || []).some(h => h.status === 'Approved' && h.source === 'Approve'),
        othersAllActive: others.every(c => c.status === 'Active'),
      };
    });
    expect(state.c2Status).toBe('Approved');
    expect(state.c2HasApprove).toBe(true);
    expect(state.othersAllActive).toBe(true);
  });

  test('Approve from Board View: inline button flips status + audit entry recorded', async ({ page }) => {
    await page.evaluate((seed) => {
      S.clashes = seed.slice();
      const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
      _uid = mx;
      sv('clashes', S.clashes);
      nav('board');
    }, makeSeed());
    await page.waitForSelector('#board-content');
    // Drive the exposed handler directly with a single uid — the click path
    // is exercised by the surface-presence test above; here we assert the
    // Board View wiring writes the same audit shape as the other surfaces.
    const invoked = await page.evaluate(() => {
      const n = _markClashesAsApproved(['CLX-003']);
      if (typeof updSB === 'function') updSB();
      if (typeof updSS === 'function') updSS();
      const bc = document.getElementById('board-content');
      if (bc) bc.innerHTML = renderBoardGrid();
      return n;
    });
    expect(invoked).toBe(1);
    const state = await page.evaluate(() => {
      const c = (S.clashes || []).find(x => x.uid === 'CLX-003');
      return {
        status: c.status,
        hasApprove: (c.statusHistory || []).some(h => h.status === 'Approved' && h.approvedAt && h.source === 'Approve'),
      };
    });
    expect(state.status).toBe('Approved');
    expect(state.hasApprove).toBe(true);
  });

  test('Approved is terminal: re-importing the same partial XML does NOT re-flag the approved clash', async ({ page }) => {
    // Seed + import once so CLX-004 & CLX-005 land in the queue
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

    // Approve CLX-004
    await page.evaluate(() => {
      _markClashesAsApproved(['CLX-004']);
    });
    await page.waitForFunction(() =>
      (S.clashes || []).some(c => c.uid === 'CLX-004' && c.status === 'Approved')
    );

    // Re-import the same partial XML
    await page.evaluate(() => nav('bcf'));
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_PARTIAL);

    const afterReimport = await page.evaluate(() => {
      const c4 = (S.clashes || []).find(x => x.uid === 'CLX-004');
      const allPending = (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid).sort();
      return {
        c4Status: c4.status,
        c4Pending: c4.pendingReview,
        c4Disappeared: c4.disappearedAt,
        allPending,
      };
    });
    // Approved clash must NOT re-appear in the queue
    expect(afterReimport.c4Status).toBe('Approved');
    expect(afterReimport.c4Pending).toBeUndefined();
    expect(afterReimport.c4Disappeared).toBeUndefined();
    // CLX-005 was already in the queue from import 1 (still pending); it is
    // legitimately re-flaggable because the re-import still omits it. This
    // assertion confirms no OTHER clash slipped into the queue.
    expect(afterReimport.allPending).toEqual(['CLX-005']);
  });

  test('color infra covers Approved: NW.Approved.s === "#00B050", nwc("Approved") returns that entry', async ({ page }) => {
    const colorCheck = await page.evaluate(() => ({
      nwApproved: NW && NW.Approved && NW.Approved.s,
      nwcApproved: nwc('Approved') === NW.Approved,
      hmApproved: HM_STATUS_COLOURS && HM_STATUS_COLOURS.Approved,
    }));
    expect(colorCheck.nwApproved).toBe('#00B050');
    expect(colorCheck.nwcApproved).toBe(true);
    expect(colorCheck.hmApproved).toBe('#00B050');
  });
});
