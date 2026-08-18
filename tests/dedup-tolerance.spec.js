import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// DEDUP-TOLERANCE-SETTING / DEDUP-TOLERANCE-FILTER
//
// The Dedup Queue proximity threshold used to be a hardcoded `d > 500`
// cutoff in scanForDedupCandidates(). It is now nw:dedupToleranceMm
// (default 50, clamped 5..500), applied in three places that must agree:
//   1. generation  — scanForDedupCandidates()
//   2. render      — rDedup()'s active + skipped filters
//   3. badge       — updSB()'s DEDUP-QUEUE-BADGE-FILTER count
//
// Coordinates are millimetres and _dedupCellKey buckets on
// testName + sourceA + sourceB only (no spatial cell), so a pure X offset
// is an exact 3D Euclidean distance and the only proximity gate.

// One candidate pair `dx` mm apart on X. Each pair gets its own testName
// so pairs never cross-bucket. Element strings match exactly on both sides
// (DEDUP-SIGNATURE-FILTER) and element IDs are blank so PAIR-ID-MERGE
// doesn't collapse them first. weekTag left undefined so DEDUP-SCOPE-GUARD's
// same-import check is a no-op.
function pairAt(dx, tag) {
  const base = {
    testName: '[H] Tol ' + tag,
    disciplineA: 'MEP', disciplineB: 'Structural',
    elementIdA: '', elementIdB: '',
    elementIdSrcA: '', elementIdSrcB: '',
    elementA: 'Duct-1', elementB: 'Beam-1',
    sourceA: 'GAS_v_08_AMHS.nwc',
    sourceB: 'Structure.nwc',
    penetration: '20mm',
    status: 'Active', priority: 'High',
    assignedTo: '', notes: '',
    date: '01/07/26',
    nwImageRef: '',
    statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
  };
  return [
    { ...base, uid: 'CLX-' + tag + '-A', name: 'CLX-' + tag + '-A', nwOrig: 'ClashA-' + tag,
      x: 1000, y: 1000, z: 1000 },
    { ...base, uid: 'CLX-' + tag + '-B', name: 'CLX-' + tag + '-B', nwOrig: 'ClashB-' + tag,
      x: 1000 + dx, y: 1000, z: 1000 },
  ];
}

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  // INV-007 gate: wait for the one-shot initial-scan migration against the
  // demo dataset before wiping, so window.onload's deferred migrations
  // can't race the seeded state below.
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
}

// Seeds the register and runs the scan. `tolMm` (optional) is written to
// localStorage BEFORE the scan so generation sees it.
async function seed(page, clashes, tolMm) {
  await page.evaluate(({ clashes, tolMm }) => {
    if (tolMm != null) localStorage.setItem('nw:dedupToleranceMm', String(tolMm));
    S.clashes = clashes.slice();
    S.dedupQueue = [];
    sv('clashes', S.clashes);
    sv('dedupQueue', S.dedupQueue);
    scanForDedupCandidates();
    updSB();
  }, { clashes, tolMm });
}

const queuedTags = (page) => page.evaluate(() =>
  (S.dedupQueue || []).map(p => p.a.replace(/^CLX-/, '').replace(/-A$/, '')).sort());

