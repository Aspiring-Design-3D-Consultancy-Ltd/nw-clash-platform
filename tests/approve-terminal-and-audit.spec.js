import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Two clashes in one testName, ID-keyed so pairKey() classifies at the ID:: tier.
// The XML re-import below only mentions Clash1 — Clash2 must NOT re-enter the
// Review Queue after we approve it, per the "Approve is terminal" contract.
function makeSeed() {
  const wy = { week: 27, year: 2026 };
  const mk = (n) => ({
    uid: 'CLX-' + String(n).padStart(3, '0'),
    name: 'CLX-' + String(n).padStart(3, '0') + ' — Clash' + n,
    nwOrig: 'Clash' + n,
    testName: '[H] Approve Terminal Test A',
    disciplineA: 'Structural', disciplineB: 'MEP',
    elementA: 'Beam-' + n, elementB: 'Duct-' + n,
    elementIdA: 'EID-A-' + n, elementIdB: 'EID-B-' + n,
    elementIdSrcA: 'Element ID', elementIdSrcB: 'Element ID',
    sourceA: 'Structural.nwc', sourceB: 'MEP.nwc',
    penetration: '20mm',
    status: 'Active', priority: 'High',
    assignedTo: '', notes: '',
    date: '01/07/26',
    x: 10 * n, y: 20 * n, z: 30 * n,
    nwImageRef: '',
    statusHistory: [{ week: wy.week, year: wy.year, status: 'Active' }],
  });
  return [mk(1), mk(2)];
}

const XML_ONLY_CLASH1 = `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="[H] Approve Terminal Test A">
      <clashresult name="Clash1" distance="-0.02">
        <clashpoint><pos3f x="10" y="20" z="30"/></clashpoint>
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
    </clashtest>
  </batchtest>
</exchange>`;

