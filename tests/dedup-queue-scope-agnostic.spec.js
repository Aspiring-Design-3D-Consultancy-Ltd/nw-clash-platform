import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    localStorage.setItem('nw:dedupInitialScan', '1');
    // Set both dedup migration gates so hydrate-time migrations don't
    // mutate the test's seeded queue.
    localStorage.setItem('nw:dedupRetroCleanup:v1', 'true');
    localStorage.setItem('nw:dedupSkippedMigration:v1', 'true');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
}

function makeClash({ uid, x = 100, weekTag, elementA = 'Duct', elementB = 'Beam', testName = '[H] Scope Bypass' }) {
  return {
    uid, name: uid + ' — c', nwOrig: 'C' + uid,
    testName,
    disciplineA: 'MEP', disciplineB: 'Structural',
    elementA, elementB,
    elementIdA: '', elementIdB: '',
    elementIdSrcA: '', elementIdSrcB: '',
    sourceA: 'GAS.nwc', sourceB: 'Struct.nwc',
    penetration: '20mm', status: 'Active', priority: 'High',
    assignedTo: '', notes: '', date: '01/07/26',
    x, y: 0, z: 0, nwImageRef: '',
    weekTag,
    statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
  };
}

test.describe('DEDUP-QUEUE-VIEW-SCOPE-BYPASS — inbox shows unresolved regardless of scope', () => {
  test('unresolved pairs render even when their primary clash sits in a prior week', async ({ page }) => {
    // Seed clashes tagged to an older weekTag than "the current scope"
    // would view. The register carries them but the picker's UI scope
    // could be scoped to the current week. Dedup Queue must ignore
    // that scope and show all unresolved pairs.
    await bootstrap(page);
    await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [
        { dedupPairId: 'dq-1', a: 'CLX-101', b: 'CLX-102', distMm: 3, detectedAt: '2026-06-01T10:00:00.000Z', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
        { dedupPairId: 'dq-2', a: 'CLX-103', b: 'CLX-104', distMm: 5, detectedAt: '2026-06-01T10:00:00.000Z', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
      ];
      sv('clashes', S.clashes);
      sv('dedupQueue', S.dedupQueue);
      nav('dedup');
    }, [
      makeClash({ uid: 'CLX-101', x: 100, weekTag: 'week-260601' }),
      makeClash({ uid: 'CLX-102', x: 103, weekTag: 'week-260601' }),
      makeClash({ uid: 'CLX-103', x: 200, weekTag: 'week-260601' }),
      makeClash({ uid: 'CLX-104', x: 205, weekTag: 'week-260601' }),
    ]);
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(2);
    await expect(page.locator('text=/2 candidate pairs awaiting review/')).toBeVisible();
  });

  test('orphan pair (uid missing from register) still renders, cells show "(missing)"', async ({ page }) => {
    // Pre-fix the byUid.has() filter dropped these entirely; per brief,
    // the retro-cleanup drops them at load. But if one slipped through,
    // the view must still show it — with a placeholder cell — so the
    // coordinator can Skip / Merge from the UI.
    await bootstrap(page);
    await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [
        { dedupPairId: 'dq-orphan', a: 'CLX-201', b: 'CLX-999-missing', distMm: 3, detectedAt: '2026-06-01T10:00:00.000Z', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
      ];
      sv('clashes', S.clashes);
      sv('dedupQueue', S.dedupQueue);
      nav('dedup');
    }, [ makeClash({ uid: 'CLX-201', x: 100, weekTag: 'week-260601' }) ]);
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(1);
    await expect(page.locator('[data-dedup-pair]')).toContainText('(missing)');
  });

  test('resolved pairs never render in the view (audit-only)', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [
        { dedupPairId: 'dq-active', a: 'CLX-301', b: 'CLX-302', distMm: 3, detectedAt: '2026-06-01T10:00:00.000Z', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
        { dedupPairId: 'dq-merged', a: 'CLX-303', b: 'CLX-304', distMm: 3, detectedAt: '2026-06-01T10:00:00.000Z', skipped: false, resolved: true, resolvedAction: 'merge', resolvedAt: '2026-06-01T11:00:00.000Z' },
      ];
      sv('clashes', S.clashes);
      sv('dedupQueue', S.dedupQueue);
      nav('dedup');
    }, [
      makeClash({ uid: 'CLX-301', x: 100, weekTag: 'week-260601' }),
      makeClash({ uid: 'CLX-302', x: 103, weekTag: 'week-260601' }),
      makeClash({ uid: 'CLX-303', x: 200, weekTag: 'week-260601' }),
      makeClash({ uid: 'CLX-304', x: 203, weekTag: 'week-260601' }),
    ]);
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(1);
    // The resolved pair is not in the active list.
    await expect(page.locator('[data-dedup-pair="dq-merged"]')).toHaveCount(0);
  });
});

