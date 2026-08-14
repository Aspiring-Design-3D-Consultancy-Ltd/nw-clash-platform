import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* INV-005 regression coverage.
   Both REVIEW-QUEUE-MIGRATE-SCOPE-FIX and REVIEW-QUEUE-MIGRATE-DATE-GUARD-FIX
   run inline inside initAuth() (window.onload), gated on a one-shot
   localStorage flag — they are not standalone callable functions like
   _migrateDedupQueueV1(), so triggering them requires a real page
   navigation rather than a direct function call.

   Asymmetric-failure technique (mirrors tests/inv003-asym.spec.js): a
   mocked Storage.prototype.setItem throws QuotaExceededError only for
   large payloads (the clashes register, easily >50 chars once it holds
   even a couple of clash records) while small gate-flag writes ('1',
   'false') still succeed — exactly the realistic near-quota scenario
   that exposed the original divergence bug.

   Because the mock must be installed BEFORE initAuth() runs on each
   navigation, it's registered once via page.addInitScript() (which
   re-executes on every subsequent navigation of that page) and toggled
   between navigations with a plain, non-'nw:'-prefixed localStorage
   marker key so it can be flipped on/off without re-registering the
   init script. */

async function installMock(page) {
  await page.addInitScript(() => {
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (localStorage.getItem('__inv005MockActive') === '1' && String(v).length > 50) {
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

function makeStaleClashes() {
  return [
    { uid: 'CLX-101', testName: '[INV5] Scope Test A', nwOrig: 'ClashOne', status: 'Active',
      pendingReview: true, disappearedAt: '2026-06-01T09:00:00.000Z', disappearedInBatch: 'bat-old-1' },
    { uid: 'CLX-102', testName: '[INV5] Scope Test B', nwOrig: 'ClashTwo', status: 'Active',
      pendingReview: true, disappearedAt: '2026-06-01T09:00:00.000Z', disappearedInBatch: 'bat-old-1' },
  ];
}

test.describe('INV-005: reviewQueueScopeFixed gate/persistence divergence', () => {
  test('failure path: large clashes write fails — gate stays unset, storage unchanged, migration retries and converges next load', async ({ page }) => {
    await installMock(page);
    await bootstrapFresh(page);
    const seedClashes = makeStaleClashes();
    const originalJson = JSON.stringify(seedClashes);

    await page.evaluate(({ clashes }) => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      localStorage.setItem('nw:clashes', JSON.stringify(clashes));
      localStorage.setItem('__inv005MockActive', '1');
    }, { clashes: seedClashes });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-101'));

    const afterFail = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:reviewQueueScopeFixed'),
      persistedClashes: localStorage.getItem('nw:clashes'),
    }));
    // Gate must NOT be set — the write that should have preceded it threw.
    expect(afterFail.gate).toBeNull();
    // Persisted register must remain byte-identical to the pre-migration
    // seed — the fix's whole point is that a failed clashes write can no
    // longer be masked by sv() before the gate is set unconditionally.
    expect(afterFail.persistedClashes).toBe(originalJson);

    // Migration must not be permanently skipped: with the quota pressure
    // gone, the very next load re-attempts and this time succeeds,
    // bringing storage and the gate back into sync.
    await page.evaluate(() => { localStorage.setItem('__inv005MockActive', '0'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-101'));

    const afterRetry = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:reviewQueueScopeFixed'),
      persistedClashes: JSON.parse(localStorage.getItem('nw:clashes') || 'null'),
    }));
    expect(afterRetry.gate).toBe('1');
    const p101 = afterRetry.persistedClashes.find(c => c.uid === 'CLX-101');
    expect(p101.pendingReview).toBeUndefined();
    expect(p101.disappearedAt).toBeUndefined();
    expect(p101.disappearedInBatch).toBeUndefined();
  });

  test('success path: write succeeds — gate is set, storage updated, gate and storage stay synchronized', async ({ page }) => {
    await bootstrapFresh(page);
    const seedClashes = makeStaleClashes();

    await page.evaluate(({ clashes }) => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      localStorage.setItem('nw:clashes', JSON.stringify(clashes));
    }, { clashes: seedClashes });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-101'));

    const after = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:reviewQueueScopeFixed'),
      persistedClashes: JSON.parse(localStorage.getItem('nw:clashes') || 'null'),
      inMemory101: S.clashes.find(c => c.uid === 'CLX-101'),
    }));
    expect(after.gate).toBe('1');
    const p101 = after.persistedClashes.find(c => c.uid === 'CLX-101');
    expect(p101.pendingReview).toBeUndefined();
    expect(p101.disappearedAt).toBeUndefined();
    expect(p101.disappearedInBatch).toBeUndefined();
    // In-memory and persisted state agree — no divergence on the happy path.
    expect(after.inMemory101.pendingReview).toBeUndefined();
    expect(after.inMemory101.disappearedAt).toBeUndefined();
  });
});

