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

// Distinct, deterministic test images built in-page. Solid fills are useless
// here — every adjacent pair compares equal, so any two of them hash to the
// same all-zero value. Gradients and stripes give the row comparisons
// something to bite on.
const MAKERS = `
const _mk = (draw) => {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  draw(g, c);
  return c.toDataURL('image/png').split(',')[1];
};
const imgDarkToLight = () => _mk(g => {
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, '#000'); grad.addColorStop(1, '#fff');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
});
const imgLightToDark = () => _mk(g => {
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#000');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
});
const imgStripes = () => _mk(g => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#000';
  for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 8, 64);
});
`;

test.describe('IMG-DHASH-PHASE1 — computeDHash', () => {
  test('returns 16 lowercase hex chars', async ({ page }) => {
    await bootstrap(page);
    const h = await page.evaluate(`(async () => { ${MAKERS}
      return await computeDHash(imgStripes());
    })()`);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  test('determinism — the same image hashes to the same value every time', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      const b64 = imgStripes();
      const a = await computeDHash(b64);
      const b = await computeDHash(b64);
      const c = await computeDHash(b64);
      return { a, b, c };
    })()`);
    expect(r.a).toBe(r.b);
    expect(r.b).toBe(r.c);
  });

  test('determinism survives a round trip through IndexedDB', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      const b64 = imgStripes();
      const before = await computeDHash(b64);
      await idbPut(1, { b64, dhash: before });
      const rec = await idbGet(1);
      const after = await computeDHash(rec.b64);
      return { before, after, stored: rec.dhash };
    })()`);
    expect(r.after).toBe(r.before);
    expect(r.stored).toBe(r.before);
  });

  test('sensitivity — visually different images hash differently', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      return {
        darkToLight: await computeDHash(imgDarkToLight()),
        lightToDark: await computeDHash(imgLightToDark()),
        stripes: await computeDHash(imgStripes()),
      };
    })()`);
    expect(r.darkToLight).not.toBe(r.lightToDark);
    expect(r.darkToLight).not.toBe(r.stripes);
    expect(r.lightToDark).not.toBe(r.stripes);
  });

  test('rejects rather than returning a sentinel on undecodable input', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(async () => {
      const out = { empty: null, garbage: null };
      try { await computeDHash(''); } catch (e) { out.empty = e.message; }
      try { await computeDHash('bm90LWFuLWltYWdl'); } catch (e) { out.garbage = e.message; }
      return out;
    });
    expect(r.empty).toContain('empty input');
    expect(r.garbage).toContain('decode failed');
  });
});

test.describe('IMG-DHASH-PHASE1 — record shape', () => {
  test('legacy bare-string records still read back through _idbGetB64', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      const b64 = imgStripes();
      await idbPut(1, b64);                 // pre-dHash shape
      _nwImagesByIndex.length = 0;          // defeat the memory cache
      const got = await _idbGetB64(1);
      return { match: got === b64, isString: typeof got === 'string' };
    })()`);
    expect(r.isString).toBe(true);
    expect(r.match).toBe(true);
  });

  test('new {b64,dhash} records read back as plain b64', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      const b64 = imgStripes();
      await idbPut(1, { b64, dhash: 'aaaaaaaaaaaaaaaa' });
      _nwImagesByIndex.length = 0;
      const got = await _idbGetB64(1);
      return { match: got === b64 };
    })()`);
    expect(r.match).toBe(true);
  });
});

test.describe('IMG-DHASH-PHASE1 — backfill', () => {
  test('hashes every legacy record and skips the metadata block', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      const b64 = imgStripes();
      await idbPut(0, { shape: 'imgfix-v1', count: 4, byTest: {} });
      for (let i = 1; i <= 4; i++) await idbPut(i, b64);
      const res = await _dhashBackfill();
      const recs = [];
      for (let i = 1; i <= 4; i++) recs.push(await idbGet(i));
      const meta = await idbGet(0);
      return {
        res,
        hashes: recs.map(x => x && x.dhash),
        metaUntouched: !!(meta && meta.shape === 'imgfix-v1' && meta.dhash === undefined),
      };
    })()`);
    expect(r.res.hashed).toBe(4);
    expect(r.res.failed).toBe(0);
    expect(r.res.total).toBe(4);
    expect(r.hashes.every(h => /^[0-9a-f]{16}$/.test(h))).toBe(true);
    expect(r.metaUntouched).toBe(true);
  });

  test('resumable — an interrupted run keeps its finished work and the rerun completes it', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      const b64 = imgStripes();
      for (let i = 1; i <= 6; i++) await idbPut(i, b64);

      // Interrupt: let the first 3 hash writes land, then fail every write.
      const realPut = window.idbPut;
      let writes = 0;
      window.idbPut = function (k, v) {
        if (v && typeof v === 'object' && typeof v.dhash === 'string') {
          if (++writes > 3) return Promise.reject(new Error('simulated interruption'));
        }
        return realPut.call(this, k, v);
      };
      const first = await _dhashBackfill();
      window.idbPut = realPut;

      const afterCrash = [];
      for (let i = 1; i <= 6; i++) afterCrash.push((await idbGet(i) || {}).dhash || null);

      // Resume.
      const second = await _dhashBackfill();
      const afterResume = [];
      for (let i = 1; i <= 6; i++) afterResume.push((await idbGet(i) || {}).dhash || null);

      return { first, second, afterCrash, afterResume };
    })()`);

    // Interrupted run: exactly the 3 committed writes survived.
    expect(r.first.hashed).toBe(3);
    expect(r.first.failed).toBe(3);
    expect(r.afterCrash.filter(Boolean).length).toBe(3);

    // Rerun hashes only what was missing — the 3 already done are not redone.
    expect(r.second.hashed).toBe(3);
    expect(r.second.already).toBe(3);
    expect(r.second.failed).toBe(0);
    expect(r.afterResume.filter(Boolean).length).toBe(6);
    expect(r.afterResume.every(h => /^[0-9a-f]{16}$/.test(h))).toBe(true);
  });

  test('writes nothing to localStorage', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      const b64 = imgStripes();
      for (let i = 1; i <= 5; i++) await idbPut(i, b64);

      const realSet = Storage.prototype.setItem;
      const realRemove = Storage.prototype.removeItem;
      const writes = [];
      Storage.prototype.setItem = function (k, v) { writes.push('set:' + k); return realSet.call(this, k, v); };
      Storage.prototype.removeItem = function (k) { writes.push('remove:' + k); return realRemove.call(this, k); };
      let res;
      try { res = await _dhashBackfill(); }
      finally {
        Storage.prototype.setItem = realSet;
        Storage.prototype.removeItem = realRemove;
      }
      return { writes, res };
    })()`);
    expect(r.res.hashed).toBe(5);
    expect(r.writes, `unexpected localStorage traffic: ${JSON.stringify(r.writes)}`).toEqual([]);
  });

  test('no-ops cleanly on an empty store', async ({ page }) => {
    await bootstrap(page);
    const res = await page.evaluate(async () => await _dhashBackfill());
    expect(res.total).toBe(0);
    expect(res.hashed).toBe(0);
    expect(res.failed).toBe(0);
  });
});
