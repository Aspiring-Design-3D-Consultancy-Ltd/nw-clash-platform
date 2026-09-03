import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A11-IMAGE-KEY-RAWTESTNAME contract:
   loadNwImages(files, testName) receives baseName (raw XML filename,
   unscoped) from importFolderPick and stores images under key
   baseName + '::' + filename in _nwImages. After PR-A6 renamed
   c.testName to carry a "(FAB)" / "(CUP)" suffix, hasNwImage /
   getNwImageB64 / getNwImageB64Sync were still keying by
   c.testName — the composite lookup always missed on renamed tests
   even though the images were correctly stored.

   Fix: read c.rawTestName (which PR-A6 stamps at parse time and
   preserves on every clash) with a c.testName fallback for pre-A6
   registers. _posClashCount buckets by the same key so the
   positional-fallback safety check matches.

   Fixture: two clashes with same rawTestName='03_GAS_v_08_AMHS'
   but different scoped testNames ("(FAB)" vs "(CUP)"), each with
   its own nwImageRef. Preload the _nwImages map keyed by
   rawTestName. Post-fix: both lookups resolve. Pre-fix: both miss.

   Backwards-compat probe: a legacy clash with only c.testName (no
   rawTestName) whose testName matches the image-store key still
   resolves — proves the fallback covers pre-A6 registers. */

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof S !== 'undefined'
    && typeof getNwImageB64 === 'function'
    && typeof getNwImageB64Sync === 'function'
    && typeof hasNwImage === 'function'
    && typeof _posClashCount === 'function');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';
    S.clashes = []; S.weekly = [];
    sv('clashes', S.clashes); sv('weekly', S.weekly);
    window.alert = () => {};
    window.confirm = () => true;
  });
}

// Seed the in-memory image state to look like a completed loadNwImages
// call: composite key by baseName, per-test tracker, index cache with a
// tiny 1x1 JPEG b64 payload so getNwImageB64Sync can prove a hit vs miss.
function seedImages(page, entries) {
  return page.evaluate((entries) => {
    _nwImages.clear();
    Object.keys(_nwImgByTest).forEach(k => delete _nwImgByTest[k]);
    _nwImgSets.clear(); // IMG-WEEK-KEYING: sets are the source of truth; _nwImgByTest and _nwImages are derived
    _nwImagesByIndex.length = 0;
    _nwImagesByIndex.push(null);
    const B64 = '/9j/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';
    entries.forEach(({rawTn, filenames, firstIdx}) => {
      _nwImgSets.set(_iwkKey(rawTn, 'untagged'), { testName: rawTn, weekTag: 'untagged', firstIdx, count: filenames.length, filenames });
      filenames.forEach((fn, j) => { _nwImagesByIndex[firstIdx + j] = B64; });
    });
    _nwImgCount = _iwkRebuildViews();
  }, entries);
}

