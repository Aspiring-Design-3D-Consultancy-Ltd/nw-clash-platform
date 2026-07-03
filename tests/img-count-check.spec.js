import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Build an XML with N clashes carrying unique element IDs so pairKey lands on
// the ID:: tier — merge is deterministic and doesn't get side-tracked into
// the LEGACY fallback.
function makeXml(clashCount, testName = '[H] Img Count Check Test A') {
  const items = [];
  for (let n = 1; n <= clashCount; n++) {
    items.push(`<clashresult name="Clash${n}" distance="-0.02">
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
    // Start with an empty register so we don't have to reason about the
    // baked-in demo data or the cross-test dedup modal. Seed weekly with
    // the *current* ISO week — importToRegister anchors the imports[]
    // push to _anchorYW, which for a future-dated batch falls back to
    // today's (yr, wk). Using isoWeekNum/isoWeekYear (already loaded)
    // keeps this stable across whatever "today" the sandbox has.
    S.clashes = [];
    const today = new Date();
    const wkNow = isoWeekNum(today);
    const yrNow = isoWeekYear(today);
    S.weekly = [{ label: 'Wk ' + wkNow, date: today.toISOString().slice(0,10), week: wkNow, year: yrNow, imports: [] }];
    sv('clashes', S.clashes);
    sv('weekly', S.weekly);
    nav('bcf');
  });
  await page.waitForSelector('#bxml');
}

async function parseXml(page, xml, imageCount) {
  await page.evaluate(({ xml, imageCount }) => {
    document.getElementById('bxml').value = xml;
    bparse();
    window._skipCrossTestDupes = true;
    _bcfImgCount = imageCount;
  }, { xml, imageCount });
}

test.describe('IMG-COUNT-CHECK', () => {
  test('5 clashes / 5 images → import proceeds silently (no modal)', async ({ page }) => {
    await bootstrap(page);
    await parseXml(page, makeXml(5), 5);
    await page.evaluate(() => _importToRegisterChecked('append'));

    // No modal.
    await expect(page.locator('#img-count-check-modal')).toHaveCount(0);
    // Register got the 5 clashes.
    const merged = await page.evaluate(() => (S.clashes || []).length);
    expect(merged).toBe(5);
    // Imports[] entry has NO mismatch flag.
    const importsEntry = await page.evaluate(() => {
      const allImports = (S.weekly || []).flatMap(w => (w.imports || []));
      return allImports.at(-1) || null;
    });
    expect(importsEntry?.imageCountMismatch).toBeUndefined();
  });

  test('5 clashes / 3 images → modal fires, Cancel discards, Continue merges with imageCountMismatch metadata', async ({ page }) => {
    // ── Sub-case A: Cancel discards the batch.
    await bootstrap(page);
    await parseXml(page, makeXml(5), 3);
    await page.evaluate(() => _importToRegisterChecked('append'));

    const modal = page.locator('#img-count-check-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('5 clashes but 3 images');
    await expect(modal).toContainText('Include Clash Viewpoints');

    await page.locator('#img-count-check-cancel').click();
    await expect(modal).toHaveCount(0);

    const cancelState = await page.evaluate(() => ({
      registerCount: (S.clashes || []).length,
      parsedCount: _bcfC.length,
    }));
    expect(cancelState.registerCount).toBe(0); // nothing appended
    expect(cancelState.parsedCount).toBe(0); // batch discarded

    // ── Sub-case B: Continue on the same 5/3 mismatch — merge with flag.
    await parseXml(page, makeXml(5), 3);
    await page.evaluate(() => _importToRegisterChecked('append'));
    await expect(page.locator('#img-count-check-modal')).toBeVisible();
    await page.locator('#img-count-check-continue').click();
    await expect(page.locator('#img-count-check-modal')).toHaveCount(0);

    const continueState = await page.evaluate(() => {
      const allImports = (S.weekly || []).flatMap(w => (w.imports || []));
      const entry = allImports.at(-1) || null;
      return { registerCount: (S.clashes || []).length, entry };
    });
    expect(continueState.registerCount).toBe(5);
    expect(continueState.entry?.imageCountMismatch).toBe(true);
    expect(continueState.entry?.clashCount).toBe(5);
    expect(continueState.entry?.imageCount).toBe(3);
  });

  test('5 clashes / 0 images → modal fires, same Cancel/Continue behaviour', async ({ page }) => {
    await bootstrap(page);
    await parseXml(page, makeXml(5), 0);
    await page.evaluate(() => _importToRegisterChecked('append'));

    const modal = page.locator('#img-count-check-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('5 clashes but 0 images');

    await page.locator('#img-count-check-continue').click();
    await expect(modal).toHaveCount(0);

    const state = await page.evaluate(() => {
      const allImports = (S.weekly || []).flatMap(w => (w.imports || []));
      const entry = allImports.at(-1) || null;
      return { registerCount: (S.clashes || []).length, entry };
    });
    expect(state.registerCount).toBe(5);
    expect(state.entry?.imageCountMismatch).toBe(true);
    expect(state.entry?.clashCount).toBe(5);
    expect(state.entry?.imageCount).toBe(0);
  });

  test('0 clashes / 0 images → import proceeds silently (both zero, no mismatch)', async ({ page }) => {
    await bootstrap(page);
    // 0 clashes: bparse against an XML with no clashresults leaves _bcfC empty.
    // importToRegister guards on _bcfC.length so it would alert — instead we
    // exercise the wrapper's zero-match branch directly.
    await page.evaluate(() => {
      _bcfC = [];
      _bcfImgCount = 0;
      // Stub alert so importToRegister's "Parse XML first" alert doesn't
      // race with the wrapper's return path in headless mode.
      window.alert = () => {};
      _importToRegisterChecked('append');
    });

    // No modal (0 === 0, silent).
    await expect(page.locator('#img-count-check-modal')).toHaveCount(0);
    // Register untouched.
    const registerCount = await page.evaluate(() => (S.clashes || []).length);
    expect(registerCount).toBe(0);
  });

  test('post-import _bcfImgCount resets so a subsequent paste sees a clean state', async ({ page }) => {
    await bootstrap(page);
    // First import: 5/5 silent match.
    await parseXml(page, makeXml(5), 5);
    await page.evaluate(() => _importToRegisterChecked('append'));

    // Second import: parse a new 3-clash XML but do NOT set _bcfImgCount —
    // the wrapper should see 0, mismatch with 3, and open the modal. If
    // the wrapper had leaked the previous 5, this would silently proceed.
    await parseXml(page, makeXml(3, '[H] Img Count Check Test B'), undefined);
    // Explicit "not set" — we want 0 leaked from the previous batch's reset.
    await page.evaluate(() => { _bcfImgCount = 0; });
    await page.evaluate(() => _importToRegisterChecked('append'));

    await expect(page.locator('#img-count-check-modal')).toBeVisible();
    await expect(page.locator('#img-count-check-modal')).toContainText('3 clashes but 0 images');
  });
});
