import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* IDB-RECORDS-MIGRATION contract:
   nw:clashes and nw:weekly live in the `records` store of NWClashImages.
   sv() stays synchronous and boolean; lv() stays synchronous, reading a cache
   filled at boot. Config flags stay in localStorage. The migration verifies
   before it gates, and the gate is never set on a failed write. */

async function fresh(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && typeof DATA_VERSION === 'string');
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(async () => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    // Mark the profile as already-initialised. Without this every reload takes
    // initAuth()'s first-run branch and seeds 104 demo clashes into the routed
    // key, which is correct app behaviour but not what these tests measure.
    localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
    localStorage.setItem('nw:dedupInitialScan', '1');
    try { await _flushPendingWrites(); } catch (e) {}
    try {
      const db = await openIDB();
      await new Promise(r => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').clear(); tx.oncomplete = r; tx.onerror = r; });
    } catch (e) {}
  });
}

/** Reload and wait for initAuth()'s async boot (including _recInit) to settle. */
async function reload(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof _recFallback !== 'undefined' && _recFallback === false, null, { timeout: 10000 });
  // initAuth() normalises S.clashes/S.weekly to [] when absent, which queues a
  // routed write for each. Drain those so tests measure their own writes only.
  await page.evaluate(async () => { await _flushPendingWrites(); });
}

const rawIdb = `async (key) => {
  const db = await openIDB();
  return await new Promise((res, rej) => {
    const tx = db.transaction('records', 'readonly');
    const r = tx.objectStore('records').get(key);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(new Error('get failed'));
  });
}`;

test.describe('IDB-RECORDS-MIGRATION — key router', () => {
  test('the allowlist is exactly the two large register keys', async ({ page }) => {
    await fresh(page);
    const r = await page.evaluate(() => ({
      routed: [..._IDB_ROUTED_KEYS].sort(),
      clashes: _isRoutedKey('clashes'), weekly: _isRoutedKey('weekly'),
      pin: _isRoutedKey('pin'), dataVersion: _isRoutedKey('dataVersion'),
      dedupQueue: _isRoutedKey('dedupQueue'),
      actionHistory: _isRoutedKey('dedupActionHistory'),
    }));
    expect(r.routed).toEqual(['clashes', 'weekly']);
    expect(r.clashes).toBe(true);
    expect(r.weekly).toBe(true);
    // Config flags and the audit keys must NOT route — sync contracts depend on them.
    expect(r.pin).toBe(false);
    expect(r.dataVersion).toBe(false);
    expect(r.dedupQueue).toBe(false);
    expect(r.actionHistory).toBe(false);
  });

  test('a routed write lands in IndexedDB and never in localStorage', async ({ page }) => {
    await fresh(page); await reload(page);
    const r = await page.evaluate(async (rawIdbSrc) => {
      const getRaw = eval(`(${rawIdbSrc})`);
      const ret = sv('clashes', [{ uid: 'CLX-001', name: 'routed' }]);
      const lsImmediately = localStorage.getItem('nw:clashes');
      await _flushPendingWrites();
      return { ret, lsImmediately, ls: localStorage.getItem('nw:clashes'), idb: await getRaw('clashes') };
    }, rawIdb);
    expect(r.ret).toBe(true);                     // sync boolean contract preserved
    expect(r.lsImmediately).toBeNull();
    expect(r.ls).toBeNull();
    expect(r.idb).toEqual([{ uid: 'CLX-001', name: 'routed' }]);
  });

  test('config flags still write to localStorage synchronously', async ({ page }) => {
    await fresh(page); await reload(page);
    const r = await page.evaluate(() => {
      const ret = sv('dataVersion', 'v4-correct-dates-jan25');
      sv('republishToleranceMm', 25);
      return {
        ret,
        dataVersionImmediately: localStorage.getItem('nw:dataVersion'),  // no flush awaited
        tolerance: localStorage.getItem('nw:republishToleranceMm'),
        readBack: lv('dataVersion', null),
      };
    });
    expect(r.ret).toBe(true);
    expect(r.dataVersionImmediately).toBe('"v4-correct-dates-jan25"');
    expect(r.tolerance).toBe('25');
    expect(r.readBack).toBe('v4-correct-dates-jan25');
  });

  test('lv() reads routed keys synchronously from cache, and honours the default', async ({ page }) => {
    await fresh(page); await reload(page);
    const r = await page.evaluate(async () => {
      const before = lv('clashes', null);       // boot normalised this to []
      sv('clashes', [{ uid: 'CLX-009' }]);
      const afterSyncNoFlush = lv('clashes', null);   // must be visible before any flush
      await _flushPendingWrites();
      // Absent-key path: both routed keys are normalised at boot, so drop one
      // from the cache to exercise lv()'s default branch honestly.
      delete _recCache.weekly;
      return { before, afterSyncNoFlush, missingDefault: lv('weekly', 'FALLBACK') };
    });
    expect(r.before).toEqual([]);
    expect(r.afterSyncNoFlush).toEqual([{ uid: 'CLX-009' }]);
    expect(r.missingDefault).toBe('FALLBACK');
  });
});

