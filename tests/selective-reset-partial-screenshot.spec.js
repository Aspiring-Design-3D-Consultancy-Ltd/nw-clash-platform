import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

test('capture: Selective Reset modal with images ticked, plans unticked (the state under test)', async ({ page }) => {
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
  await page.evaluate(async () => {
    await idbPut(0, { count: 2, loadedAt: Date.now() });
    await idbPut(1, 'BLOB-A');
    await idbPut(2, 'BLOB-B');
    selectiveReset();
    const cbi = document.querySelector('#selective-reset-modal input[data-cat="images"]');
    const cbp = document.querySelector('#selective-reset-modal input[data-cat="plans"]');
    if (cbi) cbi.checked = true;
    if (cbp) cbp.checked = false;
  });
  // Once the reset fires, location.reload() detaches the page context and
  // screenshots after that point race the navigation. The modal in this
  // exact state is the deliverable — success is verified by the other spec.
  await page.screenshot({
    path: path.resolve(__dirname, '..', 'selective-reset-partial-modal.png'),
    fullPage: false,
  });
});
