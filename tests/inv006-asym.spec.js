import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* INV-006 regression coverage.
   DEDUP-QUEUE-DETECT's one-shot initial-scan wrapper and _rqdaMigrate()
   both run inline inside initAuth() (window.onload), gated on a one-shot
   localStorage flag — same shape as the INV-005 review-queue migrations.
   Triggering them requires a real page navigation rather than a direct
   function call.

   Asymmetric-failure technique (mirrors tests/inv003-asym.spec.js /
   tests/inv005-asym.spec.js): a mocked Storage.prototype.setItem throws
   QuotaExceededError only for large payloads (the dedup queue / clashes
   register, easily >50 chars once populated) while small gate-flag writes
   ('1') still succeed — the realistic near-quota scenario that exposed
   the original divergence bug.

   Option C remediation under test: a dedicated, throwing
   localStorage.setItem write of the wrapper's own result (S.dedupQueue /
   S.clashes) added inside each one-shot wrapper, without altering the
   shared scanForDedupCandidates() / _rqdaReclassifyAll() / sv() helpers. */

async function installMock(page) {
  await page.addInitScript(() => {
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (localStorage.getItem('__inv006MockActive') === '1' && String(v).length > 50) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return origSetItem.call(this, k, v);
    };
  });
}

async function bootstrapFresh(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
}

// Two coord-adjacent clashes tuned so DEDUP-SCOPE-GUARD / DEDUP-SIGNATURE-FILTER
// let the pair through and scanForDedupCandidates() emits a real, non-empty
// dedupQueue payload (large enough to trip the mocked quota ceiling).
function makeDedupCandidateClashes() {
  return [
    { uid: 'CLX-201', name: 'CLX-201 — c', nwOrig: 'C201', testName: '[INV6] Dedup Test',
      disciplineA: 'MEP', disciplineB: 'Structural', elementA: 'ItemA', elementB: 'ItemB',
      elementIdA: '', elementIdB: '', elementIdSrcA: '', elementIdSrcB: '',
      sourceA: 'GAS.nwc', sourceB: 'Struct.nwc', penetration: '20mm', status: 'Active',
      priority: 'High', assignedTo: '', notes: '', date: '01/07/26',
      x: 100, y: 0, z: 0, nwImageRef: '', weekTag: 'week-260601',
      statusHistory: [{ week: 27, year: 2026, status: 'Active' }] },
    { uid: 'CLX-202', name: 'CLX-202 — c', nwOrig: 'C202', testName: '[INV6] Dedup Test',
      disciplineA: 'MEP', disciplineB: 'Structural', elementA: 'ItemA', elementB: 'ItemB',
      elementIdA: '', elementIdB: '', elementIdSrcA: '', elementIdSrcB: '',
      sourceA: 'GAS.nwc', sourceB: 'Struct.nwc', penetration: '20mm', status: 'Active',
      priority: 'High', assignedTo: '', notes: '', date: '01/07/26',
      x: 103, y: 0, z: 0, nwImageRef: '', weekTag: 'week-260608',
      statusHistory: [{ week: 27, year: 2026, status: 'Active' }] },
  ];
}

test.describe('INV-006: dedupInitialScan gate/persistence divergence', () => {
  test('failure path: large dedupQueue write fails — gate stays unset, storage unchanged, scan retries and converges next load', async ({ page }) => {
    await installMock(page);
    await bootstrapFresh(page);
    const seedClashes = makeDedupCandidateClashes();

    await page.evaluate(({ clashes }) => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
      localStorage.setItem('nw:clashes', JSON.stringify(clashes));
      localStorage.setItem('__inv006MockActive', '1');
    }, { clashes: seedClashes });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-201'));

    const afterFail = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:dedupInitialScan'),
      persistedQueue: localStorage.getItem('nw:dedupQueue'),
    }));
    expect(afterFail.gate).toBeNull();
    expect(afterFail.persistedQueue).toBeNull();

    // Retry: mock disabled, scan re-runs and converges.
    await page.evaluate(() => { localStorage.setItem('__inv006MockActive', '0'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-201'));

    const afterRetry = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:dedupInitialScan'),
      persistedQueue: JSON.parse(localStorage.getItem('nw:dedupQueue') || 'null'),
    }));
    expect(afterRetry.gate).toBe('1');
    expect(Array.isArray(afterRetry.persistedQueue)).toBe(true);
    expect(afterRetry.persistedQueue.length).toBe(1);
  });

  test('success path: write succeeds — gate is set, storage updated, gate and storage stay synchronized', async ({ page }) => {
    await bootstrapFresh(page);
    const seedClashes = makeDedupCandidateClashes();

    await page.evaluate(({ clashes }) => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
      localStorage.setItem('nw:clashes', JSON.stringify(clashes));
    }, { clashes: seedClashes });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-201'));

    const after = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:dedupInitialScan'),
      persistedQueue: JSON.parse(localStorage.getItem('nw:dedupQueue') || 'null'),
      inMemoryQueue: S.dedupQueue,
    }));
    expect(after.gate).toBe('1');
    expect(after.persistedQueue.length).toBe(1);
    expect(after.inMemoryQueue.length).toBe(1);
    expect(after.persistedQueue.map(p => p.dedupPairId)).toEqual(after.inMemoryQueue.map(p => p.dedupPairId));
  });
});