test.describe('IDB-RECORDS-MIGRATION — write-through and debounce', () => {
  test('a burst of writes coalesces into one put per key', async ({ page }) => {
    await fresh(page); await reload(page);
    const r = await page.evaluate(async (rawIdbSrc) => {
      const getRaw = eval(`(${rawIdbSrc})`);
      let puts = 0;
      const realPut = window._idbPutRecord;
      window._idbPutRecord = function (k, v) { puts++; return realPut.call(this, k, v); };
      for (let i = 1; i <= 20; i++) sv('clashes', [{ uid: 'CLX-' + i }]);
      const pendingBefore = _recPending.size;
      await _flushPendingWrites();
      window._idbPutRecord = realPut;
      return { puts, pendingBefore, pendingAfter: _recPending.size, idb: await getRaw('clashes') };
    }, rawIdb);
    expect(r.pendingBefore).toBe(1);      // 20 writes to one key, one pending entry
    expect(r.puts).toBe(1);               // ...and one actual put
    expect(r.idb).toEqual([{ uid: 'CLX-20' }]);  // last value wins
    expect(r.pendingAfter).toBe(0);
  });

  test('a queued write reaches IndexedDB without an explicit flush', async ({ page }) => {
    await fresh(page); await reload(page);
    await page.evaluate(() => { sv('weekly', [{ year: 2026, week: 31 }]); });
    await page.waitForFunction(() => _recPending.size === 0, null, { timeout: 5000 });
    const idb = await page.evaluate(async (s) => await eval(`(${s})`)('weekly'), rawIdb);
    expect(idb).toEqual([{ year: 2026, week: 31 }]);
  });

  test('a failed record write increments _svFailCount so the guard still sees it', async ({ page }) => {
    await fresh(page); await reload(page);
    const r = await page.evaluate(async () => {
      const before = _svFailCount;
      const realPut = window._idbPutRecord;
      window._idbPutRecord = () => Promise.reject(new Error('simulated store failure'));
      const ret = sv('clashes', [{ uid: 'CLX-001' }]);
      await _flushPendingWrites();
      window._idbPutRecord = realPut;
      return { ret, delta: _svFailCount - before, failedKeys: [..._svFailedKeys], banner: !!document.getElementById('sv-write-failure') };
    });
    expect(r.ret).toBe(true);            // sv() reports "queued", not "durable"
    expect(r.delta).toBe(1);             // ...and the failure surfaces on flush
    expect(r.failedKeys).toContain('clashes');
    expect(r.banner).toBe(true);
  });
});

test.describe('IDB-RECORDS-MIGRATION — boot read', () => {
  test('a value written in one session is read back after reload', async ({ page }) => {
    await fresh(page); await reload(page);
    await page.evaluate(async () => { sv('clashes', [{ uid: 'CLX-777', name: 'survives' }]); await _flushPendingWrites(); });
    await reload(page);
    const r = await page.evaluate(() => ({ viaLv: lv('clashes', null), cache: _recCache.clashes, ls: localStorage.getItem('nw:clashes') }));
    // Boot migrations enrich records in place (nwOrig backfill), so assert the
    // value survived the round trip rather than that it is byte-identical.
    expect(r.viaLv).toHaveLength(1);
    expect(r.viaLv[0]).toMatchObject({ uid: 'CLX-777', name: 'survives' });
    expect(r.cache).toHaveLength(1);
    expect(r.ls).toBeNull();
  });
});

