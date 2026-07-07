import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// Two clashes at 3mm distance, same test + sources — a canonical dedup
// candidate pair. Element IDs blanked so PAIR-ID doesn't collapse them.
function makePair() {
  const base = {
    testName: '[H] Dedup Test',
    disciplineA: 'MEP', disciplineB: 'Structural',
    elementIdA: '', elementIdB: '',
    elementIdSrcA: '', elementIdSrcB: '',
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
    { ...base, uid: 'CLX-001', name: 'CLX-001 — A', nwOrig: 'ClashA',
      elementA: 'Duct-1', elementB: 'Beam-1',
      x: 100, y: 100, z: 100, notes: 'Coordinator note: check flange' },
    { ...base, uid: 'CLX-002', name: 'CLX-002 — B', nwOrig: 'ClashB',
      elementA: 'Duct-2', elementB: 'Beam-2',
      x: 103, y: 100, z: 100 }, // 3mm away
  ];
}

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    // Leave dedupInitialScan UNSET so the migration runs on seed.
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
}

async function seed(page, clashes) {
  await page.evaluate((clashes) => {
    S.clashes = clashes.slice();
    S.dedupQueue = [];
    sv('clashes', S.clashes);
    sv('dedupQueue', S.dedupQueue);
    // Trigger the scan directly (mimics the initial-scan migration path).
    scanForDedupCandidates();
    updSB();
  }, clashes);
}

test.describe('DEDUP-QUEUE', () => {
  test('badge counts candidate pairs, Merge collapses to one record, older uid + notes preserved', async ({ page }) => {
    await bootstrap(page);
    await seed(page, makePair());

    // Badge shows 1 candidate.
    const badge = page.locator('#na-dedup-badge');
    await expect(badge).toHaveText('1');
    await expect(badge).toBeVisible();

    // Navigate to the queue tab; verify the pair renders side-by-side.
    await page.evaluate(() => nav('dedup'));
    const card = page.locator('[data-dedup-pair]');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('3.00mm');
    await expect(card).toContainText('CLX-001');
    await expect(card).toContainText('CLX-002');

    // Merge — driver via the exposed handler to sidestep the confirm
    // dialog's page.on('dialog') plumbing.
    const pairId = await page.evaluate(() => S.dedupQueue[0].dedupPairId);
    await page.evaluate((pid) => dedupMerge(pid), pairId);

    const state = await page.evaluate(() => ({
      count: (S.clashes || []).length,
      remaining: S.clashes[0],
      queueLen: (S.dedupQueue || []).length,
    }));
    expect(state.count).toBe(1);
    // Older uid survived.
    expect(state.remaining.uid).toBe('CLX-001');
    expect(state.remaining.dedupResolved).toBe(true);
    // Newer record's notes were transferred (older had a note; newer had
    // none — assert the older's original notes survive intact).
    expect(state.remaining.notes).toContain('Coordinator note: check flange');
    // Queue emptied.
    expect(state.queueLen).toBe(0);

    // Badge hides at zero.
    await page.evaluate(() => updSB());
    await expect(page.locator('#na-dedup-badge')).toBeHidden();
  });

  test('Keep separate marks both records dedupResolved=true and drops the pair from the queue', async ({ page }) => {
    await bootstrap(page);
    await seed(page, makePair());

    const pairId = await page.evaluate(() => S.dedupQueue[0].dedupPairId);
    await page.evaluate((pid) => dedupKeepSeparate(pid), pairId);

    const state = await page.evaluate(() => ({
      count: (S.clashes || []).length,
      a: S.clashes.find(c => c.uid === 'CLX-001'),
      b: S.clashes.find(c => c.uid === 'CLX-002'),
      queueLen: (S.dedupQueue || []).length,
    }));
    expect(state.count).toBe(2); // both records still present
    expect(state.a.dedupResolved).toBe(true);
    expect(state.b.dedupResolved).toBe(true);
    expect(state.queueLen).toBe(0);

    // Re-running the scan must NOT re-add this pair — dedupResolved
    // clashes are excluded.
    await page.evaluate(() => scanForDedupCandidates());
    const reScanned = await page.evaluate(() => (S.dedupQueue || []).length);
    expect(reScanned).toBe(0);
  });

  test('Skip leaves the pair in the queue for later review', async ({ page }) => {
    await bootstrap(page);
    await seed(page, makePair());

    const pairId = await page.evaluate(() => S.dedupQueue[0].dedupPairId);
    await page.evaluate((pid) => dedupSkip(pid), pairId);

    const state = await page.evaluate(() => ({
      queueLen: (S.dedupQueue || []).length,
      dedupResolvedA: S.clashes.find(c => c.uid === 'CLX-001').dedupResolved,
      dedupResolvedB: S.clashes.find(c => c.uid === 'CLX-002').dedupResolved,
    }));
    expect(state.queueLen).toBe(1);
    expect(state.dedupResolvedA).toBeUndefined();
    expect(state.dedupResolvedB).toBeUndefined();
  });

  test('empty state renders when the queue has no live pairs', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => {
      S.clashes = [];
      S.dedupQueue = [];
      sv('clashes', []);
      sv('dedupQueue', []);
      nav('dedup');
    });
    await expect(page.locator('text=Dedup Queue is empty')).toBeVisible();
  });
});
