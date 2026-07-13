import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

async function bootstrap(page, { keepIncidentGate = false } = {}) {
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
  await page.evaluate(({ keepIncidentGate }) => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('nw:reviewQueueScopeFixed', '1');
    localStorage.setItem('nw:reviewQueueDateGuardFixed', '1');
    localStorage.setItem('nw:dedupInitialScan', '1');
    localStorage.setItem('nw:dedupRetroCleanup:v1', 'true');
    if (!keepIncidentGate) localStorage.setItem('nw:dedupIncidentLog:20260713:v1', 'true');
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
  }, { keepIncidentGate });
}

function makeClash({ uid, x = 100, weekTag, elementA = 'Duct', elementB = 'Beam', testName = '[H] Audit' }) {
  return {
    uid, name: uid, nwOrig: uid, testName,
    disciplineA: 'MEP', disciplineB: 'Structural',
    elementA, elementB,
    elementIdA: '', elementIdB: '',
    sourceA: 'GAS.nwc', sourceB: 'Struct.nwc',
    penetration: '20mm', status: 'Active', priority: 'High',
    assignedTo: '', notes: '', date: '01/07/26',
    x, y: 0, z: 0, nwImageRef: '',
    weekTag,
    statusHistory: [{ week: 27, year: 2026, status: 'Active' }],
  };
}