function makeStaleClashes() {
  return [
    { uid: 'CLX-301', testName: '[INV6] Delta Test A', nwOrig: 'ClashOne', status: 'Active',
      pendingReview: true, disappearedAt: '2026-06-01T09:00:00.000Z', disappearedInBatch: 'bat-old-6' },
    { uid: 'CLX-302', testName: '[INV6] Delta Test B', nwOrig: 'ClashTwo', status: 'Active',
      pendingReview: true, disappearedAt: '2026-06-01T09:00:00.000Z', disappearedInBatch: 'bat-old-6' },
  ];
}

test.describe('INV-006: reviewQueueDeltaAnalysisMigrated gate/persistence divergence', () => {
  test('failure path: large clashes write fails — gate stays unset, storage unchanged, migration retries and converges next load', async ({ page }) => {
    await installMock(page);
    await bootstrapFresh(page);
    const seedClashes = makeStaleClashes();
    const originalJson = JSON.stringify(seedClashes);

    await page.evaluate(({ clashes }) => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
      localStorage.setItem('nw:dedupInitialScan', '1');
      localStorage.setItem('nw:clashes', JSON.stringify(clashes));
      localStorage.setItem('__inv006MockActive', '1');
    }, { clashes: seedClashes });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-301'));
    // Give the 1600ms setTimeout-scheduled migration time to fire.
    await page.waitForTimeout(1900);

    const afterFail = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:reviewQueueDeltaAnalysisMigrated'),
      persistedClashes: localStorage.getItem('nw:clashes'),
    }));
    expect(afterFail.gate).toBeNull();
    expect(afterFail.persistedClashes).toBe(originalJson);

    // Retry: mock disabled, migration re-runs and converges.
    await page.evaluate(() => { localStorage.setItem('__inv006MockActive', '0'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-301'));
    await page.waitForTimeout(1900);

    const afterRetry = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:reviewQueueDeltaAnalysisMigrated'),
      persistedClashes: JSON.parse(localStorage.getItem('nw:clashes') || 'null'),
    }));
    expect(afterRetry.gate).toBe('1');
    const p301 = afterRetry.persistedClashes.find(c => c.uid === 'CLX-301');
    expect(p301._bucket).toBeDefined();
  });

  test('success path: write succeeds — gate is set, storage updated, gate and storage stay synchronized', async ({ page }) => {
    await bootstrapFresh(page);
    const seedClashes = makeStaleClashes();

    await page.evaluate(({ clashes }) => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
      localStorage.setItem('nw:dedupInitialScan', '1');
      localStorage.setItem('nw:clashes', JSON.stringify(clashes));
    }, { clashes: seedClashes });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-301'));
    await page.waitForTimeout(1900);

    const after = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:reviewQueueDeltaAnalysisMigrated'),
      persistedClashes: JSON.parse(localStorage.getItem('nw:clashes') || 'null'),
      inMemory301: S.clashes.find(c => c.uid === 'CLX-301'),
    }));
    expect(after.gate).toBe('1');
    const p301 = after.persistedClashes.find(c => c.uid === 'CLX-301');
    expect(p301._bucket).toBeDefined();
    expect(after.inMemory301._bucket).toBe(p301._bucket);
  });
});
