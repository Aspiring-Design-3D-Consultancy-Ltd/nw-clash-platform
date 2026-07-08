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
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    nav('bcf');
  });
}

test.describe('BATCH-IMPORT-GUIDANCE', () => {
  test('guidance banner renders on the BCF import panel with the archives-root instruction', async ({ page }) => {
    await bootstrap(page);
    // The banner sits above the "Import Folder" button on the BCF panel.
    const banner = page.locator('text=Pick your archives root folder');
    await expect(banner).toBeVisible();
    // Body text mentions the wrong-pick failure mode.
    await expect(page.locator('body')).toContainText(/folder identity will be captured incorrectly/);
  });
});

test.describe('BATCH-IMPORT-SHAPE-WARN', () => {
  // Duck-typed File-like — importFolderPick reads name, webkitRelativePath,
  // and slice(a,b).text(). Real File objects can't set webkitRelativePath
  // from JS (readonly), so we synthesise a browsable-file shim.
  const fakeFile = (name, webkitRelativePath, content = '<?xml version="1.0"?><exchange/>') => ({
    name,
    webkitRelativePath,
    slice(a, b) { return { text: async () => content.slice(a, b) }; },
    async text() { return content; },
  });

  test('_bifDetectsSingleArchive returns null when top-level segment is not archive-like', async ({ page }) => {
    await bootstrap(page);
    const cases = await page.evaluate(({ files }) => {
      return {
        rootWithMultiple: _bifDetectsSingleArchive(files.multi),
        rootSingleArchive: _bifDetectsSingleArchive(files.single),
        nonMuratecTop: _bifDetectsSingleArchive(files.nonArchive),
        bareFiles: _bifDetectsSingleArchive(files.bare),
      };
    }, {
      files: {
        multi: [
          { name: 'a.xml', webkitRelativePath: 'Clash Tests/Week1/a.xml' },
          { name: 'b.xml', webkitRelativePath: 'Clash Tests/Week2/b.xml' },
        ],
        single: [
          { name: 'a.xml', webkitRelativePath: '03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml' },
          { name: 'b.jpg', webkitRelativePath: '03_GAS_v_08_AMHS/files/b.jpg' },
        ],
        nonArchive: [
          { name: 'a.xml', webkitRelativePath: 'MyBenignFolder/a.xml' },
          { name: 'b.xml', webkitRelativePath: 'MyBenignFolder/b.xml' },
        ],
        bare: [{ name: 'a.xml', webkitRelativePath: '' }],
      },
    });
    expect(cases.rootWithMultiple).toBeNull();
    expect(cases.rootSingleArchive).toBe('03_GAS_v_08_AMHS');
    expect(cases.nonMuratecTop).toBeNull();
    expect(cases.bareFiles).toBeNull();
  });

  test('_bifDetectsSingleArchive also catches the "_AMHS" suffix pattern even without "_v_"', async ({ page }) => {
    await bootstrap(page);
    const seg = await page.evaluate(() => _bifDetectsSingleArchive([
      { name: 'a.xml', webkitRelativePath: 'GAS_AMHS/a.xml' },
      { name: 'b.xml', webkitRelativePath: 'GAS_AMHS/b.xml' },
    ]));
    expect(seg).toBe('GAS_AMHS');
  });

  test('archives-root pick — no warning shown, import proceeds', async ({ page }) => {
    await bootstrap(page);
    // Two files under a real archives-root ("Clash Tests" holding both
    // weekly archives). Shape check returns null → importFolderPick
    // continues straight into the report-candidate scan. We only assert
    // the modal never rendered — parsing failure downstream is expected
    // (the fake XML is minimal).
    await page.evaluate(async () => {
      const files = [
        { name: 'a.xml', webkitRelativePath: 'Clash Tests/Week1/a.xml',
          slice: () => ({ text: async () => '<exchange/>' }), text: async () => '<exchange/>' },
        { name: 'b.xml', webkitRelativePath: 'Clash Tests/Week2/b.xml',
          slice: () => ({ text: async () => '<exchange/>' }), text: async () => '<exchange/>' },
      ];
      // Kick off the flow; if the shape warn had fired we'd see the modal.
      const p = importFolderPick({ files, value: '' });
      window.__pickPromise = p;
    });
    // Give the microtask + slice awaits a tick to run.
    await page.waitForTimeout(200);
    await expect(page.locator('#bif-shape-warn')).toHaveCount(0);
  });

  test('single-archive pick — warning shown with "single archive" wording', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(async () => {
      const files = [
        { name: '03_GAS_v_08_AMHS.xml', webkitRelativePath: '03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml',
          slice: () => ({ text: async () => '<exchange/>' }), text: async () => '<exchange/>' },
        { name: 'img.jpg', webkitRelativePath: '03_GAS_v_08_AMHS/files/img.jpg',
          slice: () => ({ text: async () => '' }), text: async () => '' },
      ];
      // Fire and forget — the modal awaits button click.
      window.__pickPromise = importFolderPick({ files, value: '' });
    });
    const modal = page.locator('#bif-shape-warn');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('single archive');
    await expect(modal).toContainText('03_GAS_v_08_AMHS');
    await expect(modal).toContainText('archives root');
    await expect(page.locator('#bif-shape-back')).toBeVisible();
    await expect(page.locator('#bif-shape-continue')).toBeVisible();
  });

  test('single-archive pick + Go back → import aborts, no toast, no state change', async ({ page }) => {
    await bootstrap(page);
    const before = await page.evaluate(() => S.clashes.length);
    await page.evaluate(async () => {
      const files = [
        { name: '03_GAS_v_08_AMHS.xml', webkitRelativePath: '03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml',
          slice: () => ({ text: async () => '<exchange/>' }), text: async () => '<exchange/>' },
      ];
      window.__pickPromise = importFolderPick({ files, value: '' });
    });
    await page.locator('#bif-shape-back').click();
    await expect(page.locator('#bif-shape-warn')).toHaveCount(0);
    // Wait for the promise to settle so we know importFolderPick returned.
    await page.evaluate(() => window.__pickPromise);
    const after = await page.evaluate(() => S.clashes.length);
    expect(after).toBe(before);
  });

  test('single-archive pick + Continue anyway → import proceeds (modal closes, control flows past the shape check)', async ({ page }) => {
    await bootstrap(page);
    // Instrument the downstream: replace showToast + bloadf so we can
    // prove the shape check cleared without needing real Blobs downstream.
    // bloadf is what the single-test branch of importFolderPick calls
    // after the report-candidate scan lands on exactly one xml.
    await page.evaluate(() => {
      window.__toasts = [];
      window.showToast = (m) => { window.__toasts.push(String(m)); };
      window.__bloadfCalls = 0;
      window.bloadf = () => { window.__bloadfCalls++; };
    });
    await page.evaluate(async () => {
      const xml = '<?xml version="1.0"?><exchange><batchtest><clashtest name="T"><clashresult name="c1"><createddate><date year="2026" month="7" day="1"/></createddate></clashresult></clashtest></batchtest></exchange>';
      const files = [
        { name: '03_GAS_v_08_AMHS.xml', webkitRelativePath: '03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml',
          slice: (a, b) => ({ text: async () => xml.slice(a, b) }), text: async () => xml },
      ];
      window.__pickPromise = importFolderPick({ files, value: '' });
    });
    await page.locator('#bif-shape-continue').click();
    await expect(page.locator('#bif-shape-warn')).toHaveCount(0);
    // Wait for the promise to settle.
    await page.evaluate(() => window.__pickPromise);
    // The report-candidate scan ran → landed on 1 job → called bloadf.
    // Both signals confirm the shape check cleared.
    const state = await page.evaluate(() => ({
      toasts: window.__toasts || [],
      bloadfCalls: window.__bloadfCalls || 0,
    }));
    expect(state.bloadfCalls).toBe(1);
    expect(state.toasts.some(m => /Scanning|Importing/i.test(m))).toBe(true);
  });

  test('Escape closes the shape warn dialog and aborts the import', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(async () => {
      const files = [
        { name: '03_GAS_v_08_AMHS.xml', webkitRelativePath: '03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml',
          slice: () => ({ text: async () => '' }), text: async () => '' },
      ];
      window.__pickPromise = importFolderPick({ files, value: '' });
    });
    await expect(page.locator('#bif-shape-warn')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#bif-shape-warn')).toHaveCount(0);
    await page.evaluate(() => window.__pickPromise);
  });
});
