import { test, expect } from '@playwright/test';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const HTML = 'file://' + path.resolve(__dirname, '..', 'working.html');

/* PR-A7-AUDIT-XTEST-TOLERANCE contract:
   Two callers of findCrossTestDuplicates were passing an explicit
   tolMm:5 override, defeating PR-A5's 1mm default:
     - auditRegisterForCrossTestDuplicates (L9151) — auto-runs ~700ms
       after every batch import via XTEST-DUP-BATCH-AUDIT
     - importToRegister XTEST-DUP-IMPORT pre-loop (L9423) — same
       function PR-A5 was authored to protect
   Both stayed at 5mm; dense clashes across different testNames with
   matching source .nwc got false-flagged as cross-test dupes. The
   audit modal's "Merge and delete older" then collapsed genuinely
   distinct records; the import modal's "Skip duplicates" dropped
   legitimate incoming clashes.

   Fixture: 4 register clashes across 2 testNames, all sharing the
   same source .nwc pair (A.nwc / B.nwc). Two same-testName pairs
   sit ~50mm apart from each other (well outside the 1mm tolerance).
   Two cross-testName pairs sit 3mm apart — INSIDE the old 5mm
   window but OUTSIDE the new 1mm window.

   Post-fix expectations:
     - auditRegisterForCrossTestDuplicates() returns [] (no dupes)
     - findCrossTestDuplicates(..., {tolMm:1}) returns []
   Pre-fix (origin/main): both would return non-empty because the
   coord tier fires at 3mm ≤ 5mm across the two testNames. */

async function bootstrap(page) {
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof S !== 'undefined'
    && typeof findCrossTestDuplicates === 'function'
    && typeof auditRegisterForCrossTestDuplicates === 'function');
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nw:')).forEach(k => localStorage.removeItem(k));
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').classList.add('show');
    _ROLE = 'admin';
    // Prevent the audit modal from popping — we assert on the return value.
    window.confirm = () => false;
    window.alert = () => {};
  });
}

