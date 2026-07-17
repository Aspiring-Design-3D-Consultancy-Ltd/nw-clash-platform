import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* CLEAR-ALL-IDB-NONBLOCKING contract:
   1. On timeout, clearAll() no longer aborts — the alert fires and the
      page reloads regardless of whether IDB completed.
   2. On timeout, nw:pendingIdbWipe is left set so initNwImages can
      retry the delete on next launch.
   3. On success, nw:pendingIdbWipe is cleared.
   The reload is what the pre-fix bug stranded users away from — the
   test's alert-throws-block pattern mirrors what happened in reality
   before we blocked the reload artificially (the alert was the last
   thing the user saw, then location.reload replaced the DOM). */
test.describe('CLEAR-ALL-IDB-NONBLOCKING — reload-always contract', () => {
  test.beforeEach(async ({ page }) => {
    // Prime localStorage BEFORE any of the page's own scripts run so
    // initAuth's demo-install branch (savedVer!==DATA_VERSION at L1067)
    // never fires. This avoids two flaky sources: (a) initAuth's async
    // migration functions (STATUS-HIST, DEDUP-INCIDENT, etc.) writing
    // the in-memory demo array back to localStorage mid-test, and (b)
    // initNwImages racing the test body to clear nw:pendingIdbWipe.
    await page.addInitScript(() => {
      localStorage.setItem('nw:dataVersion', JSON.stringify('v4-correct-dates-jan25'));
      localStorage.setItem('nw:clashes', '[]');
      localStorage.setItem('nw:weekly', '[]');
    });
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof clearAll === 'function' && typeof _wipeIdbWithVerify === 'function' && Array.isArray(S.clashes) && S.clashes.length === 0);
    // Let initNwImages settle past its PENDING-IDB-WIPE-SWEEP so the
    // test body's setItem('nw:pendingIdbWipe','1') isn't cleared out
    // from under it.
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
    await page.evaluate(() => {
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
      _ROLE = 'admin';
    });
  });

  test('clearAll reaches the alert + reload even when IDB wipe hangs past the 3s ceiling', async ({ page }) => {
    // Stub _wipeIdbWithVerify with a promise that never resolves so the
    // 3s race timeout is the only thing that can settle the flow.
    // Then confirm we still hit the terminal alert + location.reload.
    await page.evaluate(() => {
      window._wipeIdbWithVerify = () => new Promise(() => {});
      window.confirm = () => true;
      window._postAlertSnapshot = null;
      window.alert = () => {
        window._postAlertSnapshot = {
          clashes: localStorage.getItem('nw:clashes'),
          weekly: localStorage.getItem('nw:weekly'),
          dataVersion: localStorage.getItem('nw:dataVersion'),
          pendingIdbWipe: localStorage.getItem('nw:pendingIdbWipe'),
        };
        throw new Error('__test_block_reload__');
      };
    });
    const t0 = Date.now();
    await page.evaluate(async () => {
      try { await clearAll(); }
      catch (e) { if (!/__test_block_reload__/.test(e.message)) throw e; }
    });
    const elapsed = Date.now() - t0;

    // Must have alerted (reached the reload path).
    const snap = await page.evaluate(() => window._postAlertSnapshot);
    expect(snap).not.toBeNull();
    // Whitelist wipe + belt-and-braces empty arrays already persisted.
    expect(snap.clashes).toBe('[]');
    expect(snap.weekly).toBe('[]');
    expect(snap.dataVersion).not.toBeNull();
    // Pending flag left set for initNwImages to retry.
    expect(snap.pendingIdbWipe).toBe('1');
    // 3s ceiling honored (allow some slack for JS runtime).
    expect(elapsed).toBeGreaterThanOrEqual(2800);
    expect(elapsed).toBeLessThan(6000);
  });

  test('clearAll clears the pending flag when IDB wipe resolves within the ceiling', async ({ page }) => {
    await page.evaluate(() => {
      // Fast-resolving stub.
      window._wipeIdbWithVerify = () => Promise.resolve();
      window.confirm = () => true;
      window._postAlertSnapshot = null;
      window.alert = () => {
        window._postAlertSnapshot = {
          pendingIdbWipe: localStorage.getItem('nw:pendingIdbWipe'),
        };
        throw new Error('__test_block_reload__');
      };
    });
    await page.evaluate(async () => {
      try { await clearAll(); }
      catch (e) { if (!/__test_block_reload__/.test(e.message)) throw e; }
    });
    const snap = await page.evaluate(() => window._postAlertSnapshot);
    expect(snap).not.toBeNull();
    // Flag was set then cleared inside the try block.
    expect(snap.pendingIdbWipe).toBeNull();
  });
});

/* PENDING-IDB-WIPE-SWEEP contract:
   Launch with nw:pendingIdbWipe='1' → initNwImages runs deleteDatabase
   and clears the flag. Runs before initNwImages opens its own idbGet
   connection so the delete has the best chance of succeeding. */
test.describe('PENDING-IDB-WIPE-SWEEP — retries deferred delete at launch', () => {
  test('nw:pendingIdbWipe is cleared after initNwImages runs', async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined');
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      localStorage.setItem('nw:pendingIdbWipe', '1');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    // Wait for the flag to have been cleared by the sweep. Since
    // initNwImages runs on window.onload, the sweep completes within
    // a few hundred ms even when the delete blocks (2s ceiling).
    await page.waitForFunction(
      () => localStorage.getItem('nw:pendingIdbWipe') === null,
      { timeout: 5000 }
    );
    const stillPresent = await page.evaluate(() => localStorage.getItem('nw:pendingIdbWipe'));
    expect(stillPresent).toBeNull();
  });
});
