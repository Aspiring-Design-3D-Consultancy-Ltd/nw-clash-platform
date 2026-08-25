import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

function makeXml(testName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="${testName}">
      <clashresult name="${testName}-C1" distance="-0.02">
        <clashpoint><pos3f x="1" y="2" z="3"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="7" day="1" hour="10" minute="0" second="0"/></createddate>
        <clashobject><pathlink><node>ESMC.nwd</node><node>GAS.nwc</node></pathlink></clashobject>
        <clashobject><pathlink><node>ESMC.nwd</node><node>Structure.nwc</node></pathlink></clashobject>
      </clashresult>
    </clashtest>
  </batchtest>
</exchange>`;
}

const NAMES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    S.clashes = [];
    sv('clashes', S.clashes);
    nav('bcf');
  });
}

/**
 * Runs a 6-test folder import with sv('clashes') rigged to start rejecting at
 * the Nth write. `preFail` simulates a page where an UNRELATED write already
 * failed earlier in the session, before this batch began.
 * Counts real bparse() calls so "stopped early" means XMLs genuinely unparsed,
 * not merely unimported.
 */
async function runBatch(page, { failFromWrite, preFail = false }) {
  return page.evaluate(async ({ bodies, failFromWrite, preFail }) => {
    const files = bodies.map(({ name, body }) => {
      const f = new File([body], name + '.xml', { type: 'text/xml' });
      Object.defineProperty(f, 'webkitRelativePath', { value: 'week-260701/CUP arch/' + name + '.xml' });
      return f;
    });

    const toasts = [];
    const realToast = window.showToast;
    window.showToast = (m) => { toasts.push(String(m)); };
    window.confirm = () => true;

    if (preFail) { _svFailCount++; _svFailedKeys.add('unrelatedEarlierKey'); }

    const realSv = window.sv;
    let writes = 0;
    window.sv = function (k, v) {
      if (k === 'clashes') {
        writes++;
        if (writes >= failFromWrite) { _svFailCount++; _svFailedKeys.add(k); return false; }
      }
      return realSv.call(this, k, v);
    };

    let parsed = 0;
    const realBparse = window.bparse;
    window.bparse = function () { parsed++; return realBparse.apply(this, arguments); };

    try {
      await window.importFolderPick({ files, value: '' });
    } finally {
      window.showToast = realToast;
      window.sv = realSv;
      window.bparse = realBparse;
    }
    return { toasts, parsed, total: files.length };
  }, { bodies: NAMES.map(n => ({ name: n, body: makeXml(n) })), failFromWrite, preFail });
}

test.describe('BATCH-IMPORT-EARLY-STOP', () => {
  test('stops parsing the moment a write is rejected instead of grinding through the rest', async ({ page }) => {
    await bootstrap(page);
    const r = await runBatch(page, { failFromWrite: 3 });
    // The loop breaks at the top of the first iteration after a rejection, so
    // some tests import cleanly and the remainder are never read or parsed.
    // (importToRegister issues more than one sv('clashes') per test, so which
    // test the 3rd write lands in is an implementation detail — the invariant
    // under test is that the batch stops short, not where exactly.)
    expect(r.parsed).toBeGreaterThan(0);
    expect(r.parsed).toBeLessThan(r.total);
  });

  test('names the stopping point in a toast', async ({ page }) => {
    await bootstrap(page);
    const r = await runBatch(page, { failFromWrite: 3 });
    const stop = r.toasts.find(t => t.includes('Stopping batch'));
    expect(stop, `no stop toast in: ${JSON.stringify(r.toasts)}`).toBeTruthy();
    // The count the user is shown must be the number of tests actually parsed.
    expect(stop).toContain(`${r.parsed} of ${r.total} tests`);
  });

  test('logs the halt under the [BATCH-IMPORT-EARLY-STOP] tag', async ({ page }) => {
    const logs = [];
    page.on('console', m => logs.push(m.text()));
    await bootstrap(page);
    await runBatch(page, { failFromWrite: 3 });
    const line = logs.find(l => l.includes('[BATCH-IMPORT-EARLY-STOP]'));
    expect(line, 'no [BATCH-IMPORT-EARLY-STOP] console line').toBeTruthy();
    expect(line).toContain('Remaining tests were not parsed');
  });

  test('a write that failed BEFORE this batch does not abort it at 0 of N', async ({ page }) => {
    await bootstrap(page);
    // Regression guard for gating on `_svFailCount > 0` instead of on the
    // _svFailAtStart snapshot: _svFailCount is monotonic and never reset, so a
    // bare > 0 test would refuse every subsequent folder import for the rest of
    // the page's life — including the retry right after the user frees space.
    const r = await runBatch(page, { failFromWrite: 99, preFail: true });
    expect(r.parsed).toBe(r.total);
    expect(r.toasts.some(t => t.includes('Stopping batch'))).toBe(false);
    expect(r.toasts[r.toasts.length - 1]).toMatch(/^✓ Imported 6 of 6 clash tests/);
  });
});
