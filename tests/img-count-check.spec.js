import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Build a Navisworks-shaped XML with N clashes where the first `withHref`
// carry an href attribute (viewpoint image reference) and the rest do not.
// The href value mirrors real archive files: "files\cd000001.jpg" — the
// parser strips the folder prefix into c.nwImageRef.
function makeXml(clashCount, withHref, testName = '[H] Img Count Check Test A') {
  const items = [];
  for (let n = 1; n <= clashCount; n++) {
    const href = n <= withHref ? ` href="files\\cd${String(n).padStart(6,'0')}.jpg"` : '';
    items.push(`<clashresult name="Clash${n}"${href} distance="-0.02">
      <clashpoint><pos3f x="${100*n}" y="${200*n}" z="${300*n}"/></clashpoint>
      <resultstatus>active</resultstatus>
      <createddate><date year="2026" month="7" day="15" hour="10" minute="0" second="0"/></createddate>
      <clashobject><pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-A-${n}</value></objectattribute></clashobject>
      <clashobject><pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-B-${n}</value></objectattribute></clashobject>
    </clashresult>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="${testName}">
      ${items.join('')}
    </clashtest>
  </batchtest>
</exchange>`;
}

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    S.clashes = [];
    const today = new Date();
    S.weekly = [{
      label: 'Wk ' + isoWeekNum(today),
      date: today.toISOString().slice(0,10),
      week: isoWeekNum(today),
      year: isoWeekYear(today),
      imports: [],
    }];
    sv('clashes', S.clashes);
    sv('weekly', S.weekly);
    nav('bcf');
  });
  await page.waitForSelector('#bxml');
}

async function parseXml(page, xml) {
  await page.evaluate((xml) => {
    document.getElementById('bxml').value = xml;
    bparse();
    window._skipCrossTestDupes = true;
  }, xml);
}

async function latestImportEntry(page) {
  return page.evaluate(() => {
    const allImports = (S.weekly || []).flatMap(w => (w.imports || []));
    return allImports.at(-1) || null;
  });
}

test.describe('IMG-COUNT-CHECK (href-based)', () => {
  test('50 clashes, 50 hrefs → import proceeds silently (no modal)', async ({ page }) => {
    await bootstrap(page);
    await parseXml(page, makeXml(50, 50));

    // Sanity: parser stamped nwImageRef on every clash from the href attribute.
    const parsed = await page.evaluate(() => ({
      count: _bcfC.length,
      withRef: _bcfC.filter(c => c.nwImageRef).length,
      firstRef: _bcfC[0]?.nwImageRef,
    }));
    expect(parsed.count).toBe(50);
    expect(parsed.withRef).toBe(50);
    expect(parsed.firstRef).toBe('cd000001.jpg');

    await page.evaluate(() => _importToRegisterChecked('append'));
    await expect(page.locator('#img-count-check-modal')).toHaveCount(0);

    const registerCount = await page.evaluate(() => (S.clashes || []).length);
    expect(registerCount).toBe(50);
    const entry = await latestImportEntry(page);
    expect(entry?.imageCountMismatch).toBeUndefined();
  });

  test('50 clashes, 48 hrefs (real archive shape) → modal fires with "2 of 50", Cancel discards, Continue merges', async ({ page }) => {
    // ── Sub-case A: Cancel discards the batch.
    await bootstrap(page);
    await parseXml(page, makeXml(50, 48));
    await page.evaluate(() => _importToRegisterChecked('append'));

    const modal = page.locator('#img-count-check-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('2 of 50');
    await expect(modal).toContainText('no image reference (no viewpoint captured in Navisworks)');
    await expect(modal).toContainText('re-export with viewpoints');

    await page.locator('#img-count-check-cancel').click();
    await expect(modal).toHaveCount(0);

    const cancelState = await page.evaluate(() => ({
      registerCount: (S.clashes || []).length,
      parsedCount: _bcfC.length,
    }));
    expect(cancelState.registerCount).toBe(0);
    expect(cancelState.parsedCount).toBe(0);

    // ── Sub-case B: Continue merges + stamps the imports[] entry.
    await parseXml(page, makeXml(50, 48));
    await page.evaluate(() => _importToRegisterChecked('append'));
    await expect(page.locator('#img-count-check-modal')).toBeVisible();
    await page.locator('#img-count-check-continue').click();
    await expect(page.locator('#img-count-check-modal')).toHaveCount(0);

    const merged = await page.evaluate(() => (S.clashes || []).length);
    expect(merged).toBe(50);
    const entry = await latestImportEntry(page);
    expect(entry?.imageCountMismatch).toBe(true);
    expect(entry?.clashCount).toBe(50);
    expect(entry?.declaredImages).toBe(48);
    expect(entry?.missing).toBe(2);
  });

  test('50 clashes, 0 hrefs → modal fires with "50 of 50" and Continue works', async ({ page }) => {
    await bootstrap(page);
    await parseXml(page, makeXml(50, 0));
    await page.evaluate(() => _importToRegisterChecked('append'));

    const modal = page.locator('#img-count-check-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('50 of 50');

    await page.locator('#img-count-check-continue').click();
    await expect(modal).toHaveCount(0);

    const entry = await latestImportEntry(page);
    expect(entry?.imageCountMismatch).toBe(true);
    expect(entry?.clashCount).toBe(50);
    expect(entry?.declaredImages).toBe(0);
    expect(entry?.missing).toBe(50);
  });

  test('empty XML (0 clashes) → no modal', async ({ page }) => {
    await bootstrap(page);
    // Zero clashresults → _bcfC stays empty → clashCount and declaredImages
    // both zero → missing zero → wrapper falls through to importToRegister,
    // which alerts "Parse XML first" — stub the alert to keep the test
    // headless-safe. The important assertion is that the modal did NOT open.
    await page.evaluate(() => {
      _bcfC = [];
      window.alert = () => {};
      _importToRegisterChecked('append');
    });
    await expect(page.locator('#img-count-check-modal')).toHaveCount(0);
    const registerCount = await page.evaluate(() => (S.clashes || []).length);
    expect(registerCount).toBe(0);
  });

  test('_bcfImgCount from a prior Load NWC Images run does NOT influence the check', async ({ page }) => {
    // Regression guard: PR #10 conflated the Load NWC Images counter with
    // this check and produced a false positive on every hrefless XML. The
    // href-based rebuild must ignore _bcfImgCount entirely — including
    // whatever value the separate Load NWC Images flow may have left set.
    await bootstrap(page);
    await parseXml(page, makeXml(50, 50));
    await page.evaluate(() => { _bcfImgCount = 3; });
    await page.evaluate(() => _importToRegisterChecked('append'));

    await expect(page.locator('#img-count-check-modal')).toHaveCount(0);
    const merged = await page.evaluate(() => (S.clashes || []).length);
    expect(merged).toBe(50);
    // _bcfImgCount must be left alone by the wrapper (its lifecycle
    // belongs to loadNwImages, not this check).
    const bcfImgCountAfter = await page.evaluate(() => _bcfImgCount);
    expect(bcfImgCountAfter).toBe(3);
  });
});
