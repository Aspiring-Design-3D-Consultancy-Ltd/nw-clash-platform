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
  test('guidance banner renders on the BCF import panel with the parent-folder instruction', async ({ page }) => {
    await bootstrap(page);
    const banner = page.locator('text=Pick the parent folder that contains all your archive folders');
    await expect(banner).toBeVisible();
    // Body text mentions the failure mode and the expected structure.
    // Test-subfolder is called out as optional (both AMHS 4-seg and Exyte
    // 3-seg layouts are supported).
    await expect(page.locator('body')).toContainText(/archive identity will not be captured correctly/);
    await expect(page.locator('body')).toContainText(/\[picked folder\] \/ \[archive folder\] \/ \[XML file\]/);
    await expect(page.locator('body')).toContainText(/test subfolder between archive and XML is also supported/);
  });
});

test.describe('BATCH-IMPORT-SHAPE-WARN', () => {
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

  // The end-to-end SHAPE-WARN via importFolderPick paths that used to
  // exercise 2-segment picks are now guarded upstream by BATCH-IMPORT-
  // PICK-VALIDATION — see batch-import-pick-validation.spec.js. The
  // _bifShowShapeWarn modal itself still renders when triggered directly.

  test('shape-warn modal renders when called directly and can be dismissed', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => {
      window.__shapeResult = null;
      window.__shapePromise = _bifShowShapeWarn('03_GAS_v_08_AMHS').then(r => { window.__shapeResult = r; });
    });
    const modal = page.locator('#bif-shape-warn');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('single archive');
    await expect(modal).toContainText('03_GAS_v_08_AMHS');
    await expect(modal).toContainText('archives root');
    await expect(page.locator('#bif-shape-back')).toBeVisible();
    await expect(page.locator('#bif-shape-continue')).toBeVisible();
    await page.locator('#bif-shape-back').click();
    await expect(modal).toHaveCount(0);
    await page.evaluate(() => window.__shapePromise);
    expect(await page.evaluate(() => window.__shapeResult)).toBe(false);
  });

  test('shape-warn modal Continue anyway resolves with true', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => {
      window.__shapeResult = null;
      window.__shapePromise = _bifShowShapeWarn('03_GAS_v_08_AMHS').then(r => { window.__shapeResult = r; });
    });
    await page.locator('#bif-shape-continue').click();
    await expect(page.locator('#bif-shape-warn')).toHaveCount(0);
    await page.evaluate(() => window.__shapePromise);
    expect(await page.evaluate(() => window.__shapeResult)).toBe(true);
  });

  test('Escape closes the shape warn dialog', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => {
      window.__shapePromise = _bifShowShapeWarn('03_GAS_v_08_AMHS');
    });
    await expect(page.locator('#bif-shape-warn')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#bif-shape-warn')).toHaveCount(0);
  });
});
