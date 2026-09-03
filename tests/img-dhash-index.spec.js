import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(async () => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    try { await idbClear(); } catch (e) { /* nothing stored yet */ }
    _dhashIndex.clear();
    Object.keys(_nwImgByTest).forEach(k => delete _nwImgByTest[k]);
    _nwImages.clear();
    _nwImagesByIndex.length = 0;
    _nwImgCount = 0;
  });
}

// Real PNG Files built in-page so loadNwImages and computeDHash run for real.
// Gradients and stripes give the row comparisons something to bite on; a
// solid fill would hash to all zeros.
const MAKERS = `
const _mkFile = (name, draw) => new Promise(res => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); draw(g, c);
  c.toBlob(b => res(new File([b], name, { type: 'image/png' })), 'image/png');
});
const gradient = (g) => {
  const gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
};
// A near miss must survive the 9x8 downscale: a 3px dot does not (it hashes
// identically to the plain gradient), a dark band over one column of the top
// three rows flips a handful of row comparisons and nothing else.
const gradientDot = (g) => { gradient(g); g.fillStyle = '#000'; g.fillRect(48, 0, 8, 24); };
const stripes = (g) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#000'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 8, 64);
};
const b64Of = (draw) => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; draw(c.getContext('2d'), c); return c.toDataURL('image/png').split(',')[1]; };
`;

const HEX16 = /^[0-9a-f]{16}$/;