test.describe('IDB-RECORDS-MIGRATION — migration verify-then-gate', () => {
  test('existing localStorage register migrates, verifies, gates, then deletes', async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      localStorage.setItem('nw:clashes', JSON.stringify([{ uid: 'CLX-001', name: 'legacy' }, { uid: 'CLX-002' }]));
      localStorage.setItem('nw:weekly', JSON.stringify([{ year: 2026, week: 30 }]));
      localStorage.removeItem('nw:idbRecordsMigrated');
    });
    await reload(page);
    const r = await page.evaluate(async (s) => {
      const getRaw = eval(`(${s})`);
      return {
        gate: localStorage.getItem('nw:idbRecordsMigrated'),
        lsClashes: localStorage.getItem('nw:clashes'),
        lsWeekly: localStorage.getItem('nw:weekly'),
        idbClashes: await getRaw('clashes'),
        idbWeekly: await getRaw('weekly'),
        viaLv: lv('clashes', null),
      };
    }, rawIdb);
    expect(r.idbClashes.map(c => c.uid)).toEqual(['CLX-001', 'CLX-002']);
    expect(r.idbWeekly).toEqual([{ year: 2026, week: 30 }]);
    expect(r.gate).toBe('1');
    expect(r.lsClashes).toBeNull();      // deleted only after the gate
    expect(r.lsWeekly).toBeNull();
    expect(r.viaLv.map(c => c.uid)).toEqual(['CLX-001', 'CLX-002']);
  });

  test('a failed write during migration leaves the gate UNSET and the originals intact', async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      localStorage.setItem('nw:clashes', JSON.stringify([{ uid: 'CLX-001', name: 'must survive' }]));
      localStorage.removeItem('nw:idbRecordsMigrated');
    });
    // Break the record write, then drive the migration directly.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof _recMigrateFromLocalStorage === 'function');
    const r = await page.evaluate(async () => {
      localStorage.removeItem('nw:idbRecordsMigrated');
      localStorage.setItem('nw:clashes', JSON.stringify([{ uid: 'CLX-001', name: 'must survive' }]));
      const realPut = window._idbPutRecord;
      window._idbPutRecord = () => Promise.reject(new Error('simulated write failure'));
      let threw = null;
      try { await _recMigrateFromLocalStorage(); } catch (e) { threw = e.message; }
      window._idbPutRecord = realPut;
      return { threw, gate: localStorage.getItem('nw:idbRecordsMigrated'), ls: localStorage.getItem('nw:clashes') };
    });
    expect(r.threw).toContain('simulated write failure');
    expect(r.gate).toBeNull();                                   // gate NEVER precedes verification
    expect(JSON.parse(r.ls)).toEqual([{ uid: 'CLX-001', name: 'must survive' }]);
  });

  test('a read-back mismatch aborts before the gate', async ({ page }) => {
    await fresh(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof _recMigrateFromLocalStorage === 'function');
    const r = await page.evaluate(async () => {
      localStorage.removeItem('nw:idbRecordsMigrated');
      localStorage.setItem('nw:clashes', JSON.stringify([{ uid: 'CLX-001' }]));
      const realGet = window._idbGetRecord;
      window._idbGetRecord = () => Promise.resolve([{ uid: 'TAMPERED' }]);   // read-back disagrees
      let threw = null;
      try { await _recMigrateFromLocalStorage(); } catch (e) { threw = e.message; }
      window._idbGetRecord = realGet;
      return { threw, gate: localStorage.getItem('nw:idbRecordsMigrated'), ls: localStorage.getItem('nw:clashes') };
    });
    expect(r.threw).toContain('verify failed');
    expect(r.gate).toBeNull();
    expect(JSON.parse(r.ls)).toEqual([{ uid: 'CLX-001' }]);
  });

  test('migration is idempotent — a second boot does not re-run it', async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => localStorage.setItem('nw:clashes', JSON.stringify([{ uid: 'CLX-001' }])));
    await reload(page);
    await page.evaluate(async () => { sv('clashes', [{ uid: 'CLX-001' }, { uid: 'CLX-002' }]); await _flushPendingWrites(); });
    await reload(page);
    const r = await page.evaluate(() => ({ viaLv: lv('clashes', null), gate: localStorage.getItem('nw:idbRecordsMigrated') }));
    expect(r.gate).toBe('1');
    expect(r.viaLv).toHaveLength(2);      // second boot must not clobber with the stale original
  });
});

