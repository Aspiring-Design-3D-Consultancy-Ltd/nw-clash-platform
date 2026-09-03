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
    try { await idbClear(); } catch (e) {}
    _dhashIndex.clear();
    _nwImgSets.clear(); Object.keys(_nwImgLatest).forEach(k => delete _nwImgLatest[k]);
    _nwImages.clear(); _nwImagesByIndex.length = 0; _nwImgCount = 0;
    S.clashes = []; S.dedupQueue = [];
  });
}

// Real PNGs through loadNwImages so the hashes are real. img1/img2 identical
// gradients (0 bits apart), img3 a gradient with a band (a few bits), img4
// stripes (far).
const SEED = `
const _mkFile = (name, draw) => new Promise(res => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); draw(g); c.toBlob(b => res(new File([b], name, { type: 'image/png' })), 'image/png');
});
const grad = g => { const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); };
const band = g => { grad(g); g.fillStyle = '#000'; g.fillRect(48, 0, 8, 24); };
const stripes = g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#000'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 8, 64); };
await loadNwImages([await _mkFile('img1.png', grad), await _mkFile('img2.png', grad), await _mkFile('img3.png', band), await _mkFile('img4.png', stripes)], 'T1', 'week-260831');
const mk = (uid, ref) => ({ uid, name: uid, testName: 'T1', rawTestName: 'T1', weekTag: 'week-260831', nwImageRef: ref, status: 'Active', x: 1, y: 2, z: 3, statusHistory: [] });
S.clashes = [mk('CLX-001', 'img1.png'), mk('CLX-002', 'img2.png'), mk('CLX-003', 'img3.png'), mk('CLX-004', 'img4.png'), mk('CLX-005', '')];
S.dedupQueue = [
  { dedupPairId: 'dq-CLX-001-CLX-002', a: 'CLX-001', b: 'CLX-002', distMm: 3.2,  skipped: false, resolved: false, resolvedAction: null },
  { dedupPairId: 'dq-CLX-001-CLX-003', a: 'CLX-001', b: 'CLX-003', distMm: 40,   skipped: false, resolved: false, resolvedAction: null },
  { dedupPairId: 'dq-CLX-001-CLX-004', a: 'CLX-001', b: 'CLX-004', distMm: 300,  skipped: true,  resolved: false, resolvedAction: null },
  { dedupPairId: 'dq-CLX-002-CLX-005', a: 'CLX-002', b: 'CLX-005', distMm: 12,   skipped: false, resolved: false, resolvedAction: null },
  { dedupPairId: 'dq-CLX-003-CLX-004', a: 'CLX-003', b: 'CLX-004', distMm: 60,   skipped: false, resolved: true,  resolvedAction: 'keep-separate' },
  { dedupPairId: 'dq-CLX-002-CLX-099', a: 'CLX-002', b: 'CLX-099', distMm: 2,    skipped: false, resolved: true,  resolvedAction: 'merge' },
];
localStorage.setItem('nw:dedupActionHistory', JSON.stringify([
  { type: 'action', action: 'merge', pairId: 'dq-CLX-002-CLX-099', aClashId: 'CLX-002', bClashId: 'CLX-099', distMm: 2 },
  { type: 'action', action: 'keep-separate', pairId: 'dq-CLX-001-CLX-004', aClashId: 'CLX-001', bClashId: 'CLX-004', distMm: 300 },
]));
`;

test.describe('PIXEL-DEDUP-AUTOMERGE — Stage 1 similarity probe (read-only)', () => {
  test('buckets live pairs by Hamming distance and reports what could not be computed', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED} return await _dedupSimilarityProbe(); })()`);
    expect(r.queue).toEqual({ total: 6, live: 3, skipped: 1, resolvedKeepSeparate: 1, resolvedMerge: 1 });
    expect(r.live.pairs).toBe(3);
    expect(r.live.computable).toBe(2);      // 001-002 and 001-003
    expect(r.live.noImage).toBe(1);         // CLX-005 has no image ref
    // Identical gradients are 0 bits apart and land in 0-4 with their id listed.
    const same = r.rows.find(x => x.pairId === 'dq-CLX-001-CLX-002');
    expect(same.hamming).toBe(0);
    expect(r.live.hamming['0-4'].examples).toContain('dq-CLX-001-CLX-002');
    // The banded gradient is a near miss: a few bits, not zero, not far.
    const near = r.rows.find(x => x.pairId === 'dq-CLX-001-CLX-003');
    expect(near.hamming).toBeGreaterThan(0);
    expect(near.hamming).toBeLessThanOrEqual(10);
    // Every computable pair sits in exactly one bucket.
    const total = Object.values(r.live.hamming).reduce((n, b) => n + b.count, 0);
    expect(total).toBe(2);
    expect(r.live.distMm['1-5mm']).toBe(1);
    expect(r.live.distMm['25-100mm']).toBe(1);
    expect(r.live.distMm['5-25mm']).toBe(1);
  });

  test('keep-separate pairs are gathered from the queue and the action history, de-duplicated by pair id', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED} return await _dedupSimilarityProbe(); })()`);
    // dq-CLX-003-CLX-004 from the queue + dq-CLX-001-CLX-004 from history.
    expect(r.keepSeparate.pairs).toBe(2);
    expect(r.keepSeparate.computable).toBe(2);
    const far = r.rows.filter(x => x.group === 'keep-separate');
    expect(far.every(x => x.hamming > 10)).toBe(true);   // stripes vs gradients
  });

  test('merged pairs whose newer clash is gone are counted but not computed', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED} return await _dedupSimilarityProbe(); })()`);
    expect(r.history.merges).toBe(1);
    expect(r.merged.pairs).toBe(1);
    expect(r.merged.computable).toBe(0);
    expect(r.merged.missingClash).toBe(1);
  });

  test('writes nothing — queue, register, history, nw:* keys and the image store are byte-identical afterwards', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      const snap = async () => JSON.stringify({
        q: S.dedupQueue, c: S.clashes,
        ls: Object.keys(localStorage).filter(k => k.startsWith('nw:')).sort().map(k => [k, localStorage.getItem(k)]),
        keys: await idbGetAllKeys(), meta: await idbGet(0),
      });
      const before = await snap();
      let puts = 0; const oPut = idbPut; window.idbPut = async (...a) => { puts++; return oPut(...a); };
      await _dedupSimilarityProbe();
      window.idbPut = oPut;
      return { same: before === (await snap()), puts };
    })()`);
    expect(r.same).toBe(true);
    expect(r.puts).toBe(0);
  });

  test('an empty queue produces an empty, well-formed report', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(async () => await _dedupSimilarityProbe());
    expect(r.queue.total).toBe(0);
    expect(r.live.pairs).toBe(0);
    expect(r.rows).toEqual([]);
    expect(Object.keys(r.live.hamming)).toEqual(['0-4', '5-8', '9-12', '13-16', '>16']);
  });
});