test.describe('DEDUP-ACTION-LOG — helper + Keep Separate + Merge hooks', () => {
  test('_appendDedupAuditEvent is defined and appends to nw:dedupActionHistory as JSON array', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(() => {
      localStorage.removeItem('nw:dedupActionHistory');
      _appendDedupAuditEvent({ type: 'test', tag: 'A' });
      _appendDedupAuditEvent({ type: 'test', tag: 'B' });
      return JSON.parse(localStorage.getItem('nw:dedupActionHistory') || '[]');
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'test', tag: 'A' });
    expect(result[1]).toEqual({ type: 'test', tag: 'B' });
  });

  test('Keep Separate handler appends an "action" event with keep-separate + full pair context', async ({ page }) => {
    await bootstrap(page);
    const evt = await page.evaluate((clashes) => {
      localStorage.removeItem('nw:dedupActionHistory');
      S.clashes = clashes;
      S.dedupQueue = [
        { dedupPairId: 'dq-1', a: 'CLX-1', b: 'CLX-2', distMm: 3, detectedAt: '2026-07-01T10:00:00.000Z', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      dedupKeepSeparate('dq-1');
      return JSON.parse(localStorage.getItem('nw:dedupActionHistory') || '[]').pop();
    }, [
      makeClash({ uid: 'CLX-1', x: 100, weekTag: 'week-260601', elementA: 'DuctX', elementB: 'BeamX' }),
      makeClash({ uid: 'CLX-2', x: 103, weekTag: 'week-260608', elementA: 'DuctX', elementB: 'BeamX' }),
    ]);
    expect(evt.type).toBe('action');
    expect(evt.action).toBe('keep-separate');
    expect(evt.pairId).toBe('dq-1');
    expect(evt.aClashId).toBe('CLX-1');
    expect(evt.bClashId).toBe('CLX-2');
    expect(evt.aWeekTag).toBe('week-260601');
    expect(evt.bWeekTag).toBe('week-260608');
    expect(evt.aElementA).toBe('DuctX');
    expect(evt.aElementB).toBe('BeamX');
    expect(evt.distMm).toBe(3);
    expect(typeof evt.resolvedAt).toBe('string');
    expect(evt.resolvedAt.length).toBeGreaterThan(10);
    expect(typeof evt.actor).toBe('string');
  });

  test('Merge handler appends an "action" event with merge + mergedIntoClashId = older uid', async ({ page }) => {
    await bootstrap(page);
    const evt = await page.evaluate((clashes) => {
      localStorage.removeItem('nw:dedupActionHistory');
      S.clashes = clashes;
      S.dedupQueue = [
        { dedupPairId: 'dq-m', a: 'CLX-100', b: 'CLX-101', distMm: 5, detectedAt: '2026-07-01T10:00:00.000Z', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      window.confirm = () => true;
      dedupMerge('dq-m');
      return JSON.parse(localStorage.getItem('nw:dedupActionHistory') || '[]').pop();
    }, [
      makeClash({ uid: 'CLX-100', x: 100, weekTag: 'week-260601' }),
      makeClash({ uid: 'CLX-101', x: 105, weekTag: 'week-260608' }),
    ]);
    expect(evt.type).toBe('action');
    expect(evt.action).toBe('merge');
    expect(evt.pairId).toBe('dq-m');
    expect(evt.mergedIntoClashId).toBe('CLX-100');
    // Merge deleted the newer clash from the register — bWeekTag reads undefined.
    // aWeekTag survives because the older clash stayed.
    expect(evt.aWeekTag).toBe('week-260601');
    expect(evt.aClashId).toBe('CLX-100');
    expect(evt.bClashId).toBe('CLX-101');
    expect(evt.distMm).toBe(5);
  });

  test('audit log is append-only across multiple actions', async ({ page }) => {
    await bootstrap(page);
    const log = await page.evaluate((clashes) => {
      localStorage.removeItem('nw:dedupActionHistory');
      S.clashes = clashes;
      S.dedupQueue = [
        { dedupPairId: 'dq-1', a: 'CLX-1', b: 'CLX-2', distMm: 3, detectedAt: 'x', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
        { dedupPairId: 'dq-2', a: 'CLX-3', b: 'CLX-4', distMm: 3, detectedAt: 'x', skipped: false, resolved: false, resolvedAction: null, resolvedAt: null },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      window.confirm = () => true;
      dedupKeepSeparate('dq-1');
      dedupMerge('dq-2');
      return JSON.parse(localStorage.getItem('nw:dedupActionHistory') || '[]');
    }, Array.from({ length: 4 }, (_, i) => makeClash({ uid: 'CLX-' + (i + 1), x: 100 + i })));
    expect(log).toHaveLength(2);
    expect(log[0].action).toBe('keep-separate');
    expect(log[1].action).toBe('merge');
  });
});

test.describe('DEDUP-GRADUATION-DETECT — PRE snapshot + POST diff', () => {
  test('actioned pair excluded by rebuilt queue triggers a "graduation" event', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate((clashes) => {
      localStorage.removeItem('nw:dedupActionHistory');
      S.clashes = clashes;
      // Actioned (skipped) pair whose clashes will disappear from the
      // register — rescan drops the pair and the graduation hook fires.
      S.dedupQueue = [
        { dedupPairId: 'dq-lost', a: 'CLX-901', b: 'CLX-902', distMm: 3, detectedAt: 'x', skipped: true, resolved: false, resolvedAction: 'keep-separate', resolvedAt: '2026-07-01T10:00:00.000Z' },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      // Remove one of the clashes from the register, then rescan.
      S.clashes = S.clashes.filter(c => c.uid !== 'CLX-902');
      sv('clashes', S.clashes);
      scanForDedupCandidates();
      return JSON.parse(localStorage.getItem('nw:dedupActionHistory') || '[]');
    }, [
      makeClash({ uid: 'CLX-901', x: 100 }),
      makeClash({ uid: 'CLX-902', x: 103 }),
    ]);
    const gradEvt = result.find(e => e.type === 'graduation');
    expect(gradEvt).toBeDefined();
    expect(gradEvt.pairId).toBe('dq-lost');
    expect(gradEvt.action).toBe('keep-separate');
    expect(gradEvt.aClashId).toBe('CLX-901');
    expect(gradEvt.bClashId).toBe('CLX-902');
    expect(gradEvt.reason).toBe('clash-deleted');
    expect(gradEvt.priorResolvedAt).toBe('2026-07-01T10:00:00.000Z');
    expect(typeof gradEvt.graduatedAt).toBe('string');
  });

  test('graduation event captures the actioned pair action verbatim (merge vs keep-separate)', async ({ page }) => {
    // Distinguishing test: the pair's prior `action` field flows through to
    // the graduation event unchanged, so the audit trail records what the
    // user originally clicked before the pair was lost.
    await bootstrap(page);
    const events = await page.evaluate((clashes) => {
      localStorage.removeItem('nw:dedupActionHistory');
      S.clashes = clashes;
      S.dedupQueue = [
        { dedupPairId: 'dq-was-merge', a: 'CLX-101', b: 'CLX-102', distMm: 3, detectedAt: 'x', skipped: false, resolved: true, resolvedAction: 'merge', resolvedAt: 'A' },
        { dedupPairId: 'dq-was-ks', a: 'CLX-103', b: 'CLX-104', distMm: 3, detectedAt: 'x', skipped: true, resolved: false, resolvedAction: 'keep-separate', resolvedAt: 'B' },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      // Drop the b-side of both pairs so both graduate via clash-deleted.
      S.clashes = S.clashes.filter(c => c.uid !== 'CLX-102' && c.uid !== 'CLX-104');
      sv('clashes', S.clashes);
      scanForDedupCandidates();
      return JSON.parse(localStorage.getItem('nw:dedupActionHistory') || '[]').filter(e => e.type === 'graduation');
    }, [
      makeClash({ uid: 'CLX-101', x: 100 }),
      makeClash({ uid: 'CLX-102', x: 103 }),
      makeClash({ uid: 'CLX-103', x: 200 }),
      makeClash({ uid: 'CLX-104', x: 203 }),
    ]);
    expect(events).toHaveLength(2);
    const wasMerge = events.find(e => e.pairId === 'dq-was-merge');
    const wasKS = events.find(e => e.pairId === 'dq-was-ks');
    expect(wasMerge.action).toBe('merge');
    expect(wasMerge.priorResolvedAt).toBe('A');
    expect(wasKS.action).toBe('keep-separate');
    expect(wasKS.priorResolvedAt).toBe('B');
    // Both graduate via the reachable path (missing clash).
    expect(wasMerge.reason).toBe('clash-deleted');
    expect(wasKS.reason).toBe('clash-deleted');
  });

  test('actioned pair that SURVIVES the rebuild does not log a graduation', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate((clashes) => {
      localStorage.removeItem('nw:dedupActionHistory');
      S.clashes = clashes;
      // Pair actioned (skipped) but survives all filters — SCOPE-GUARD
      // ok (different weekTags), SIGNATURE-FILTER ok (matching elements),
      // clashes still in register. But under DEDUP-QUEUE-DETECT-IDEMPOTENT
      // the pair should stay in the queue with its skipped flag.
      S.dedupQueue = [
        { dedupPairId: 'dq-CLX-1-CLX-2', a: 'CLX-1', b: 'CLX-2', distMm: 3, detectedAt: 'x', skipped: true, resolved: false, resolvedAction: 'keep-separate', resolvedAt: 'x' },
      ];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      scanForDedupCandidates();
      return JSON.parse(localStorage.getItem('nw:dedupActionHistory') || '[]');
    }, [
      makeClash({ uid: 'CLX-1', x: 100, weekTag: 'week-260601' }),
      makeClash({ uid: 'CLX-2', x: 103, weekTag: 'week-260608' }),
    ]);
    // No graduation event — pair still in queue post-rebuild.
    const gradEvts = result.filter(e => e.type === 'graduation');
    expect(gradEvts).toHaveLength(0);
  });
});

test.describe('DEDUP-INCIDENT-LOG-2026-07-13-v1 — one-shot data-loss record', () => {
  test('first call appends the incident event and sets the gate', async ({ page }) => {
    await bootstrap(page, { keepIncidentGate: true });
    const result = await page.evaluate(() => {
      localStorage.removeItem('nw:dedupActionHistory');
      localStorage.removeItem('nw:dedupIncidentLog:20260713:v1');
      _logDedupIncident20260713V1();
      return {
        log: JSON.parse(localStorage.getItem('nw:dedupActionHistory') || '[]'),
        gate: localStorage.getItem('nw:dedupIncidentLog:20260713:v1'),
      };
    });
    expect(result.log).toHaveLength(1);
    const evt = result.log[0];
    expect(evt.type).toBe('incident');
    expect(evt.incidentId).toBe('20260713-actioned-loss');
    expect(evt.incidentDate).toBe('2026-07-13');
    expect(evt.knownActionedCountBefore).toBe(118);
    expect(evt.knownActionedCountAfter).toBe(104);
    expect(evt.lostCount).toBe(14);
    expect(typeof evt.loggedAt).toBe('string');
    // No reconstruction — the description explicitly says the actions
    // are unrecoverable.
    expect(evt.description).toMatch(/unrecoverable/i);
    expect(result.gate).toBe('true');
  });

  test('idempotent: second call is a no-op even when the gate is set', async ({ page }) => {
    await bootstrap(page, { keepIncidentGate: true });
    const logLen = await page.evaluate(() => {
      localStorage.removeItem('nw:dedupActionHistory');
      localStorage.setItem('nw:dedupIncidentLog:20260713:v1', 'true');
      _logDedupIncident20260713V1();
      return JSON.parse(localStorage.getItem('nw:dedupActionHistory') || '[]').length;
    });
    expect(logLen).toBe(0);
  });
});

test.describe('DEDUP-AUDIT-LOG-VIEWER — read-only modal', () => {
  test('button rendered in Dedup Queue header with the correct event count', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => {
      localStorage.setItem('nw:dedupActionHistory', JSON.stringify([
        { type: 'action', action: 'merge', pairId: 'dq-A', resolvedAt: '2026-07-10T10:00:00.000Z' },
        { type: 'action', action: 'keep-separate', pairId: 'dq-B', resolvedAt: '2026-07-11T10:00:00.000Z' },
      ]));
      S.clashes = []; S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      nav('dedup');
    });
    await expect(page.locator('button', { hasText: /View action history \(2\)/ })).toBeVisible();
  });

  test('empty state renders "No dedup activity logged yet" when the log is empty', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => {
      localStorage.removeItem('nw:dedupActionHistory');
      S.clashes = []; S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      nav('dedup');
      dedupOpenAuditViewer();
    });
    await expect(page.locator('#dedup-audit-viewer')).toBeVisible();
    await expect(page.locator('#dedup-audit-viewer')).toContainText('No dedup activity logged yet');
  });

  test('viewer renders one row per event with Type / Action / Pair ID / Reason columns', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => {
      localStorage.setItem('nw:dedupActionHistory', JSON.stringify([
        { type: 'action', action: 'merge', pairId: 'dq-M', resolvedAt: '2026-07-10T10:00:00.000Z' },
        { type: 'action', action: 'keep-separate', pairId: 'dq-KS', resolvedAt: '2026-07-11T10:00:00.000Z' },
        { type: 'graduation', action: 'keep-separate', pairId: 'dq-G', reason: 'clash-deleted', graduatedAt: '2026-07-12T10:00:00.000Z' },
        { type: 'incident', incidentId: '20260713-actioned-loss', lostCount: 14, loggedAt: '2026-07-13T10:00:00.000Z' },
      ]));
      S.clashes = []; S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      nav('dedup');
      dedupOpenAuditViewer();
    });
    const viewer = page.locator('#dedup-audit-viewer');
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('4 events logged');
    // One row per event.
    await expect(viewer.locator('tr[data-audit-event-row]')).toHaveCount(4);
    // Event content surfaces.
    await expect(viewer).toContainText('dq-M');
    await expect(viewer).toContainText('dq-KS');
    await expect(viewer).toContainText('dq-G');
    await expect(viewer).toContainText('20260713-actioned-loss');
    await expect(viewer).toContainText('clash-deleted');
  });

  test('newest-first default sort', async ({ page }) => {
    await bootstrap(page);
    const orderTop = await page.evaluate(() => {
      localStorage.setItem('nw:dedupActionHistory', JSON.stringify([
        { type: 'action', action: 'merge', pairId: 'dq-OLD', resolvedAt: '2026-01-01T00:00:00.000Z' },
        { type: 'action', action: 'merge', pairId: 'dq-NEW', resolvedAt: '2026-12-31T00:00:00.000Z' },
      ]));
      S.clashes = []; S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      nav('dedup');
      dedupOpenAuditViewer();
      const rows = document.querySelectorAll('#dedup-audit-body tbody > tr');
      return rows[0]?.textContent || '';
    });
    // First row must be the newer one.
    expect(orderTop).toContain('dq-NEW');
  });

  test('Escape closes the modal', async ({ page }) => {
    await bootstrap(page);
    await page.evaluate(() => {
      localStorage.setItem('nw:dedupActionHistory', JSON.stringify([
        { type: 'action', action: 'merge', pairId: 'dq-1', resolvedAt: '2026-07-10T10:00:00.000Z' },
      ]));
      S.clashes = []; S.dedupQueue = [];
      sv('clashes', S.clashes); sv('dedupQueue', S.dedupQueue);
      nav('dedup');
      dedupOpenAuditViewer();
    });
    await expect(page.locator('#dedup-audit-viewer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#dedup-audit-viewer')).toHaveCount(0);
  });
});