test.describe('IMG-DHASH-INDEX — referenced-slot hash index', () => {
  test('loadNwImages writes dhashByIdx into the metadata block and fills the in-memory index', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      const files = [await _mkFile('img1.png', gradient), await _mkFile('img2.png', stripes), await _mkFile('img3.png', gradientDot)];
      await loadNwImages(files, 'T1');
      const meta = await idbGet(0);
      const recs = [];
      for (let i = 1; i <= 3; i++) recs.push(await idbGet(i));
      return {
        byTest: meta.byTest, dhashByIdx: meta.dhashByIdx,
        recHashes: recs.map(x => x.dhash),
        mem: [..._dhashIndex.entries()],
        keys: await idbGetAllKeys(),
      };
    })()`);
    expect(r.byTest.T1).toMatchObject({ firstIdx: 1, count: 3 });
    expect(Object.keys(r.dhashByIdx).sort()).toEqual(['1', '2', '3']);
    for (let i = 1; i <= 3; i++) {
      expect(r.dhashByIdx[i]).toMatch(HEX16);
      expect(r.dhashByIdx[i]).toBe(r.recHashes[i - 1]);   // index mirrors the record
    }
    expect(r.mem.length).toBe(3);
    expect(r.keys.every(k => typeof k === 'number')).toBe(true); // no sidecar keys
  });

  test('initNwImages restores the index from metadata without loading payloads', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages([await _mkFile('img1.png', gradient), await _mkFile('img2.png', stripes)], 'T1');
      const expected = Object.assign({}, (await idbGet(0)).dhashByIdx);
      _dhashIndex.clear();
      _nwImagesByIndex.length = 0;
      if (!S.clashes.length) S.clashes.push({ uid: 'keep-orphan-sweep-off' });
      await initNwImages();
      return { expected, mem: Object.fromEntries(_dhashIndex), cached: _nwImagesByIndex.slice(1).map(x => x === undefined) };
    })()`);
    expect(r.mem).toEqual(r.expected);
    expect(Object.keys(r.mem).length).toBe(2);
    expect(r.cached).toEqual([true, true]);   // lazy — payloads not read on restore
  });

  test('backfill indexes referenced legacy records, skips orphans, persists once; the rerun reads no indexed payloads', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      // Store as an earlier build left it: bare-string records, no index. Slots
      // 1..3 are referenced by T1; 4 and 5 are orphans.
      await idbPut(0, { shape: 'imgfix-v1', count: 3, byTest: { T1: { firstIdx: 1, count: 3, filenames: ['a.png', 'b.png', 'c.png'] } } });
      _nwImgByTest.T1 = { firstIdx: 1, count: 3, filenames: ['a.png', 'b.png', 'c.png'] };
      const g = b64Of(gradient), s = b64Of(stripes);
      await idbPut(1, g); await idbPut(2, s); await idbPut(3, g); await idbPut(4, s); await idbPut(5, g);

      let puts0 = 0; const oPut = idbPut;
      window.idbPut = async (k, v) => { if (k === 0) puts0++; return oPut(k, v); };
      const first = await _dhashBackfill();
      const meta = await idbGet(0);
      const rec4 = await idbGet(4);

      let gets = []; const oGet = idbGet;
      window.idbGet = async (k) => { gets.push(k); return oGet(k); };
      const second = await _dhashBackfill();
      window.idbGet = oGet; window.idbPut = oPut;
      return { first, second, puts0, dhashByIdx: meta.dhashByIdx, byTest: meta.byTest, rec4Hashed: !!(rec4 && rec4.dhash), gets, mem: _dhashIndex.size };
    })()`);
    // Phase 1 contract kept: every numeric key gets hashed, orphans included.
    expect(r.first).toMatchObject({ hashed: 5, already: 0, failed: 0, indexed: 3, total: 5 });
    expect(r.rec4Hashed).toBe(true);
    // Index covers exactly the referenced slots, written in one metadata put.
    expect(Object.keys(r.dhashByIdx).sort()).toEqual(['1', '2', '3']);
    expect(r.puts0).toBe(1);
    expect(r.byTest.T1).toMatchObject({ firstIdx: 1, count: 3 });
    expect(r.mem).toBe(3);
    // Rerun: indexed slots are counted done without a payload read; only the
    // two orphans are read, and nothing new is indexed or written.
    expect(r.second).toMatchObject({ hashed: 0, already: 5, failed: 0, indexed: 0, total: 5 });
    expect(r.gets.filter(k => k !== 0).sort()).toEqual([4, 5]);
  });

  test('backfill leaves the metadata block untouched when nothing is referenced (Phase 1 guarantee)', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      const g = b64Of(gradient);
      // Case A: metadata with no ranges.
      const metaA = { shape: 'imgfix-v1', count: 2, byTest: {} };
      await idbPut(0, metaA); await idbPut(1, g); await idbPut(2, g);
      const resA = await _dhashBackfill();
      const afterA = await idbGet(0);
      // Case B: no metadata block at all.
      await idbClear(); _dhashIndex.clear();
      await idbPut(1, g); await idbPut(2, g);
      const resB = await _dhashBackfill();
      const keysB = await idbGetAllKeys();
      return { resA, sameA: JSON.stringify(afterA) === JSON.stringify(metaA), resB, keysB };
    })()`);
    expect(r.resA).toMatchObject({ hashed: 2, indexed: 0 });
    expect(r.sameA).toBe(true);
    expect(r.resB).toMatchObject({ hashed: 2, indexed: 0 });
    expect(r.keysB).toEqual([1, 2]);   // no key 0 created
  });

  test('re-loading a test prunes index entries for slots it no longer covers', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages([await _mkFile('img1.png', gradient), await _mkFile('img2.png', stripes), await _mkFile('img3.png', gradientDot)], 'T1');
      const before = Object.keys((await idbGet(0)).dhashByIdx).sort();
      await loadNwImages([await _mkFile('img1.png', stripes)], 'T1');
      const meta = await idbGet(0);
      return { before, after: Object.keys(meta.dhashByIdx).sort(), byTest: meta.byTest, mem: _dhashIndex.size };
    })()`);
    expect(r.before).toEqual(['1', '2', '3']);
    expect(r.byTest.T1).toMatchObject({ firstIdx: 1, count: 1 });
    expect(r.after).toEqual(['1']);
    expect(r.mem).toBe(1);
  });

  test('findSimilarImages groups matching images across tests and maps them back to test and filename', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages([await _mkFile('img1.png', gradient), await _mkFile('img2.png', stripes), await _mkFile('img3.png', gradientDot)], 'T1');
      await loadNwImages([await _mkFile('img1.png', gradient)], 'T2');
      const h = Object.fromEntries(_dhashIndex);
      return {
        exact: findSimilarImages(0),
        near: findSimilarImages(10),
        dGradDot: _dhashHamming(h[1], h[3]),
        dGradStripes: _dhashHamming(h[1], h[2]),
        idxCount: _dhashIndex.size,
      };
    })()`);
    expect(r.idxCount).toBe(4);
    // Fixture sanity: the band is a near miss (not identical), the stripes are not.
    expect(r.dGradDot).toBeGreaterThan(0);
    expect(r.dGradDot).toBeLessThanOrEqual(10);
    expect(r.dGradStripes).toBeGreaterThan(10);
    // Distance 0: the two identical gradients, one per test.
    expect(r.exact.length).toBe(1);
    expect(r.exact[0]).toMatchObject({ size: 2, crossTest: true, tests: ['T1', 'T2'] });
    expect(r.exact[0].members.map(m => m.testName + '::' + m.filename)).toEqual(['T1::img1.png', 'T2::img1.png']);
    // Distance 10: the dotted gradient joins; the stripes never do.
    expect(r.near.length).toBe(1);
    expect(r.near[0].size).toBe(3);
    expect(r.near[0].members.map(m => m.filename)).toEqual(['img1.png', 'img3.png', 'img1.png']);
    expect(r.near[0].members.some(m => m.filename === 'img2.png')).toBe(false);
  });

  test('_dhashHamming counts differing bits and rejects malformed input', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(() => ({
      same: _dhashHamming('0123456789abcdef', '0123456789abcdef'),
      all: _dhashHamming('ffffffffffffffff', '0000000000000000'),
      nibble: _dhashHamming('f000000000000000', '0000000000000000'),
      one: _dhashHamming('0000000000000001', '0000000000000000'),
      bad: _dhashHamming('short', '0000000000000000'),
      nul: _dhashHamming(null, '0000000000000000'),
    }));
    expect(r).toEqual({ same: 0, all: 64, nibble: 4, one: 1, bad: 64, nul: 64 });
  });

  test('_dhashIndexGet falls back to the record for an unindexed slot and caches it if referenced', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => {
      await idbPut(0, { shape: 'imgfix-v1', count: 2, byTest: { T1: { firstIdx: 1, count: 1, filenames: ['a.png'] } } });
      _nwImgByTest.T1 = { firstIdx: 1, count: 1, filenames: ['a.png'] };
      await idbPut(1, { b64: 'AA==', dhash: '0123456789abcdef' });
      await idbPut(2, { b64: 'AA==', dhash: 'fedcba9876543210' });   // orphan
      await idbPut(3, 'AA==');                                         // never hashed
      _dhashIndex.clear();
      const a = await _dhashIndexGet(1);
      const b = await _dhashIndexGet(2);
      const c = await _dhashIndexGet(3);
      const d = await _dhashIndexGet(99);
      return { a, b, c, d, mem: Object.fromEntries(_dhashIndex) };
    })()`);
    expect(r.a).toBe('0123456789abcdef');
    expect(r.b).toBe('fedcba9876543210');
    expect(r.c).toBeNull();
    expect(r.d).toBeNull();
    expect(r.mem).toEqual({ 1: '0123456789abcdef' });   // orphan read, not cached
  });
});
