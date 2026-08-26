import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// STORAGE-WRITE-GUARD regression cover.
//
// The W31 defect: a folder pick of 29 XMLs parsed and merged every clash into
// S.clashes, but each per-file sv('clashes', …) hit the ~5MB localStorage
// ceiling and was swallowed by sv()'s bare `catch(e){}`. importFolderPick still
// reported "✓ Imported 29 of 29 clash tests". Nothing was persisted; the next
// reload showed the register back at its pre-import state, with no W31 clashes
// in nw:clashes and no W31 entry in nw:weekly.
//
// These specs pin the two halves of the fix: sv() reports failure (return
// value, console.error, banner) and the batch loop no longer claims success
// when a write was rejected.

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    S.clashes = []; sv('clashes', S.clashes);
    S.weekly = []; sv('weekly', S.weekly);
    nav('bcf');
  });
}

// Fill localStorage with 256KB ballast chunks until `keep` MB of headroom is
// left, so the next sizeable sv() is guaranteed to be rejected.
const FILL = (headroomMB) => `
  const chunk = 'x'.repeat(1024 * 256);
  let n = 0;
  try { for (;;) { localStorage.setItem('ballast' + n, chunk); n++; } } catch (e) {}
  const drop = Math.ceil(${headroomMB} * 4);
  for (let i = 0; i < drop; i++) localStorage.removeItem('ballast' + (n - 1 - i));
`;

