import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A9-FOLDER-BATCH-IMG-SKIP contract:
   importFolderPick's per-test sequential loop was calling
   _importToRegisterChecked('append') per file. That helper shows
   _showImgCountMismatchModal (blocking dialog) and RETURNS without
   importing when any parsed clash has no nwImageRef. The loop doesn't
   await user interaction — it proceeds after a 150ms setTimeout. If a
   subsequent test also triggers the modal, _showImgCountMismatchModal's
   existing.remove() orphans the previous modal's unclicked buttons.
   That test's clashes are silently dropped: no error, no log, no toast.

   Fix: swap _importToRegisterChecked → importToRegister inside the
   loop only. The upfront confirm("All will be appended… Proceed?") at
   the top of importFolderPick already covers user intent for the
   whole batch; the per-test modal is redundant here and actively
   breaks the loop. Single-file bloadf path (via the "Append to
   Register" button at L7885) continues to use _importToRegisterChecked
   — unchanged.

   Fixture: 2 XML files, each with 3 clashresults and NO href
   attribute (nwImageRef stays empty on every parsed clash → the
   image-count check fires → the modal blocks the pre-fix loop).
   Both files sit in a `week-260727/…` folder shape so the pick-
   validation and week-wrapper gates pass. */

const XML_NO_HREF = (testName, count) => {
  const results = Array.from({length: count}, (_, i) => `
    <clashresult name="Clash${i+1}" status="active" distance="-0.02">
      <clashpoint><pos3f x="${i*10}" y="0" z="0"/></clashpoint>
      <createddate><date year="2026" month="7" day="27" hour="10" minute="0" second="0"/></createddate>
      <clashobject>
        <objectattribute><name>GUID</name><value>GA-${testName}-${i+1}</value></objectattribute>
        <smarttag><name>Item Name</name><value>Wall_${i+1}</value></smarttag>
        <smarttag><name>Item Type</name><value>Solid</value></smarttag>
        <layer>FAB_L20</layer>
        <pathlink><node>proj.nwd</node><node>AMHS-E-F-00.nwc</node><node>modelroot</node><node>Walls</node><node>Wall_${i+1}</node></pathlink>
      </clashobject>
      <clashobject>
        <objectattribute><name>GUID</name><value>GB-${testName}-${i+1}</value></objectattribute>
        <smarttag><name>Item Name</name><value>Duct_${i+1}</value></smarttag>
        <smarttag><name>Item Type</name><value>Solid</value></smarttag>
        <layer>FAB_L20</layer>
        <pathlink><node>proj.nwd</node><node>AMHS-M-F-00.nwc</node><node>modelroot</node><node>Ducts</node><node>Duct_${i+1}</node></pathlink>
      </clashobject>
    </clashresult>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="m">
  <batchtest units="m">
    <clashtest name="${testName}" units="m">
      ${results}
    </clashtest>
  </batchtest>
</exchange>`;
};

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof S !== 'undefined'
    && typeof importFolderPick === 'function'
    && typeof _importToRegisterChecked === 'function'
    && typeof importToRegister === 'function');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';
    S.clashes = []; S.weekly = [];
    sv('clashes', S.clashes); sv('weekly', S.weekly);
    // Auto-accept the confirm() dialog importFolderPick shows before
    // the loop starts + suppress any secondary modals.
    window.confirm = () => true;
    window.alert = () => {};
    window.showToast = () => {};
    // Suppress cross-test dedup modal (empty register → no dupes anyway).
    window._skipCrossTestDupes = true;
    // Stub loadNwImages so we don't hit IndexedDB — the loop still runs.
    window.loadNwImages = () => {};
    // Nav to BCF so batchLoad's DOM prerequisites are present.
    if (typeof nav === 'function') nav('bcf');
  });
  await page.waitForSelector('#b-file-chips', { timeout: 5000 }).catch(() => {});
}

