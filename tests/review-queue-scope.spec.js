import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Two-test seed: 3 in Test A, 3 in Test B, all Active. Element IDs make pairKey
// land on the ID:: tier so the merge branch matches directly (not the LEGACY
// fallback which relies on nwOrig collisions).
function makeSeed() {
  const wy = { week: 27, year: 2026 };
  const mk = (uid, tn, ida, idb, n) => ({
    uid,
    name: uid + ' — Clash' + n,
    nwOrig: 'Clash' + n,
    testName: tn,
    disciplineA: 'Structural', disciplineB: 'MEP',
    elementA: 'Beam-' + n, elementB: 'Duct-' + n,
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
    mk('CLX-001', '[H] Scope Test A', 'EID-AA-1', 'EID-AB-1', 1),
    mk('CLX-002', '[H] Scope Test A', 'EID-AA-2', 'EID-AB-2', 2),
    mk('CLX-003', '[H] Scope Test A', 'EID-AA-3', 'EID-AB-3', 3),
    mk('CLX-101', '[H] Scope Test B', 'EID-BA-1', 'EID-BB-1', 1),
    mk('CLX-102', '[H] Scope Test B', 'EID-BA-2', 'EID-BB-2', 2),
    mk('CLX-103', '[H] Scope Test B', 'EID-BA-3', 'EID-BB-3', 3),
  ];
}

// XML that only covers Test A — and only 2 of the 3 Test A clashes. Test B
// is absent from this batch entirely.
const XML_TEST_A_PARTIAL = `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="[H] Scope Test A">
      ${[1,2].map(n => `<clashresult name="Clash${n}" distance="-0.02">
        <clashpoint><pos3f x="${100*n}" y="${200*n}" z="${300*n}"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="7" day="15" hour="10" minute="0" second="0"/></createddate>
        <clashobject><pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-AA-${n}</value></objectattribute></clashobject>
        <clashobject><pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-AB-${n}</value></objectattribute></clashobject>
      </clashresult>`).join('')}
    </clashtest>
  </batchtest>
</exchange>`;

const XML_TEST_B_FULL = `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="[H] Scope Test B">
      ${[1,2,3].map(n => `<clashresult name="Clash${n}" distance="-0.02">
        <clashpoint><pos3f x="${100*n}" y="${200*n}" z="${300*n}"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="7" day="15" hour="10" minute="0" second="0"/></createddate>
        <clashobject><pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-BA-${n}</value></objectattribute></clashobject>
        <clashobject><pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-BB-${n}</value></objectattribute></clashobject>
      </clashresult>`).join('')}
    </clashtest>
  </batchtest>
</exchange>`;

test.describe('REVIEW-QUEUE-DETECT-SCOPE', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
    // INV-007: wait for the terminal inline one-shot migration gate so
    // window.onload's setTimeout(1500/1600)-deferred migrations don't
    // race and silently overwrite this test's seeded state.
    await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      // Prevent the one-time migration from mistaking a fresh seed for a stale
      // pre-fix register between test steps. Set the flag now so the
      // migration is a no-op even after reload.
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      nav('bcf');
    });
    await page.waitForSelector('#bxml');
  });

  test('a partial Test A import flags only the missing Test A clash — Test B clashes are untouched', async ({ page }) => {
    // Seed 3 Test A + 3 Test B, all Active.
    await page.evaluate((seed) => {
      S.clashes = seed.slice();
      const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
      _uid = mx;
      sv('clashes', S.clashes);
    }, makeSeed());

    // Import Test A partial (2 of 3 Test A clashes; Test B absent from batch).
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_TEST_A_PARTIAL);

    const state = await page.evaluate(() => ({
      flaggedTestA: (S.clashes || []).filter(c => c.testName === '[H] Scope Test A' && c.pendingReview === true).map(c => c.uid),
      flaggedTestB: (S.clashes || []).filter(c => c.testName === '[H] Scope Test B' && c.pendingReview === true).map(c => c.uid),
      allPending: (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid),
    }));
    expect(state.flaggedTestA).toEqual(['CLX-003']);
    expect(state.flaggedTestB).toEqual([]);
    expect(state.allPending).toEqual(['CLX-003']);

    // Badge shows 1, not 4.
    await page.evaluate(() => updSB());
    const badge = page.locator('#na-review-badge');
    await expect(badge).toHaveText('1');
    await expect(badge).toBeVisible();

    // Now import Test B in full — should NOT flag anything (all Test B clashes
    // match) and MUST NOT flip the earlier Test A flag off.
    await page.evaluate(() => nav('bcf'));
    await page.waitForSelector('#bxml');
    await page.evaluate((xml) => {
      document.getElementById('bxml').value = xml;
      bparse();
      window._skipCrossTestDupes = true;
      importToRegister('append');
    }, XML_TEST_B_FULL);

    const state2 = await page.evaluate(() => ({
      flaggedTestA: (S.clashes || []).filter(c => c.testName === '[H] Scope Test A' && c.pendingReview === true).map(c => c.uid),
      flaggedTestB: (S.clashes || []).filter(c => c.testName === '[H] Scope Test B' && c.pendingReview === true).map(c => c.uid),
    }));
    expect(state2.flaggedTestA).toEqual(['CLX-003']);
    expect(state2.flaggedTestB).toEqual([]);
  });
});

