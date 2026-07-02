import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');
const DATA_VERSION = 'v4-correct-dates-jan25';

// 5 Active clashes in one test, dated 15/06/26.
function makeSeed() {
  const wy = { week: 24, year: 2026 };
  const mk = (n) => ({
    uid: 'CLX-' + String(n).padStart(3, '0'),
    name: 'CLX-' + String(n).padStart(3, '0') + ' — Clash' + n,
    nwOrig: 'Clash' + n,
    testName: '[H] Guard Fix Test A',
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

// XML matching the real Navisworks export shape — nested <date> with full
// year/month/day/hour/minute/second attributes.
function makeXmlWithCreatedDate({ year, month, day, hour = 10, minute = 0, second = 0, clashes = [1,2,3] }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="[H] Guard Fix Test A">
      ${clashes.map(n => `<clashresult name="Clash${n}" distance="-0.02">
        <clashpoint><pos3f x="${100*n}" y="${200*n}" z="${300*n}"/></clashpoint>
        <resultstatus>active</resultstatus>
        <createddate><date year="${year}" month="${month}" day="${day}" hour="${hour}" minute="${minute}" second="${second}"/></createddate>
        <clashobject><pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-A-${n}</value></objectattribute></clashobject>
        <clashobject><pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-B-${n}</value></objectattribute></clashobject>
      </clashresult>`).join('')}
    </clashtest>
  </batchtest>
</exchange>`;
}

// XML with NO createddate at all — the production foot-gun. The old build
// fell through unguarded and mass-flagged; the fix should FAIL CLOSED here.
function makeXmlWithNoDate({ clashes = [1,2,3] } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<exchange units="mm">
  <batchtest units="mm">
    <clashtest name="[H] Guard Fix Test A">
      ${clashes.map(n => `<clashresult name="Clash${n}" distance="-0.02">
        <clashpoint><pos3f x="${100*n}" y="${200*n}" z="${300*n}"/></clashpoint>
        <resultstatus>active</resultstatus>
        <clashobject><pathlink><node>ESMC.nwd</node><node>Structural.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-A-${n}</value></objectattribute></clashobject>
        <clashobject><pathlink><node>ESMC.nwd</node><node>MEP.nwc</node></pathlink><objectattribute><name>Element ID</name><value>EID-B-${n}</value></objectattribute></clashobject>
      </clashresult>`).join('')}
    </clashtest>
  </batchtest>
</exchange>`;
}

async function bootstrap(page, { keepMigrationLive = false } = {}) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate((keepMigrationLive) => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    if (!keepMigrationLive) {
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    }
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    nav('bcf');
  }, keepMigrationLive);
  await page.waitForSelector('#bxml');
}

async function seed(page) {
  await page.evaluate((seed) => {
    S.clashes = seed.slice();
    S.reviewQueueBanners = {};
    S.reviewQueueNoDateBanner = false;
    const mx = Math.max(0, ...S.clashes.map(c => parseInt((c.uid || 'CLX-0').replace(/\D/g, ''), 10) || 0));
    _uid = mx;
    sv('clashes', S.clashes);
    sv('reviewQueueBanners', S.reviewQueueBanners);
    sv('reviewQueueNoDateBanner', false);
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

test.describe('REVIEW-QUEUE-DATE-GUARD-CREATEDDATE — real Navisworks nested <date> parsing', () => {
  test('older nested-<date> XML (21 Apr 2026 22:08:34) against a 15 Jun 2026 register → 0 flagged, amber banner', async ({ page }) => {
    await bootstrap(page);
    await seed(page);
    await runImport(page, makeXmlWithCreatedDate({ year: 2026, month: 4, day: 21, hour: 22, minute: 8, second: 34 }));

    const state = await page.evaluate(() => ({
      pending: (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid),
      banners: S.reviewQueueBanners || {},
      noDateBanner: S.reviewQueueNoDateBanner === true,
      // Sanity check: parser captured the full ISO with time.
      firstCreatedISO: _bcfC[0]?.nwCreatedFullISO,
    }));
    expect(state.pending).toEqual([]);
    expect(state.banners['[H] Guard Fix Test A']).toBeDefined();
    expect(state.banners['[H] Guard Fix Test A'].batchDate).toBe('21/04/26');
    expect(state.banners['[H] Guard Fix Test A'].earliestDate).toBe('15/06/26');
    expect(state.noDateBanner).toBe(false);
    // The parser must have captured full time — this is the production bug
    // (previous version only carried day precision via DD/MM/YY roundtrip).
    expect(state.firstCreatedISO).toBe('2026-04-21T22:08:34.000Z');

    await page.evaluate(() => nav('review'));
    await expect(page.locator('.rq-date-banner')).toBeVisible();
  });

  test('newer nested-<date> XML (20 Jul 2026 09:15:00) against 15 Jun 2026 register → 2 flagged, no banner', async ({ page }) => {
    await bootstrap(page);
    await seed(page);
    await runImport(page, makeXmlWithCreatedDate({ year: 2026, month: 7, day: 20, hour: 9, minute: 15, second: 0 }));

    const state = await page.evaluate(() => ({
      pending: (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid).sort(),
      banners: S.reviewQueueBanners || {},
      noDateBanner: S.reviewQueueNoDateBanner === true,
    }));
    expect(state.pending).toEqual(['CLX-004', 'CLX-005']);
    expect(state.banners['[H] Guard Fix Test A']).toBeUndefined();
    expect(state.noDateBanner).toBe(false);
  });
});

test.describe('REVIEW-QUEUE-DATE-GUARD — fail-closed on unresolvable date', () => {
  test('no <createddate> at all → 0 flagged, "no resolvable date" banner surfaces (fail-closed)', async ({ page }) => {
    await bootstrap(page);
    await seed(page);
    await runImport(page, makeXmlWithNoDate());

    const state = await page.evaluate(() => ({
      pending: (S.clashes || []).filter(c => c.pendingReview === true).map(c => c.uid),
      banners: S.reviewQueueBanners || {},
      noDateBanner: S.reviewQueueNoDateBanner === true,
      // Sanity: parser should also see no ISO to fall back to.
      anyFallbackISO: (_bcfC || []).some(c => c && c.nwCreatedFullISO),
    }));
    expect(state.pending).toEqual([]); // <— the fix: no more silent flagging
    expect(state.noDateBanner).toBe(true);
    expect(state.anyFallbackISO).toBe(false);

    await page.evaluate(() => nav('review'));
    const banner = page.locator('.rq-nodate-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('no resolvable date');
    await expect(banner).toContainText('Review Queue detection was skipped');
  });

  test('a subsequent dated import clears the no-date banner', async ({ page }) => {
    await bootstrap(page);
    await seed(page);
    await runImport(page, makeXmlWithNoDate());
    let noDate = await page.evaluate(() => S.reviewQueueNoDateBanner === true);
    expect(noDate).toBe(true);

    await runImport(page, makeXmlWithCreatedDate({ year: 2026, month: 7, day: 20 }));
    noDate = await page.evaluate(() => S.reviewQueueNoDateBanner === true);
    expect(noDate).toBe(false);
  });
});

test.describe('REVIEW-QUEUE-MIGRATE-DATE-GUARD-FIX', () => {
  test('one-time migration clears stale pendingReview flags left by the pre-fix build and sets the guard', async ({ page }) => {
    await page.goto(HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);

    // Seed a pre-fix production register: 3 pending clashes + 1 reviewedStillOpen.
    // No nw:reviewQueueDateGuardFixed guard yet — mirrors a browser that first
    // loaded the app before this fix.
    await page.evaluate((dv) => {
      Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
      // Keep the previous migration flag set so its clear doesn't fire first.
      localStorage.setItem('nw:reviewQueueScopeFixed', '1');
      localStorage.setItem('nw:dataVersion', JSON.stringify(dv));
      const clashes = [
        { uid: 'CLX-001', testName: 'Test A', nwOrig: 'Clash1', status: 'Active',
          pendingReview: true, disappearedAt: '2026-04-21T22:08:34.000Z', disappearedInBatch: 'bat-stale-1' },
        { uid: 'CLX-002', testName: 'Test B', nwOrig: 'Clash1', status: 'Active',
          pendingReview: true, disappearedAt: '2026-04-21T22:08:34.000Z', disappearedInBatch: 'bat-stale-1' },
        { uid: 'CLX-003', testName: 'Test C', nwOrig: 'Clash1', status: 'Active',
          pendingReview: true, disappearedAt: '2026-04-21T22:08:34.000Z', disappearedInBatch: 'bat-stale-1' },
        { uid: 'CLX-004', testName: 'Test D', nwOrig: 'Clash1', status: 'Active',
          reviewedStillOpen: true },
      ];
      localStorage.setItem('nw:clashes', JSON.stringify(clashes));
      localStorage.setItem('nw:reviewQueueNoDateBanner', JSON.stringify(true));
    }, DATA_VERSION);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (S.clashes || []).some(c => c.uid === 'CLX-001'));

    const after = await page.evaluate(() => ({
      c1: S.clashes.find(x => x.uid === 'CLX-001'),
      c2: S.clashes.find(x => x.uid === 'CLX-002'),
      c3: S.clashes.find(x => x.uid === 'CLX-003'),
      c4: S.clashes.find(x => x.uid === 'CLX-004'),
      guard: localStorage.getItem('nw:reviewQueueDateGuardFixed'),
      noDateBanner: S.reviewQueueNoDateBanner === true,
    }));

    expect(after.c1.pendingReview).toBeUndefined();
    expect(after.c1.disappearedAt).toBeUndefined();
    expect(after.c1.disappearedInBatch).toBeUndefined();
    expect(after.c2.pendingReview).toBeUndefined();
    expect(after.c3.pendingReview).toBeUndefined();
    // reviewedStillOpen must survive — user confirmations stay valid.
    expect(after.c4.reviewedStillOpen).toBe(true);
    expect(after.guard).toBe('1');
    // Stale no-date banner cleared alongside the flags.
    expect(after.noDateBanner).toBe(false);

    // Second reload: migration must be idempotent — a fresh pendingReview
    // set between reloads must NOT be wiped.
    await page.evaluate((dv) => {
      const cs = S.clashes.map(c => c.uid === 'CLX-001'
        ? { ...c, pendingReview: true, disappearedAt: '2026-07-20T00:00:00.000Z', disappearedInBatch: 'bat-new' }
        : c);
      localStorage.setItem('nw:dataVersion', JSON.stringify(dv));
      localStorage.setItem('nw:clashes', JSON.stringify(cs));
    }, DATA_VERSION);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (S.clashes || []).some(c => c.uid === 'CLX-001'));
    const after2 = await page.evaluate(() => {
      const c1 = S.clashes.find(x => x.uid === 'CLX-001');
      return { pendingReview: c1.pendingReview, disappearedInBatch: c1.disappearedInBatch };
    });
    expect(after2.pendingReview).toBe(true);
    expect(after2.disappearedInBatch).toBe('bat-new');
  });
});
