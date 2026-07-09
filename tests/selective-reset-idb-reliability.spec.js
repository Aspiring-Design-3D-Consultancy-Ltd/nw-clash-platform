import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
}

test.describe('SELECTIVE-RESET-IDB-CLOSE', () => {
  test('openIDB installs onversionchange handler that closes the singleton and nulls the module ref', async ({ page }) => {
    await bootstrap(page);
    const state = await page.evaluate(async () => {
      // Open the singleton via the app path.
      await idbPut(1, 'hello');
      const preHandlerInstalled = !!(_idb && typeof _idb.onversionchange === 'function');
      // Direct-fire the handler — this is what Chromium would call when
      // a peer connection triggers a versionchange event. We don't rely
      // on a real peer open request because racing that is flaky in
      // headless (open-blocked-close cycles land in different orders).
      let closeCalled = false;
      const realClose = _idb.close.bind(_idb);
      _idb.close = () => { closeCalled = true; realClose(); };
      _idb.onversionchange();
      return {
        preHandlerInstalled,
        closeCalled,
        idbNulled: _idb === null,
      };
    });
    expect(state.preHandlerInstalled).toBe(true);
    expect(state.closeCalled).toBe(true);
    expect(state.idbNulled).toBe(true);
  });

  test('_deleteIdbDatabase default timeout is 15000ms (not 3000ms)', async ({ page }) => {
    await bootstrap(page);
    const info = await page.evaluate(() => {
      // Replace deleteDatabase with a stub that never fires success/error
      // and never fires blocked. The promise should stay pending — we
      // race it against a 4-second timer and expect the delete's own
      // timeout NOT to have fired by then (proving the ceiling is >>3s).
      const orig = indexedDB.deleteDatabase.bind(indexedDB);
      let started = 0, resolved = 0, rejectedMsg = null;
      indexedDB.deleteDatabase = () => {
        started++;
        // Return a request whose handlers never fire.
        return { onerror: null, onsuccess: null, onblocked: null };
      };
      const p = _deleteIdbDatabase('NWClashImages')
        .then(() => { resolved = 1; })
        .catch(e => { rejectedMsg = e.message; });
      // Wait 4 seconds — the OLD 3000ms ceiling would have rejected by
      // now; the new 15000ms ceiling will not.
      return new Promise(r => setTimeout(() => {
        r({ started, resolved, rejectedMsg });
        indexedDB.deleteDatabase = orig;
      }, 4000));
    });
    expect(info.started).toBe(1);
    expect(info.resolved).toBe(0);
    // If rejectedMsg is set, timeout fired within 4s → default is still ≤4s.
    expect(info.rejectedMsg).toBeNull();
  });

  test('_deleteIdbDatabase timeout message names "another connection" when onblocked fired', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      const orig = indexedDB.deleteDatabase.bind(indexedDB);
      indexedDB.deleteDatabase = () => {
        // Never settle — but fire onblocked once the caller wires it.
        const stub = { onerror: null, onsuccess: null, onblocked: null };
        // Fire onblocked next microtask.
        setTimeout(() => { try { stub.onblocked && stub.onblocked(); } catch (_) {} }, 10);
        return stub;
      };
      try {
        await _deleteIdbDatabase('NWClashImages', 200);
        return { rejected: false };
      } catch (e) {
        return { rejected: true, message: e.message };
      } finally {
        indexedDB.deleteDatabase = orig;
      }
    });
    expect(result.rejected).toBe(true);
    expect(result.message).toMatch(/blocked by another connection/i);
    expect(result.message).toMatch(/Close every other browser tab/i);
  });

  test('_deleteIdbDatabase timeout without onblocked keeps the plain timeout message', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      const orig = indexedDB.deleteDatabase.bind(indexedDB);
      indexedDB.deleteDatabase = () => ({ onerror: null, onsuccess: null, onblocked: null });
      try {
        await _deleteIdbDatabase('NWClashImages', 100);
        return { rejected: false };
      } catch (e) {
        return { rejected: true, message: e.message };
      } finally {
        indexedDB.deleteDatabase = orig;
      }
    });
    expect(result.rejected).toBe(true);
    expect(result.message).toMatch(/deleteDatabase timeout after 100ms/);
    expect(result.message).not.toMatch(/blocked by another connection/i);
  });

  test('failure-path backward-compat: legacy synthetic throw still rejects (regression guard)', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      const orig = indexedDB.deleteDatabase.bind(indexedDB);
      indexedDB.deleteDatabase = () => { throw new Error('SYNTHETIC_DELETE_FAILURE'); };
      try {
        await _deleteIdbDatabase('NWClashImages', 500);
        return { rejected: false };
      } catch (e) {
        return { rejected: true, message: e.message };
      } finally {
        indexedDB.deleteDatabase = orig;
      }
    });
    expect(result.rejected).toBe(true);
    expect(result.message).toContain('SYNTHETIC_DELETE_FAILURE');
  });
});