test.describe('DEDUP-KEEP-SEPARATE-FLAG-FIX — sets skipped:true, not resolved:true', () => {
  test('Keep Separate stamps skipped:true + resolvedAction:keep-separate + resolvedAt; resolved stays false', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [
        { dedupPairId: 'dq-1', a: 'CLX-001', b: 'CLX-002', distMm: 3, detectedAt: '2026-06-01T10:00:00.000Z', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
      ];
      sv('clashes', S.clashes);
      sv('dedupQueue', S.dedupQueue);
    }, [
      makeClash({ uid: 'CLX-001', x: 100 }),
      makeClash({ uid: 'CLX-002', x: 103 }),
    ]);
    await page.evaluate(() => dedupKeepSeparate('dq-1'));
    const pair = await page.evaluate(() => S.dedupQueue[0]);
    expect(pair.skipped).toBe(true);
    expect(pair.resolved).toBe(false);
    expect(pair.resolvedAction).toBe('keep-separate');
    expect(typeof pair.resolvedAt).toBe('string');
    expect(pair.resolvedAt.length).toBeGreaterThan(10);
    // The underlying clashes still get dedupResolved=true so the scan
    // doesn't re-surface them.
    const clashes = await page.evaluate(() => ({
      a: S.clashes.find(c => c.uid === 'CLX-001'),
      b: S.clashes.find(c => c.uid === 'CLX-002'),
    }));
    expect(clashes.a.dedupResolved).toBe(true);
    expect(clashes.b.dedupResolved).toBe(true);
  });

  test('regression: Merge handler still sets resolved:true (not skipped)', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [
        { dedupPairId: 'dq-m', a: 'CLX-011', b: 'CLX-012', distMm: 3, detectedAt: '2026-06-01T10:00:00.000Z', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
      ];
      sv('clashes', S.clashes);
      sv('dedupQueue', S.dedupQueue);
      window.confirm = () => true;
    }, [
      makeClash({ uid: 'CLX-011', x: 100 }),
      makeClash({ uid: 'CLX-012', x: 103 }),
    ]);
    await page.evaluate(() => dedupMerge('dq-m'));
    const pair = await page.evaluate(() => S.dedupQueue[0]);
    expect(pair.resolved).toBe(true);
    expect(pair.skipped).toBe(false);
    expect(pair.resolvedAction).toBe('merge');
  });
});

test.describe('DEDUP-BADGE-COUNT-FIX — badge excludes resolved AND skipped', () => {
  test('badge equals count of pairs where !resolved && !skipped', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [
        { dedupPairId: 'dq-1', a: 'CLX-1', b: 'CLX-2', distMm: 3, detectedAt: 'x', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
        { dedupPairId: 'dq-2', a: 'CLX-3', b: 'CLX-4', distMm: 3, detectedAt: 'x', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
        { dedupPairId: 'dq-3', a: 'CLX-5', b: 'CLX-6', distMm: 3, detectedAt: 'x', skipped: true, resolved: false, resolvedAction: 'keep-separate', resolvedAt: 'x' },
        { dedupPairId: 'dq-4', a: 'CLX-7', b: 'CLX-8', distMm: 3, detectedAt: 'x', skipped: false, resolved: true, resolvedAction: 'merge', resolvedAt: 'x' },
      ];
      sv('clashes', S.clashes);
      sv('dedupQueue', S.dedupQueue);
      updSB();
    }, Array.from({ length: 8 }, (_, i) => makeClash({ uid: 'CLX-' + (i + 1), x: 100 + i })));
    await expect(page.locator('#na-dedup-badge')).toHaveText('2');
  });
});