test.describe('PR-A7-AUDIT-XTEST-TOLERANCE — auditRegisterForCrossTestDuplicates uses 1mm, not 5mm', () => {
  test.beforeEach(async ({ page }) => { await bootstrap(page); });

  test('auditRegisterForCrossTestDuplicates() does not flag 3mm-apart cross-test clashes (was flagged at 5mm)', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Two testNames, dense clashes, all with the same source .nwc pair
      // (satisfies PR-A5's source-match guard). One side of each clash
      // has an empty elementIdB so allIdsPresent is false and the coord
      // tier is actually reached (asymmetric-identity condition — the
      // same pattern the W31 CR / MEP / SPM / CM files carried). Cross-
      // testName pairs sit 3mm apart in X — inside the old 5mm window,
      // outside the new 1mm window.
      S.clashes = [
        {uid:'CLX-0001',testName:'FAB_ARC_v_08_AMHS',elementIdA:'ARC-A-1',elementIdB:'',sourceA:'AMHS-E-F-00.nwc',sourceB:'AMHS-M-F-00.nwc',x:100,y:100,z:100,status:'Active'},
        {uid:'CLX-0002',testName:'FAB_ARC_v_08_AMHS',elementIdA:'ARC-A-2',elementIdB:'',sourceA:'AMHS-E-F-00.nwc',sourceB:'AMHS-M-F-00.nwc',x:200,y:100,z:100,status:'Active'},
        {uid:'CLX-0011',testName:'FAB_STR_v_08_AMHS',elementIdA:'STR-A-1',elementIdB:'',sourceA:'AMHS-E-F-00.nwc',sourceB:'AMHS-M-F-00.nwc',x:103,y:100,z:100,status:'Active'},
        {uid:'CLX-0012',testName:'FAB_STR_v_08_AMHS',elementIdA:'STR-A-2',elementIdB:'',sourceA:'AMHS-E-F-00.nwc',sourceB:'AMHS-M-F-00.nwc',x:203,y:100,z:100,status:'Active'},
      ];
      sv('clashes', S.clashes);
      // Stub _showAuditModal so we can capture what the audit function
      // would have shown — this is the actual bug surface. Pre-A7 with
      // the caller's tolMm:5 override, the audit function calls its
      // own findCrossTestDuplicates(S.clashes, S.clashes, {tolMm:5}) →
      // the 3mm cross-test pairs get flagged. Post-A7 with tolMm:1 the
      // pairs stay separate.
      let captured = null;
      window._showAuditModal = (pairs) => { captured = pairs; };
      auditRegisterForCrossTestDuplicates();
      return {
        modalCalled: captured !== null,
        pairCount: captured ? captured.length : 0,
      };
    });
    // Post-fix: audit returns nothing to show — no modal.
    // Pre-fix: modal shown with 4 pairs (2 same-source cross-test at 3mm each).
    expect(result.modalCalled).toBe(false);
    expect(result.pairCount).toBe(0);
  });

  test('audit still flags real coord-tier dupes (<=1mm, matching sources, different testNames)', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Coord tier only fires when at least one of the 4 identity IDs
      // is empty (allIdsPresent returns false — the strict-ID branch
      // above it takes precedence otherwise). Simulate the asymmetric-
      // identity condition that triggered W31: A-side has an ID, B-side
      // is empty. Cross-testName pairs sit 0.5mm apart with matching
      // sources → real coord-tier dupe.
      S.clashes = [
        {uid:'CLX-0001',testName:'FAB_ARC_v_08_AMHS',elementIdA:'ARC-A-1',elementIdB:'',sourceA:'AMHS-E-F-00.nwc',sourceB:'AMHS-M-F-00.nwc',x:100,y:100,z:100,status:'Active'},
        {uid:'CLX-0011',testName:'FAB_STR_v_08_AMHS',elementIdA:'STR-A-1',elementIdB:'',sourceA:'AMHS-E-F-00.nwc',sourceB:'AMHS-M-F-00.nwc',x:100.5,y:100,z:100,status:'Active'},
      ];
      sv('clashes', S.clashes);
      const raw = findCrossTestDuplicates(S.clashes||[], S.clashes||[], {tolMm:1});
      return {matchCount: raw.length};
    });
    // Real dupe at 0.5mm surfaces — tolerance change didn't disable the tier.
    expect(result.matchCount).toBeGreaterThan(0);
  });

  test('XTEST-DUP-IMPORT pre-loop gate also uses 1mm (companion caller fix)', async ({ page }) => {
    // This exercises the second stale caller at L9423. We can't easily
    // invoke importToRegister's pre-loop guard in isolation without
    // running the full merge, so instead we assert the wider CONTRACT:
    // grep-equivalent — the source code that reads S.clashes / _bcfC
    // for cross-test dupe detection uses the 1mm-default variant of
    // findCrossTestDuplicates. Reading the function source string lets
    // us prove the override was removed without depending on runtime
    // side effects.
    // Strip both // line comments and /* … */ block comments so the
    // marker-narrative text ("with an explicit tolMm:5, which…") in
    // PR-A7's comment doesn't trip the assertion. We're asserting on
    // executable JS, not commentary.
    function stripComments(js){
      return String(js||'')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
    }
    const src = stripComments(await page.evaluate(() => String(importToRegister)));
    // No `tolMm: 5` or `tolMm:5` inside importToRegister code after PR-A7.
    expect(src).not.toMatch(/tolMm\s*:\s*5\b/);
    // Similarly for the audit function.
    const auditSrc = stripComments(await page.evaluate(() => String(auditRegisterForCrossTestDuplicates)));
    expect(auditSrc).not.toMatch(/tolMm\s*:\s*5\b/);
    // Both call findCrossTestDuplicates; each site should either omit
    // the tolMm override (relying on the 1mm default) or pass tolMm:1
    // explicitly. Assert both sites now say 1 (this PR's chosen path).
    expect(src).toMatch(/tolMm\s*:\s*1\b/);
    expect(auditSrc).toMatch(/tolMm\s*:\s*1\b/);
  });
});
