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
  });
}

// Two tests own slots 1..3 and 4..5. Slot 3 is missing from the store.
// Keys 6,7,8 and 20 are orphans (present, but no range covers them).
// Key 7 is a legacy bare-string record; key 8 is stored without a hash.
const SEED = `
  await idbPut(0, { shape: 'imgfix-v1', count: 5, loadedAt: Date.now(), byTest: {
    T1: { firstIdx: 1, count: 3, filenames: ['a.png', 'b.png', 'c.png'] },
    T2: { firstIdx: 4, count: 2, filenames: ['d.png', 'e.png'] },
  } });
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  for (const k of [1, 2, 4, 5, 6]) await idbPut(k, { b64, dhash: '0123456789abcdef' });
  await idbPut(7, b64);
  await idbPut(8, { b64, dhash: null });
  await idbPut(20, { b64, dhash: 'fedcba9876543210' });
`;

test.describe('IMG-STORE-AUDIT — read-only audit of the images store', () => {
  test('the audit function exists and is callable from the console', async ({ page }) => {
    await bootstrap(page);
    const t = await page.evaluate(() => typeof _auditNwImageStore);
    expect(t).toBe('function');
  });

  test('an empty store audits clean', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(async () => await _auditNwImageStore());
    expect(r.ok).toBe(true);
    expect(r.totalKeys).toBe(0);
    expect(r.metaPresent).toBe(false);
    expect(r.referenced).toBe(0);
    expect(r.orphaned).toBe(0);
    expect(r.missing).toBe(0);
  });

  test('classifies referenced, orphaned, missing slots against the byTest ranges', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED} return await _auditNwImageStore(); })()`);
    expect(r.ok).toBe(true);
    expect(r.totalKeys).toBe(9);          // key 0 + 8 image keys
    expect(r.metaPresent).toBe(true);
    expect(r.metaShape).toBe('imgfix-v1');
    expect(r.metaCount).toBe(5);
    expect(r.tests).toBe(2);
    expect(r.referencedSlots).toBe(5);
    expect(r.referenced).toBe(4);         // 1,2,4,5
    expect(r.missing).toBe(1);            // slot 3
    expect(r.orphaned).toBe(4);           // 6,7,8,20
    expect(r.overlapping).toBe(0);
    expect(r.nonNumericKeys).toBe(0);
    expect(r.orphanRuns).toBe(2);         // 6-8 and 20
    expect(r.orphanKeyMin).toBe(6);
    expect(r.orphanKeyMax).toBe(20);
    expect(r.largestOrphanRuns[0]).toEqual({ from: 6, to: 8, n: 3 });
    const t1 = r.byTest.find(t => t.testName === 'T1');
    expect(t1).toMatchObject({ firstIdx: 1, count: 3, present: 2, missing: 1 });
    const t2 = r.byTest.find(t => t.testName === 'T2');
    expect(t2).toMatchObject({ firstIdx: 4, count: 2, present: 2, missing: 0 });
  });

  test('the sample reports record shapes and hash coverage per class', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED} return await _auditNwImageStore(); })()`);
    expect(r.sample.referenced).toMatchObject({ n: 4, objectShape: 4, legacyShape: 0, hashed: 4, unhashed: 0, unreadable: 0 });
    expect(r.sample.orphaned).toMatchObject({ n: 4, objectShape: 3, legacyShape: 1, hashed: 2, unhashed: 1, unreadable: 0 });
    expect(r.sample.orphaned.avgDecodedBytes).toBeGreaterThan(0);
    expect(r.estDecodedBytes.orphaned).toBe(r.sample.orphaned.avgDecodedBytes * 4);
    expect(r.estDecodedBytes.referenced).toBe(r.sample.referenced.avgDecodedBytes * 4);
  });

  test('sample:0 skips payload reads entirely', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      let gets = 0; const orig = idbGet;
      window.idbGet = async (k) => { gets++; return orig(k); };
      const out = await _auditNwImageStore({ sample: 0 });
      window.idbGet = orig;
      return { out, gets };
    })()`);
    expect(r.out.sample).toBeNull();
    expect(r.out.estDecodedBytes).toBeNull();
    expect(r.gets).toBe(1);               // only the metadata block
    expect(r.out.orphaned).toBe(4);
  });

  test('overlapping ranges are counted, not hidden', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => {
      await idbPut(0, { shape: 'imgfix-v1', count: 4, byTest: {
        A: { firstIdx: 1, count: 2, filenames: ['a', 'b'] },
        B: { firstIdx: 2, count: 2, filenames: ['c', 'd'] },
      } });
      for (const k of [1, 2, 3]) await idbPut(k, { b64: 'AA==', dhash: null });
      return await _auditNwImageStore({ sample: 0 });
    })()`);
    expect(r.overlapping).toBe(1);        // slot 2 claimed by A and B
    expect(r.referencedSlots).toBe(3);
    expect(r.referenced).toBe(3);
    expect(r.orphaned).toBe(0);
  });

  test('writes nothing — store contents and every nw:* key are byte-identical afterwards', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${SEED}
      localStorage.setItem('nw:auditProbe', 'untouched');
      const snap = async () => JSON.stringify({
        keys: await idbGetAllKeys(),
        recs: await idbGetAll(),
        ls: Object.keys(localStorage).filter(k => k.startsWith('nw:')).sort().map(k => [k, localStorage.getItem(k)]),
      });
      const before = await snap();
      let puts = 0, dels = 0;
      const oPut = idbPut, oClear = idbClear;
      window.idbPut = async (...a) => { puts++; return oPut(...a); };
      window.idbClear = async (...a) => { dels++; return oClear(...a); };
      await _auditNwImageStore();
      window.idbPut = oPut; window.idbClear = oClear;
      const after = await snap();
      return { same: before === after, puts, dels };
    })()`);
    expect(r.same).toBe(true);
    expect(r.puts).toBe(0);
    expect(r.dels).toBe(0);
  });

  test('a store with records but no metadata block reports every image as orphaned', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => {
      for (const k of [1, 2, 3]) await idbPut(k, 'AA==');
      return await _auditNwImageStore({ sample: 0 });
    })()`);
    expect(r.metaPresent).toBe(false);
    expect(r.tests).toBe(0);
    expect(r.referenced).toBe(0);
    expect(r.orphaned).toBe(3);
    expect(r.orphanRuns).toBe(1);
  });
});
