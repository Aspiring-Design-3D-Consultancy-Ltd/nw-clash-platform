import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  // INV-007: wait for the terminal inline one-shot migration gate so
  // window.onload's setTimeout(1500/1600)-deferred migrations don't
  // race and silently overwrite this test's seeded state.
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    localStorage.setItem('nw:dedupInitialScan', '1');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
}

// Two coord-adjacent clashes as a seed pair. Fields tuned so that PAIR-ID
// falls through (no elementIds), coord tier misses (>1mm), and the pair
// enters the dedup detector.
function makeClash({ uid, x = 100, weekTag, elementA = 'ItemA', elementB = 'ItemB', testName = '[H] Dedup' }) {
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

test.describe('DEDUP-SCOPE-GUARD — same-weekTag pairs never queue', () => {
  test('two clashes sharing weekTag = same-import: no candidate emitted', async ({ page }) => {
    await bootstrap(page);
    const state = await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [];
      sv('clashes', S.clashes);
      const added = scanForDedupCandidates();
      return { added, queueLen: S.dedupQueue.length };
    }, [
      makeClash({ uid: 'CLX-001', x: 100, weekTag: 'week-260601' }),
      makeClash({ uid: 'CLX-002', x: 103, weekTag: 'week-260601' }),
    ]);
    expect(state.added).toBe(0);
    expect(state.queueLen).toBe(0);
  });

  test('different weekTags: pair still surfaces (candidate emitted)', async ({ page }) => {
    await bootstrap(page);
    const state = await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [];
      sv('clashes', S.clashes);
      const added = scanForDedupCandidates();
      return { added, queueLen: S.dedupQueue.length };
    }, [
      makeClash({ uid: 'CLX-001', x: 100, weekTag: 'week-260601' }),
      makeClash({ uid: 'CLX-002', x: 103, weekTag: 'week-260608' }),
    ]);
    expect(state.added).toBe(1);
    expect(state.queueLen).toBe(1);
  });

  test('weekTag missing on one side: guard is a no-op (does not skip)', async ({ page }) => {
    // Legacy clash without weekTag alongside a weekly-tagged one → the
    // guard's `a.weekTag && b.weekTag` gate short-circuits false; pair
    // still surfaces (subject to SIGNATURE-FILTER).
    await bootstrap(page);
    const state = await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [];
      sv('clashes', S.clashes);
      const added = scanForDedupCandidates();
      return { added };
    }, [
      makeClash({ uid: 'CLX-001', x: 100 }),
      makeClash({ uid: 'CLX-002', x: 103, weekTag: 'week-260601' }),
    ]);
    expect(state.added).toBe(1);
  });
});

test.describe('DEDUP-SIGNATURE-FILTER — strict elementA/elementB equality', () => {
  test('different elementA → no candidate', async ({ page }) => {
    await bootstrap(page);
    const state = await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [];
      sv('clashes', S.clashes);
      return scanForDedupCandidates();
    }, [
      makeClash({ uid: 'CLX-001', x: 100, elementA: 'Duct-1', elementB: 'Beam' }),
      makeClash({ uid: 'CLX-002', x: 103, elementA: 'Duct-2', elementB: 'Beam' }),
    ]);
    expect(state).toBe(0);
  });

  test('different elementB → no candidate', async ({ page }) => {
    await bootstrap(page);
    const state = await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [];
      sv('clashes', S.clashes);
      return scanForDedupCandidates();
    }, [
      makeClash({ uid: 'CLX-001', x: 100, elementA: 'Duct', elementB: 'Beam-1' }),
      makeClash({ uid: 'CLX-002', x: 103, elementA: 'Duct', elementB: 'Beam-2' }),
    ]);
    expect(state).toBe(0);
  });

  test('matching elementA AND elementB → candidate surfaces', async ({ page }) => {
    await bootstrap(page);
    const state = await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [];
      sv('clashes', S.clashes);
      return scanForDedupCandidates();
    }, [
      makeClash({ uid: 'CLX-001', x: 100, elementA: 'Duct', elementB: 'Beam' }),
      makeClash({ uid: 'CLX-002', x: 103, elementA: 'Duct', elementB: 'Beam' }),
    ]);
    expect(state).toBe(1);
  });

  test('em-dash suffix differs (equipment vs access zone) → no candidate — the intended tradeoff', async ({ page }) => {
    await bootstrap(page);
    const state = await page.evaluate((clashes) => {
      S.clashes = clashes;
      S.dedupQueue = [];
      sv('clashes', S.clashes);
      return scanForDedupCandidates();
    }, [
      makeClash({ uid: 'CLX-001', x: 100,
        elementA: 'AMHS-RS-F_A-30-MUR-CM.nwc — StraightDYN',
        elementB: 'Wall-A' }),
      makeClash({ uid: 'CLX-002', x: 103,
        elementA: 'AMHS-RS-F_A-30-MUR-CM.nwc — MML_Maintenance',
        elementB: 'Wall-A' }),
    ]);
    expect(state).toBe(0);
  });
});

