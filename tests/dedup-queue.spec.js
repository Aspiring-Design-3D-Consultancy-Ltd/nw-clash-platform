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
    // DEDUP-QUEUE-RESOLVE-PERSIST: the candidate stays in the queue as an
    // audit record but flagged resolved — filters out of the active view
    // and badge, doesn't count toward the "awaiting review" tally.
    expect(state.queueLen).toBe(1);
    const resolvedShape = await page.evaluate(() => ({
      resolved: S.dedupQueue[0].resolved,
      action: S.dedupQueue[0].resolvedAction,
    }));
    expect(resolvedShape.resolved).toBe(true);
    expect(resolvedShape.action).toBe('merge');

    // Badge hides because the only pair is resolved (BADGE-FILTER excludes
    // resolved from the count).
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
    // DEDUP-QUEUE-RESOLVE-PERSIST: candidate stays in the queue as an
    // audit record, but flagged resolved so it's excluded from view/badge.
    expect(state.queueLen).toBe(1);
    const resolvedShape = await page.evaluate(() => ({
      resolved: S.dedupQueue[0].resolved,
      action: S.dedupQueue[0].resolvedAction,
    }));
    expect(resolvedShape.resolved).toBe(true);
    expect(resolvedShape.action).toBe('keep-separate');

    // Re-running the scan must NOT re-add this pair — dedupResolved
    // clashes are excluded AND the resolved flag on the candidate
    // survives (DEDUP-QUEUE-DETECT-IDEMPOTENT).
    await page.evaluate(() => scanForDedupCandidates());
    const reScanned = await page.evaluate(() => ({
      len: (S.dedupQueue || []).length,
      resolved: S.dedupQueue[0]?.resolved,
    }));
    expect(reScanned.len).toBe(1);
    expect(reScanned.resolved).toBe(true);
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

  test('DEDUP-QUEUE-IMAGES — both cells render <img> tags when nwImageRef + IDB blob are present', async ({ page }) => {
    await bootstrap(page);
    const pair = makePair();
    pair[0].nwImageRef = 'clashA.jpg';
    pair[1].nwImageRef = 'clashB.jpg';
    await seed(page, pair);
    // Seed the IDB image store the way loadNwImages does: idbPut per blob,
    // set _nwImages composite key → idx, set _nwImgByTest per test.
    await page.evaluate(async () => {
      // Minimal 3-byte "base64" payload — the browser won't render it as
      // an image but our assertions only care that the <img> tag is
      // built with a data:image/jpeg;base64,... src.
      await idbPut(1, 'AAAA'); // clashA.jpg blob
      await idbPut(2, 'BBBB'); // clashB.jpg blob
      _nwImages.set('[H] Dedup Test::clashA.jpg', 1);
      _nwImages.set('[H] Dedup Test::clashB.jpg', 2);
      _nwImagesByIndex[1] = 'AAAA';
      _nwImagesByIndex[2] = 'BBBB';
      _nwImgByTest['[H] Dedup Test'] = { firstIdx: 1, count: 2, filenames: ['clashA.jpg', 'clashB.jpg'] };
      _nwImgCount = 2;
    });
    await page.evaluate(() => nav('dedup'));

    const slots = page.locator('.dq-img[data-dq-uid]');
    await expect(slots).toHaveCount(2);
    // Wait for the async fill to swap the placeholder text for an <img>.
    await page.waitForFunction(() => {
      const s = document.querySelectorAll('.dq-img[data-dq-uid]');
      return s.length === 2 && [...s].every(el => el.querySelector('img'));
    });
    const imgA = page.locator('.dq-img[data-dq-uid="CLX-001"] img');
    const imgB = page.locator('.dq-img[data-dq-uid="CLX-002"] img');
    await expect(imgA).toBeVisible();
    await expect(imgB).toBeVisible();
    const srcA = await imgA.getAttribute('src');
    const srcB = await imgB.getAttribute('src');
    expect(srcA).toMatch(/^data:image\/jpeg;base64,/);
    expect(srcB).toMatch(/^data:image\/jpeg;base64,/);
    // Sanity: the base64 payloads survive the round-trip unchanged.
    expect(srcA.endsWith(',AAAA')).toBe(true);
    expect(srcB.endsWith(',BBBB')).toBe(true);
  });

  test('DEDUP-QUEUE-IMAGES — placeholder renders on the side with no nwImageRef; the other side still renders <img>', async ({ page }) => {
    await bootstrap(page);
    const pair = makePair();
    pair[0].nwImageRef = 'clashA.jpg';
    pair[1].nwImageRef = ''; // no viewpoint captured on side B
    await seed(page, pair);
    await page.evaluate(async () => {
      await idbPut(1, 'AAAA');
      _nwImages.set('[H] Dedup Test::clashA.jpg', 1);
      _nwImagesByIndex[1] = 'AAAA';
      _nwImgByTest['[H] Dedup Test'] = { firstIdx: 1, count: 1, filenames: ['clashA.jpg'] };
      _nwImgCount = 1;
    });
    await page.evaluate(() => nav('dedup'));

    // Wait for the async fill to resolve at least one slot.
    await page.waitForFunction(() => {
      const a = document.querySelector('.dq-img[data-dq-uid="CLX-001"]');
      const b = document.querySelector('.dq-img[data-dq-uid="CLX-002"]');
      return a && b && (a.querySelector('img') || a.textContent.trim() === 'No viewpoint available')
                    && (b.querySelector('img') || b.textContent.trim() === 'No viewpoint available');
    });

    const cellA = page.locator('.dq-img[data-dq-uid="CLX-001"]');
    const cellB = page.locator('.dq-img[data-dq-uid="CLX-002"]');
    await expect(cellA.locator('img')).toHaveCount(1);
    await expect(cellB).toHaveText('No viewpoint available');
  });

  test('DEDUP-QUEUE-IMAGES — placeholder + no console errors when nwImageRef is set but the IDB blob is missing', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const text = m.text();
      // Filter sandbox-level network noise (the pptx CDN loader at
      // working.html:351 races the file:// bootstrap and reports a
      // tunnel failure from the container's egress proxy — unrelated
      // to the DEDUP-QUEUE-IMAGES path).
      if (/ERR_TUNNEL_CONNECTION_FAILED|Failed to load resource/.test(text)) return;
      errors.push(text);
    });

    await bootstrap(page);
    const pair = makePair();
    pair[0].nwImageRef = 'ghost.jpg'; // nwImageRef points nowhere
    pair[1].nwImageRef = 'alsoGhost.jpg';
    await seed(page, pair);
    await page.evaluate(() => {
      // _nwImgCount > 0 so getNwImageB64 doesn't short-circuit — but the
      // composite key isn't in _nwImages, so idbGet is never called and
      // the resolver returns null.
      _nwImgCount = 1;
    });
    await page.evaluate(() => nav('dedup'));

    await page.waitForFunction(() => {
      const s = document.querySelectorAll('.dq-img[data-dq-uid]');
      return s.length === 2 && [...s].every(el => el.textContent.trim() === 'No viewpoint available');
    });

    await expect(page.locator('.dq-img[data-dq-uid="CLX-001"]')).toHaveText('No viewpoint available');
    await expect(page.locator('.dq-img[data-dq-uid="CLX-002"]')).toHaveText('No viewpoint available');
    expect(errors).toEqual([]);
  });

  // DEDUP-QUEUE-SKIP-PERSIST: Skip must persist to nw:dedupQueue and survive
  // reload. Previous shape stored only {dedupPairId,a,b,distMm,detectedAt}
  // — Skip did nothing; the pair silently re-surfaced on the next scan.
  test('DEDUP-QUEUE-SKIP-PERSIST — Skip stamps skipped=true, persists across reload, does NOT delete the pair', async ({ page }) => {
    await bootstrap(page);
    await seed(page, makePair());
    const pairId = await page.evaluate(() => S.dedupQueue[0].dedupPairId);
    await page.evaluate((pid) => dedupSkip(pid), pairId);

    // In-memory shape: skipped=true, resolved=false, pair still in queue.
    const inMem = await page.evaluate(() => ({
      len: S.dedupQueue.length,
      skipped: S.dedupQueue[0].skipped,
      resolved: S.dedupQueue[0].resolved,
    }));
    expect(inMem.len).toBe(1);
    expect(inMem.skipped).toBe(true);
    expect(inMem.resolved).toBe(false);

    // localStorage mirror.
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('nw:dedupQueue') || '[]'));
    expect(persisted.length).toBe(1);
    expect(persisted[0].skipped).toBe(true);
    expect(persisted[0].resolved).toBe(false);

    // Active view hides the skipped pair; badge count = 0.
    await page.evaluate(() => nav('dedup'));
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(0);
    await page.evaluate(() => updSB());
    await expect(page.locator('#na-dedup-badge')).toBeHidden();

    // Show skipped toggle appears with count (1).
    const toggleBtn = page.locator('button', { hasText: /Show skipped \(1\)/ });
    await expect(toggleBtn).toBeVisible();

    // Expand: skipped pair renders below active with "SKIPPED" pill + Unskip button.
    await toggleBtn.click();
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(1);
    await expect(page.locator('[data-dedup-pair]')).toContainText('SKIPPED');
    await expect(page.locator('button', { hasText: 'Unskip' })).toBeVisible();

    // Unskip restores the pair to the active queue.
    await page.evaluate((pid) => dedupUnskip(pid), pairId);
    const afterUnskip = await page.evaluate(() => S.dedupQueue[0].skipped);
    expect(afterUnskip).toBe(false);
    await page.evaluate(() => updSB());
    await expect(page.locator('#na-dedup-badge')).toHaveText('1');
  });

  // DEDUP-QUEUE-RESOLVE-PERSIST: Merge / Keep separate mark the candidate
  // resolved=true with an audit-trail action stamp. The pair filters out of
  // the active view + badge but remains in the store for the audit trail.
  test('DEDUP-QUEUE-RESOLVE-PERSIST — Merge stamps resolved=true + resolvedAction=merge; pair filters out of active view and badge', async ({ page }) => {
    await bootstrap(page);
    await seed(page, makePair());
    const pairId = await page.evaluate(() => S.dedupQueue[0].dedupPairId);
    await page.evaluate((pid) => dedupMerge(pid), pairId);

    const state = await page.evaluate(() => ({
      queueLen: S.dedupQueue.length,
      pair: S.dedupQueue[0],
      clashCount: S.clashes.length,
    }));
    // Register-side merge still deletes newer clash + preserves older uid.
    expect(state.clashCount).toBe(1);
    // Candidate stays in the store as an audit record, but flagged resolved.
    expect(state.queueLen).toBe(1);
    expect(state.pair.resolved).toBe(true);
    expect(state.pair.resolvedAction).toBe('merge');
    expect(state.pair.resolvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Persisted mirror carries the same shape.
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('nw:dedupQueue') || '[]'));
    expect(persisted[0].resolved).toBe(true);
    expect(persisted[0].resolvedAction).toBe('merge');

    // Active view hides resolved pairs; badge shows 0.
    await page.evaluate(() => nav('dedup'));
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(0);
    await expect(page.locator('#na-dedup-badge')).toBeHidden();
  });

  test('DEDUP-QUEUE-RESOLVE-PERSIST — Keep separate stamps resolved=true + resolvedAction=keep-separate', async ({ page }) => {
    await bootstrap(page);
    await seed(page, makePair());
    const pairId = await page.evaluate(() => S.dedupQueue[0].dedupPairId);
    await page.evaluate((pid) => dedupKeepSeparate(pid), pairId);

    const state = await page.evaluate(() => ({
      queueLen: S.dedupQueue.length,
      pair: S.dedupQueue[0],
      clashCount: S.clashes.length,
    }));
    // Both records survive the register (Keep separate does not delete).
    expect(state.clashCount).toBe(2);
    expect(state.queueLen).toBe(1);
    expect(state.pair.resolved).toBe(true);
    expect(state.pair.resolvedAction).toBe('keep-separate');

    // Active view + badge both hide the resolved pair.
    await page.evaluate(() => nav('dedup'));
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(0);
    await expect(page.locator('#na-dedup-badge')).toBeHidden();
  });

  // DEDUP-QUEUE-ORPHAN-CLEANUP: candidates whose register entries were
  // deleted out-of-band must be pruned on load. Production incident: 44
  // candidates persisted, 39 pointed to deleted uids, badge read raw
  // .length while view filtered at render time — the two drifted.
  test('DEDUP-QUEUE-ORPHAN-CLEANUP — candidates referencing deleted uids are pruned on next load', async ({ page }) => {
    await bootstrap(page);
    await seed(page, makePair());

    // Simulate the production incident: a Merge (or an out-of-band delete)
    // removed the newer clash but the candidate record was left in the
    // store with the pre-fix schema (no resolved flag). Reload cleanly
    // via localStorage seed + full reload.
    await page.evaluate(() => {
      // Delete CLX-002 out-of-band, leaving CLX-001 in the register but
      // the candidate {a:CLX-001, b:CLX-002} orphaned in the queue.
      S.clashes = S.clashes.filter(c => c.uid !== 'CLX-002');
      // Wipe the resolution flags to mimic a pre-migration store.
      const orphan = { ...S.dedupQueue[0] };
      delete orphan.resolved; delete orphan.resolvedAction;
      delete orphan.resolvedAt; delete orphan.skipped;
      sv('clashes', S.clashes);
      sv('dedupQueue', [orphan]);
    });

    // Trigger the on-load orphan-cleanup path by re-navigating to reload.
    // Wait for initAuth to complete — the migration runs inside initAuth
    // and its very last synchronous act is setting nw:dedupInitialScan.
    // Also wait for S.projName so we know initAuth's early hydrate ran.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
    await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
    await page.evaluate(() => {
      document.getElementById('auth').style.display = 'none';
      document.getElementById('app').classList.add('show');
    });

    // Orphan pruned + badge in sync with the (now empty) active queue.
    const state = await page.evaluate(() => ({
      queueLen: (S.dedupQueue || []).length,
      persisted: JSON.parse(localStorage.getItem('nw:dedupQueue') || '[]').length,
    }));
    expect(state.queueLen).toBe(0);
    expect(state.persisted).toBe(0);
    await page.evaluate(() => updSB());
    await expect(page.locator('#na-dedup-badge')).toBeHidden();
  });

  // DEDUP-QUEUE-DETECT-IDEMPOTENT: re-running the scan on a queue with
  // skipped / resolved entries must NOT re-add those pairs and must NOT
  // wipe the resolution flags. Pre-fix behaviour: the scan appended
  // duplicates on every import, and any prior state on the record was
  // silently discarded.
  test('DEDUP-QUEUE-DETECT-IDEMPOTENT — re-running the scan preserves skipped/resolved flags and does not duplicate the pair', async ({ page }) => {
    await bootstrap(page);
    await seed(page, makePair());

    // Skip the pair — now the record carries skipped=true.
    const pairId = await page.evaluate(() => S.dedupQueue[0].dedupPairId);
    await page.evaluate((pid) => dedupSkip(pid), pairId);
    const before = await page.evaluate(() => ({
      len: S.dedupQueue.length,
      skipped: S.dedupQueue[0].skipped,
    }));
    expect(before.len).toBe(1);
    expect(before.skipped).toBe(true);

    // Re-run the scan — the same pair must still exist ONCE with skipped=true.
    await page.evaluate(() => scanForDedupCandidates());
    const after = await page.evaluate(() => ({
      len: S.dedupQueue.length,
      skipped: S.dedupQueue[0].skipped,
    }));
    expect(after.len).toBe(1);
    expect(after.skipped).toBe(true);

    // And once more for a resolved pair. Reset, Merge it, re-scan, prove the
    // resolved flag persists too.
    await page.evaluate(() => {
      S.clashes = [
        { ...S.clashes[0], uid: 'CLX-100' },
        { ...S.clashes[0], uid: 'CLX-101', x: 100.5 }, // ~0.5mm — under coord tier, but scan sees pairKey
      ];
      // Force distance > 1mm so the pair lands in the dedup queue (not
      // auto-merged by coord tier). Shift x by 3mm.
      S.clashes[1].x = 103;
      S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', []);
      scanForDedupCandidates();
    });
    const seededLen = await page.evaluate(() => S.dedupQueue.length);
    expect(seededLen).toBe(1);
    const pid2 = await page.evaluate(() => S.dedupQueue[0].dedupPairId);
    await page.evaluate((pid) => dedupKeepSeparate(pid), pid2);
    await page.evaluate(() => scanForDedupCandidates());
    const finalPair = await page.evaluate(() => S.dedupQueue[0]);
    expect(finalPair.resolved).toBe(true);
    expect(finalPair.resolvedAction).toBe('keep-separate');
  });

  // DEDUP-QUEUE-BADGE-FILTER: the nav-badge count must equal the number
  // of pairs the active view shows. Filter identical to view's
  // (!resolved && !skipped). Pre-fix bug: badge read raw .length.
  test('DEDUP-QUEUE-BADGE-FILTER — badge count matches active view; excludes skipped and resolved pairs', async ({ page }) => {
    await bootstrap(page);

    // Seed 3 pairs with distinct source pairs so pairKey isolates each
    // pair — scanForDedupCandidates would otherwise link every clash in
    // range across all three groups.
    await page.evaluate(() => {
      const mk = (a, x, srcA, srcB) => ({
        uid: a, name: a + ' — c', nwOrig: 'C' + a,
        testName: '[H] Badge Test',
        disciplineA: 'MEP', disciplineB: 'Structural',
        elementA: 'D-' + a, elementB: 'B-' + a,
        elementIdA: '', elementIdB: '',
        elementIdSrcA: '', elementIdSrcB: '',
        sourceA: srcA, sourceB: srcB,
        penetration: '20mm', status: 'Active', priority: 'High',
        assignedTo: '', notes: '', date: '01/07/26',
        x, y: 0, z: 0, nwImageRef: '',
        statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
      });
      S.clashes = [
        mk('CLX-010', 100, 'A1.nwc', 'B1.nwc'),
        mk('CLX-011', 103, 'A1.nwc', 'B1.nwc'),
        mk('CLX-020', 500, 'A2.nwc', 'B2.nwc'),
        mk('CLX-021', 503, 'A2.nwc', 'B2.nwc'),
        mk('CLX-030', 900, 'A3.nwc', 'B3.nwc'),
        mk('CLX-031', 903, 'A3.nwc', 'B3.nwc'),
      ];
      S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', []);
      scanForDedupCandidates();
    });

    const seededLen = await page.evaluate(() => S.dedupQueue.length);
    expect(seededLen).toBe(3);

    // Skip the second, Merge the third.
    const pids = await page.evaluate(() => S.dedupQueue.map(p => p.dedupPairId));
    await page.evaluate((pid) => dedupSkip(pid), pids[1]);
    await page.evaluate((pid) => dedupMerge(pid), pids[2]);

    // Badge should now read 1 (only the first pair is active).
    await page.evaluate(() => updSB());
    await expect(page.locator('#na-dedup-badge')).toHaveText('1');

    // Active view shows exactly 1 pair.
    await page.evaluate(() => nav('dedup'));
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(1);
    // And the header count matches.
    await expect(page.locator('text=/1 candidate pair awaiting review/')).toBeVisible();

    // Show-skipped toggle reveals the skipped pair only (resolved never
    // renders in either bucket).
    await page.locator('button', { hasText: /Show skipped \(1\)/ }).click();
    await expect(page.locator('[data-dedup-pair]')).toHaveCount(2);
  });
});
