import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  // INV-007: wait for the terminal inline one-shot migration gate so
  // window.onload's setTimeout(1500/1600)-deferred migrations don't
  // race and silently overwrite this test's seeded state.
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
}

// Seed IndexedDB with a couple of image blobs + a meta record so we can
// prove the wipe removed them. Uses the app's exposed idbPut helper.
async function seedIdb(page) {
  await page.evaluate(async () => {
    await idbPut(0, { shape: 'imgfix-v1', count: 2, loadedAt: Date.now(),
                      byTest: { 'GhostTest': { firstIdx: 1, count: 2, filenames: ['a.jpg','b.jpg'] } } });
    await idbPut(1, 'GHOST-BLOB-A');
    await idbPut(2, 'GHOST-BLOB-B');
  });
}

async function idbKeysAfter(page) {
  // Fresh open through a raw IDB request so we don't depend on the app's
  // shared _idb helper (which may hold a stale reference across a
  // deleteDatabase call). onupgradeneeded re-creates the empty store; we
  // then read getAllKeys off it.
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('NWClashImages');
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
      if (!db.objectStoreNames.contains('plans')) db.createObjectStore('plans');
    };
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('images')) { db.close(); resolve([]); return; }
      const tx = db.transaction('images', 'readonly');
      const kreq = tx.objectStore('images').getAllKeys();
      kreq.onsuccess = () => { db.close(); resolve(kreq.result || []); };
      kreq.onerror = () => { db.close(); reject(kreq.error); };
    };
    req.onerror = () => reject(req.error);
  }));
}

test.describe('WIPE-VERIFY', () => {
  test('happy path: _wipeAllStorage deletes NWClashImages, verify returns empty', async ({ page }) => {
    await bootstrap(page);
    await seedIdb(page);
    // Sanity: seeded keys are present before the wipe.
    const before = await idbKeysAfter(page);
    expect(before.length).toBeGreaterThan(0);

    // Drive the wipe directly (bypasses the three confirm() prompts).
    await page.evaluate(() => _wipeAllStorage(true));

    // Verify: getAllKeys() returns [] (or the store is empty of leaked
    // ghosts — a fresh open after deleteDatabase re-creates the store
    // via onupgradeneeded but the object stores are empty).
    const after = await idbKeysAfter(page);
    expect(after).toEqual([]);
  });

  test('failure path: _deleteIdbDatabase rejects when indexedDB.deleteDatabase throws', async ({ page }) => {
    await bootstrap(page);
    // Force deleteDatabase to always throw synchronously — mirrors the
    // "database still locked from a stale connection" case that used to
    // reach the silent 3-second resolve.
    const result = await page.evaluate(async () => {
      const origDelete = indexedDB.deleteDatabase.bind(indexedDB);
      indexedDB.deleteDatabase = () => { throw new Error('SYNTHETIC_DELETE_FAILURE'); };
      try {
        await _deleteIdbDatabase('NWClashImages', 500);
        return { rejected: false };
      } catch (e) {
        return { rejected: true, message: e.message };
      } finally {
        indexedDB.deleteDatabase = origDelete;
      }
    });
    expect(result.rejected).toBe(true);
    expect(result.message).toContain('SYNTHETIC_DELETE_FAILURE');
  });

  test('failure path: _wipeAllStorage throws when the full-wipe helper rejects twice', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      const origDelete = indexedDB.deleteDatabase.bind(indexedDB);
      let calls = 0;
      indexedDB.deleteDatabase = () => {
        calls++;
        throw new Error('SYNTH_FAILURE_' + calls);
      };
      try {
        await _wipeAllStorage(true);
        return { threw: false, calls };
      } catch (e) {
        return { threw: true, message: e.message, calls };
      } finally {
        indexedDB.deleteDatabase = origDelete;
      }
    });
    expect(result.threw).toBe(true);
    // Retry once means deleteDatabase was invoked twice by the helper.
    expect(result.calls).toBe(2);
    expect(result.message).toContain('IndexedDB wipe failed after retry');
  });

  test('factoryReset alerts and aborts the reload when the wipe throws', async ({ page }) => {
    await bootstrap(page);
    // Accept the three confirms in order; capture every alert message
    // so we can assert the specific "Factory reset FAILED" copy fired.
    const alertMessages = [];
    page.on('dialog', async d => {
      if (d.type() === 'alert') alertMessages.push(d.message());
      await d.accept();
    });

    // Wrap location.reload in a page-side spy — we don't need to stop it
    // (Playwright's headless page survives a location.reload back to the
    // same file:// URL), we just need to observe that it wasn't invoked.
    await page.evaluate(() => {
      window.__reloadCalls = 0;
      const orig = location.reload.bind(location);
      // Not all browsers let us defineProperty on location.reload; wrap
      // via a getter on the Location prototype if writable, else patch
      // window.factoryReset to route through a shim after alert.
      try {
        Location.prototype.reload = function () { window.__reloadCalls++; };
      } catch (_e) {
        // Fall through: rely on the alert assertion only.
      }
    });

    const result = await page.evaluate(async () => {
      const origDelete = indexedDB.deleteDatabase.bind(indexedDB);
      indexedDB.deleteDatabase = () => { throw new Error('SYNTHETIC_FAILURE'); };
      try {
        await factoryReset();
        return { ok: true, reloadCalls: window.__reloadCalls };
      } finally {
        indexedDB.deleteDatabase = origDelete;
      }
    });
    expect(result.ok).toBe(true);
    // Reload never called — user has to acknowledge the failure alert and
    // fix the underlying IDB state before trying again.
    expect(result.reloadCalls).toBe(0);
    const failureAlert = alertMessages.find(m => /Factory reset FAILED/.test(m));
    expect(failureAlert).toBeDefined();
    expect(failureAlert).toMatch(/SYNTHETIC_FAILURE|IndexedDB wipe failed/);
  });
});