test.describe('DEDUP-QUEUE-RETRO-CLEANUP-v1 — one-shot migration', () => {
  test('drops same-weekTag pairs + elementA-mismatch pairs; keeps the rest; sets gate', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(() => {
      // Six clashes → three candidate pairs pre-seeded into S.dedupQueue.
      // Migration should drop the same-weekTag pair and the element-mismatch
      // pair, keeping only the genuinely-clean one.
      const mk = (uid, x, weekTag, eA, eB) => ({
        uid, name: uid, nwOrig: uid, testName: '[H] Retro',
        disciplineA: 'MEP', disciplineB: 'Structural',
        elementA: eA, elementB: eB, elementIdA: '', elementIdB: '',
        sourceA: 'A.nwc', sourceB: 'B.nwc',
        penetration: '10mm', status: 'Active', priority: 'High',
        assignedTo: '', notes: '', date: '01/07/26',
        x, y: 0, z: 0, nwImageRef: '', weekTag,
        statusHistory: [],
      });
      S.clashes = [
        mk('CLX-001', 100, 'week-260601', 'Duct', 'Beam'),
        mk('CLX-002', 103, 'week-260601', 'Duct', 'Beam'), // same weekTag → drop
        mk('CLX-003', 200, 'week-260601', 'Duct-A', 'Beam'),
        mk('CLX-004', 203, 'week-260608', 'Duct-B', 'Beam'), // elementA mismatch → drop
        mk('CLX-005', 300, 'week-260601', 'Pipe', 'Column'),
        mk('CLX-006', 303, 'week-260608', 'Pipe', 'Column'), // clean → keep
      ];
      S.dedupQueue = [
        { dedupPairId: 'dq-1', a: 'CLX-001', b: 'CLX-002', distMm: 3, detectedAt: 'x', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
        { dedupPairId: 'dq-2', a: 'CLX-003', b: 'CLX-004', distMm: 3, detectedAt: 'x', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
        { dedupPairId: 'dq-3', a: 'CLX-005', b: 'CLX-006', distMm: 3, detectedAt: 'x', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      localStorage.removeItem('nw:dedupRetroCleanup:v1');
      _migrateDedupQueueV1();
      return {
        remainingIds: S.dedupQueue.map(p => p.dedupPairId),
        gate: localStorage.getItem('nw:dedupRetroCleanup:v1'),
      };
    });
    expect(result.remainingIds).toEqual(['dq-3']);
    expect(result.gate).toBe('true');
  });

  test('idempotent: second call is a no-op even if the queue would otherwise be cleaned', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(() => {
      // Gate set BEFORE the queue is populated with cleanable data.
      // Migration must not touch S.dedupQueue on this call.
      localStorage.setItem('nw:dedupRetroCleanup:v1', 'true');
      const mk = (uid, x, weekTag) => ({
        uid, name: uid, nwOrig: uid, testName: '[H] Idem',
        elementA: 'Duct', elementB: 'Beam',
        elementIdA: '', elementIdB: '',
        sourceA: 'A.nwc', sourceB: 'B.nwc',
        x, y: 0, z: 0, weekTag,
      });
      S.clashes = [
        mk('CLX-001', 100, 'week-260601'),
        mk('CLX-002', 103, 'week-260601'),
      ];
      // Would-be-dropped pair (same weekTag) already in queue.
      S.dedupQueue = [
        { dedupPairId: 'dq-1', a: 'CLX-001', b: 'CLX-002', distMm: 3, detectedAt: 'x', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      _migrateDedupQueueV1();
      return S.dedupQueue.length;
    });
    // Gate short-circuits the migration — the pair survives.
    expect(result).toBe(1);
  });

  test('empty queue on a fresh install: sets the gate and returns cleanly', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(() => {
      S.clashes = [];
      S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      localStorage.removeItem('nw:dedupRetroCleanup:v1');
      _migrateDedupQueueV1();
      return {
        gate: localStorage.getItem('nw:dedupRetroCleanup:v1'),
        queueLen: S.dedupQueue.length,
      };
    });
    expect(result.gate).toBe('true');
    expect(result.queueLen).toBe(0);
  });

  test('orphan pairs (uid missing from register) are dropped', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(() => {
      S.clashes = [
        { uid: 'CLX-001', testName: 'T', elementA: 'D', elementB: 'B', sourceA: 'A.nwc', sourceB: 'B.nwc', x: 100, y: 0, z: 0 },
      ];
      S.dedupQueue = [
        { dedupPairId: 'dq-orphan', a: 'CLX-001', b: 'CLX-999-missing', distMm: 3, detectedAt: 'x', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      localStorage.removeItem('nw:dedupRetroCleanup:v1');
      _migrateDedupQueueV1();
      return S.dedupQueue.length;
    });
    expect(result).toBe(0);
  });
});
