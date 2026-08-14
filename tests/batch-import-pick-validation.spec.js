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
  // INV-007: wait for the terminal inline one-shot migration gate so
  // window.onload's setTimeout(1500/1600)-deferred migrations don't
  // race and silently overwrite this test's seeded state.
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
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
    // XML only — one file, path is [picked-archive]/[XML]. WEEKLY-IMPORT-
    // VALIDATION bumped the floor to 4 segments (week / archive /
    // [test-subfolder]/ XML), so this still blocks.
    await fireImportFolderPick(page, [
      { name: '03_GAS_v_08_AMHS.xml', webkitRelativePath: '03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml' },
    ]);
    const modal = page.locator('#bif-pick-validation');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Wrong folder level picked');
    await expect(modal).toContainText('week wrapper');
    await expect(modal).toContainText('needs at least 3');
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

  test('3-segment layout — depth check passes; WEEKLY-IMPORT-VALIDATION warn appears for non-week wrapper', async ({ page }) => {
    await bootstrap(page);
    // Pre-weekly [Clash Tests]/[archive]/[XML] — 3 segments, above the
    // depth floor. Wrapper "Clash Tests" doesn't match `week-YYMMDD` so
    // WEEKLY-IMPORT-VALIDATION shows its warn (not the harder block).
    const xml = makeXml('Clash1');
    await page.evaluate(async ({ xml }) => {
      const blobFile = new File([xml], 'Exyte AAS_v_08_AMHS.xml', { type: 'application/xml' });
      Object.defineProperty(blobFile, 'webkitRelativePath', {
        value: 'Clash Tests/260629 FAB Exyte v AMHS Clash test/Exyte AAS_v_08_AMHS.xml',
      });
      window.__fakeInput = { files: [blobFile], value: '' };
      window.__pickPromise = importFolderPick(window.__fakeInput);
    }, { xml });
    const warn = page.locator('#bif-week-warn');
    await expect(warn).toBeVisible();
    await expect(warn).toContainText('Clash Tests');
    // Pick-validation modal must NOT be visible for a 3+ segment path.
    expect(await page.$('#bif-pick-validation')).toBeNull();
    await page.locator('#bif-week-back').click();
  });

  test('correct 4-segment weekly pick (Exyte layout) — no validation dialog, parses proceed to sniffing stage', async ({ page }) => {
    await bootstrap(page);
    // week-YYMMDD / archive / XML = 4 segments. Wrapper matches the
    // `week-\\d{6}` pattern so the WEEKLY-IMPORT-VALIDATION warn stays silent.
    const xml = makeXml('Clash1');
    await page.evaluate(async ({ xml }) => {
      const blobFile = new File([xml], 'Exyte AAS_v_08_AMHS.xml', { type: 'application/xml' });
      Object.defineProperty(blobFile, 'webkitRelativePath', {
        value: 'week-260629/260629 FAB Exyte v AMHS Clash test/Exyte AAS_v_08_AMHS.xml',
      });
      const fake = { files: [blobFile], value: '' };
      await importFolderPick(fake);
    }, { xml });
    expect(await page.$('#bif-pick-validation')).toBeNull();
    expect(await page.$('#bif-week-warn')).toBeNull();
    const loaded = await page.evaluate(() => document.getElementById('bxml').value);
    expect(loaded).toContain('<clashresult');
    expect(loaded).toContain('Clash1');
  });

  test('5-segment weekly pick (AMHS layout with test subfolder) — no validation dialog', async ({ page }) => {
    await bootstrap(page);
    const xml = makeXml('Clash1');
    await page.evaluate(async ({ xml }) => {
      const blobFile = new File([xml], '03_GAS_v_08_AMHS.xml', { type: 'application/xml' });
      Object.defineProperty(blobFile, 'webkitRelativePath', {
        value: 'week-260601/260601 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml',
      });
      const fake = { files: [blobFile], value: '' };
      await importFolderPick(fake);
    }, { xml });
    expect(await page.$('#bif-pick-validation')).toBeNull();
    expect(await page.$('#bif-week-warn')).toBeNull();
    const loaded = await page.evaluate(() => document.getElementById('bxml').value);
    expect(loaded).toContain('<clashresult');
    expect(loaded).toContain('Clash1');
  });

  test('non-week wrapper (4+ segments) — WEEKLY-IMPORT-VALIDATION warn appears; user can Continue anyway', async ({ page }) => {
    await bootstrap(page);
    const xml = makeXml('Clash1');
    // Fire in the background — the pick pauses on the warn dialog.
    await page.evaluate(async ({ xml }) => {
      const blobFile = new File([xml], '03_GAS_v_08_AMHS.xml', { type: 'application/xml' });
      Object.defineProperty(blobFile, 'webkitRelativePath', {
        value: 'not-a-week-folder/260601 FAB AMHS/03_GAS_v_08_AMHS/03_GAS_v_08_AMHS.xml',
      });
      window.__fakeInput = { files: [blobFile], value: '' };
      window.__pickPromise = importFolderPick(window.__fakeInput);
    }, { xml });
    const warn = page.locator('#bif-week-warn');
    await expect(warn).toBeVisible();
    await expect(warn).toContainText('week-YYMMDD');
    await expect(warn).toContainText('not-a-week-folder');
    // Continue anyway → the pick resumes.
    await page.locator('#bif-week-continue').click();
    await expect(warn).toHaveCount(0);
    await page.evaluate(() => window.__pickPromise);
    const loaded = await page.evaluate(() => document.getElementById('bxml').value);
    expect(loaded).toContain('<clashresult');
  });

  test('non-week wrapper — Go back and rename aborts the import', async ({ page }) => {
    await bootstrap(page);
    const xml = makeXml('Clash1');
    await page.evaluate(async ({ xml }) => {
      const blobFile = new File([xml], '03_GAS.xml', { type: 'application/xml' });
      Object.defineProperty(blobFile, 'webkitRelativePath', {
        value: 'not-a-week-folder/archive/sub/03_GAS.xml',
      });
      window.__fakeInput = { files: [blobFile], value: 'C:\\fakepath\\anything' };
      window.__pickPromise = importFolderPick(window.__fakeInput);
    }, { xml });
    await page.locator('#bif-week-warn').waitFor();
    await page.locator('#bif-week-back').click();
    await expect(page.locator('#bif-week-warn')).toHaveCount(0);
    const state = await page.evaluate(async () => {
      await window.__pickPromise;
      return { inputCleared: window.__fakeInput.value === '', bxml: document.getElementById('bxml').value };
    });
    expect(state.inputCleared).toBe(true);
    // No XML was loaded — user aborted before the sniff stage.
    expect(state.bxml).toBe('');
  });
});

test.describe('BATCH-IMPORT-FOLDER-CAPTURE — real-world end-to-end', () => {
  test('4-seg AMHS path yields archive folder on every clash', async ({ page }) => {
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

  test('3-seg Exyte path yields archive folder on every clash', async ({ page }) => {
    await bootstrap(page);
    const clashes = await page.evaluate((xml) => {
      _bcfFileNames = ['Exyte AAS_v_08_AMHS.xml'];
      _bcfFilePaths = ['Clash Tests/260629 FAB Exyte v AMHS Clash test/Exyte AAS_v_08_AMHS.xml'];
      document.getElementById('bxml').value = xml;
      bparse();
      return _bcfC.slice();
    }, makeXml('Clash1'));
    expect(clashes.length).toBeGreaterThan(0);
    for (const c of clashes) {
      expect(c.sourceFolder).toBe('260629 FAB Exyte v AMHS Clash test');
      expect(c.sourceFilePath).toBe('Clash Tests/260629 FAB Exyte v AMHS Clash test/Exyte AAS_v_08_AMHS.xml');
      expect(c.sourceFile).toBe('Exyte AAS_v_08_AMHS.xml');
    }
  });
});
