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
});
