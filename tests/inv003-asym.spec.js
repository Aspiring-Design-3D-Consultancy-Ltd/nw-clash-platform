import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

test('INV-003: asymmetric write failure - large payload write fails but small gate-flag write succeeds, permanently skipping a one-shot migration', async ({ page }) => {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
  const result = await page.evaluate(() => {
    // Pair survives every retro-cleanup filter rule (different weekTags,
    // matching elementA/elementB) so the filtered queue written back to
    // storage is a non-trivial, non-empty JSON blob — large enough to
    // trip the mocked quota ceiling below.
    S.dedupQueue = [
      { dedupPairId: 'dq-1', a: 'A', b: 'B', distMm: 3, detectedAt: '2026-07-08T00:00:00Z', weekTag: 'w1' },
    ];
    S.clashes = [
      { uid: 'A', elementA: 'e1', elementB: 'e2', weekTag: 'w1' },
      { uid: 'B', elementA: 'e1', elementB: 'e2', weekTag: 'w2' },
    ];
    // Simulate a QuotaExceededError that only affects LARGE payload writes
    // (realistic: browser storage quota is near its ceiling, so the big
    // dedupQueue JSON blob fails but the tiny 'true' flag string succeeds).
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) {
      if (String(v).length > 50) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return origSetItem.call(this, k, v);
    };
    _migrateDedupQueueV1();
    Storage.prototype.setItem = origSetItem;
    return {
      gateNowPermanentlySet: localStorage.getItem('nw:dedupRetroCleanup:v1'),
      persistedQueue: localStorage.getItem('nw:dedupQueue'), // must remain untouched/null
      inMemoryQueueWasMutated: S.dedupQueue.length,
    };
  });
  // Fixed behaviour: the large queue write throws, the outer try/catch
  // in _migrateDedupQueueV1() swallows it, and — critically — the gate
  // is NEVER reached in that code path. Both S.dedupQueue (in-memory)
  // and nw:dedupQueue (persisted) remain at their pre-migration state,
  // and nw:dedupRetroCleanup:v1 stays unset so the migration safely
  // retries on the next load once the quota pressure clears.
  expect(result.gateNowPermanentlySet).toBeNull();
  expect(result.persistedQueue).toBeNull();
  expect(result.inMemoryQueueWasMutated).toBe(1);
});

test('INV-003 regression: when the persist succeeds, gate and stored queue stay in sync', async ({ page }) => {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
  const result = await page.evaluate(() => {
    S.dedupQueue = [
      { dedupPairId: 'dq-1', a: 'A', b: 'B', distMm: 3, detectedAt: '2026-07-08T00:00:00Z', weekTag: 'w1' },
    ];
    S.clashes = [
      { uid: 'A', elementA: 'e1', elementB: 'e2', weekTag: 'w1' },
      { uid: 'B', elementA: 'e1', elementB: 'e2', weekTag: 'w1' },
    ];
    _migrateDedupQueueV1();
    return {
      gate: localStorage.getItem('nw:dedupRetroCleanup:v1'),
      persistedQueue: JSON.parse(localStorage.getItem('nw:dedupQueue') || 'null'),
      inMemoryQueueLen: S.dedupQueue.length,
    };
  });
  // Same-weekTag pair is dropped by the retro-cleanup rules, the drop is
  // actually persisted, and only then is the gate set — no divergence.
  expect(result.gate).toBe('true');
  expect(result.persistedQueue).toEqual([]);
  expect(result.inMemoryQueueLen).toBe(0);
});