test.describe('SELECTIVE-RESET-IDB-VERIFY', () => {
  test('_verifyIdbFreshVersion returns ok:true after a real deleteDatabase', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      await idbPut(0, { count: 2 });
      await idbPut(1, 'A');
      await _deleteIdbDatabase('NWClashImages', 15000);
      return _verifyIdbFreshVersion('NWClashImages', 2000);
    });
    expect(result.ok).toBe(true);
  });

  test('_verifyIdbFreshVersion returns ok:false when the schema still exists (silent-fail signature)', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      // Seed a real DB at v2 with the schema — same shape as post-openIDB.
      await idbPut(1, 'sim');
      _closeSharedIdb();
      // Do NOT deleteDatabase — verify should observe the v2 schema and
      // flag it as a silent-fail signature.
      return _verifyIdbFreshVersion('NWClashImages', 2000);
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/version 2/);
    expect(result.error).toMatch(/silently failed/);
  });

  test('_wipeIdbWithVerify("full") retries once when the first delete stub is a no-op', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      await idbPut(1, 'seed');
      const orig = indexedDB.deleteDatabase.bind(indexedDB);
      let call = 0;
      indexedDB.deleteDatabase = (name) => {
        call++;
        if (call === 1) {
          // First attempt: pretend success, but don't actually delete.
          const stub = { onerror: null, onsuccess: null, onblocked: null };
          setTimeout(() => { try { stub.onsuccess && stub.onsuccess(); } catch (_) {} }, 5);
          return stub;
        }
        // Second attempt: real delete.
        return orig(name);
      };
      let err = null;
      try {
        await _wipeIdbWithVerify('full');
      } catch (e) { err = e.message; }
      indexedDB.deleteDatabase = orig;
      return { call, err };
    });
    expect(result.err).toBeNull();
    expect(result.call).toBe(2);
  });

  test('_wipeIdbWithVerify("full") throws after two consecutive silent-fails', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      await idbPut(1, 'seed');
      const orig = indexedDB.deleteDatabase.bind(indexedDB);
      let call = 0;
      indexedDB.deleteDatabase = () => {
        call++;
        const stub = { onerror: null, onsuccess: null, onblocked: null };
        setTimeout(() => { try { stub.onsuccess && stub.onsuccess(); } catch (_) {} }, 5);
        return stub; // never actually deletes — both attempts silent-fail
      };
      let err = null;
      try { await _wipeIdbWithVerify('full'); }
      catch (e) { err = e.message; }
      indexedDB.deleteDatabase = orig;
      // Clean up: really delete now so subsequent tests get a fresh DB.
      await new Promise(res => {
        const r = indexedDB.deleteDatabase('NWClashImages');
        r.onsuccess = r.onerror = r.onblocked = () => res();
      });
      return { call, err };
    });
    expect(result.call).toBe(2);
    expect(result.err).toMatch(/wipe verify failed/i);
    expect(result.err).toMatch(/silently failed/i);
  });
});

