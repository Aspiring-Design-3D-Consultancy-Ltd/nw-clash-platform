import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Seed: 5 Active clashes in one test, all dated 15/06/26 (DD/MM/YY). Element
// IDs keep pairKey on the ID:: tier so the merge branch matches directly.
function makeSeed() {
  const wy = { week: 24, year: 2026 };
  const mk = (n) => ({
    uid: 'CLX-' + String(n).padStart(3, '0'),
    name: 'CLX-' + String(n).padStart(3, '0') + ' — Clash' + n,
    nwOrig: 'Clash' + n,
    testName: '[H] Date Guard Test A',
    disciplineA: 'Structural', disciplineB: 'MEP',
    elementA: 'Beam-' + n, elementB: 'Duct-' + n,
    elementIdA: 'EID-A-' + n, elementIdB: 'EID-B-' + n,
    elementIdSrcA: 'Element ID', elementIdSrcB: 'Element ID',
    sourceA: 'Structural.nwc', sourceB: 'MEP.nwc',
    penetration: '20mm',
    status: 'Active',
    priority: 'High',
    assignedTo: '', notes: '',
    date: '15/06/26',
    x: 100 * n, y: 200 * n, z: 300 * n,
    nwImageRef: '',
    statusHistory: [{ week: wy.week, year: wy.year, status: 'Active' }],
  });
  return [mk(1), mk(2), mk(3), mk(4), mk(5)];
}

// Build an XML whose <createddate> resolves to the given YYYY-MM-DD. Contains
// Clash1..Clash3 only, so Clash4 and Clash5 are the "disappeared" candidates.
function makeXml(dateISO) {
  const [y, m, d] = dateISO.split('-');
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="[H] Date Guard Test A">
      ${[1,2,3].map(n => `<clashresult name="Clash${n}" distance="-0.02">
        <clashpoint><pos3f x="${100*n}" y="${200*n}" z="${300*n}"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="${y}" month="${parseInt(m,10)}" day="${parseInt(d,10)}"/></createddate>
        <clashobject><pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-A-${n}</value></objectattribute></clashobject>
        <clashobject><pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-B-${n}</value></objectattribute></clashobject>
      </clashresult>`).join('')}
    </clashtest>
  </batchtest>
</exchange>`;
}

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    // Prevent the REVIEW-QUEUE-MIGRATE-SCOPE-FIX one-time from clearing our
    // seeded pendingReview state between steps.
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    nav('bcf');
  });
  await page.waitForSelector('#bxml');
}

async function seed(page) {
  await page.evaluate((seed) => {
    S.clashes = seed.slice();
    const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
    _uid = mx;
    S.reviewQueueBanners = {};
    sv('clashes', S.clashes);
    sv('reviewQueueBanners', S.reviewQueueBanners);
  }, makeSeed());
}

async function runImport(page, xml) {
  await page.evaluate(() => nav('bcf'));
  await page.waitForSelector('#bxml');
  await page.evaluate((x) => {
    document.getElementById('bxml').value = x;
    bparse();
    window._skipCrossTestDupes = true;
    importToRegister('append');
  }, xml);
}

test.describe('REVIEW-QUEUE-DATE-GUARD', () => {
  test('older batch: 0 pendingReview, amber banner surfaces on empty state and group header', async ({ page }) => {
    await bootstrap(page);
    await seed(page);
    await runImport(page, makeXml('2026-06-01')); // pre-dates register (15/06/26)

    const state = await page.evaluate(() => ({
      pending: (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid),
      banners: S.reviewQueueBanners || {},
    }));
    expect(state.pending).toEqual([]);
    expect(state.banners['[H] Date Guard Test A']).toBeDefined();
    expect(state.banners['[H] Date Guard Test A'].batchDate).toBe('01/06/26');
    expect(state.banners['[H] Date Guard Test A'].earliestDate).toBe('15/06/26');

    // Empty-state banner renders (amber card with the ⚠ prefix).
    await page.evaluate(() => nav('review'));
    const banner = page.locator('.rq-date-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Last import pre-dates the register');
  });

  test('newer batch: 2 pendingReview flagged, banner absent', async ({ page }) => {
    await bootstrap(page);
    await seed(page);
    await runImport(page, makeXml('2026-06-20')); // strictly later than register

    const state = await page.evaluate(() => ({
      pending: (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid),
      banners: S.reviewQueueBanners || {},
    }));
    expect(state.pending.sort()).toEqual(['CLX-004', 'CLX-005']);
    // Banner cleared for the test that advanced past its earliest.
    expect(state.banners['[H] Date Guard Test A']).toBeUndefined();

    await page.evaluate(() => nav('review'));
    await expect(page.locator('.rq-date-banner')).toHaveCount(0);
  });

  test('same-date batch: 0 flagged, banner surfaces (equal treated as not-strictly-later)', async ({ page }) => {
    await bootstrap(page);
    await seed(page);
    await runImport(page, makeXml('2026-06-15')); // same as register earliest

    const state = await page.evaluate(() => ({
      pending: (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid),
      banners: S.reviewQueueBanners || {},
    }));
    expect(state.pending).toEqual([]);
    expect(state.banners['[H] Date Guard Test A']).toBeDefined();
    expect(state.banners['[H] Date Guard Test A'].batchDate).toBe('15/06/26');
    expect(state.banners['[H] Date Guard Test A'].earliestDate).toBe('15/06/26');
  });

  test('newer import after an older one clears the earlier banner', async ({ page }) => {
    await bootstrap(page);
    await seed(page);
    await runImport(page, makeXml('2026-06-01'));
    await runImport(page, makeXml('2026-06-20'));

    const state = await page.evaluate(() => ({
      pending: (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid).sort(),
      banners: S.reviewQueueBanners || {},
    }));
    // Only the two truly-disappeared clashes remain flagged.
    expect(state.pending).toEqual(['CLX-004', 'CLX-005']);
    expect(state.banners['[H] Date Guard Test A']).toBeUndefined();
  });
});