test.describe('IDB-RECORDS-MIGRATION — flush on import and on unload', () => {
  test('importFolderPick awaits the queue before judging _svFailCount', async ({ page }) => {
    await fresh(page); await reload(page);
    const r = await page.evaluate(async () => {
      const xml = t => `<?xml version="1.0"?><exchange units="mm"><batchtest units="mm"><clashtest name="${t}">
        <clashresult name="${t}-C1" distance="-0.02"><clashpoint><pos3f x="1" y="2" z="3"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="2026" month="7" day="1" hour="10" minute="0" second="0"/></createddate>
        <clashobject><pathlink><node>ESMC.nwd</node><node>GAS.nwc</node></pathlink></clashobject>
        <clashobject><pathlink><node>ESMC.nwd</node><node>ST.nwc</node></pathlink></clashobject>
      </clashresult></clashtest></batchtest></exchange>`;
      const mk = n => { const f = new File([xml(n)], n + '.xml', { type: 'text/xml' });
        Object.defineProperty(f, 'webkitRelativePath', { value: 'week-260701/CUP arch/' + n + '.xml' }); return f; };
      nav('bcf');   // #bxml lives in the BCF view; importFolderPick writes into it
      const toasts = []; const realToast = window.showToast;
      window.showToast = m => { toasts.push(String(m)); };
      window.confirm = () => true;
      // Every record write fails: the closing summary must say NOT SAVED.
      const realPut = window._idbPutRecord;
      window._idbPutRecord = () => Promise.reject(new Error('simulated full store'));
      try { await importFolderPick({ files: [mk('T1'), mk('T2')], value: '' }); }
      finally { window.showToast = realToast; window._idbPutRecord = realPut; }
      return { closing: toasts[toasts.length - 1], pending: _recPending.size };
    });
    // The regression this guards: queued writes made a full store look clean.
    expect(r.closing).not.toMatch(/^✓ Imported/);
    expect(r.closing).toContain('NOT SAVED');
    expect(r.pending).toBe(0);            // queue drained by the awaited flush
  });

  test('hiding the tab flushes the queue', async ({ page }) => {
    await fresh(page); await reload(page);
    await page.evaluate(() => {
      sv('clashes', [{ uid: 'CLX-HIDE' }]);
      if (_recFlushTimer) { clearTimeout(_recFlushTimer); _recFlushTimer = null; }  // defeat the debounce
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => _recPending.size === 0, null, { timeout: 5000 });
    const idb = await page.evaluate(async (s) => await eval(`(${s})`)('clashes'), rawIdb);
    expect(idb).toEqual([{ uid: 'CLX-HIDE' }]);
  });

  test('pagehide flushes and marks the queue dirty until the write lands', async ({ page }) => {
    await fresh(page); await reload(page);
    const marked = await page.evaluate(() => {
      sv('clashes', [{ uid: 'CLX-UNLOAD' }]);
      if (_recFlushTimer) { clearTimeout(_recFlushTimer); _recFlushTimer = null; }
      window.dispatchEvent(new Event('pagehide'));
      return localStorage.getItem('nw:recFlushDirty');   // set synchronously, before the flush
    });
    expect(marked).toBeTruthy();
    await page.waitForFunction(() => _recPending.size === 0, null, { timeout: 5000 });
    const r = await page.evaluate(async (s) => ({
      idb: await eval(`(${s})`)('clashes'),
      dirty: localStorage.getItem('nw:recFlushDirty'),
    }), rawIdb);
    expect(r.idb).toEqual([{ uid: 'CLX-UNLOAD' }]);
    expect(r.dirty).toBeNull();          // cleared once the write actually landed
  });
});

/* IDB-RECORDS-VERIFY-RACE — regression coverage for the live-profile defect.
   On the real profile the migration aborted with "verify failed for nw:clashes".
   Root cause was not encoding or payload size: initAuth()'s await on _recInit()
   runs BEFORE S.clashes is hydrated, and window.onload does not await initAuth,
   so initNwImages() saw S.clashes === [] with image metadata present, read that
   as the ORPHAN-IDB-SWEEP condition, and deleted the database out from under
   the in-flight migration write. */
test.describe('IDB-RECORDS-VERIFY-RACE', () => {
  /** Seed the live-profile shape: a register in localStorage + image metadata in IDB. */
  async function seedProfile(page, { clashCount, imageCount, notesLen = 400 }) {
    await page.evaluate(async ({ clashCount, imageCount, notesLen }) => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
      localStorage.setItem('nw:dedupInitialScan', '1');
      if (clashCount > 0) {
        const reg = Array.from({ length: clashCount }, (_, i) => ({
          uid: 'CLX-' + String(i + 1).padStart(3, '0'), name: 'Clash ' + i,
          testName: '03_GAS vs 08_AMHS', status: 'Active', priority: 'High',
          notes: 'x'.repeat(notesLen), x: 1.1 + i, y: 2.2, z: 3.3,
          statusHistory: [{ status: 'New', week: 25, year: 2026 }],
        }));
        localStorage.setItem('nw:clashes', JSON.stringify(reg));
        localStorage.setItem('nw:weekly', JSON.stringify([{ year: 2026, week: 31, total: clashCount }]));
      }
      await openIDB();
      if (imageCount > 0) {
        await idbPut(0, { shape: 'imgfix-v1', count: imageCount, loadedAt: Date.now(),
          byTest: { '03_GAS vs 08_AMHS': { firstIdx: 1, count: imageCount, filenames: [] } } });
        await idbPut(1, { b64: 'aaaa', dhash: null });
      }
    }, { clashCount, imageCount, notesLen });
  }

  test('a register migrates cleanly while image metadata is present (the live-profile defect)', async ({ page }) => {
    await fresh(page);
    await seedProfile(page, { clashCount: 600, imageCount: 63178 });
    await reload(page);
    const r = await page.evaluate(async () => ({
      fallback: _recFallback,
      gate: localStorage.getItem('nw:idbRecordsMigrated'),
      lsClashes: localStorage.getItem('nw:clashes'),
      recordsLen: (await _idbGetRecord('clashes') || []).length,
      registerLen: (S.clashes || []).length,
      imagesMetaCount: (await idbGet(0) || {}).count,
    }));
    expect(r.fallback).toBe(false);          // migration succeeded, no fallback
    expect(r.gate).toBe('1');
    expect(r.lsClashes).toBeNull();          // originals removed after verification
    expect(r.recordsLen).toBe(600);
    expect(r.registerLen).toBe(600);
    expect(r.imagesMetaCount).toBe(63178);   // the sweep did NOT delete the DB
  });

  test('a multi-MB register survives the round trip and verifies', async ({ page }) => {
    test.setTimeout(120000);
    await fresh(page);
    // ~4.3 MB of JSON — the size of the real 4,264-clash register.
    await seedProfile(page, { clashCount: 4264, notesLen: 700, imageCount: 63178 });
    const seededChars = await page.evaluate(() => (localStorage.getItem('nw:clashes') || '').length);
    expect(seededChars).toBeGreaterThan(3 * 1024 * 1024);   // genuinely multi-MB
    await reload(page);
    const r = await page.evaluate(async () => {
      const back = await _idbGetRecord('clashes');
      return {
        fallback: _recFallback,
        gate: localStorage.getItem('nw:idbRecordsMigrated'),
        lsClashes: localStorage.getItem('nw:clashes'),
        recordsLen: (back || []).length,
        firstUid: back && back[0] && back[0].uid,
        lastUid: back && back[back.length - 1] && back[back.length - 1].uid,
        roundTripChars: JSON.stringify(back).length,
      };
    });
    expect(r.fallback).toBe(false);
    expect(r.gate).toBe('1');
    expect(r.lsClashes).toBeNull();
    expect(r.recordsLen).toBe(4264);
    expect(r.firstUid).toBe('CLX-001');
    expect(r.lastUid).toBe('CLX-4264');
    expect(r.roundTripChars).toBeGreaterThan(3 * 1024 * 1024);
  });

  test('ORPHAN-IDB-SWEEP still fires when the register is genuinely empty', async ({ page }) => {
    await fresh(page);
    // No register at all, but image metadata left behind — the state the sweep exists for.
    await seedProfile(page, { clashCount: 0, imageCount: 1247 });
    await page.evaluate(() => localStorage.setItem('nw:clashes', JSON.stringify([])));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof _registerHydrated !== 'undefined' && _registerHydrated === true, null, { timeout: 10000 });
    await page.waitForTimeout(2500);   // let the sweep's delete settle
    const r = await page.evaluate(() => ({
      nwImgCount: _nwImgCount,
      registerLen: (S.clashes || []).length,
      hydrated: _registerHydrated,
    }));
    expect(r.hydrated).toBe(true);
    expect(r.registerLen).toBe(0);
    expect(r.nwImgCount).toBe(0);      // stale metadata swept, not surfaced as "1247 images / 0 clashes"
  });

  test('the register-hydrated signal is raised on both initAuth paths', async ({ page }) => {
    await fresh(page); await reload(page);
    expect(await page.evaluate(() => _registerHydrated)).toBe(true);
  });
});

