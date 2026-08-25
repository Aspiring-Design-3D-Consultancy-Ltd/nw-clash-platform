import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Minimal real-shape Clash Detective XML — one clashresult per test, enough
// for bparse() to populate _bcfC so the batch loop reaches the register write.
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

// Drive importFolderPick over three tests with importToRegister() rigged to
// throw on the second, capturing every toast and the resulting register.
async function runBatchWithFailingTest(page) {
  return page.evaluate(async (xmlBodies) => {
    const mk = (name, dir, body) => {
      const f = new File([body], name + '.xml', { type: 'text/xml' });
      Object.defineProperty(f, 'webkitRelativePath', { value: dir + '/' + name + '.xml' });
      return f;
    };
    const files = [
      mk('T1', 'week-260701/CUP arch', xmlBodies.T1),
      mk('T2', 'week-260701/CUP arch', xmlBodies.T2),
      mk('T3', 'week-260701/FAB arch', xmlBodies.T3),
    ];
    const toasts = [];
    const realToast = window.showToast;
    window.showToast = (m) => { toasts.push(String(m)); };
    window.confirm = () => true;

    const realImport = window.importToRegister;
    let calls = 0;
    window.importToRegister = function (mode) {
      calls++;
      if (calls === 2) throw new Error('simulated merge failure');
      return realImport.call(this, mode);
    };

    try {
      await window.importFolderPick({ files, value: '' });
    } finally {
      window.showToast = realToast;
      window.importToRegister = realImport;
    }
    return {
      toasts,
      clashCount: S.clashes.length,
      tests: [...new Set(S.clashes.map(c => c.testName))],
    };
  }, { T1: makeXml('T1'), T2: makeXml('T2'), T3: makeXml('T3') });
}

test.describe('BATCH-IMPORT-FAILURE-GUARD', () => {
  test('a throwing register write costs one test, not the rest of the batch', async ({ page }) => {
    await bootstrap(page);
    const r = await runBatchWithFailingTest(page);

    // T1 and T3 still land; only the rigged T2 is lost.
    expect(r.clashCount).toBe(2);
    expect(r.tests.some(t => t.startsWith('T1'))).toBe(true);
    expect(r.tests.some(t => t.startsWith('T3'))).toBe(true);
    expect(r.tests.some(t => t.startsWith('T2'))).toBe(false);
  });

  test('the failing test is named in a user-visible toast', async ({ page }) => {
    await bootstrap(page);
    const r = await runBatchWithFailingTest(page);
    const warn = r.toasts.find(t => t.includes('"T2" failed to import'));
    expect(warn, `no failure toast in: ${JSON.stringify(r.toasts)}`).toBeTruthy();
    expect(warn).toContain('simulated merge failure');
  });

  test('the closing summary does not count clashes that never reached the register', async ({ page }) => {
    await bootstrap(page);
    const r = await runBatchWithFailingTest(page);
    // Pre-guard, totalClashesImported was incremented before the write, so a
    // throw left the summary claiming 3 clashes against 2 completed tests.
    const summary = r.toasts.find(t => t.includes('Imported'));
    expect(summary, `no summary toast in: ${JSON.stringify(r.toasts)}`).toBeTruthy();
    expect(summary).toContain('2 of 3 clash tests');
    expect(summary).toContain('(2 clashes total)');
  });

  test('logs the failure under the [BATCH-STORAGE-FULL] tag', async ({ page }) => {
    const logs = [];
    page.on('console', m => logs.push(m.text()));
    await bootstrap(page);
    await runBatchWithFailingTest(page);
    const line = logs.find(l => l.includes('[BATCH-STORAGE-FULL]'));
    expect(line, 'no [BATCH-STORAGE-FULL] console line').toBeTruthy();
    expect(line).toContain('T2');
    expect(line).toContain('simulated merge failure');
  });
});
