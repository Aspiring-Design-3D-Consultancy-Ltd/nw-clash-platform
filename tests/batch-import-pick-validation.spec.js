import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

function makeXml(clashName = 'Clash1', testName = 'GAS vs Struct') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="${testName}">
      <clashresult name="${clashName}" href="files\\cd000001.jpg" distance="-0.02">
        <clashpoint><pos3f x="100" y="100" z="100"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="7" day="1" hour="10" minute="0" second="0"/></createddate>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>GAS.nwc</node></pathlink>
          <objectattribute><name>Item Name</name><value>Duct-1</value></objectattribute>
        </clashobject>
        <clashobject>
          <pathlink><node>ESMC.nwd</node><node>Structure.nwc</node></pathlink>
          <objectattribute><name>Item Name</name><value>Beam-1</value></objectattribute>
        </clashobject>
      </clashresult>
    </clashtest>
  </batchtest>
</exchange>`;
}

async function bootstrap(page, view = 'bcf') {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate((v) => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    nav(v);
  }, view);
}

// Kick off importFolderPick with a duck-typed input element. It reads
// files (with webkitRelativePath) and .value (mutated to '' on abort).
// Playwright's setInputFiles can't set webkitRelativePath, so we
// synthesise the shape at runtime and race the modal on the page side.
async function fireImportFolderPick(page, files) {
  await page.evaluate((files) => {
    // Stash the fake element on window so tests can inspect its final
    // .value (importFolderPick clears it on the abort path).
    window.__fakeInput = { files, value: '' };
    window.__pickPromise = importFolderPick(window.__fakeInput);
  }, files);
}

test.describe('BATCH-IMPORT-PICK-VALIDATION', () => {
  test('picks below the parent — 2 segments — blocks import with the guidance dialog', async ({ page }) => {
    await bootstrap(page);
    const seed = await page.evaluate(() => (S.clashes || []).length);
    // XML only — one file, path is [picked-archive]/[XML]. This is the
    // scenario prior PRs mis-attributed the archive folder for.
    await fireImportFolderPick(page, [
      { name: '03_GAS_v_08_AMHS.xml', webkitRelativePath: '03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml' },
    ]);
    const modal = page.locator('#bif-pick-validation');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Wrong folder level picked');
    await expect(modal).toContainText('parent folder');
    await expect(modal).toContainText('[picked folder]');
    // Dismiss and let importFolderPick's abort path run.
    await page.locator('#bif-pick-close').click();
    await expect(modal).toHaveCount(0);
    const state = await page.evaluate(async () => {
      await window.__pickPromise;
      return {
        inputCleared: window.__fakeInput.value === '',
        bcfLen: (typeof _bcfC !== 'undefined' ? _bcfC.length : 0),
        clashCount: (S.clashes || []).length,
      };
    });
    expect(state.inputCleared).toBe(true);
    expect(state.bcfLen).toBe(0);
    expect(state.clashCount).toBe(seed);
  });

  test('picks below the parent — 3 segments — still blocks import', async ({ page }) => {
    await bootstrap(page);
    // Edge case: [picked]/[archive]/[XML] with NO test-subfolder layer.
    // Third-from-last would silently mis-attribute here, so PICK-VALIDATION
    // blocks it before the parser runs.
    await fireImportFolderPick(page, [
      { name: '03_GAS_v_08_AMHS.xml', webkitRelativePath: 'Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml' },
    ]);
    const modal = page.locator('#bif-pick-validation');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Wrong folder level picked');
    await page.locator('#bif-pick-close').click();
    await expect(modal).toHaveCount(0);
    const state = await page.evaluate(async () => {
      await window.__pickPromise;
      return { bcfLen: (typeof _bcfC !== 'undefined' ? _bcfC.length : 0) };
    });
    expect(state.bcfLen).toBe(0);
  });

  test('correct 4-segment pick — no validation dialog, parses proceed to sniffing stage', async ({ page }) => {
    await bootstrap(page);
    // A File-like object whose .slice returns a Blob-compatible object so
    // importFolderPick's `await c.slice(0,4096).text()` still resolves.
    const xml = makeXml('Clash1');
    await page.evaluate(async ({ xml }) => {
      const blobFile = new File([xml], '03_GAS_v_08_AMHS.xml', { type: 'application/xml' });
      Object.defineProperty(blobFile, 'webkitRelativePath', {
        value: 'Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml',
      });
      const fake = { files: [blobFile], value: '' };
      await importFolderPick(fake);
    }, { xml });
    // No validation dialog was inserted.
    expect(await page.$('#bif-pick-validation')).toBeNull();
    // XML got loaded into the bxml textarea by the single-test path
    // (bloadf({files:[xmlFile]}) branch inside importFolderPick).
    const loaded = await page.evaluate(() => document.getElementById('bxml').value);
    expect(loaded).toContain('<clashresult');
    expect(loaded).toContain('Clash1');
  });
});

test.describe('BATCH-IMPORT-FOLDER-CAPTURE — real-world four-segment end-to-end', () => {
  test('a full path yields the archive folder as sourceFolder on every clash', async ({ page }) => {
    await bootstrap(page);
    const clashes = await page.evaluate((xml) => {
      _bcfFileNames = ['03_GAS_v_08_AMHS.xml'];
      _bcfFilePaths = ['Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml'];
      document.getElementById('bxml').value = xml;
      bparse();
      return _bcfC.slice();
    }, makeXml('Clash1'));
    expect(clashes.length).toBeGreaterThan(0);
    for (const c of clashes) {
      expect(c.sourceFolder).toBe('260601 FAB AMHS v 7 Clash test');
      expect(c.sourceFilePath).toBe('Clash Tests/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml');
      expect(c.sourceFile).toBe('03_GAS_v_08_AMHS.xml');
    }
  });
});
