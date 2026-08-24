import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// IMG-BATCH-BACKPRESSURE regression cover.
//
// The W31 defect: loadNwImages() opened a FileReader for every image in the
// same synchronous tick and returned immediately, and importFolderPick's batch
// loop called it un-awaited once per test. A 29-test pick therefore had every
// image in all 29 tests decoding at once — 4,322 images / ~500MB on the real
// folder — each with its own IndexedDB transaction. The XML loop ran ~10s ahead
// of the reader queue (measured: at iteration 23, test 16 was at 13/126), which
// is the reported hang, and the peak footprint is the reported crash partway
// through the image load.
//
// These assertions are deterministic and size-independent: they pin the
// concurrency bound and the await, not the OOM itself.

// n tests, each with `imgs` images and `clashes` clashes, in canonical
// week-260727/<archive>/<test>/ layout with a sibling <test>_files image folder.
function buildPick({ tests, imgs, clashes }) {
  return { tests, imgs, clashes };
}

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    ['reviewQueueScopeFixed', 'reviewQueueDateGuardFixed', 'dedupInitialScan']
      .forEach(k => localStorage.setItem('nw:' + k, '1'));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    S.clashes = []; sv('clashes', S.clashes);
    S.weekly = []; sv('weekly', S.weekly);
    nav('bcf');
  });
}

// Runs a folder pick in-page with FileReader instrumented to record peak
// concurrent reads. Returns counts observed the instant importFolderPick
// resolves — the point the batch loop considers the import finished.
const RUN = `
async ({ tests, imgs, clashes, failAt, readDelayMs }) => {
  let live = 0, peak = 0, started = 0;
  const Real = window.FileReader;
  window.FileReader = function () {
    const r = new Real();
    const realRead = r.readAsDataURL.bind(r);
    r.readAsDataURL = (f) => {
      started++; live++; if (live > peak) peak = live;
      const done = () => { live--; };
      r.addEventListener('load', done, { once: true });
      r.addEventListener('error', done, { once: true });
      r.addEventListener('abort', done, { once: true });
      if (failAt && f.name === failAt) {
        // Surface a read error the same way a corrupt/locked file would.
        setTimeout(() => { r.dispatchEvent(new Event('error')); }, 0);
        return;
      }
      if (readDelayMs) {
        // Stand in for the real cost of decoding a ~120KB Navisworks viewpoint
        // JPEG. Without it, 512-byte synthetic files complete faster than the
        // batch loop's own per-iteration yield and no scheduling difference is
        // observable at all.
        const inner = new Real();
        inner.onload = (e) => setTimeout(() => {
          Object.defineProperty(r, 'result', { value: e.target.result, configurable: true });
          r.dispatchEvent(new Event('load'));
        }, readDelayMs);
        inner.onerror = () => setTimeout(() => r.dispatchEvent(new Event('error')), readDelayMs);
        inner.readAsDataURL(f);
        return;
      }
      return realRead(f);
    };
    return r;
  };

  const files = [];
  const blob = '\\xFF\\xD8\\xFF\\xE0' + 'x'.repeat(512);
  for (let i = 1; i <= tests; i++) {
    const bldg = i % 2 === 0 ? 'FAB' : 'CUP';
    const base = String(i).padStart(2, '0') + '_CR_v_08_AMHS';
    const dir = 'week-260727/260727 ' + bldg + ' AMHS v 8 Clash test/' + base;
    let results = '';
    for (let c = 1; c <= clashes; c++) {
      results += '<clashresult name="Clash' + c + '" href="files\\\\cd' + String(c).padStart(6, '0') + '.jpg" distance="-0.02">' +
        '<clashpoint><pos3f x="' + (i * 1000 + c) + '" y="' + c + '" z="10"/></clashpoint><resultstatus>active</resultstatus>' +
        '<createddate><date year="2026" month="7" day="27" hour="10" minute="0" second="0"/></createddate>' +
        '<clashobject><pathlink><node>ESMC.nwd</node><node>GAS' + i + '.nwc</node></pathlink>' +
        '<objectattribute><name>Item Name</name><value>Duct-' + i + '-' + c + '</value></objectattribute>' +
        '<objectattribute><name>Element ID</name><value>' + i + '00' + c + '</value></objectattribute></clashobject>' +
        '<clashobject><pathlink><node>ESMC.nwd</node><node>Struct' + i + '.nwc</node></pathlink>' +
        '<objectattribute><name>Item Name</name><value>Beam-' + i + '-' + c + '</value></objectattribute>' +
        '<objectattribute><name>Element ID</name><value>9' + i + '00' + c + '</value></objectattribute></clashobject>' +
        '</clashresult>';
    }
    const xml = '<?xml version="1.0" encoding="UTF-8"?><exchange units="mm"><batchtest units="mm">' +
      '<clashtest name="Test ' + i + ' ' + bldg + '">' + results + '</clashtest></batchtest></exchange>';
    const xf = new File([xml], base + '.xml', { type: 'text/xml', lastModified: Date.UTC(2026, 6, 27) });
    Object.defineProperty(xf, 'webkitRelativePath', { value: dir + '/' + base + '.xml' });
    files.push(xf);
    for (let k = 1; k <= imgs; k++) {
      const nm = 'cd' + String(k).padStart(6, '0') + '.jpg';
      const f = new File([blob], nm, { type: 'image/jpeg' });
      Object.defineProperty(f, 'webkitRelativePath', { value: dir + '/' + base + '_files/' + nm });
      files.push(f);
    }
  }

  const realConfirm = window.confirm;
  window.confirm = () => true;
  try {
    await importFolderPick({ files, value: 'x' });
  } finally {
    window.confirm = realConfirm;
    window.FileReader = Real;
  }

  // Everything below is sampled the instant importFolderPick resolved.
  const idbKeys = await idbGetAllKeys();
  return {
    peakConcurrentReads: peak,
    startedReads: started,
    stillInFlight: live,
    totalImages: tests * imgs,
    mappedImages: _nwImages.size,
    idbImageKeys: idbKeys.filter(k => k !== 0).length,
    clashes: (S.clashes || []).length,
    persisted: JSON.parse(localStorage.getItem('nw:clashes') || '[]').length,
    weekly: JSON.parse(localStorage.getItem('nw:weekly') || '[]').map(w => w.year + '-W' + w.week),
  };
}`;

