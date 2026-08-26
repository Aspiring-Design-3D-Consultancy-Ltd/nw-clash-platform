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

  /* INV-008 regression coverage start. Root cause: openIDB() had a
     check-then-act race on the module-level _idb singleton — two
     concurrent callers (e.g. initNwImages()/initPlans() on window.onload)
     could both see _idb as falsy and each issue their own
     indexedDB.open(), producing an orphaned second connection whose own
     onversionchange handler closed over the shared _idb variable instead
     of itself and therefore never self-closed. Remediated with Option A
     (cache the in-flight openIDB() promise so concurrent callers share
     one indexedDB.open() request) and Option B (the onversionchange
     handler now closes its own captured connection and only nulls _idb
     if _idb still aliases that exact connection). */
  test('concurrent openIDB() callers de-duplicate into a single indexedDB.open() call and share one connection (INV-008 Option A)', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      _closeSharedIdb();
      const orig = indexedDB.open.bind(indexedDB);
      let openCalls = 0;
      indexedDB.open = (name, ver) => { openCalls++; return orig(name, ver); };
      const [dbA, dbB] = await Promise.all([openIDB(), openIDB()]);
      indexedDB.open = orig;
      return { openCalls, sameConnection: dbA === dbB };
    });
    expect(result.openCalls).toBe(1);
    expect(result.sameConnection).toBe(true);
  });

  test('an orphaned connection\'s own onversionchange handler closes only itself, leaving a different active _idb untouched (INV-008 Option B)', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      const dbA = await openIDB();
      // Manufacture the pre-Option-A race shape directly: reset the
      // singleton bookkeeping WITHOUT closing dbA, so dbA becomes a
      // genuinely orphaned (still open, unreferenced) connection — this
      // reproduces the exact defect scenario from the investigation
      // (two live connections, _idb able to alias only one of them).
      _idb = null;
      _idbOpenPromise = null;
      const dbB = await openIDB();
      const distinctConnections = dbA !== dbB;
      let aCloseCalled = false, bCloseCalled = false;
      const realCloseA = dbA.close.bind(dbA);
      const realCloseB = dbB.close.bind(dbB);
      dbA.close = () => { aCloseCalled = true; realCloseA(); };
      dbB.close = () => { bCloseCalled = true; realCloseB(); };
      // Fire dbA's own onversionchange handler — the orphan scenario:
      // dbA is superseded, but its handler must still close ITS OWN
      // connection without disturbing the currently active dbB.
      dbA.onversionchange();
      return {
        distinctConnections,
        aCloseCalled,
        bCloseCalled,
        idbStillAliasesB: _idb === dbB,
      };
    });
    expect(result.distinctConnections).toBe(true);
    expect(result.aCloseCalled).toBe(true);
    expect(result.bCloseCalled).toBe(false);
    expect(result.idbStillAliasesB).toBe(true);
  });

  test('openIDB() clears the cached in-flight promise when the open request errors, allowing a fresh retry to succeed', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      _closeSharedIdb();
      const orig = indexedDB.open.bind(indexedDB);
      let calls = 0;
      indexedDB.open = (name, ver) => {
        calls++;
        if (calls === 1) {
          const req = { onerror: null, onsuccess: null, onupgradeneeded: null };
          setTimeout(() => {
            try { req.onerror && req.onerror({ target: { error: new Error('SYNTHETIC_OPEN_FAILURE') } }); } catch (_) {}
          }, 5);
          return req;
        }
        return orig(name, ver);
      };
      let firstError = null;
      try { await openIDB(); } catch (e) { firstError = e.message; }
      const promiseClearedAfterFailure = _idbOpenPromise === null;
      let secondSucceeded = false, secondError = null;
      try { secondSucceeded = !!(await openIDB()); } catch (e) { secondError = e.message; }
      indexedDB.open = orig;
      return { calls, firstError, promiseClearedAfterFailure, secondSucceeded, secondError };
    });
    expect(result.calls).toBe(2);
    expect(result.firstError).toBe('SYNTHETIC_OPEN_FAILURE');
    expect(result.promiseClearedAfterFailure).toBe(true);
    expect(result.secondSucceeded).toBe(true);
    expect(result.secondError).toBeNull();
  });

  test('_closeSharedIdb() clears the cached in-flight openIDB() promise, not just _idb', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      await idbPut(1, 'seed'); // ensure the singleton is populated
      const preIdb = !!_idb;
      _closeSharedIdb();
      return {
        preIdb,
        idbNulledAfterClose: _idb === null,
        promiseNulledAfterClose: _idbOpenPromise === null,
      };
    });
    expect(result.preIdb).toBe(true);
    expect(result.idbNulledAfterClose).toBe(true);
    expect(result.promiseNulledAfterClose).toBe(true);
  });
  /* INV-008 regression coverage end */

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
    // Schema version moves with the DB (v3 since IDB-RECORDS-MIGRATION); the
    // signature under test is 'reopened with the schema still present'.
    expect(result.error).toMatch(/DB reopened at version \d+ with stores \[/);
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

test.describe('SELECTIVE-RESET-IDB-CLOSE — partial-clear timeout parity', () => {
  test('_clearIdbStores default timeout is 15000ms (not 3000ms)', async ({ page }) => {
    await bootstrap(page);
    const info = await page.evaluate(() => {
      // Stub indexedDB.open — the request opens "successfully" but the tx
      // never completes. If the default ceiling is still 3s, the promise
      // rejects within 4s; if bumped to 15s, it stays pending past 4s.
      const orig = indexedDB.open.bind(indexedDB);
      indexedDB.open = () => {
        const req = { onerror: null, onsuccess: null, onupgradeneeded: null, result: null };
        setTimeout(() => {
          req.result = {
            objectStoreNames: { contains: () => true },
            transaction: () => ({
              objectStore: () => ({ clear: () => ({}) }),
              oncomplete: null, onerror: null, onabort: null,
            }),
            close: () => {},
          };
          try { req.onsuccess && req.onsuccess(); } catch (_) {}
        }, 5);
        return req;
      };
      let resolved = 0, rejectedMsg = null;
      _clearIdbStores('NWClashImages', ['images'])
        .then(() => { resolved = 1; })
        .catch(e => { rejectedMsg = e.message; });
      return new Promise(r => setTimeout(() => {
        r({ resolved, rejectedMsg });
        indexedDB.open = orig;
      }, 4000));
    });
    expect(info.resolved).toBe(0);
    // Would-fire message: "clear timeout after 3000ms" — must NOT appear.
    expect(info.rejectedMsg).toBeNull();
  });

  test('_clearIdbStores timeout message names the ceiling that fired', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      const orig = indexedDB.open.bind(indexedDB);
      indexedDB.open = () => ({ onerror: null, onsuccess: null, onupgradeneeded: null });
      try {
        await _clearIdbStores('NWClashImages', ['images'], 100);
        return { rejected: false };
      } catch (e) {
        return { rejected: true, message: e.message };
      } finally {
        indexedDB.open = orig;
      }
    });
    expect(result.rejected).toBe(true);
    expect(result.message).toMatch(/clear timeout after 100ms/);
  });

  test('_wipeIdbWithVerify("partial") completes when the clear tx takes ~5s (would fail with old 3s ceiling)', async ({ page }) => {
    test.setTimeout(20_000);
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      await idbPut(1, 'BLOB-A');
      await idbPut(2, 'BLOB-B');
      // Wrap indexedDB.open so the returned tx delays oncomplete by ~5s.
      const orig = indexedDB.open.bind(indexedDB);
      indexedDB.open = (name, ver) => {
        const req = orig(name, ver);
        req.addEventListener('success', () => {
          const db = req.result;
          const origTx = db.transaction.bind(db);
          db.transaction = (stores, mode) => {
            const tx = origTx(stores, mode);
            // Delay whichever completion fires — swap oncomplete setter.
            const origOnComplete = Object.getOwnPropertyDescriptor(
              IDBTransaction.prototype, 'oncomplete'
            );
            let userComplete = null;
            Object.defineProperty(tx, 'oncomplete', {
              get() { return userComplete; },
              set(fn) {
                userComplete = fn;
                // Intercept native complete event and delay 5s.
                tx.addEventListener('complete', () => {
                  setTimeout(() => { try { fn && fn(); } catch (_) {} }, 5000);
                }, { once: true });
              },
            });
            return tx;
          };
        }, { once: true });
        return req;
      };
      const t0 = performance.now();
      let threw = null;
      try {
        await _wipeIdbWithVerify('partial', ['images']);
      } catch (e) { threw = e.message; }
      const elapsed = performance.now() - t0;
      indexedDB.open = orig;
      return { threw, elapsed };
    });
    expect(result.threw).toBeNull();
    // ~5s delay + verify — well over 3s (old ceiling would have thrown), well under 15s.
    expect(result.elapsed).toBeGreaterThan(4500);
    expect(result.elapsed).toBeLessThan(15_000);
  });

  test('_verifyIdbEmpty succeeds within the 5000ms default used by _wipeIdbWithVerify', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      // DB freshly opened, empty images store. verify should return ok.
      await _deleteIdbDatabase('NWClashImages', 15000);
      const t0 = performance.now();
      const check = await _verifyIdbEmpty('NWClashImages', ['images', 'plans'], 5000);
      return { ok: check.ok, elapsed: performance.now() - t0 };
    });
    expect(result.ok).toBe(true);
    expect(result.elapsed).toBeLessThan(5000);
  });

  test('selective reset with ONLY images ticked routes through the partial path and reloads without error', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      const alerts = [];
      window.alert = m => alerts.push(String(m));
      window.confirm = () => true;
      try { Location.prototype.reload = function () {}; } catch (_) {}
      // Track which wipe branch is taken by wrapping _clearIdbStores.
      const origClear = _clearIdbStores;
      let partialCalled = 0, partialTimeoutArg = null;
      window._clearIdbStores = (name, stores, tmo) => {
        partialCalled++; partialTimeoutArg = tmo;
        return origClear(name, stores, tmo);
      };
      // Also track _deleteIdbDatabase to prove the atomic path was NOT used.
      const origDel = _deleteIdbDatabase;
      let atomicCalled = 0;
      window._deleteIdbDatabase = (name, tmo) => {
        atomicCalled++;
        return origDel(name, tmo);
      };
      await idbPut(0, { count: 2, loadedAt: Date.now() });
      await idbPut(1, 'BLOB-A');
      await idbPut(2, 'BLOB-B');
      selectiveReset();
      const cats = _selectiveResetCategories();
      const cbi = document.querySelector('#selective-reset-modal input[data-cat="images"]');
      const cbp = document.querySelector('#selective-reset-modal input[data-cat="plans"]');
      if (cbi) cbi.checked = true;
      if (cbp) cbp.checked = false;
      let threw = null;
      try {
        await _executeSelectiveReset(cats, 'selective-reset-modal');
      } catch (e) { threw = e.message; }
      window._clearIdbStores = origClear;
      window._deleteIdbDatabase = origDel;
      return { alerts, threw, partialCalled, atomicCalled, partialTimeoutArg };
    });
    expect(result.threw).toBeNull();
    expect(result.partialCalled).toBeGreaterThan(0);
    expect(result.atomicCalled).toBe(0);
    expect(result.partialTimeoutArg).toBe(15000);
    expect(result.alerts.some(m => /Selective reset complete/i.test(m))).toBe(true);
    expect(result.alerts.some(m => /Selective reset FAILED/i.test(m))).toBe(false);
  });

  test('regression: selective reset with BOTH images AND plans ticked still routes through atomic delete', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      const alerts = [];
      window.alert = m => alerts.push(String(m));
      window.confirm = () => true;
      try { Location.prototype.reload = function () {}; } catch (_) {}
      const origDel = _deleteIdbDatabase;
      let atomicCalled = 0, atomicTimeoutArg = null;
      window._deleteIdbDatabase = (name, tmo) => {
        atomicCalled++; atomicTimeoutArg = tmo;
        return origDel(name, tmo);
      };
      const origClear = _clearIdbStores;
      let partialCalled = 0;
      window._clearIdbStores = (name, stores, tmo) => {
        partialCalled++;
        return origClear(name, stores, tmo);
      };
      await idbPut(1, 'seed');
      selectiveReset();
      const cats = _selectiveResetCategories();
      const cbi = document.querySelector('#selective-reset-modal input[data-cat="images"]');
      const cbp = document.querySelector('#selective-reset-modal input[data-cat="plans"]');
      if (cbi) cbi.checked = true;
      if (cbp) cbp.checked = true;
      let threw = null;
      try {
        await _executeSelectiveReset(cats, 'selective-reset-modal');
      } catch (e) { threw = e.message; }
      window._deleteIdbDatabase = origDel;
      window._clearIdbStores = origClear;
      return { alerts, threw, atomicCalled, partialCalled, atomicTimeoutArg };
    });
    expect(result.threw).toBeNull();
    expect(result.atomicCalled).toBeGreaterThan(0);
    expect(result.partialCalled).toBe(0);
    expect(result.atomicTimeoutArg).toBe(15000);
    expect(result.alerts.some(m => /Selective reset complete/i.test(m))).toBe(true);
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
        const req = indexedDB.open('NWClashImages');
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