test.describe('INV-005: reviewQueueDateGuardFixed gate/persistence divergence', () => {
  test('failure path: large clashes write fails — gate stays unset, storage (clashes + banner) unchanged, migration retries and converges next load', async ({ page }) => {
    await installMock(page);
    await bootstrapFresh(page);
    const seedClashes = makeStaleClashes();
    const originalJson = JSON.stringify(seedClashes);

    await page.evaluate(({ clashes }) => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      // Pre-set the SCOPE-FIX gate so that one-shot doesn't consume our
      // seeded pendingReview/disappearedAt flags before DATE-GUARD-FIX runs
      // (mirrors the same guard used in tests/review-queue-date-guard.spec.js).
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      localStorage.setItem('nw:clashes', JSON.stringify(clashes));
      // Also seed the no-date banner so the second write inside the same
      // try block is exercised — it must likewise never fire when the
      // preceding clashes write throws.
      localStorage.setItem('nw:reviewQueueNoDateBanner', JSON.stringify(true));
      localStorage.setItem('__inv005MockActive', '1');
    }, { clashes: seedClashes });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-101'));

    const afterFail = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:reviewQueueDateGuardFixed'),
      persistedClashes: localStorage.getItem('nw:clashes'),
      persistedBanner: localStorage.getItem('nw:reviewQueueNoDateBanner'),
    }));
    expect(afterFail.gate).toBeNull();
    expect(afterFail.persistedClashes).toBe(originalJson);
    // Banner write lives after the clashes write in the same try block —
    // the throw must prevent it from ever running.
    expect(afterFail.persistedBanner).toBe(JSON.stringify(true));

    // Retry: mock disabled, migration re-runs and converges.
    await page.evaluate(() => { localStorage.setItem('__inv005MockActive', '0'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-101'));

    const afterRetry = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:reviewQueueDateGuardFixed'),
      persistedClashes: JSON.parse(localStorage.getItem('nw:clashes') || 'null'),
      persistedBanner: localStorage.getItem('nw:reviewQueueNoDateBanner'),
    }));
    expect(afterRetry.gate).toBe('1');
    const p101 = afterRetry.persistedClashes.find(c => c.uid === 'CLX-101');
    expect(p101.pendingReview).toBeUndefined();
    expect(p101.disappearedAt).toBeUndefined();
    expect(p101.disappearedInBatch).toBeUndefined();
    expect(afterRetry.persistedBanner).toBe(JSON.stringify(false));
  });

  test('success path: write succeeds — gate is set, storage (clashes + banner) updated, gate and storage stay synchronized', async ({ page }) => {
    await bootstrapFresh(page);
    const seedClashes = makeStaleClashes();

    await page.evaluate(({ clashes }) => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      localStorage.setItem('nw:clashes', JSON.stringify(clashes));
      localStorage.setItem('nw:reviewQueueNoDateBanner', JSON.stringify(true));
    }, { clashes: seedClashes });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.clashes.some(c => c.uid === 'CLX-101'));

    const after = await page.evaluate(() => ({
      gate: localStorage.getItem('nw:reviewQueueDateGuardFixed'),
      persistedClashes: JSON.parse(localStorage.getItem('nw:clashes') || 'null'),
      persistedBanner: localStorage.getItem('nw:reviewQueueNoDateBanner'),
      inMemoryBanner: S.reviewQueueNoDateBanner,
      inMemory101: S.clashes.find(c => c.uid === 'CLX-101'),
    }));
    expect(after.gate).toBe('1');
    const p101 = after.persistedClashes.find(c => c.uid === 'CLX-101');
    expect(p101.pendingReview).toBeUndefined();
    expect(p101.disappearedAt).toBeUndefined();
    expect(p101.disappearedInBatch).toBeUndefined();
    expect(after.persistedBanner).toBe(JSON.stringify(false));
    // In-memory and persisted state agree on both the register and the banner.
    expect(after.inMemoryBanner).toBe(false);
    expect(after.inMemory101.pendingReview).toBeUndefined();
    expect(after.inMemory101.disappearedAt).toBeUndefined();
  });
});