test.describe('PR-A9-FOLDER-BATCH-IMG-SKIP — folder-batch loop does not silently drop tests when clashes lack nwImageRef', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('two-test batch with missing viewpoints: all clashes across both tests land in S.clashes', async ({ page }) => {
    const result = await page.evaluate(async ({ xml1, xml2 }) => {
      // Construct 2 File objects with distinct webkitRelativePaths so
      // importFolderPick sees a proper folder-shaped pick. NO href on
      // any clashresult → nwImageRef empty on every parsed clash →
      // pre-fix _importToRegisterChecked shows the blocking modal.
      function mkFile(name, content, relPath) {
        const f = new File([content], name, {type: 'text/xml'});
        Object.defineProperty(f, 'webkitRelativePath', {value: relPath, writable: false});
        Object.defineProperty(f, 'lastModified', {value: 0, writable: false});
        return f;
      }
      const files = [
        mkFile('03_GAS_v_08_AMHS.xml', xml1, 'week-260727/260727 FAB AMHS v 7 Clash test/03_GAS_v_08_AMHS.xml'),
        mkFile('04_STR_v_08_AMHS.xml', xml2, 'week-260727/260727 FAB AMHS v 7 Clash test/04_STR_v_08_AMHS.xml'),
      ];
      // Fake inputEl — importFolderPick reads .files and writes .value=''.
      const fakeInput = { files, value: 'ignored' };
      // Track how many times the image-count modal opens — pre-fix it
      // fires twice (once per file); post-fix it never fires for the
      // batch loop.
      let modalOpenCount = 0;
      const origAppend = document.body.appendChild.bind(document.body);
      document.body.appendChild = function(el) {
        if (el && el.id === 'img-count-check-modal') modalOpenCount++;
        return origAppend(el);
      };
      try {
        await importFolderPick(fakeInput);
      } finally {
        document.body.appendChild = origAppend;
      }
      // Wait for the loop's tail setTimeout(150) + a margin.
      await new Promise(r => setTimeout(r, 500));
      // Group by testName so we can prove both tests landed.
      const byTest = {};
      (S.clashes || []).forEach(c => {
        byTest[c.testName] = (byTest[c.testName] || 0) + 1;
      });
      // Any leftover modal DOM node (which pre-fix would leave orphaned)?
      const orphanModal = document.getElementById('img-count-check-modal');
      return {
        total: (S.clashes || []).length,
        byTest,
        distinctTests: Object.keys(byTest).sort(),
        modalOpenCount,
        orphanModalPresent: !!orphanModal,
      };
    }, { xml1: XML_NO_HREF('03_GAS_v_08_AMHS', 3), xml2: XML_NO_HREF('04_STR_v_08_AMHS', 5) });

    // Both tests' clashes present: 3 + 5 = 8 total.
    expect(result.total).toBe(8);
    // Both distinct testNames present. PR-A6 adds the (FAB) suffix.
    expect(result.distinctTests).toEqual([
      '03_GAS_v_08_AMHS (FAB)',
      '04_STR_v_08_AMHS (FAB)',
    ]);
    expect(result.byTest['03_GAS_v_08_AMHS (FAB)']).toBe(3);
    expect(result.byTest['04_STR_v_08_AMHS (FAB)']).toBe(5);
    // Post-fix: the modal never fires inside the loop (single-file
    // path via bloadf still uses it — this is loop-only). Pre-fix it
    // fires 2× and orphans stack up.
    expect(result.modalOpenCount).toBe(0);
    expect(result.orphanModalPresent).toBe(false);
  });

  test('single-file bloadf path is NOT affected — _importToRegisterChecked and its modal are still active there', async ({ page }) => {
    // Guardrail against the fix accidentally removing the modal
    // altogether. The single-file button still calls
    // _importToRegisterChecked, which must still fire the modal when
    // clashes miss nwImageRef.
    const stillWorks = await page.evaluate(() => {
      const src = String(_importToRegisterChecked);
      return {
        stillShowsModal: /_showImgCountMismatchModal/.test(src),
        stillGuardsMissing: /missing\s*[<>]=?/.test(src) || /missing<=0/.test(src),
        singleFileButtonAppend: !!document.querySelector('button[onclick*="_importToRegisterChecked(\'append\')"]'),
        singleFileButtonReplace: !!document.querySelector('button[onclick*="_importToRegisterChecked(\'replace\')"]'),
      };
    });
    expect(stillWorks.stillShowsModal).toBe(true);
    expect(stillWorks.stillGuardsMissing).toBe(true);
    expect(stillWorks.singleFileButtonAppend).toBe(true);
    expect(stillWorks.singleFileButtonReplace).toBe(true);
  });
});