test.describe('APPROVE — terminal-status filter + audit-hardening', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      _ROLE = 'admin';
    });
  });

  test('Fix #1 — Approved clash absent from re-imported XML does NOT re-enter Review Queue', async ({ page }) => {
    // Seed: two Active clashes in one test. Approve CLX-002 directly via handler
    // (short-cut for the type-APPROVE modal — we're testing the queue filter here).
    await page.evaluate((seed) => {
      S.clashes = seed.slice();
      const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
      _uid = mx;
      sv('clashes', S.clashes);
      _markClashesAsApproved(['CLX-002'], 'ClashRegister');
    }, makeSeed());

    // Sanity: CLX-002 is now Approved, sitting in the register as terminal.
    const seeded = await page.evaluate(() =>
      (S.clashes || []).map(c => ({ uid: c.uid, status: c.status }))
    );
    expect(seeded).toEqual([
      { uid: 'CLX-001', status: 'Active' },
      { uid: 'CLX-002', status: 'Approved' },
    ]);

    // Import an XML that omits CLX-002 entirely. Under the pre-fix behaviour
    // (line 8403 filtering only Resolved), CLX-002 would be flagged as
    // pendingReview because it looks "disappeared". Fix excludes Approved
    // the same way it excludes Resolved.
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_ONLY_CLASH1);

    const afterImport = await page.evaluate(() => {
      const flagged = (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid).sort();
      const c2 = (S.clashes || []).find(x => x.uid === 'CLX-002');
      return {
        flagged,
        c2Status: c2.status,
        c2Pending: c2.pendingReview,
        c2Disappeared: c2.disappearedAt,
      };
    });
    // The critical assertion — CLX-002 (Approved) is NOT in the pending list.
    expect(afterImport.flagged).toEqual([]);
    expect(afterImport.c2Status).toBe('Approved');
    expect(afterImport.c2Pending).toBeUndefined();
    expect(afterImport.c2Disappeared).toBeUndefined();

    // Sidebar Review Queue badge stays hidden (zero pending).
    await expect(page.locator('#na-review-badge')).toBeHidden();
  });

  test('Fix #1 — regression control: Resolved clashes still excluded from queue on re-import', async ({ page }) => {
    // Confirm the pre-existing Resolved exclusion behaviour is unaffected —
    // fix should mirror Resolved, not replace it.
    await page.evaluate((seed) => {
      S.clashes = seed.slice();
      const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
      _uid = mx;
      // Set CLX-002 to Resolved directly (bypasses uf → pushStatusHistory).
      S.clashes.find(c => c.uid === 'CLX-002').status = 'Resolved';
      sv('clashes', S.clashes);
    }, makeSeed());
    await page.evaluate(() => { nav('bcf'); });
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_ONLY_CLASH1);
    const flagged = await page.evaluate(() =>
      (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid)
    );
    expect(flagged).toEqual([]);
  });

  test('Fix #2 — reentrant _crApproveOpen fires the prior cancel callback', async ({ page }) => {
    // Simulate: user opens dropdown for CLX-001 → modal opens with cancel cb A.
    // Before dismissing, a second _crApproveOpen is called (programmatic / race)
    // for CLX-002 with cancel cb B. Guard must fire cb A so CLX-001's dropdown
    // is restored before the shared modal state is overwritten.
    const result = await page.evaluate(() => {
      let aFired = 0, bFired = 0;
      _crApproveOpen(['CLX-001'], () => { aFired++; });
      const uidsMid = _crApproveUids.slice();
      _crApproveOpen(['CLX-002'], () => { bFired++; });
      const uidsAfter = _crApproveUids.slice();
      _crApproveCancel();
      return { aFired, bFired, uidsMid, uidsAfter };
    });
    expect(result.uidsMid).toEqual(['CLX-001']);
    expect(result.uidsAfter).toEqual(['CLX-002']);
    // Prior cancel cb (A) must have fired once during the second open.
    expect(result.aFired).toBe(1);
    // The second's cancel cb (B) fires exactly once via the final _crApproveCancel.
    expect(result.bFired).toBe(1);
  });

  test('Fix #3 — audit entry preserves disappearedInBatch as reviewedInBatch', async ({ page }) => {
    // Seed a single clash with the RQ-disappearance flags set, as if the queue
    // had surfaced it after an earlier import.
    await page.evaluate(() => {
      S.clashes = [{
        uid: 'CLX-777',
        name: 'CLX-777 — Terminal audit test',
        testName: 'AuditTest',
        disciplineA: 'S', disciplineB: 'M',
        elementA: 'a', elementB: 'b',
        penetration: '10mm', priority: 'High',
        status: 'Active',
        date: '01/07/26',
        x: 0, y: 0, z: 0,
        pendingReview: true,
        disappearedAt: '2026-07-14',
        disappearedInBatch: 'bat-xyz-999',
        statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
      }];
      sv('clashes', S.clashes);
      _markClashesAsApproved(['CLX-777'], 'ClashRegister');
    });

    const audit = await page.evaluate(() => {
      const c = (S.clashes || []).find(x => x.uid === 'CLX-777');
      const last = (c.statusHistory || []).slice().reverse().find(h => h.approvedAt);
      return {
        status: c.status,
        pending: c.pendingReview,
        disAt: c.disappearedAt,
        disBatch: c.disappearedInBatch,
        auditReviewedInBatch: last && last.reviewedInBatch,
        auditReviewedAtBatchDate: last && last.reviewedAtBatchDate,
        auditSource: last && last.source,
      };
    });
    expect(audit.status).toBe('Approved');
    expect(audit.pending).toBeUndefined();
    expect(audit.disAt).toBeUndefined();
    expect(audit.disBatch).toBeUndefined();
    expect(audit.auditReviewedInBatch).toBe('bat-xyz-999');
    expect(audit.auditReviewedAtBatchDate).toBe('2026-07-14');
    expect(audit.auditSource).toBe('ClashRegister');
  });

  test('Fix #3 — non-RQ Approve: reviewedInBatch is empty string (never undefined)', async ({ page }) => {
    // A clash approved directly from the register (never flagged into the
    // queue) has no disappearedInBatch. The audit entry should still carry
    // reviewedInBatch as an empty string so downstream audit-log readers can
    // rely on the field always existing.
    await page.evaluate(() => {
      S.clashes = [{
        uid: 'CLX-888',
        name: 'CLX-888 — Direct approve',
        testName: 'DirectTest',
        disciplineA: 'S', disciplineB: 'M',
        elementA: 'a', elementB: 'b',
        penetration: '10mm', priority: 'High',
        status: 'Active',
        date: '01/07/26',
        x: 0, y: 0, z: 0,
        statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
      }];
      sv('clashes', S.clashes);
      _markClashesAsApproved(['CLX-888'], 'ClashRegister');
    });
    const audit = await page.evaluate(() => {
      const c = (S.clashes || []).find(x => x.uid === 'CLX-888');
      const last = (c.statusHistory || []).slice().reverse().find(h => h.approvedAt);
      return {
        hasField: last && Object.prototype.hasOwnProperty.call(last, 'reviewedInBatch'),
        value: last && last.reviewedInBatch,
        hasDateField: last && Object.prototype.hasOwnProperty.call(last, 'reviewedAtBatchDate'),
        dateValue: last && last.reviewedAtBatchDate,
      };
    });
    expect(audit.hasField).toBe(true);
    expect(audit.value).toBe('');
    expect(audit.hasDateField).toBe(true);
    expect(audit.dateValue).toBe('');
  });
});