test.describe('STORAGE-WRITE-GUARD', () => {
  test('sv() returns true on a write that lands', async ({ page }) => {
    await bootstrap(page);
    const ok = await page.evaluate(() => sv('svGuardProbe', { a: 1 }));
    expect(ok).toBe(true);
  });

  test('sv() returns false, logs, and raises a banner when the store is full', async ({ page }) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await bootstrap(page);

    const res = await page.evaluate((fill) => {
      // eslint-disable-next-line no-eval
      eval(fill);
      const before = _svFailCount;
      // IDB-RECORDS-MIGRATION: 'clashes' is routed to IndexedDB now, so it no
      // longer exercises the localStorage quota guard. 'dedupQueue' still lives
      // in localStorage and covers the identical code path.
      const ok = sv('dedupQueue', new Array(20000).fill({ uid: 'CLX-000', testName: 'x'.repeat(60) }));
      const banner = document.getElementById('sv-write-failure');
      return {
        ok,
        failCountDelta: _svFailCount - before,
        failedKeys: [..._svFailedKeys],
        bannerPresent: !!banner,
        bannerText: banner ? banner.textContent : '',
      };
    }, FILL(0.25));

    expect(res.ok).toBe(false);
    expect(res.failCountDelta).toBe(1);
    expect(res.failedKeys).toContain('dedupQueue');
    expect(res.bannerPresent).toBe(true);
    expect(res.bannerText).toContain('storage is full');
    expect(res.bannerText).toContain('NOT saved');
    expect(errors.join('\n')).toContain('[STORAGE-WRITE-GUARD]');
  });

  test('banner is dismissible and does not stack across repeated failures', async ({ page }) => {
    await bootstrap(page);
    const res = await page.evaluate((fill) => {
      // eslint-disable-next-line no-eval
      eval(fill);
      const big = new Array(20000).fill({ uid: 'CLX-000', testName: 'x'.repeat(60) });
      sv('clashes', big); sv('weekly', big); sv('imports', big);
      const count = document.querySelectorAll('#sv-write-failure').length;
      document.getElementById('sv-write-failure-x').click();
      return { count, afterDismiss: document.querySelectorAll('#sv-write-failure').length };
    }, FILL(0.25));
    expect(res.count).toBe(1);
    expect(res.afterDismiss).toBe(0);
  });

  test('folder batch import does NOT report success when writes were rejected', async ({ page }) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('dialog', d => d.accept()); // the "Found N clash tests … Proceed?" confirm
    await bootstrap(page);

    const res = await page.evaluate(async (fill) => {
      // eslint-disable-next-line no-eval
      eval(fill);
      // IDB-RECORDS-MIGRATION: filling localStorage no longer breaks the
      // register write — it goes to IndexedDB. Reject the record write so this
      // regression still tests what it was written to test: a rejected register
      // write must never be reported as a successful import.
      window._idbPutRecord = () => Promise.reject(new Error('simulated full store'));

      // 6 W31 XMLs × 120 clashes — more than the remaining headroom holds.
      const files = [];
      for (let i = 1; i <= 6; i++) {
        const bldg = i % 2 === 0 ? 'FAB' : 'CUP';
        let results = '';
        for (let c = 1; c <= 120; c++) {
          results += `<clashresult name="Clash${c}" href="files\\cd${String(c).padStart(6, '0')}.jpg" distance="-0.02">
            <clashpoint><pos3f x="${i * 1000 + c}" y="${c}" z="10"/></clashpoint><resultstatus>active</resultstatus>
            <createddate><date year="2026" month="7" day="27" hour="10" minute="0" second="0"/></createddate>
            <clashobject><pathlink><node>ESMC.nwd</node><node>GAS${i}.nwc</node></pathlink>
              <objectattribute><name>Item Name</name><value>Duct-${i}-${c}</value></objectattribute>
              <objectattribute><name>Element ID</name><value>${i}00${c}</value></objectattribute></clashobject>
            <clashobject><pathlink><node>ESMC.nwd</node><node>Struct${i}.nwc</node></pathlink>
              <objectattribute><name>Item Name</name><value>Beam-${i}-${c}</value></objectattribute>
              <objectattribute><name>Element ID</name><value>9${i}00${c}</value></objectattribute></clashobject>
          </clashresult>`;
        }
        const nm = `${String(i).padStart(2, '0')}_CR_v_08_AMHS.xml`;
        const xml = `<?xml version="1.0" encoding="UTF-8"?><exchange units="mm"><batchtest units="mm">` +
          `<clashtest name="Test ${i} ${bldg}">${results}</clashtest></batchtest></exchange>`;
        const f = new File([xml], nm, { type: 'text/xml', lastModified: Date.UTC(2026, 6, 27) });
        Object.defineProperty(f, 'webkitRelativePath', {
          value: `week-260727/260727 ${bldg} AMHS v 8 Clash test/${nm.replace('.xml', '')}/${nm}`,
        });
        files.push(f);
      }

      const toasts = [];
      const realToast = window.showToast;
      window.showToast = (m, d) => { toasts.push(String(m)); return realToast(m, d); };
      try {
        await importFolderPick({ files, value: 'x' });
      } finally {
        window.showToast = realToast;
      }

      return {
        toasts,
        svFailCount: _svFailCount,
        inMemory: (S.clashes || []).length,
        persisted: 0,   // every record write was rejected, so nothing reached the store
        bannerPresent: !!document.getElementById('sv-write-failure'),
      };
    }, FILL(0.25));

    // Writes were genuinely rejected and the register diverged from disk.
    expect(res.svFailCount).toBeGreaterThan(0);
    expect(res.inMemory).toBeGreaterThan(res.persisted);

    const closing = res.toasts[res.toasts.length - 1];
    // The regression: this used to read "✓ Imported 6 of 6 clash tests".
    expect(closing).not.toMatch(/^✓ Imported/);
    expect(closing).toContain('NOT SAVED');
    expect(closing).toContain('storage is full');
    expect(res.bannerPresent).toBe(true);
    expect(errors.join('\n')).toContain('[STORAGE-WRITE-GUARD-BATCH]');
  });

  test('folder batch import still reports success when storage has room', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await bootstrap(page);

    const res = await page.evaluate(async () => {
      const files = [];
      for (let i = 1; i <= 4; i++) {
        const bldg = i % 2 === 0 ? 'FAB' : 'CUP';
        let results = '';
        for (let c = 1; c <= 5; c++) {
          results += `<clashresult name="Clash${c}" href="files\\cd00000${c}.jpg" distance="-0.02">
            <clashpoint><pos3f x="${i * 100 + c}" y="${c}" z="10"/></clashpoint><resultstatus>active</resultstatus>
            <createddate><date year="2026" month="7" day="27" hour="10" minute="0" second="0"/></createddate>
            <clashobject><pathlink><node>ESMC.nwd</node><node>GAS${i}.nwc</node></pathlink>
              <objectattribute><name>Item Name</name><value>Duct-${i}-${c}</value></objectattribute>
              <objectattribute><name>Element ID</name><value>${i}00${c}</value></objectattribute></clashobject>
            <clashobject><pathlink><node>ESMC.nwd</node><node>Struct${i}.nwc</node></pathlink>
              <objectattribute><name>Item Name</name><value>Beam-${i}-${c}</value></objectattribute>
              <objectattribute><name>Element ID</name><value>9${i}00${c}</value></objectattribute></clashobject>
          </clashresult>`;
        }
        const nm = `${String(i).padStart(2, '0')}_CR_v_08_AMHS.xml`;
        const xml = `<?xml version="1.0" encoding="UTF-8"?><exchange units="mm"><batchtest units="mm">` +
          `<clashtest name="Test ${i} ${bldg}">${results}</clashtest></batchtest></exchange>`;
        const f = new File([xml], nm, { type: 'text/xml', lastModified: Date.UTC(2026, 6, 27) });
        Object.defineProperty(f, 'webkitRelativePath', {
          value: `week-260727/260727 ${bldg} AMHS v 8 Clash test/${nm.replace('.xml', '')}/${nm}`,
        });
        files.push(f);
      }

      const toasts = [];
      const realToast = window.showToast;
      window.showToast = (m, d) => { toasts.push(String(m)); return realToast(m, d); };
      try { await importFolderPick({ files, value: 'x' }); } finally { window.showToast = realToast; }

      return {
        toasts,
        svFailCount: _svFailCount,
        persisted: (await (async () => {
          await _flushPendingWrites();
          const db = await openIDB();
          return await new Promise(res => {
            const tx = db.transaction('records', 'readonly');
            const r = tx.objectStore('records').get('clashes');
            r.onsuccess = () => res(r.result || []); r.onerror = () => res([]);
          });
        })()).length,
        weekly: (await (async () => {
          const db = await openIDB();
          return await new Promise(res => {
            const tx = db.transaction('records', 'readonly');
            const r = tx.objectStore('records').get('weekly');
            r.onsuccess = () => res(r.result || []); r.onerror = () => res([]);
          });
        })()).map(w => w.year + '-W' + w.week),
        bannerPresent: !!document.getElementById('sv-write-failure'),
      };
    });

    expect(res.svFailCount).toBe(0);
    expect(res.bannerPresent).toBe(false);
    expect(res.persisted).toBe(20);
    expect(res.weekly).toContain('2026-W31');
    expect(res.toasts[res.toasts.length - 1]).toMatch(/^✓ Imported 4 of 4 clash tests/);
  });
});
