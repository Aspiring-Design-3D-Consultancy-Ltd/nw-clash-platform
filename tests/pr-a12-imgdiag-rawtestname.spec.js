import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A12-IMGDIAG-RAWTESTNAME contract (region 5 of the PR-A11-
   IMAGE-KEY-RAWTESTNAME marker family):

   The IMG-DIAG block inside openClashDetail's template (working.html
   ~L17734) rebuilds its own composite-key lookup instead of calling
   the resolver functions PR-A11 fixed. Region 5 mirrors PR-A11's
   pattern (c.rawTestName || c.testName || '') so a PR-A6-renamed
   test with a matched image renders the green "📷 NW screenshot"
   label — not the false amber "⚠ Missing: […]" warning.

   Fixture: register with one scoped-name clash. Seed the image
   store keyed by rawTestName. Open the clash detail modal via
   openClashDetail(uid). Post-fix: modal contains "NW screenshot"
   (green). Pre-fix (main): modal contains "Missing:" (amber) for
   the scoped clash. */

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof S !== 'undefined'
    && typeof openClashDetail === 'function');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';
    S.clashes = []; S.weekly = [];
    sv('clashes', S.clashes); sv('weekly', S.weekly);
    window.alert = () => {};
  });
}

function seedImages(page, entries) {
  return page.evaluate((entries) => {
    _nwImages.clear();
    Object.keys(_nwImgByTest).forEach(k => delete _nwImgByTest[k]);
    _nwImgSets.clear(); // IMG-WEEK-KEYING: sets are the source of truth; _nwImgByTest and _nwImages are derived
    _nwImagesByIndex.length = 0;
    _nwImagesByIndex.push(null);
    // 1x1 JPEG so the image resolver returns a truthy b64.
    const B64 = '/9j/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';
    entries.forEach(({rawTn, filenames, firstIdx}) => {
      _nwImgSets.set(_iwkKey(rawTn, 'untagged'), { testName: rawTn, weekTag: 'untagged', firstIdx, count: filenames.length, filenames });
      filenames.forEach((fn, j) => { _nwImagesByIndex[firstIdx + j] = B64; });
    });
    _nwImgCount = _iwkRebuildViews();
  }, entries);
}

test.describe('PR-A12 — IMG-DIAG label reads rawTestName (region 5 of PR-A11-IMAGE-KEY-RAWTESTNAME)', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('scoped-name clash with matched image: label shows green "NW screenshot" (not amber "Missing")', async ({ page }) => {
    await page.evaluate(() => {
      S.clashes = [{
        uid: 'CLX-0001',
        name: 'CLX-0001 — c',
        testName: '03_GAS_v_08_AMHS (FAB)',
        rawTestName: '03_GAS_v_08_AMHS',
        buildingScope: 'FAB',
        disciplineA: 'S', disciplineB: 'M',
        elementA: 'a', elementB: 'b',
        elementIdA: 'A1', elementIdB: 'B1',
        sourceA: 'AMHS-E-F-00.nwc', sourceB: 'AMHS-M-F-00.nwc',
        penetration: '10mm', status: 'Active', priority: 'High',
        assignedTo: '', notes: '',
        date: '01/07/26',
        x: 100, y: 200, z: 300,
        nwImageRef: 'cd000001.jpg',
        testIdx: 0,
        statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
      }];
      sv('clashes', S.clashes);
    });
    await seedImages(page, [
      { rawTn: '03_GAS_v_08_AMHS', filenames: ['cd000001.jpg'], firstIdx: 1 },
    ]);
    // Render the modal and inspect the diagnostic label.
    const diagHtml = await page.evaluate(() => {
      openClashDetail('CLX-0001');
      // Extract only the Plan-View heading row so we don't false-match
      // on incidental "Missing" text elsewhere in the modal (e.g.
      // status-history or notes fields).
      const inner = document.getElementById('cm-inner');
      if (!inner) return null;
      const titles = [...inner.querySelectorAll('.cm-ttl')];
      const planTitle = titles.find(t => /Plan View/.test(t.textContent||''));
      return planTitle ? planTitle.outerHTML : null;
    });
    expect(diagHtml).not.toBeNull();
    // Post-fix: label is the green "NW screenshot" span. Pre-fix
    // (origin/main): amber "⚠ Missing: cd000001.jpg".
    expect(diagHtml).toContain('NW screenshot');
    expect(diagHtml).not.toContain('Missing:');
  });

  test('unscoped legacy clash (pre-A6) with matched image: label still shows green — backwards compat', async ({ page }) => {
    await page.evaluate(() => {
      S.clashes = [{
        uid: 'CLX-LEGACY',
        name: 'CLX-LEGACY — c',
        // No rawTestName — legacy pre-A6 clash. Falls back to testName.
        testName: 'legacy_test',
        disciplineA: 'S', disciplineB: 'M',
        elementA: 'a', elementB: 'b',
        sourceA: 'A.nwc', sourceB: 'B.nwc',
        penetration: '5mm', status: 'Active', priority: 'Low',
        assignedTo: '', notes: '',
        date: '01/07/26',
        x: 0, y: 0, z: 0,
        nwImageRef: 'cd000042.jpg',
        testIdx: 0,
        statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
      }];
      sv('clashes', S.clashes);
    });
    await seedImages(page, [
      { rawTn: 'legacy_test', filenames: ['cd000042.jpg'], firstIdx: 1 },
    ]);
    const diagHtml = await page.evaluate(() => {
      openClashDetail('CLX-LEGACY');
      const inner = document.getElementById('cm-inner');
      if (!inner) return null;
      const titles = [...inner.querySelectorAll('.cm-ttl')];
      const planTitle = titles.find(t => /Plan View/.test(t.textContent||''));
      return planTitle ? planTitle.outerHTML : null;
    });
    expect(diagHtml).not.toBeNull();
    expect(diagHtml).toContain('NW screenshot');
    expect(diagHtml).not.toContain('Missing:');
  });

  test('scoped-name clash with unmatched ref: label still shows amber "Missing" (miss stays a miss)', async ({ page }) => {
    // Guardrail: fix must not make every lookup pass. If the raw-keyed
    // store legitimately has no entry for this filename, the amber
    // Missing warning should still surface.
    await page.evaluate(() => {
      S.clashes = [{
        uid: 'CLX-MISS',
        name: 'CLX-MISS — c',
        testName: 'X (FAB)',
        rawTestName: 'X',
        disciplineA: 'S', disciplineB: 'M',
        elementA: 'a', elementB: 'b',
        sourceA: 'A.nwc', sourceB: 'B.nwc',
        penetration: '5mm', status: 'Active', priority: 'Low',
        assignedTo: '', notes: '',
        date: '01/07/26',
        x: 0, y: 0, z: 0,
        nwImageRef: 'cd999999.jpg',
        testIdx: 5,   // out-of-range for the 1-file store below
        statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
      }];
      sv('clashes', S.clashes);
    });
    await seedImages(page, [
      { rawTn: 'X', filenames: ['cd000001.jpg'], firstIdx: 1 },
    ]);
    const diagHtml = await page.evaluate(() => {
      openClashDetail('CLX-MISS');
      const inner = document.getElementById('cm-inner');
      if (!inner) return null;
      const titles = [...inner.querySelectorAll('.cm-ttl')];
      const planTitle = titles.find(t => /Plan View/.test(t.textContent||''));
      return planTitle ? planTitle.outerHTML : null;
    });
    expect(diagHtml).not.toBeNull();
    expect(diagHtml).toContain('Missing:');
    expect(diagHtml).not.toContain('NW screenshot');
  });
});