test.describe('SELECTIVE-RESET wiring — end-to-end with images ticked', () => {
  test('selective reset with NW images ticked runs to completion, seeded IDB is verified empty', async ({ page }) => {
    await bootstrap(page);
    // Snapshot inside the same evaluate as the reset — location.reload()
    // fires at the end of the wipe and detaches the page context, so any
    // second evaluate after the fact races the navigation. This mirrors
    // the pattern in selective-reset.spec.js.
    const result = await page.evaluate(async () => {
      const alerts = [];
      window.alert = m => alerts.push(String(m));
      window.confirm = () => true;
      try { Location.prototype.reload = function () {}; } catch (_) {}
      await idbPut(0, { count: 2, loadedAt: Date.now() });
      await idbPut(1, 'BLOB-A');
      await idbPut(2, 'BLOB-B');
      selectiveReset();
      const cats = _selectiveResetCategories();
      const cb = document.querySelector('#selective-reset-modal input[data-cat="images"]');
      if (cb) cb.checked = true;
      let threw = null;
      try {
        await _executeSelectiveReset(cats, 'selective-reset-modal');
      } catch (e) { threw = e.message; }
      // Verify empty inline — raw open, read getAllKeys, close.
      const keys = await new Promise((resolve, reject) => {
        const req = indexedDB.open('NWClashImages', 2);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
          if (!db.objectStoreNames.contains('plans')) db.createObjectStore('plans');
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('images', 'readonly');
          const kreq = tx.objectStore('images').getAllKeys();
          kreq.onsuccess = () => { db.close(); resolve(kreq.result || []); };
          kreq.onerror = () => { db.close(); reject(kreq.error); };
        };
        req.onerror = () => reject(req.error);
      });
      return { alerts, threw, keys };
    });
    expect(result.threw).toBeNull();
    expect(result.alerts.some(m => /Selective reset complete/i.test(m))).toBe(true);
    expect(result.alerts.some(m => /Selective reset FAILED/i.test(m))).toBe(false);
    expect(result.keys).toEqual([]);
  });

  test('selective-reset failure alert includes the "close all other tabs" guidance', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      const alerts = [];
      window.alert = m => alerts.push(String(m));
      window.confirm = () => true;
      try { Location.prototype.reload = function () {}; } catch (_) {}
      await idbPut(1, 'seed');
      // Ticking BOTH images and plans forces mode='full', which routes
      // through _deleteIdbDatabase — the mock synthetic throw catches
      // there. (Partial mode uses _clearIdbStores, which the throw
      // wouldn't touch.)
      const orig = indexedDB.deleteDatabase.bind(indexedDB);
      indexedDB.deleteDatabase = () => { throw new Error('SYNTHETIC_FAIL'); };
      try {
        selectiveReset();
        const cats = _selectiveResetCategories();
        const cbi = document.querySelector('#selective-reset-modal input[data-cat="images"]');
        const cbp = document.querySelector('#selective-reset-modal input[data-cat="plans"]');
        if (cbi) cbi.checked = true;
        if (cbp) cbp.checked = true;
        await _executeSelectiveReset(cats, 'selective-reset-modal');
      } finally {
        indexedDB.deleteDatabase = orig;
      }
      // Actually delete after the test so the DB comes back clean.
      await new Promise(res => {
        const r = indexedDB.deleteDatabase('NWClashImages');
        r.onsuccess = r.onerror = r.onblocked = () => res();
      });
      return alerts;
    });
    const failure = result.find(m => /Selective reset FAILED/i.test(m));
    expect(failure).toBeDefined();
    expect(failure).toMatch(/another browser tab has working\.html open/i);
    expect(failure).toMatch(/Close all other tabs with this file, then try again/i);
    // Success alert did NOT also fire.
    expect(result.some(m => /Selective reset complete/i.test(m))).toBe(false);
  });
});
