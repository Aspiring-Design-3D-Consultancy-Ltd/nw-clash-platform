import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

// INV-010 C1 (STATUS-PROVENANCE) + C2 (STATUS-PROVENANCE-GUARD)
//
// C1 records WHO wrote each statusHistory entry: import-written entries carry
// s:'i'; human, backfilled and legacy entries carry no key at all. Absent
// means protected, which is what removes the need for any migration.
//
// C2 stops an automated writer replacing a human-written same-week entry in
// place. Before C2, a clash approved in W28 and re-imported in W28 had its
// {W28, Approved} entry rewritten to {W28, New} — the approval left no trace.
//
// SCOPE. C1 + C2 preserve the evidence; they do not restore reporting.
// clashStatusAt() keeps the LAST entry at or before the target week, so with
// {W28, Approved} followed by {W28, New} it still returns "New". Test 5
// asserts that explicitly. Correcting it is C3/C4.

const W = { week: 28, year: 2026 };            // ISO week of 2026-07-08
const NEXT = { week: 29, year: 2026 };         // ISO week of 2026-07-15
const IMPORT = 'i';

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  // INV-007 gate: let the one-shot initial-scan migration finish before wiping.
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:dataVersion', JSON.stringify(DATA_VERSION));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  });
}

// A register clash with a caller-supplied statusHistory.
function clash(status, hist) {
  return {
    uid: 'CLX-900', name: 'CLX-900', nwOrig: 'Clash1', testName: '[H] Prov',
    disciplineA: 'MEP', disciplineB: 'S',
    elementA: 'Duct-1', elementB: 'Beam-1',
    elementIdA: 'ID-A', elementIdB: 'ID-B',
    elementIdSrcA: 'Element ID', elementIdSrcB: 'Element ID',
    sourceA: 'MEP.nwc', sourceB: 'Struct.nwc',
    penetration: '20mm', status, priority: 'High',
    assignedTo: 'Coordinator', notes: 'signed off', date: '01/07/26',
    x: 1000, y: 1000, z: 1000, statusHistory: hist,
  };
}

// The same clash as it arrives from the following week's Navisworks export.
function incoming(nwStatus, weekDate) {
  return {
    nwName: 'Clash7', tn: '[H] Prov',
    eA: { id: 'ID-A', idSrc: 'Element ID', item: 'Duct-1', layer: '', source: 'MEP.nwc' },
    eB: { id: 'ID-B', idSrc: 'Element ID', item: 'Beam-1', layer: '', source: 'Struct.nwc' },
    dA: 'MEP', dB: 'S', depMm: 20, pri: 'High',
    _nwStatus: nwStatus,
    x: 1000, y: 1000, z: 1000,
    nwCreated: '08/07/26', weekDate, sourceFile: 'prov.xml',
  };
}

async function seed(page, c) {
  await page.evaluate((c) => {
    S.clashes = [c]; S.weekly = [];
    sv('clashes', S.clashes); sv('weekly', S.weekly);
  }, c);
}

// Drives the real importToRegister() append path. The function throws on a
// DOM element that only exists once the file-picker flow has rendered; that
// happens AFTER the merge loop and after sv('clashes', ...), so the write
// under test has already landed. Swallowed deliberately.
async function runImport(page, inc) {
  await page.evaluate((inc) => {
    _bcfC = [{ ...inc, mappedSt: mapNWSt(inc._nwStatus) }];
    window._skipCrossTestDupes = true;
    try { importToRegister('append'); } catch (e) { /* DOM-only, post-write */ }
  }, inc);
}

const history = (page) => page.evaluate(() => S.clashes[0].statusHistory);

