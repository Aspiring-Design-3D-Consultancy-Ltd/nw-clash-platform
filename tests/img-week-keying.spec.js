import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* IMG-WEEK-KEYING contract:
   Image sets are keyed by (testName, weekTag). A clash resolves through its own
   week's set when one exists — and only that set — and falls back to the test's
   latest set (by week date) only when its week has no set. Same-week re-loads
   supersede; different weeks accumulate. Metadata stays imgfix-v1 with `sets`
   and `latest` added; `byTest` is the derived latest view. */

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
    _nwImgSets.clear();
    Object.keys(_nwImgLatest).forEach(k => delete _nwImgLatest[k]);
    Object.keys(_nwImgByTest).forEach(k => delete _nwImgByTest[k]);
    _nwImages.clear();
    _nwImagesByIndex.length = 0;
    _nwImgCount = 0;
    _posClashCountCache = null;
  });
}

// Real PNG Files, distinct per (seed, index) so slots can be told apart by content.
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
const W1 = 'week-260601', W2 = 'week-260608', W3 = 'week-260615';
const slotB64 = async (key) => { const idx = _nwImages.get(key); return idx === undefined ? null : (await idbGet(idx)).b64; };
const clash = (over) => Object.assign({ uid: 'X', rawTestName: 'T1', testName: 'T1 (CUP)', nwImageRef: 'img1.png', weekTag: W1 }, over || {});
`;

test.describe('IMG-WEEK-KEYING — per-week resolution', () => {
  test('a clash resolves through its own week set; two weeks of the same test coexist', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages(await files(3, 0), 'T1', W1);
      await loadNwImages(await files(3, 100), 'T1', W2);
      const w1 = await slotB64('T1::' + W1 + '::img1.png');
      const w2 = await slotB64('T1::' + W2 + '::img1.png');
      const a = await getNwImageB64(clash({ weekTag: W1 }));
      const b = await getNwImageB64(clash({ weekTag: W2 }));
      return { w1, w2, a, b, hasA: hasNwImage(clash({ weekTag: W1 })), hasB: hasNwImage(clash({ weekTag: W2 })),
        syncA: getNwImageB64Sync(clash({ weekTag: W1 })), sets: _nwImgSets.size, count: _nwImgCount, keys: (await idbGetAllKeys()).length };
    })()`);
    expect(r.w1).not.toBe(r.w2);
    expect(r.a).toBe(r.w1);
    expect(r.b).toBe(r.w2);
    expect(r.hasA).toBe(true); expect(r.hasB).toBe(true);
    expect(r.syncA).toBe(r.w1);          // memory cache holds this session's loads
    expect(r.sets).toBe(2);
    expect(r.count).toBe(6);
    expect(r.keys).toBe(7);              // key 0 + 6 images, nothing superseded across weeks
  });

  test('legacy and untagged clashes fall back to the latest set by week date, not load order', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages(await files(2, 100), 'T1', W2);   // newer week loaded FIRST
      await loadNwImages(await files(2, 0), 'T1', W1);     // older week loaded second
      const w2 = await slotB64('T1::' + W2 + '::img1.png');
      return {
        w2,
        legacy: await getNwImageB64(clash({ weekTag: null })),       // no week on the clash
        unknownWeek: await getNwImageB64(clash({ weekTag: W3 })),    // week with no set
        latest: _nwImgLatest.T1,
        byTestFirst: _nwImgByTest.T1.firstIdx, w2First: _nwImgSets.get(_iwkKey('T1', W2)).firstIdx,
      };
    })()`);
    expect(r.legacy).toBe(r.w2);
    expect(r.unknownWeek).toBe(r.w2);
    expect(r.latest).toBe('week-260608');
    expect(r.byTestFirst).toBe(r.w2First);   // byTest mirrors the latest set
  });

  test('a file missing from the clash\'s own week is a placeholder, never the neighbour week\'s file', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages(await files(3, 0), 'T1', W1);     // img1..img3
      await loadNwImages(await files(4, 100), 'T1', W2);   // img1..img4
      return {
        w1MissingImg4: await getNwImageB64(clash({ weekTag: W1, nwImageRef: 'img4.png' })),
        w1Has: hasNwImage(clash({ weekTag: W1, nwImageRef: 'img4.png' })),
        w2Img4: await getNwImageB64(clash({ weekTag: W2, nwImageRef: 'img4.png' })),
      };
    })()`);
    expect(r.w1MissingImg4).toBeNull();
    expect(r.w1Has).toBe(false);
    expect(r.w2Img4).not.toBeNull();
  });

  test('a load with no valid week goes into the test\'s latest set (the modal loader keeps its old behaviour)', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      const untaggedOnly = await loadNwImages(await files(1, 0), 'T1');           // no sets yet → untagged
      const tagUntagged = _nwImgLatest.T1;
      await loadNwImages(await files(2, 10), 'T1', W1);
      await loadNwImages(await files(2, 20), 'T1', W2);
      const res = await loadNwImages(await files(3, 30), 'T1');                   // no week → replaces W2
      return { untaggedOnly: untaggedOnly.weekTag, tagUntagged, res: res.weekTag, superseded: res.superseded,
        sets: [..._nwImgSets.keys()].sort(), w1Count: _nwImgSets.get(_iwkKey('T1', W1)).count, w2Count: _nwImgSets.get(_iwkKey('T1', W2)).count,
        w2First: _nwImgSets.get(_iwkKey('T1', W2)).firstIdx, keys: await idbGetAllKeys() };
    })()`);
    expect(r.untaggedOnly).toBe('untagged');
    expect(r.tagUntagged).toBe('untagged');
    expect(r.res).toBe('week-260608');
    // W2 was the highest range (slots 4..5), so the re-load reuses 4..5 and extends to 6: nothing to supersede.
    expect(r.superseded).toBe(0);
    expect(r.w2First).toBe(4);
    expect(r.keys).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(r.sets).toEqual(['T1␟untagged', 'T1␟week-260601', 'T1␟week-260608']);
    expect(r.w1Count).toBe(2);
    expect(r.w2Count).toBe(3);
  });
});

test.describe('IMG-WEEK-KEYING — supersede vs accumulate, and the referenced set', () => {
  test('re-loading the same (test, week) supersedes only that set; other weeks are untouched', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages(await files(3, 0), 'T1', W1);     // slots 1..3
      await loadNwImages(await files(2, 100), 'T1', W2);   // slots 4..5
      const res = await loadNwImages(await files(2, 200), 'T1', W1); // slots 6..7, 1..3 superseded
      const meta = await idbGet(0);
      return { res: { superseded: res.superseded, weekTag: res.weekTag }, keys: await idbGetAllKeys(),
        w2: _nwImgSets.get(_iwkKey('T1', W2)), w1: _nwImgSets.get(_iwkKey('T1', W1)), byTest: meta.byTest, latest: meta.latest };
    })()`);
    expect(r.res).toEqual({ superseded: 3, weekTag: 'week-260601' });
    expect(r.keys).toEqual([0, 4, 5, 6, 7]);
    expect(r.w2).toMatchObject({ firstIdx: 4, count: 2 });
    expect(r.w1).toMatchObject({ firstIdx: 6, count: 2 });
    expect(r.byTest.T1).toMatchObject({ firstIdx: 4, count: 2 });   // latest is still W2
    expect(r.latest).toEqual({ T1: 'week-260608' });
  });

  test('audit, cleanup and the dHash index treat every week as referenced', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages(await files(3, 0), 'T1', W1);
      await loadNwImages(await files(2, 100), 'T1', W2);
      await loadNwImages(await files(1, 200), 'T2', W2);
      const audit = await _auditNwImageStore({ sample: 0 });
      const cleanup = await _cleanupNwImageOrphans({ dryRun: false });
      const groups = findSimilarImages(64);
      return { audit: { referenced: audit.referenced, orphaned: audit.orphaned, tests: audit.tests, weeks: audit.byTest.map(b => b.weekTag).sort() },
        cleanup: { deleted: cleanup.deleted, referencedAfter: cleanup.referencedAfter, ok: cleanup.ok },
        refSlots: _dhashIndexReferencedSlots().size, keys: (await idbGetAllKeys()).length,
        memberWeeks: groups.length ? groups[0].members.map(m => m.weekTag).filter(Boolean).length : -1 };
    })()`);
    expect(r.audit).toEqual({ referenced: 6, orphaned: 0, tests: 3, weeks: ['week-260601', 'week-260608', 'week-260608'] });
    expect(r.cleanup).toEqual({ deleted: 0, referencedAfter: 6, ok: true });
    expect(r.refSlots).toBe(6);
    expect(r.keys).toBe(7);
    expect(r.memberWeeks).toBeGreaterThan(0);   // every group member carries its week
  });
});

test.describe('IMG-WEEK-KEYING — metadata shape, restore and migration', () => {
  test('metadata stays imgfix-v1 with sets and latest added; byTest mirrors the latest set', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages(await files(2, 0), 'T1', W1);
      await loadNwImages(await files(3, 100), 'T1', W2);
      const meta = await idbGet(0);
      return { shape: meta.shape, count: meta.count, byTest: meta.byTest, setKeys: Object.keys(meta.sets).sort(), latest: meta.latest,
        w2: meta.sets['T1␟' + W2] };
    })()`);
    expect(r.shape).toBe('imgfix-v1');
    expect(r.count).toBe(5);
    expect(r.setKeys).toEqual(['T1␟week-260601', 'T1␟week-260608']);
    expect(r.latest).toEqual({ T1: 'week-260608' });
    expect(r.byTest.T1).toMatchObject({ firstIdx: 3, count: 3, filenames: ['img1.png', 'img2.png', 'img3.png'] });
    expect(r.w2).toMatchObject({ testName: 'T1', weekTag: 'week-260608', firstIdx: 3, count: 3 });
  });

  test('initNwImages restores the sets from metadata and week-scoped lookups work after a cold start', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await loadNwImages(await files(2, 0), 'T1', W1);
      await loadNwImages(await files(2, 100), 'T1', W2);
      const w1 = await slotB64('T1::' + W1 + '::img2.png');
      _nwImgSets.clear(); Object.keys(_nwImgLatest).forEach(k => delete _nwImgLatest[k]);
      Object.keys(_nwImgByTest).forEach(k => delete _nwImgByTest[k]); _nwImages.clear(); _nwImagesByIndex.length = 0; _nwImgCount = 0;
      if (!S.clashes.length) S.clashes.push({ uid: 'keep-orphan-sweep-off' });
      await initNwImages();
      return { sets: _nwImgSets.size, latest: _nwImgLatest.T1, count: _nwImgCount,
        resolved: await getNwImageB64(clash({ weekTag: W1, nwImageRef: 'img2.png' })), w1 };
    })()`);
    expect(r.sets).toBe(2);
    expect(r.latest).toBe('week-260608');
    expect(r.count).toBe(4);
    expect(r.resolved).toBe(r.w1);
  });

  test('a store written before sets existed reads exactly as before (synthesised untagged sets, latest-set lookups)', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      // Old-shape store: byTest only.
      await idbPut(0, { shape: 'imgfix-v1', count: 2, byTest: { T1: { firstIdx: 1, count: 2, filenames: ['a.png', 'b.png'] } } });
      await idbPut(1, { b64: 'OLD-A', dhash: null }); await idbPut(2, { b64: 'OLD-B', dhash: null });
      const total = _iwkRestore(await idbGet(0));
      _nwImgCount = total;
      const set = _nwImgSets.get(_iwkKey('T1', 'untagged'));
      return { total, set: set && { weekTag: set.weekTag, synth: set.synth, firstIdx: set.firstIdx, count: set.count },
        latest: _nwImgLatest.T1, byTest: _nwImgByTest.T1,
        taggedClash: await getNwImageB64(clash({ weekTag: W1, nwImageRef: 'b.png' })),   // week has no set → latest
        legacyClash: await getNwImageB64(clash({ weekTag: null, nwImageRef: 'a.png' })) };
    })()`);
    expect(r.total).toBe(2);
    expect(r.set).toEqual({ weekTag: 'untagged', synth: true, firstIdx: 1, count: 2 });
    expect(r.latest).toBe('untagged');
    expect(r.byTest).toMatchObject({ firstIdx: 1, count: 2 });
    expect(r.taggedClash).toBe('OLD-B');
    expect(r.legacyClash).toBe('OLD-A');
  });

  test('migration: dry run changes nothing; apply retags synthesised sets to the latest register week, verifies, then gates', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await idbPut(0, { shape: 'imgfix-v1', count: 3, byTest: {
        T1: { firstIdx: 1, count: 2, filenames: ['a.png', 'b.png'] },
        T2: { firstIdx: 3, count: 1, filenames: ['c.png'] } } });
      for (const k of [1, 2, 3]) await idbPut(k, { b64: 'B' + k, dhash: null });
      S.clashes = [
        { uid: 'C1', rawTestName: 'T1', testName: 'T1', weekTag: W1, nwImageRef: 'a.png' },
        { uid: 'C2', rawTestName: 'T1', testName: 'T1', weekTag: W2, nwImageRef: 'b.png' },   // newest week for T1
        { uid: 'C3', rawTestName: 'T2', testName: 'T2', weekTag: null, nwImageRef: 'c.png' },  // no tagged clash for T2
      ];
      _nwImgCount = _iwkRestore(await idbGet(0));
      const before = JSON.stringify(await idbGet(0));
      const dry = await _imgWeekKeyingMigrate();
      const afterDry = JSON.stringify(await idbGet(0));
      const gateAfterDry = localStorage.getItem('nw:imgWeekKeyingMigrated');
      const applied = await _imgWeekKeyingMigrate({ dryRun: false });
      const meta = await idbGet(0);
      return { dry: { ok: dry.ok, dryRun: dry.dryRun, assignments: dry.assignments.map(a => [a.testName, a.from, a.to]) },
        unchangedByDry: before === afterDry, gateAfterDry,
        applied: { ok: applied.ok, verified: applied.verified, retagged: applied.retagged, gate: applied.gate },
        setKeys: Object.keys(meta.sets).sort(), latest: meta.latest, byTestKept: JSON.stringify(meta.byTest) === JSON.stringify(JSON.parse(before).byTest),
        gate: localStorage.getItem('nw:imgWeekKeyingMigrated'), memSets: [..._nwImgSets.keys()].sort(),
        c2: await getNwImageB64(S.clashes[1]), c1: await getNwImageB64(S.clashes[0]), c3: await getNwImageB64(S.clashes[2]) };
    })()`);
    expect(r.dry).toEqual({ ok: true, dryRun: true, assignments: [['T1', 'untagged', 'week-260608'], ['T2', 'untagged', 'untagged']] });
    expect(r.unchangedByDry).toBe(true);
    expect(r.gateAfterDry).toBeNull();
    expect(r.applied).toEqual({ ok: true, verified: true, retagged: 1, gate: '1' });
    expect(r.setKeys).toEqual(['T1␟week-260608', 'T2␟untagged']);
    expect(r.latest).toEqual({ T1: 'week-260608', T2: 'untagged' });
    expect(r.byTestKept).toBe(true);
    expect(r.gate).toBe('1');
    expect(r.memSets).toEqual(['T1␟week-260608', 'T2␟untagged']);
    expect(r.c2).toBe('B2');   // own week set
    expect(r.c1).toBe('B1');   // W1 has no set → latest (W2) fallback still resolves by filename
    expect(r.c3).toBe('B3');
  });

  test('migration: a failed metadata write leaves the gate unset and the record untouched', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(`(async () => { ${MAKERS}
      await idbPut(0, { shape: 'imgfix-v1', count: 1, byTest: { T1: { firstIdx: 1, count: 1, filenames: ['a.png'] } } });
      await idbPut(1, { b64: 'B1', dhash: null });
      S.clashes = [{ uid: 'C1', rawTestName: 'T1', testName: 'T1', weekTag: W1, nwImageRef: 'a.png' }];
      _nwImgCount = _iwkRestore(await idbGet(0));
      const before = JSON.stringify(await idbGet(0));
      const oPut = idbPut;
      window.idbPut = async (k, v) => { if (k === 0) throw new Error('simulated write failure'); return oPut(k, v); };
      const res = await _imgWeekKeyingMigrate({ dryRun: false });
      window.idbPut = oPut;
      return { res: { ok: res.ok, verified: res.verified, reason: res.reason }, same: before === JSON.stringify(await idbGet(0)),
        gate: localStorage.getItem('nw:imgWeekKeyingMigrated'), memSet: _nwImgSets.get(_iwkKey('T1', 'untagged')) ? 'untagged' : 'moved' };
    })()`);
    expect(r.res.ok).toBe(false);
    expect(r.res.reason).toMatch(/gate not set/);
    expect(r.same).toBe(true);
    expect(r.gate).toBeNull();
    expect(r.memSet).toBe('untagged');
  });
});