test.describe('DEDUP-SKIPPED-MIGRATION-v1 — one-shot flip of keep-separate off the resolved flag', () => {
  test('resolved + keep-separate → skipped:true, resolved:false; other actions untouched; gate set', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(() => {
      S.clashes = [];
      S.dedupQueue = [
        // Pre-fix: keep-separate incorrectly stored under resolved.
        { dedupPairId: 'dq-ks', a: 'CLX-1', b: 'CLX-2', distMm: 3, detectedAt: 'x', skipped: false, resolved: true, resolvedAction: 'keep-separate', resolvedAt: '2026-06-01T10:00:00.000Z' },
        // Merge: legitimately resolved, MUST stay resolved.
        { dedupPairId: 'dq-m', a: 'CLX-3', b: 'CLX-4', distMm: 3, detectedAt: 'x', skipped: false, resolved: true, resolvedAction: 'merge', resolvedAt: '2026-06-01T11:00:00.000Z' },
        // Unresolved pair: untouched.
        { dedupPairId: 'dq-u', a: 'CLX-5', b: 'CLX-6', distMm: 3, detectedAt: 'x', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      localStorage.removeItem('nw:dedupSkippedMigration:v1');
      _migrateDedupSkippedV1();
      return {
        ks: S.dedupQueue.find(p => p.dedupPairId === 'dq-ks'),
        m: S.dedupQueue.find(p => p.dedupPairId === 'dq-m'),
        u: S.dedupQueue.find(p => p.dedupPairId === 'dq-u'),
        gate: localStorage.getItem('nw:dedupSkippedMigration:v1'),
      };
    });
    expect(result.ks.resolved).toBe(false);
    expect(result.ks.skipped).toBe(true);
    // Audit fields retained.
    expect(result.ks.resolvedAction).toBe('keep-separate');
    expect(result.ks.resolvedAt).toBe('2026-06-01T10:00:00.000Z');
    // Merge untouched.
    expect(result.m.resolved).toBe(true);
    expect(result.m.skipped).toBe(false);
    expect(result.m.resolvedAction).toBe('merge');
    // Unresolved untouched.
    expect(result.u.resolved).toBe(false);
    expect(result.u.skipped).toBe(false);
    // Gate now set.
    expect(result.gate).toBe('true');
  });

  test('idempotent: second call is a no-op even when queue would otherwise get flipped', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(() => {
      localStorage.setItem('nw:dedupSkippedMigration:v1', 'true');
      S.clashes = [];
      // Queue holds a pair that WOULD flip if the migration ran.
      S.dedupQueue = [
        { dedupPairId: 'dq-ks', a: 'CLX-1', b: 'CLX-2', distMm: 3, detectedAt: 'x', skipped: false, resolved: true, resolvedAction: 'keep-separate', resolvedAt: 'x' },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      _migrateDedupSkippedV1();
      return S.dedupQueue[0];
    });
    // Gate short-circuits — pair state untouched.
    expect(result.resolved).toBe(true);
    expect(result.skipped).toBe(false);
  });

  test('empty queue: sets the gate and returns cleanly', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(() => {
      S.clashes = [];
      S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      localStorage.removeItem('nw:dedupSkippedMigration:v1');
      _migrateDedupSkippedV1();
      return {
        gate: localStorage.getItem('nw:dedupSkippedMigration:v1'),
        queueLen: S.dedupQueue.length,
      };
    });
    expect(result.gate).toBe('true');
    expect(result.queueLen).toBe(0);
  });

  test('post-migration: badge and view both correctly count the flipped pair as unresolved-count = 0', async ({ page }) => {
    // Once the migration flips keep-separate to skipped, the badge and
    // view filters (both !resolved && !skipped) must exclude it —
    // pre-migration it was silently counted as resolved (fine), post-
    // migration it must be counted as skipped (still excluded). Verifies
    // the intent from the brief: "no user-visible effect on unresolved count".
    await bootstrap(page);
    await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [
        { dedupPairId: 'dq-ks', a: 'CLX-1', b: 'CLX-2', distMm: 3, detectedAt: 'x', skipped: false, resolved: true, resolvedAction: 'keep-separate', resolvedAt: 'x' },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      localStorage.removeItem('nw:dedupSkippedMigration:v1');
      _migrateDedupSkippedV1();
      updSB();
      nav('dedup');
    }, [ makeClash({ uid: 'CLX-1', x: 100 }), makeClash({ uid: 'CLX-2', x: 103 }) ]);
    // Badge hides at 0.
    await expect(page.locator('#na-dedup-badge')).toBeHidden();
    // Active view has no pairs.
    await expect(page.locator('[data-dedup-pair="dq-ks"]')).toHaveCount(0);
  });
});
