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

// Two tests own slots 1..3 and 4..5; keys 6,7,8 and 20 are orphans.
const SEED = `
  await idbPut(0, { shape: 'imgfix-v1', count: 5, loadedAt: Date.now(), byTest: {
    T1: { firstIdx: 1, count: 3, filenames: ['a.png', 'b.png', 'c.png'] },
    T2: { firstIdx: 4, count: 2, filenames: ['d.png', 'e.png'] },
  } });
  for (const k of [1, 2, 3, 4, 5]) await idbPut(k, { b64: 'REF' + k, dhash: '0123456789abcdef' });
  for (const k of [6, 7, 8, 20]) await idbPut(k, { b64: 'ORPHAN' + k, dhash: null });
  const snap = async () => JSON.stringify({ keys: await idbGetAllKeys(), recs: await idbGetAll() });
`;

const MAKERS = `
const _mkFile = (name, seed) => new Promise(res => {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 32, 0); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#000'; g.fillRect((seed * 5) % 28, 0, 4, 12);
  c.toBlob(b => res(new File([b], name, { type: 'image/png' })), 'image/png');
});
const files = async (n, seed) => { const out = []; for (let i = 1; i <= n; i++) out.push(await _mkFile('img' + i + '.png', seed + i)); return out; };
`;

test.describe('IMG-ORPHAN-CLEANUP — console tool', () => {
  test('dry run (the default) reports what it would delete and changes nothing', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      const before = await snap();
      const out = await _cleanupNwImageOrphans();
      return { out, same: before === (await snap()) };
    })()`);
    expect(r.out).toMatchObject({ ok: true, dryRun: true, totalKeys: 10, referenced: 5, orphaned: 4, wouldDelete: 4, deleted: 0, orphanRuns: 2, orphanKeyMin: 6, orphanKeyMax: 20 });
    expect(r.same).toBe(true);
  });

  test('delete mode removes exactly the orphan keys; referenced records and key 0 are byte-identical; verification passes', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      const refBefore = {}; for (const k of [0, 1, 2, 3, 4, 5]) refBefore[k] = JSON.stringify(await idbGet(k));
      const out = await _cleanupNwImageOrphans({ dryRun: false });
      const keys = await idbGetAllKeys();
      const refAfter = {}; for (const k of [0, 1, 2, 3, 4, 5]) refAfter[k] = JSON.stringify(await idbGet(k));
      return { out, keys, same: JSON.stringify(refBefore) === JSON.stringify(refAfter) };
    })()`);
    expect(r.out).toMatchObject({ ok: true, dryRun: false, deleted: 4, referenced: 5, referencedAfter: 5, orphanedAfter: 0, verified: true });
    expect(r.keys).toEqual([0, 1, 2, 3, 4, 5]);
    expect(r.same).toBe(true);
  });

  test('refuses to delete when there is no metadata block, in both modes', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => {
      for (const k of [1, 2, 3]) await idbPut(k, 'AA==');
      const dry = await _cleanupNwImageOrphans();
      const del = await _cleanupNwImageOrphans({ dryRun: false });
      return { dry, del, keys: await idbGetAllKeys() };
    })()`);
    expect(r.dry.ok).toBe(false);
    expect(r.del.ok).toBe(false);
    expect(r.del.deleted).toBe(0);
    expect(r.del.reason).toMatch(/no metadata/);
    expect(r.keys).toEqual([1, 2, 3]);
  });

  test('refuses under a pending wipe and while the dHash backfill is running', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      localStorage.setItem('nw:pendingIdbWipe', '1');
      const a = await _cleanupNwImageOrphans({ dryRun: false });
      localStorage.removeItem('nw:pendingIdbWipe');
      _dhashBackfillRunning = true;
      const b = await _cleanupNwImageOrphans({ dryRun: false });
      _dhashBackfillRunning = false;
      return { a, b, keys: await idbGetAllKeys() };
    })()`);
    expect(r.a.ok).toBe(false); expect(r.a.deleted).toBe(0); expect(r.a.reason).toMatch(/wipe/);
    expect(r.b.ok).toBe(false); expect(r.b.deleted).toBe(0); expect(r.b.reason).toMatch(/backfill/);
    expect(r.keys.length).toBe(10);
  });

  test('the audit and the cleanup agree on the orphan set (shared classifier)', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      const audit = await _auditNwImageStore({ sample: 0 });
      const dry = await _cleanupNwImageOrphans();
      return { audit: { referenced: audit.referenced, orphaned: audit.orphaned, runs: audit.orphanRuns }, dry: { referenced: dry.referenced, orphaned: dry.orphaned, runs: dry.orphanRuns } };
    })()`);
    expect(r.audit).toEqual(r.dry);
  });
});

test.describe('IMG-ORPHAN-CLEANUP — re-loading a test no longer strands its old records', () => {
  test('re-loading a test that is not the highest range deletes its superseded slots', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages(await files(3, 0), 'T1');   // slots 1..3
      await loadNwImages(await files(2, 10), 'T2');  // slots 4..5
      const before = await idbGetAllKeys();
      const res = await loadNwImages(await files(2, 20), 'T1'); // slots 6..7; 1..3 superseded
      const meta = await idbGet(0);
      return { before, after: await idbGetAllKeys(), res, byTest: meta.byTest, idx: Object.keys(meta.dhashByIdx).sort() };
    })()`);
    expect(r.before).toEqual([0, 1, 2, 3, 4, 5]);
    expect(r.byTest.T1).toMatchObject({ firstIdx: 6, count: 2 });
    expect(r.byTest.T2).toMatchObject({ firstIdx: 4, count: 2 });
    expect(r.res.superseded).toBe(3);
    expect(r.after).toEqual([0, 4, 5, 6, 7]);
    expect(r.idx).toEqual(['4', '5', '6', '7']);
  });

  test('re-loading the highest range with fewer images overwrites in place and deletes the tail', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages(await files(3, 0), 'T1');   // slots 1..3
      const old1 = (await idbGet(1)).b64;
      const res = await loadNwImages(await files(1, 30), 'T1'); // slot 1 reused, 2..3 superseded
      return { res, keys: await idbGetAllKeys(), new1: (await idbGet(1)).b64, old1 };
    })()`);
    expect(r.keys).toEqual([0, 1]);
    expect(r.res.superseded).toBe(2);
    expect(r.new1).not.toBe(r.old1);
  });

  test('a failed metadata write keeps the superseded records (old metadata still points at them)', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages(await files(3, 0), 'T1');   // slots 1..3
      await loadNwImages(await files(2, 10), 'T2');  // slots 4..5, so T1's re-load appends at 6
      const oPut = idbPut;
      window.idbPut = async (k, v) => { if (k === 0) throw new Error('simulated metadata write failure'); return oPut(k, v); };
      const res = await loadNwImages(await files(2, 40), 'T1'); // slots 6..7 written, metadata write fails
      window.idbPut = oPut;
      return { res, keys: await idbGetAllKeys(), metaT1: (await idbGet(0)).byTest.T1 };
    })()`);
    expect(r.res.superseded).toBe(0);
    expect(r.keys).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);    // old slots 1..3 not deleted
    expect(r.metaT1).toMatchObject({ firstIdx: 1, count: 3 }); // old metadata intact
  });

  test('a full weekly re-import of every test leaves no orphans behind', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      const names = ['A', 'B', 'C'];
      for (let week = 0; week < 3; week++) for (const n of names) await loadNwImages(await files(2, week * 10), n);
      const audit = await _auditNwImageStore({ sample: 0 });
      return { keys: (await idbGetAllKeys()).length, referenced: audit.referenced, orphaned: audit.orphaned };
    })()`);
    expect(r.orphaned).toBe(0);
    expect(r.referenced).toBe(6);
    expect(r.keys).toBe(7);
  });
});
