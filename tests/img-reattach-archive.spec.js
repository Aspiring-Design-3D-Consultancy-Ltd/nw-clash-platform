import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* IMG-REATTACH-ARCHIVE contract:
   Pick one week's archive folder; every test's _files folder is matched with the
   SAME matcher importFolderPick uses, and images load through loadNwImages.
   Images only — no clash, weekly, snapshot or dedup state is read or written.
   Re-running a week replaces that week's images rather than duplicating them. */

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && typeof DATA_VERSION === 'string');
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(async () => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    try { await idbClear(); } catch (e) {}
    try { await _flushPendingWrites(); } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof _recFallback !== 'undefined' && _recFallback === false, null, { timeout: 10000 });
  await page.evaluate(async () => { await _flushPendingWrites(); });
}

/** Build a realistic weekly archive pick: per test an XML report + a sibling
 *  <baseName>_files folder of real PNGs. `bare` names tests with no images. */
const BUILD = `
async function buildArchive({ week, tests, imgs, bare = [] }) {
  const png = (seed) => new Promise(res => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#123'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#eee';
    for (let i = 0; i < 8; i++) g.fillRect((i * 4 + seed) % 32, i * 4, 3, 3);
    c.toBlob(b => res(b), 'image/png');
  });
  const xmlFor = (t) => \`<?xml version="1.0"?><exchange units="mm"><batchtest units="mm"><clashtest name="\${t}">
    <clashresult name="\${t}-C1" href="files\\\\\\\\cd000001.jpg" distance="-0.02">
      <clashpoint><pos3f x="1" y="2" z="3"/></clashpoint><resultstatus>active</resultstatus>
      <createddate><date year="2026" month="6" day="22" hour="10" minute="0" second="0"/></createddate>
      <clashobject><pathlink><node>ESMC.nwd</node><node>GAS.nwc</node></pathlink></clashobject>
      <clashobject><pathlink><node>ESMC.nwd</node><node>ST.nwc</node></pathlink></clashobject>
    </clashresult></clashtest></batchtest></exchange>\`;
  const files = [];
  const mk = (blob, name, rel, type) => {
    const f = new File([blob], name, { type });
    Object.defineProperty(f, 'webkitRelativePath', { value: rel });
    return f;
  };
  for (const t of tests.concat(bare)) {
    files.push(mk(xmlFor(t), t + '.xml', week + '/CUP arch/' + t + '.xml', 'text/xml'));
  }
  for (const t of tests) {
    for (let i = 1; i <= imgs; i++) {
      const nm = 'cd' + String(i).padStart(6, '0') + '.png';
      files.push(mk(await png(i), nm, week + '/CUP arch/' + t + '_files/' + nm, 'image/png'));
    }
  }
  return files;
}`;

/** Run the tool over a generated archive, capturing toasts and image state. */
async function runReattach(page, opts) {
  return page.evaluate(async ({ BUILD, opts }) => {
    eval(BUILD);
    const files = await buildArchive(opts);
    const toasts = []; const realToast = window.showToast;
    window.showToast = m => { toasts.push(String(m)); };
    window.confirm = () => true;
    try { await reattachImagesFromArchive({ files, value: '' }); }
    finally { window.showToast = realToast; }
    const keys = await idbGetAllKeys();
    return {
      toasts,
      imageRecords: keys.filter(k => typeof k === 'number' && k > 0).length,
      byTest: Object.fromEntries(Object.entries(_nwImgByTest).map(([k, v]) => [k, v.count])),
      mapSize: _nwImages.size,
      nwImgCount: _nwImgCount,
      // IMG-WEEK-KEYING
      sets: [..._nwImgSets.keys()].sort(),
      latest: Object.assign({}, _nwImgLatest),
    };
  }, { BUILD, opts });
}