test.describe('PR-A11-IMAGE-KEY-RAWTESTNAME — image lookups read rawTestName so PR-A6 rename does not orphan images', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('same-leaf CUP + FAB tests: getNwImageB64 resolves via rawTestName even though testName carries (FAB)/(CUP)', async ({ page }) => {
    // Two clashes with the SAME rawTestName (matches loadNwImages'
    // baseName) but DIFFERENT scoped testNames — this is the exact
    // PR-A6 fixture shape (03_GAS_v_08_AMHS.xml in both a FAB and
    // a CUP subfolder).
    await page.evaluate(() => {
      S.clashes = [
        {uid:'CLX-0001', testName:'03_GAS_v_08_AMHS (FAB)', rawTestName:'03_GAS_v_08_AMHS', buildingScope:'FAB',
         nwImageRef:'cd000001.jpg', testIdx:0, sourceA:'AMHS-E-F-00.nwc', sourceB:'AMHS-M-F-00.nwc', x:0, y:0, z:0},
        {uid:'CLX-0002', testName:'03_GAS_v_08_AMHS (CUP)', rawTestName:'03_GAS_v_08_AMHS', buildingScope:'CUP',
         nwImageRef:'cd000001.jpg', testIdx:0, sourceA:'AMHS-E-C-00.nwc', sourceB:'AMHS-M-C-00.nwc', x:0, y:0, z:0},
      ];
      sv('clashes', S.clashes);
    });
    await seedImages(page, [
      { rawTn: '03_GAS_v_08_AMHS', filenames: ['cd000001.jpg'], firstIdx: 1 },
    ]);
    const result = await page.evaluate(async () => {
      const fab = S.clashes[0], cup = S.clashes[1];
      return {
        fabHas: hasNwImage(fab),
        cupHas: hasNwImage(cup),
        fabAsync: !!(await getNwImageB64(fab)),
        cupAsync: !!(await getNwImageB64(cup)),
        fabSync: !!getNwImageB64Sync(fab),
        cupSync: !!getNwImageB64Sync(cup),
      };
    });
    expect(result.fabHas).toBe(true);
    expect(result.cupHas).toBe(true);
    expect(result.fabAsync).toBe(true);
    expect(result.cupAsync).toBe(true);
    expect(result.fabSync).toBe(true);
    expect(result.cupSync).toBe(true);
  });

  test('positional-fallback safety condition uses rawTestName-bucketed clash count', async ({ page }) => {
    // Positional fallback fires only when per-test image count ==
    // per-test clash count. Both counts must key by rawTestName after
    // PR-A11; otherwise pre-A11 bucketing (by scoped testName) leaves
    // clashes at 1-per-scope and images at N-per-rawTestName so the
    // safety check silently blocks the fallback.
    await page.evaluate(() => {
      // 3 clashes in the FAB scope, 3 in the CUP scope — same rawTestName.
      S.clashes = [
        {uid:'CLX-1', testName:'T (FAB)', rawTestName:'T', nwImageRef:'', testIdx:0},
        {uid:'CLX-2', testName:'T (FAB)', rawTestName:'T', nwImageRef:'', testIdx:1},
        {uid:'CLX-3', testName:'T (FAB)', rawTestName:'T', nwImageRef:'', testIdx:2},
        {uid:'CLX-4', testName:'T (CUP)', rawTestName:'T', nwImageRef:'', testIdx:3},
        {uid:'CLX-5', testName:'T (CUP)', rawTestName:'T', nwImageRef:'', testIdx:4},
        {uid:'CLX-6', testName:'T (CUP)', rawTestName:'T', nwImageRef:'', testIdx:5},
      ];
      sv('clashes', S.clashes);
    });
    await seedImages(page, [
      { rawTn: 'T', filenames: ['a.jpg','b.jpg','c.jpg','d.jpg','e.jpg','f.jpg'], firstIdx: 1 },
    ]);
    const result = await page.evaluate(async () => {
      // _posClashCount by rawTestName should be 6 (all clashes,
      // regardless of scope suffix).
      const rawCount = _posClashCount('T');
      // Every clash must resolve via positional fallback since
      // count-match holds and testIdx is in-range.
      const misses = [];
      for (const c of S.clashes) {
        if (!(await getNwImageB64(c))) misses.push(c.uid);
      }
      return { rawCount, misses };
    });
    expect(result.rawCount).toBe(6);
    expect(result.misses).toEqual([]);
  });

  test('backwards compat: pre-A6 clash (no rawTestName) still resolves via testName fallback', async ({ page }) => {
    // A legacy register clash from before PR-A6 has no rawTestName;
    // its c.testName is the unscoped baseName. Fallback keeps it
    // working with images loaded pre-A6.
    await page.evaluate(() => {
      S.clashes = [
        {uid:'CLX-LEGACY', testName:'legacy_test', nwImageRef:'cd000042.jpg', testIdx:0, sourceA:'A.nwc', sourceB:'B.nwc', x:0, y:0, z:0},
      ];
      sv('clashes', S.clashes);
    });
    await seedImages(page, [
      { rawTn: 'legacy_test', filenames: ['cd000042.jpg'], firstIdx: 1 },
    ]);
    const result = await page.evaluate(async () => {
      const c = S.clashes[0];
      return {
        has: hasNwImage(c),
        async: !!(await getNwImageB64(c)),
        sync: !!getNwImageB64Sync(c),
      };
    });
    expect(result.has).toBe(true);
    expect(result.async).toBe(true);
    expect(result.sync).toBe(true);
  });

  test('miss stays a miss — an unrelated testName does NOT accidentally match via fallback', async ({ page }) => {
    // Fixed images for testName 'X'; a clash for testName 'Y'
    // must not resolve.
    await page.evaluate(() => {
      S.clashes = [
        {uid:'CLX-Y', testName:'Y (FAB)', rawTestName:'Y', nwImageRef:'cd000001.jpg', testIdx:0, sourceA:'A.nwc', sourceB:'B.nwc', x:0, y:0, z:0},
      ];
      sv('clashes', S.clashes);
    });
    await seedImages(page, [
      { rawTn: 'X', filenames: ['cd000001.jpg'], firstIdx: 1 },
    ]);
    const result = await page.evaluate(async () => {
      const c = S.clashes[0];
      return {
        has: hasNwImage(c),
        async: await getNwImageB64(c),
        sync: getNwImageB64Sync(c),
      };
    });
    expect(result.has).toBe(false);
    expect(result.async).toBeNull();
    expect(result.sync).toBeNull();
  });
});