test.describe('REVIEW-QUEUE-MIGRATE-SCOPE-FIX', () => {
  test('one-time migration clears stale pendingReview flags and sets the guard', async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
    // INV-007: wait for the terminal inline one-shot migration gate so
    // window.onload's setTimeout(1500/1600)-deferred migrations don't
    // race and silently overwrite this test's seeded state.
    await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');

    // Seed a pre-fix register: two clashes carry stale review flags that a
    // pre-scope-fix production import would have left behind. The guard flag
    // is NOT set — that mirrors a browser that first hit the app before this
    // fix shipped.
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      const clashes = [
        { uid: 'CLX-001', testName: 'Test A', nwOrig: 'Clash1', status: 'Active',
          pendingReview: true, disappearedAt: '2026-06-01T09:00:00.000Z', disappearedInBatch: 'bat-old-1' },
        { uid: 'CLX-002', testName: 'Test B', nwOrig: 'Clash1', status: 'Active',
          pendingReview: true, disappearedAt: '2026-06-01T09:00:00.000Z', disappearedInBatch: 'bat-old-1' },
        { uid: 'CLX-003', testName: 'Test C', nwOrig: 'Clash1', status: 'Active',
          reviewedStillOpen: true }, // MUST be left alone
      ];
      // Match the app's current DATA_VERSION so initAuth loads OUR clashes
      // instead of resetting to the DC demo dataset. CLAUDE.md forbids bumping
      // this value — we mirror whatever it currently is at test time.
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      localStorage.setItem('nw:clashes', JSON.stringify(clashes));
    });

    // Reload — the init path runs REVIEW-QUEUE-MIGRATE-SCOPE-FIX.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes));
    // Give the async initAuth a beat to finish loading state.
    await page.waitForFunction(() => (S.clashes || []).some(c => c.uid === 'CLX-001'));

    const after = await page.evaluate(() => ({
      c1: S.clashes.find(x => x.uid === 'CLX-001'),
      c2: S.clashes.find(x => x.uid === 'CLX-002'),
      c3: S.clashes.find(x => x.uid === 'CLX-003'),
      guard: localStorage.getItem('nw:reviewQueueScopeFixed'),
    }));

    expect(after.c1.pendingReview).toBeUndefined();
    expect(after.c1.disappearedAt).toBeUndefined();
    expect(after.c1.disappearedInBatch).toBeUndefined();
    expect(after.c2.pendingReview).toBeUndefined();
    expect(after.c3.reviewedStillOpen).toBe(true);
    expect(after.guard).toBe('1');

    // Second reload: the migration must NOT re-run — if a subsequent import
    // legitimately set pendingReview, the guard prevents wiping it.
    await page.evaluate(() => {
      const cs = S.clashes.map(c => c.uid === 'CLX-001' ? { ...c, pendingReview: true, disappearedAt: '2026-08-01T00:00:00.000Z', disappearedInBatch: 'bat-new' } : c);
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      localStorage.setItem('nw:clashes', JSON.stringify(cs));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (S.clashes || []).some(c => c.uid === 'CLX-001'));
    const after2 = await page.evaluate(() => {
      const c1 = S.clashes.find(x => x.uid === 'CLX-001');
      return { pendingReview: c1.pendingReview, disappearedInBatch: c1.disappearedInBatch };
    });
    expect(after2.pendingReview).toBe(true);
    expect(after2.disappearedInBatch).toBe('bat-new');
  });
});