test.describe('SELECTIVE-RESET-PROTECT-AUDIT-LOG — audit keys survive any reset', () => {
  test('Selective Reset does not touch nw:dedupActionHistory even when Dedup Queue is ticked', async ({ page }) => {
    await bootstrap(page);
    const result = await page.evaluate(async () => {
      // Seed the audit log.
      localStorage.setItem('nw:dedupActionHistory', JSON.stringify([
        { type: 'action', action: 'merge', pairId: 'dq-preserve', resolvedAt: '2026-07-10T10:00:00.000Z' },
      ]));
      localStorage.setItem('nw:dedupIncidentLog:20260713:v1', 'true');
      localStorage.setItem('nw:dedupQueue', JSON.stringify([
        { dedupPairId: 'dq-A', a: 'CLX-1', b: 'CLX-2', resolved: false, skipped: false },
      ]));
      // Simulate a Selective Reset with Dedup Queue ticked. Invoke the
      // reset logic in isolation — the click paths use confirm() which
      // is easier to sidestep via the reset-collector approach below.
      window.confirm = () => true;
      window.alert = () => {};
      try { Location.prototype.reload = function () {}; } catch (_) {}
      // Open the modal so _executeSelectiveReset can read the checkbox.
      selectiveReset();
      const cbDedup = document.querySelector('#selective-reset-modal input[data-cat="dedup"]');
      if (cbDedup) cbDedup.checked = true;
      const cats = _selectiveResetCategories();
      await _executeSelectiveReset(cats, 'selective-reset-modal');
      return {
        auditLog: localStorage.getItem('nw:dedupActionHistory'),
        incidentGate: localStorage.getItem('nw:dedupIncidentLog:20260713:v1'),
        dedupQueue: localStorage.getItem('nw:dedupQueue'),
      };
    });
    // Audit log preserved.
    expect(result.auditLog).not.toBeNull();
    const log = JSON.parse(result.auditLog);
    expect(log[0].pairId).toBe('dq-preserve');
    // Incident gate preserved.
    expect(result.incidentGate).toBe('true');
    // Dedup Queue was actually cleared (proves the reset ran).
    expect(result.dedupQueue).toBeNull();
  });
});