test.describe('IMG-BATCH-BACKPRESSURE', () => {
  test('concurrent image reads stay bounded across a 29-test folder pick', async ({ page }) => {
    await bootstrap(page);
    const res = await page.evaluate(eval(`(${RUN})`), buildPick({ tests: 29, imgs: 20, clashes: 6 }));

    const cap = await page.evaluate(() => _IMG_READ_CONCURRENCY);
    expect(cap).toBeGreaterThan(0);
    // Pre-fix this was the full folder (580) because every reader opened at once.
    expect(res.peakConcurrentReads).toBeLessThanOrEqual(cap);
    expect(res.startedReads).toBe(res.totalImages);
  });

  test('loadNwImages is awaitable — it returns a promise, not undefined', async ({ page }) => {
    await bootstrap(page);
    const kind = await page.evaluate(() => {
      const f = new File(['x'], 'cd000001.jpg', { type: 'image/jpeg' });
      const r = loadNwImages([f], 'probe-test');
      return { isThenable: !!(r && typeof r.then === 'function') };
    });
    // Pre-fix loadNwImages returned undefined, so the batch loop had nothing to
    // await even if it had wanted to.
    expect(kind.isThenable).toBe(true);
  });

  test('batch import does not resolve until every image is stored', async ({ page }) => {
    test.setTimeout(180_000);
    await bootstrap(page);
    // 250ms per read: pre-fix, the last test's reads start ~4.2s in (29
    // iterations x the loop's 150ms yield) and are still pending when the loop
    // declares the import finished. The fixed loop awaits them.
    const res = await page.evaluate(eval(`(${RUN})`),
      { tests: 29, imgs: 4, clashes: 6, readDelayMs: 250 });

    expect(res.stillInFlight).toBe(0);
    expect(res.mappedImages).toBe(res.totalImages);
    expect(res.idbImageKeys).toBe(res.totalImages);
  });

  test('W31 folder pick imports every clash and records the weekly snapshot', async ({ page }) => {
    await bootstrap(page);
    const res = await page.evaluate(eval(`(${RUN})`), buildPick({ tests: 29, imgs: 20, clashes: 6 }));

    expect(res.clashes).toBe(29 * 6);
    expect(res.persisted).toBe(29 * 6);
    expect(res.weekly).toContain('2026-W31');
  });

  test('an unreadable image does not stall the batch or cost that test its clashes', async ({ page }) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await bootstrap(page);

    // cd000002.jpg exists in every test, so this fails one read per test.
    const res = await page.evaluate(eval(`(${RUN})`), { tests: 4, imgs: 5, clashes: 6, failAt: 'cd000002.jpg' });

    // Pre-fix a failed read never incremented `loaded`, so the completion block
    // — metadata write, UI refresh, success toast — stayed pending forever.
    expect(res.stillInFlight).toBe(0);
    expect(res.clashes).toBe(4 * 6);
    expect(res.persisted).toBe(4 * 6);
    expect(res.idbImageKeys).toBe(4 * 4); // 4 tests x (5 images - 1 unreadable)
    expect(errors.join('\n')).toContain('[IMG-BATCH-BACKPRESSURE]');
  });
});