test.describe('IMG-REATTACH-ARCHIVE', () => {
  test('attaches every test\'s images from one week\'s archive folder', async ({ page }) => {
    test.setTimeout(90000);
    await bootstrap(page);
    const r = await runReattach(page, { week: 'week-260622', tests: ['T1', 'T2', 'T3'], imgs: 4 });
    expect(r.byTest).toEqual({ T1: 4, T2: 4, T3: 4 });
    expect(r.imageRecords).toBe(12);
    expect(r.mapSize).toBe(12);
    expect(r.nwImgCount).toBe(12);
    expect(r.toasts[r.toasts.length - 1]).toContain('Re-attached 12 of 12 images across 3 of 3 tests');
  });

  test('is idempotent — re-running the same week replaces, never duplicates', async ({ page }) => {
    test.setTimeout(120000);
    await bootstrap(page);
    const first = await runReattach(page, { week: 'week-260622', tests: ['T1', 'T2'], imgs: 5 });
    expect(first.byTest).toEqual({ T1: 5, T2: 5 });
    expect(first.mapSize).toBe(10);

    const second = await runReattach(page, { week: 'week-260622', tests: ['T1', 'T2'], imgs: 5 });
    // Per-test mapping is replaced, not appended to.
    expect(second.byTest).toEqual({ T1: 5, T2: 5 });
    expect(second.mapSize).toBe(10);
    expect(second.nwImgCount).toBe(10);
    expect(second.toasts[second.toasts.length - 1]).toContain('Re-attached 10 of 10 images across 2 of 2 tests');
  });

  test('writes nothing to the register, weekly, snapshots or dedup state', async ({ page }) => {
    test.setTimeout(90000);
    await bootstrap(page);
    // Seed a register so there is something that COULD be clobbered.
    await page.evaluate(async () => {
      S.clashes = Array.from({ length: 40 }, (_, i) => ({
        uid: 'CLX-' + String(i + 1).padStart(3, '0'), name: 'Clash ' + i,
        testName: 'T1', status: 'Approved', priority: 'High',
      }));
      S.weekly = [{ year: 2026, week: 25, new: 40, active: 0, reviewed: 0, resolved: 0, approved: 0 }];
      S.dedupQueue = [{ a: 'CLX-001', b: 'CLX-002' }];
      sv('clashes', S.clashes); sv('weekly', S.weekly); sv('dedupQueue', S.dedupQueue);
      await _flushPendingWrites();
    });
    const before = await page.evaluate(async () => ({
      clashes: JSON.stringify(await _idbGetRecord('clashes')),
      weekly: JSON.stringify(await _idbGetRecord('weekly')),
      ls: JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('nw:')).sort()
        .map(k => [k, localStorage.getItem(k)])),
      statuses: (S.clashes || []).map(c => c.status).join(','),
    }));

    await runReattach(page, { week: 'week-260622', tests: ['T1'], imgs: 3 });

    const after = await page.evaluate(async () => ({
      clashes: JSON.stringify(await _idbGetRecord('clashes')),
      weekly: JSON.stringify(await _idbGetRecord('weekly')),
      ls: JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('nw:')).sort()
        .map(k => [k, localStorage.getItem(k)])),
      statuses: (S.clashes || []).map(c => c.status).join(','),
      dedupLen: (S.dedupQueue || []).length,
      registerLen: (S.clashes || []).length,
    }));
    expect(after.clashes).toBe(before.clashes);     // register byte-identical
    expect(after.weekly).toBe(before.weekly);       // weekly byte-identical
    expect(after.ls).toBe(before.ls);               // every nw:* key byte-identical
    expect(after.statuses).toBe(before.statuses);   // no status changed
    expect(after.dedupLen).toBe(1);
    expect(after.registerLen).toBe(40);
  });

  test('skips tests with no _files folder and says so', async ({ page }) => {
    test.setTimeout(90000);
    await bootstrap(page);
    const r = await runReattach(page, { week: 'week-260622', tests: ['T1'], imgs: 3, bare: ['T2', 'T3'] });
    expect(r.byTest).toEqual({ T1: 3 });
    expect(r.imageRecords).toBe(3);
    const closing = r.toasts[r.toasts.length - 1];
    expect(closing).toContain('Re-attached 3 of 3 images across 1 of 1 test');
    expect(closing).toContain('2 skipped (no images folder)');
  });

  test('reports each test to the console, plus a closing summary', async ({ page }) => {
    test.setTimeout(90000);
    const logs = [];
    page.on('console', m => { if (m.text().includes('IMG-REATTACH-ARCHIVE')) logs.push(m.text()); });
    await bootstrap(page);
    await runReattach(page, { week: 'week-260622', tests: ['T1', 'T2'], imgs: 2 });
    expect(logs.some(l => /"T1" \(week-260622\) → 2 of 2 image\(s\) attached/.test(l))).toBe(true);
    expect(logs.some(l => /"T2" \(week-260622\) → 2 of 2 image\(s\) attached/.test(l))).toBe(true);
    expect(logs.some(l => /Re-attached 4 of 4 images across 2 of 2 tests into week-260622/.test(l))).toBe(true);
  });

  test('a folder with no Navisworks report is refused without touching anything', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(async () => {
      const f = new File(['just notes'], 'notes.txt', { type: 'text/plain' });
      Object.defineProperty(f, 'webkitRelativePath', { value: 'week-260622/CUP arch/notes.txt' });
      const toasts = []; const realToast = window.showToast;
      window.showToast = m => { toasts.push(String(m)); };
      window.confirm = () => true;
      try { await reattachImagesFromArchive({ files: [f], value: '' }); }
      finally { window.showToast = realToast; }
      const keys = await idbGetAllKeys();
      return { toasts, images: keys.filter(k => typeof k === 'number' && k > 0).length };
    });
    expect(r.toasts.join(' ')).toContain('No Navisworks XML content found');
    expect(r.images).toBe(0);
  });

  test('the shared matcher is defined once and used by both callers', async ({ page }) => {
    await bootstrap(page);
    const r = await page.evaluate(() => ({
      bucket: typeof _bifBucketFolderFiles,
      sniff: typeof _bifSniffXmlFiles,
      match: typeof _bifMatchImageJobs,
      tool: typeof reattachImagesFromArchive,
      panel: typeof _rDataReattachPanel,
      // The pairing rule itself, exercised directly.
      jobs: _bifMatchImageJobs(
        [{ name: 'T1.xml', webkitRelativePath: 'w/a/T1.xml' }],
        { 'T1_files': [{ webkitRelativePath: 'w/a/T1_files/cd1.jpg' }] }
      ).map(j => ({ baseName: j.baseName, n: j.matchedImages.length })),
    }));
    expect(r.bucket).toBe('function');
    expect(r.sniff).toBe('function');
    expect(r.match).toBe('function');
    expect(r.tool).toBe('function');
    expect(r.panel).toBe('function');
    expect(r.jobs).toEqual([{ baseName: 'T1', n: 1 }]);
  });

  test('the Data Manager panel renders the picker', async ({ page }) => {
    await bootstrap(page);
    const html = await page.evaluate(() => { nav('data'); return document.getElementById('va').innerHTML; });
    expect(html).toContain('Re-attach images from archive folder');
    expect(html).toContain('reattach-folder');
    expect(html).toContain('Images only');
  });

  /* IMG-WEEK-KEYING: the tool loads into (test, week) sets. */
  test('IMG-WEEK-KEYING — images land in the (test, week) set derived from the picked folder', async ({ page }) => {
    test.setTimeout(90000);
    await bootstrap(page);
    const r = await runReattach(page, { week: 'week-260622', tests: ['T1', 'T2'], imgs: 2 });
    expect(r.sets).toEqual(['T1\u241Fweek-260622', 'T2\u241Fweek-260622']);
    expect(r.latest).toEqual({ T1: 'week-260622', T2: 'week-260622' });
    expect(r.byTest).toEqual({ T1: 2, T2: 2 });
  });

  test('IMG-WEEK-KEYING — a second week accumulates alongside the first; the latest pointer follows the week date', async ({ page }) => {
    test.setTimeout(150000);
    await bootstrap(page);
    const later = await runReattach(page, { week: 'week-260629', tests: ['T1', 'T2'], imgs: 3 });
    const earlier = await runReattach(page, { week: 'week-260622', tests: ['T1', 'T2'], imgs: 2 });
    expect(later.imageRecords).toBe(6);
    expect(earlier.imageRecords).toBe(10);                      // 6 + 4, nothing superseded across weeks
    expect(earlier.sets).toEqual(['T1\u241Fweek-260622', 'T1\u241Fweek-260629', 'T2\u241Fweek-260622', 'T2\u241Fweek-260629']);
    expect(earlier.latest).toEqual({ T1: 'week-260629', T2: 'week-260629' });   // by date, though loaded first
    expect(earlier.byTest).toEqual({ T1: 3, T2: 3 });                            // derived view mirrors the latest week
    expect(earlier.nwImgCount).toBe(10);
    // Re-running the earlier week supersedes only that week.
    const again = await runReattach(page, { week: 'week-260622', tests: ['T1', 'T2'], imgs: 2 });
    expect(again.imageRecords).toBe(10);
    expect(again.sets.length).toBe(4);
    expect(again.toasts[again.toasts.length - 1]).toContain('into week-260622');
  });

  test('IMG-WEEK-KEYING — a pick whose top folder is not a week-YYMMDD wrapper is refused and changes nothing', async ({ page }) => {
    test.setTimeout(90000);
    await bootstrap(page);
    const r = await runReattach(page, { week: 'CUP arch', tests: ['T1'], imgs: 2 });
    expect(r.imageRecords).toBe(0);
    expect(r.sets).toEqual([]);
    expect(r.toasts.some(t => /week-YYMMDD/.test(t) && /nothing was changed/.test(t))).toBe(true);
  });
});