test.describe('DEDUP-TOLERANCE', () => {

  test('default tolerance is 50mm when nw:dedupToleranceMm is unset', async ({ page }) => {
    await bootstrap(page);
    const state = await page.evaluate(() => ({
      raw: localStorage.getItem('nw:dedupToleranceMm'),
      tol: _dedupGetTolMm(),
      min: _DEDUP_TOL_MIN,
      max: _DEDUP_TOL_MAX,
      def: _DEDUP_TOL_DEFAULT,
    }));
    expect(state.raw).toBeNull();
    expect(state.tol).toBe(50);
    expect(state.min).toBe(5);
    expect(state.max).toBe(500);
    expect(state.def).toBe(50);
  });

  test('validation: getter falls back / clamps, setter clamps and rejects non-numeric', async ({ page }) => {
    await bootstrap(page);

    // Getter — invalid or below-min stored values fall back to DEFAULT;
    // above-max clamps to MAX. Mirrors _rqdaGetTolMm's asymmetric shape.
    const got = await page.evaluate(() => {
      const read = (v) => { localStorage.setItem('nw:dedupToleranceMm', v); return _dedupGetTolMm(); };
      return {
        belowMin: read('4'),
        atMin: read('5'),
        aboveMax: read('501'),
        atMax: read('500'),
        garbage: read('not-a-number'),
        empty: read(''),
        negative: read('-10'),
        mid: read('120'),
      };
    });
    expect(got.belowMin).toBe(50);   // → DEFAULT
    expect(got.atMin).toBe(5);
    expect(got.aboveMax).toBe(500);  // → MAX
    expect(got.atMax).toBe(500);
    expect(got.garbage).toBe(50);
    expect(got.empty).toBe(50);
    expect(got.negative).toBe(50);
    expect(got.mid).toBe(120);

    // Setter — clamps into range, ignores non-numeric input entirely.
    const set = await page.evaluate(() => {
      const write = (v) => { _dedupSetTolMm(v); return localStorage.getItem('nw:dedupToleranceMm'); };
      const out = { low: write(1), high: write(9999), ok: write(75) };
      out.rejected = write('abc');   // no write — previous value survives
      return out;
    });
    expect(set.low).toBe('5');
    expect(set.high).toBe('500');
    expect(set.ok).toBe('75');
    expect(set.rejected).toBe('75');
  });

  test('49mm pair is generated and visible at the 50mm default', async ({ page }) => {
    await bootstrap(page);
    await seed(page, pairAt(49, '49'));
    expect(await queuedTags(page)).toEqual(['49']);
    await expect(page.locator('#na-dedup-badge')).toHaveText('1');
    await page.evaluate(() => nav('dedup'));
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(1);
  });

  test('50mm pair is generated and visible at the 50mm default (boundary is inclusive)', async ({ page }) => {
    await bootstrap(page);
    await seed(page, pairAt(50, '50'));
    expect(await queuedTags(page)).toEqual(['50']);
    await expect(page.locator('#na-dedup-badge')).toHaveText('1');
    await page.evaluate(() => nav('dedup'));
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(1);
  });

  test('51mm pair is not generated at the 50mm default', async ({ page }) => {
    await bootstrap(page);
    await seed(page, pairAt(51, '51'));
    expect(await queuedTags(page)).toEqual([]);
    await expect(page.locator('#na-dedup-badge')).toBeHidden();
    await page.evaluate(() => nav('dedup'));
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(0);
  });

  test('51mm pair IS generated when the tolerance is raised to 100mm', async ({ page }) => {
    await bootstrap(page);
    await seed(page, pairAt(51, '51'), 100);
    expect(await queuedTags(page)).toEqual(['51']);
    await expect(page.locator('#na-dedup-badge')).toHaveText('1');
  });

  test('lowering the tolerance hides but never deletes existing queue entries, and preserves review history', async ({ page }) => {
    await bootstrap(page);
    // Generate three pairs at a wide tolerance.
    const clashes = [...pairAt(40, '40'), ...pairAt(120, '120'), ...pairAt(300, '300')];
    await seed(page, clashes, 500);
    expect(await queuedTags(page)).toEqual(['120', '300', '40']);

    // Skip the 300mm pair so it carries review history.
    await page.evaluate(() => {
      const p = S.dedupQueue.find(q => q.a === 'CLX-300-A');
      dedupSkip(p.dedupPairId);
    });
    const skippedBefore = await page.evaluate(() => {
      const p = (S.dedupQueue || []).find(q => q.a === 'CLX-300-A');
      return { skipped: p.skipped, detectedAt: p.detectedAt, dist: p.distMm };
    });
    expect(skippedBefore.skipped).toBe(true);

    // Lower the tolerance to 50mm — visibility only, no rescan.
    await page.evaluate(() => _dedupSetTolMm(50));

    const after = await page.evaluate(() => ({
      inMemory: (S.dedupQueue || []).map(p => p.a).sort(),
      persisted: (JSON.parse(localStorage.getItem('nw:dedupQueue') || '[]')).map(p => p.a).sort(),
      skipped: (S.dedupQueue || []).find(q => q.a === 'CLX-300-A'),
    }));
    // All three entries survive, in memory and in storage.
    expect(after.inMemory).toEqual(['CLX-120-A', 'CLX-300-A', 'CLX-40-A']);
    expect(after.persisted).toEqual(['CLX-120-A', 'CLX-300-A', 'CLX-40-A']);
    // Review history intact and unmodified.
    expect(after.skipped.skipped).toBe(true);
    expect(after.skipped.detectedAt).toBe(skippedBefore.detectedAt);
    expect(after.skipped.distMm).toBe(skippedBefore.dist);

    // Only the 40mm pair is visible; badge agrees.
    await page.evaluate(() => { nav('dedup'); updSB(); });
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(1);
    await expect(page.locator('[data-dedup-pair]')).toContainText('CLX-40-A');
    await expect(page.locator('#na-dedup-badge')).toHaveText('1');
  });

  test('raising the tolerance restores previously hidden candidates without a re-import', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [...pairAt(40, '40'), ...pairAt(120, '120'), ...pairAt(300, '300')], 500);
    await page.evaluate(() => _dedupSetTolMm(50));
    await page.evaluate(() => nav('dedup'));
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(1);

    // Raise to 200mm — the 120mm pair comes back, the 300mm one stays hidden.
    await page.evaluate(() => { _dedupSetTolMm(200); nav('dedup'); });
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(2);
    await expect(page.locator('#na-dedup-badge')).toHaveText('2');

    // Raise to the max — all three visible again.
    await page.evaluate(() => { _dedupSetTolMm(500); nav('dedup'); });
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(3);
    await expect(page.locator('#na-dedup-badge')).toHaveText('3');
  });

  test('badge count and rendered card count stay in parity across tolerance changes', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [
      ...pairAt(20, '20'), ...pairAt(60, '60'), ...pairAt(150, '150'), ...pairAt(400, '400'),
    ], 500);

    for (const [tol, expected] of [[500, 4], [200, 3], [100, 2], [50, 1], [10, 0]]) {
      await page.evaluate((t) => { _dedupSetTolMm(t); nav('dedup'); updSB(); }, tol);
      await expect(page.locator('[data-dedup-pair]')).toHaveCount(expected);
      const badge = page.locator('#na-dedup-badge');
      if (expected === 0) {
        await expect(badge).toBeHidden();
      } else {
        await expect(badge).toHaveText(String(expected));
      }
    }
  });

  test('a pair with a missing distMm is shown, not hidden (null-safe predicate)', async ({ page }) => {
    await bootstrap(page);
    await seed(page, pairAt(20, '20'));
    await page.evaluate(() => { delete S.dedupQueue[0].distMm; _dedupSetTolMm(5); nav('dedup'); updSB(); });
    // 20mm > 5mm tolerance, but distMm is gone — a data gap must not be
    // treated as a proximity decision.
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(1);
    await expect(page.locator('#na-dedup-badge')).toHaveText('1');
  });

  test('Settings exposes the tolerance input, saves through the handler, and reports live queue counts', async ({ page }) => {
    await bootstrap(page);
    await seed(page, [...pairAt(40, '40'), ...pairAt(300, '300')], 500);
    await page.evaluate(() => nav('settings'));

    const input = page.locator('#dedup-tol-mm');
    await expect(input).toHaveValue('500');
    await expect(input).toHaveAttribute('min', '5');
    await expect(input).toHaveAttribute('max', '500');

    // Save 50mm through the UI handler.
    await input.fill('50');
    await page.evaluate(() => _dedupUiSaveTol());
    expect(await page.evaluate(() => localStorage.getItem('nw:dedupToleranceMm'))).toBe('50');

    // The settings card reports 2 stored / 2 awaiting review / 1 visible.
    const card = page.locator('#dedup-tol-mm').locator('xpath=ancestor::div[contains(@class,"ss-sec")]');
    await expect(card).toContainText('2');
    await expect(card).toContainText('hidden');

    // Out-of-range input is rejected before it reaches storage.
    await page.locator('#dedup-tol-mm').fill('9999');
    await page.evaluate(() => _dedupUiSaveTol());
    expect(await page.evaluate(() => localStorage.getItem('nw:dedupToleranceMm'))).toBe('50');
  });

  test('the tolerance is not wired into any Selective Reset category (protected user config)', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => _dedupSetTolMm(120));
    // SELECTIVE-RESET-PROTECT-AUDIT-LOG treats the tolerance the same way it
    // treats republishToleranceMm: user-authored workflow config, protected
    // from the wipe and deliberately absent from every category's lsKeys.
    const wired = await page.evaluate(() =>
      _selectiveResetCategories().some(c => (c.lsKeys || []).includes('dedupToleranceMm')));
    expect(wired).toBe(false);
    // Ticking Dedup Queue clears the queue keys but leaves the tolerance.
    const dedupCat = await page.evaluate(() =>
      _selectiveResetCategories().find(c => c.id === 'dedup').lsKeys);
    expect(dedupCat).toEqual(['dedupQueue', 'dedupInitialScan', 'dqShowSkipped']);
    expect(await page.evaluate(() => localStorage.getItem('nw:dedupToleranceMm'))).toBe('120');
  });
});