test.describe('STATUS-PROVENANCE / STATUS-PROVENANCE-GUARD', () => {

  // ── 1-3: human behaviour must be bit-for-bit unchanged ──────────────────

  test('1 — human same-week status change replaces the last entry', async ({ page }) => {
    await bootstrap(page);
    await seed(page, clash('Active', [{ ...W, status: 'Active' }]));
    await page.evaluate((w) => pushStatusHistory(S.clashes[0], 'Reviewed', w), W);
    expect(await history(page)).toEqual([{ week: 28, year: 2026, status: 'Reviewed' }]);
  });

  test('2 — human same-week same-status is de-duped', async ({ page }) => {
    await bootstrap(page);
    await seed(page, clash('Active', [{ ...W, status: 'Active' }]));
    await page.evaluate((w) => pushStatusHistory(S.clashes[0], 'Active', w), W);
    expect(await history(page)).toEqual([{ week: 28, year: 2026, status: 'Active' }]);
  });

  test('3 — human cross-week change appends', async ({ page }) => {
    await bootstrap(page);
    await seed(page, clash('Active', [{ ...W, status: 'Active' }]));
    await page.evaluate((n) => pushStatusHistory(S.clashes[0], 'Reviewed', n), NEXT);
    expect(await history(page)).toEqual([
      { week: 28, year: 2026, status: 'Active' },
      { week: 29, year: 2026, status: 'Reviewed' },
    ]);
  });

  // ── 4-5: the INV-010 defect and the precise scope of its fix ────────────

  test('4 — import in the same ISO week as a human approval appends, never overwrites', async ({ page }) => {
    await bootstrap(page);
    await seed(page, clash('Approved', [
      { week: 27, year: 2026, status: 'New' },
      { ...W, status: 'Approved' },
    ]));
    await runImport(page, incoming('new', '2026-07-08'));

    const h = await history(page);
    expect(h).toHaveLength(3);
    // The human's approval is untouched — this is the whole of C2.
    expect(h[1]).toEqual({ week: 28, year: 2026, status: 'Approved' });
    expect(h[1].s).toBeUndefined();
    // The import's value is appended alongside it, marked as import-written.
    expect(h[2]).toEqual({ week: 28, year: 2026, status: 'New', s: IMPORT });
  });

  test('5 — the Approved entry survives, the New entry is appended, and clashStatusAt still returns New', async ({ page }) => {
    await bootstrap(page);
    await seed(page, clash('Approved', [{ ...W, status: 'Approved' }]));
    await runImport(page, incoming('new', '2026-07-08'));

    const state = await page.evaluate(() => ({
      hist: S.clashes[0].statusHistory,
      current: S.clashes[0].status,
      at28: clashStatusAt(S.clashes[0], 28, 2026),
      stored: JSON.parse(localStorage.getItem('nw:clashes'))[0].statusHistory,
    }));

    // The original Approved entry remains present.
    expect(state.hist[0]).toEqual({ week: 28, year: 2026, status: 'Approved' });
    // The imported New entry is appended.
    expect(state.hist[1]).toEqual({ week: 28, year: 2026, status: 'New', s: IMPORT });
    // Both survive persistence, so the overwrite is recoverable from storage.
    expect(state.stored).toEqual(state.hist);

    // clashStatusAt(week, year) still returns New.
    //
    // THIS IS INTENTIONAL AND DOCUMENTS CURRENT BEHAVIOUR. clashStatusAt()
    // keeps the LAST entry at or before the target week, so the appended
    // import entry wins the lookup. C1 + C2 preserve the evidence of the
    // approval; they do not change how it is reported. Correcting historical
    // reporting is C3/C4 scope. Asserted explicitly rather than omitted so a
    // future reader cannot infer from its absence that reporting was fixed.
    expect(state.at28).toBe('New');

    // Current status is likewise still overwritten by the import — C3 scope.
    expect(state.current).toBe('New');
  });

  // ── 6-8: provenance mechanics ───────────────────────────────────────────

  test('6 — import entries carry provenance, human entries do not', async ({ page }) => {
    await bootstrap(page);
    await seed(page, clash('Active', [{ week: 27, year: 2026, status: 'Active' }]));
    await page.evaluate((w) => pushStatusHistory(S.clashes[0], 'Reviewed', w), W);
    await runImport(page, incoming('resolved', '2026-07-15'));

    const h = await history(page);
    expect(h.map(e => e.s)).toEqual([undefined, undefined, IMPORT]);
    expect(Object.keys(h[1]).sort()).toEqual(['status', 'week', 'year']);
  });

  test('7 — an import replacing its OWN same-week entry does not grow history', async ({ page }) => {
    await bootstrap(page);
    await seed(page, clash('Active', [{ ...W, status: 'Active', s: IMPORT }]));
    await page.evaluate((w) => pushStatusHistory(S.clashes[0], 'Reviewed', w, 'i'), W);

    // Replaced in place, provenance retained — this is the C1 growth cap that
    // keeps C2 from spending INV-009 quota headroom every week.
    expect(await history(page)).toEqual([{ week: 28, year: 2026, status: 'Reviewed', s: IMPORT }]);
  });

  test('8 — automated writer, same week, same status: de-dupes rather than appending', async ({ page }) => {
    await bootstrap(page);
    // Against its own prior entry.
    await seed(page, clash('New', [{ ...W, status: 'New', s: IMPORT }]));
    await page.evaluate((w) => pushStatusHistory(S.clashes[0], 'New', w, 'i'), W);
    expect(await history(page)).toEqual([{ week: 28, year: 2026, status: 'New', s: IMPORT }]);

    // And against a human entry holding the same value — still no append,
    // because the de-dupe branch fires before the guard and destroys nothing.
    await seed(page, clash('Approved', [{ ...W, status: 'Approved' }]));
    await page.evaluate((w) => pushStatusHistory(S.clashes[0], 'Approved', w, 'i'), W);
    expect(await history(page)).toEqual([{ week: 28, year: 2026, status: 'Approved' }]);
  });

  // ── 9-10: the second automated writer, and legacy data ──────────────────

  test('9 — _xtResolveSkip stamps provenance and appends over a human entry', async ({ page }) => {
    await bootstrap(page);
    await seed(page, clash('Approved', [{ ...W, status: 'Approved' }]));
    await page.evaluate((inc) => {
      window._xtPendingMatches = [{
        exist: S.clashes[0],
        cand: { ...inc, mappedSt: mapNWSt(inc._nwStatus) },
      }];
      _bcfC = [];
      try { _xtResolveSkip('no-such-modal', 'append'); } catch (e) { /* DOM-only */ }
    }, incoming('new', '2026-07-08'));

    const h = await history(page);
    expect(h).toHaveLength(2);
    expect(h[0]).toEqual({ week: 28, year: 2026, status: 'Approved' });
    expect(h[1]).toEqual({ week: 28, year: 2026, status: 'New', s: IMPORT });
  });

  test('10 — legacy entries with no provenance are never replaced by an automated writer', async ({ page }) => {
    await bootstrap(page);
    // A pre-C1 register entry: no `s` key anywhere. Absent means protected,
    // which is why no migration is required.
    await seed(page, clash('Reviewed', [{ ...W, status: 'Reviewed' }]));
    await page.evaluate((w) => pushStatusHistory(S.clashes[0], 'New', w, 'i'), W);
    const h = await history(page);
    expect(h[0]).toEqual({ week: 28, year: 2026, status: 'Reviewed' });
    expect(h[1]).toEqual({ week: 28, year: 2026, status: 'New', s: IMPORT });
  });

  // ── 11-13: guard, chart axis, persistence ───────────────────────────────

  test('11 — the schema guard still rejects malformed entries when provenance is supplied', async ({ page }) => {
    await bootstrap(page);
    await seed(page, clash('Active', [{ ...W, status: 'Active' }]));
    const r = await page.evaluate((w) => {
      const c = S.clashes[0];
      const len = () => c.statusHistory.length;
      const before = len();
      _appendStatusHistory(c, { week: w.week, year: w.year }, 'i');            // no status
      const afterNoStatus = len();
      _appendStatusHistory(c, { status: 'New' }, 'i');                          // no week/year
      const afterNoWeek = len();
      _appendStatusHistory(c, null, 'i');                                       // not an object
      const afterNull = len();
      _appendStatusHistory(c, { week: 29, year: 2026, status: 'New' }, 'i');    // valid
      return { before, afterNoStatus, afterNoWeek, afterNull, afterValid: len(), last: c.statusHistory[len() - 1] };
    }, W);
    expect(r.afterNoStatus).toBe(r.before);
    expect(r.afterNoWeek).toBe(r.before);
    expect(r.afterNull).toBe(r.before);
    expect(r.afterValid).toBe(r.before + 1);
    expect(r.last).toEqual({ week: 29, year: 2026, status: 'New', s: IMPORT });
  });

  test('12 — the chart week axis is unaffected by the extra key and the duplicate week', async ({ page }) => {
    await bootstrap(page);
    await seed(page, clash('Approved', [
      { week: 27, year: 2026, status: 'New' },
      { ...W, status: 'Approved' },
    ]));
    const before = await page.evaluate(() => _platformWeeks().map(w => w.year + 'W' + w.week));
    await runImport(page, incoming('new', '2026-07-08'));
    const after = await page.evaluate(() => _platformWeeks().map(w => w.year + 'W' + w.week));
    // Same weeks, deduplicated — the appended same-week entry adds no axis point.
    expect(after).toEqual(before);
    expect(new Set(after).size).toBe(after.length);
  });

  test('13 — provenance survives a JSON backup and restore round-trip', async ({ page }) => {
    await bootstrap(page);
    await seed(page, clash('Approved', [{ ...W, status: 'Approved' }]));
    await runImport(page, incoming('new', '2026-07-08'));

    const r = await page.evaluate(() => {
      // Same payload shape dlJSON() writes to the backup file.
      const backup = JSON.parse(JSON.stringify({
        clashes: S.clashes, weekly: S.weekly,
        projName: S.projName, projWeek: S.projWeek,
        exported: new Date().toISOString(),
      }));
      const valid = _validateRestoreJson(backup);
      S.clashes = []; sv('clashes', S.clashes);          // wipe, then restore
      _executeJsonRestore(backup);
      return {
        valid: valid === true || (valid && valid.ok !== false),
        hist: S.clashes[0].statusHistory,
        stored: JSON.parse(localStorage.getItem('nw:clashes'))[0].statusHistory,
      };
    });

    expect(r.hist).toEqual([
      { week: 28, year: 2026, status: 'Approved' },
      { week: 28, year: 2026, status: 'New', s: IMPORT },
    ]);
    expect(r.stored).toEqual(r.hist);
  });
});
