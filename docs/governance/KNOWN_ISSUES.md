# Known Issues

## Purpose

Track confirmed defects, active investigations, monitoring items, and resolved issues.

This document provides a consolidated view of project risks and known problem areas.

The repository remains the authoritative source of project status.

---

# Status Definitions

## Under Investigation

Issue has been identified and is currently being investigated.

Evidence collection and verification are in progress.

## Confirmed

Issue has been verified and reproduced.

Implementation has not yet been completed.

## Monitoring

No active defect is confirmed.

Area requires ongoing observation due to complexity, historical issues, or elevated regression risk.

## Resolved

Issue has been remediated and verified.

Regression protection has been implemented where appropriate.

---

# Resolved Issues

## KI-001

Title:

closeApp() Whitelist Drift

Status:

Resolved

Severity:

High

Related Investigation:

- INV-002

Summary:

The application previously used a hardcoded `validKeys` allow-list within `closeApp()`.

Investigation confirmed that 18 actively-used persisted `nw:*` keys were absent from the allow-list and were being unintentionally deleted whenever a user performed a normal application close operation.

Affected areas included:

- Dedup Queue
- Review Queue
- Delta Analysis
- Assignee Roster
- Grid State
- Migration Flags
- Audit History

Root Cause:

The allow-list model required every persisted key to be manually maintained within `closeApp()`.

As application features evolved, persisted keys were added elsewhere in the codebase but not added to the allow-list.

The result was silent deletion of valid application state.

Approved Remediation:

The allow-list model was replaced with an explicit removal-list model (`DEFUNCT_KEYS`).

Implementation Status:

✅ Completed

QA Retest Status:

✅ PASS

Repository Steward Review:

✅ Approved With Observations

Regression Protection:

Added:

- tests/close-app-scope-fix.spec.js

Validation Results:

- close-app-scope-fix.spec.js → 3 / 3 Passed
- Combined persistence validation suite → 12 / 12 Passed

Outcome:

The defect has been resolved and verified.

Future persisted keys now survive `closeApp()` by default, eliminating the original whitelist-drift failure mode.

---

## KI-002

Title:

Data Resurrection After Reset

Status:

Resolved

Severity:

High

Related Investigation:

- R1

Summary:

`clearAll()` and `_executeSelectiveReset()` removed persisted `nw:*` localStorage keys but left corresponding in-memory `S.*` state intact.

Subsequent persistence operations could therefore write stale values back into localStorage, causing deleted data to reappear after the reset operation had completed.

Affected Areas:

- Clash Register
- Weekly Snapshots
- Dedup Queue
- Review Queue
- Levels
- Grids
- Settings
- ISO Configuration
- Admin PIN

Root Cause:

The reset workflows only removed persisted state.

In-memory state remained populated, creating divergence between application memory and localStorage.

Any subsequent persistence operation that saved `S.*` back to storage could unintentionally resurrect previously deleted data.

Approved Remediation:

Synchronize in-memory state with persisted-state deletion during reset operations.

Implementation includes:

- Factory-default `_RESET_DEFAULT_ISO`
- Memory synchronization in `clearAll()`
- Memory synchronization in `_executeSelectiveReset()`
- Category-aware selective reset handling

Implementation Status:

✅ Completed

QA Retest Status:

✅ PASS

Repository Steward Review:

✅ Approved With Observations

Release Manager Status:

✅ Conditional Approval Granted

Regression Protection:

Added:

- tests/r1-data-resurrection.spec.js

Coverage includes:

- clearAll() memory synchronization
- clearAll() resurrection prevention
- Selective reset memory synchronization
- Selective reset resurrection prevention
- Category symmetry validation

Validation Results:

- r1-data-resurrection.spec.js → 10 / 10 Passed
- Combined persistence validation suite → 22 / 22 Passed

Outcome:

The defect has been resolved and verified.

Previously cleared data can no longer be unintentionally resurrected through subsequent persistence operations.

---

## KI-003

Title:

Migration Gate / Persistence Write Divergence (Review Queue Migrations)

Status:

Resolved

Severity:

High

Related Investigation:

- INV-005

Summary:

The `REVIEW-QUEUE-MIGRATE-SCOPE-FIX` and `REVIEW-QUEUE-MIGRATE-DATE-GUARD-FIX` one-shot migrations inside `initAuth()` persisted their migrated data via `sv()`, a helper that swallows write errors internally.

If the underlying `localStorage.setItem` write failed (for example under a near-quota `QuotaExceededError` condition), the failure was silently absorbed by `sv()` and the one-shot gate flag (`nw:reviewQueueScopeFixed` / `nw:reviewQueueDateGuardFixed`) was still set unconditionally afterward. This permanently marked the migration as complete even though the underlying `nw:clashes` (and, for the date-guard migration, `nw:reviewQueueNoDateBanner`) data was never actually updated, creating a divergence between the gate and the persisted data that could not self-correct on a later load.

This is architecturally identical to the previously-remediated INV-003 (Migration Gate Persistence Divergence) defect.

Affected Areas:

- Review Queue
- initAuth() migration sequence
- One-shot migration gate flags

Root Cause:

`sv()` swallows write errors internally, so a failed persistence write did not prevent the subsequent unconditional gate-flag write, allowing gate and data to diverge permanently on write failure.

Approved Remediation:

Replaced the `sv()` calls in both migrations with direct, throwing `localStorage.setItem` calls inside the same try block as the gate-flag write, mirroring the INV-003 remediation pattern, so that a failed write prevents the gate from ever being set and the migration safely retries on the next load.

Implementation Status:

✅ Completed

QA Retest Status:

✅ PASS

Repository Steward Review:

✅ Approved With Observations

Release Manager Status:

✅ Approved

Regression Protection:

Added:

- tests/inv005-asym.spec.js

Coverage includes:

- reviewQueueScopeFixed gate/persistence asymmetric-failure path
- reviewQueueScopeFixed gate/persistence success path
- reviewQueueDateGuardFixed gate/persistence asymmetric-failure path
- reviewQueueDateGuardFixed gate/persistence success path

Validation Results:

- inv005-asym.spec.js → 4 / 4 Passed
- Combined persistence validation suite → 26 / 26 Passed

Outcome:

The defect has been resolved and verified.

Both review-queue one-shot migrations now safely retry on the next load instead of permanently diverging when a persistence write fails.

---

## KI-004

Title:

Residual Migration Gate / Persistence Divergence (Dedup Initial Scan + Review Queue Delta Analysis Migration)

Status:

Resolved

Severity:

High (`dedupInitialScan`) / Medium (`reviewQueueDeltaAnalysisMigrated`)

Related Investigation:

- INV-006

Summary:

`dedupInitialScan` (`DEDUP-QUEUE-DETECT` one-shot wrapper calling `scanForDedupCandidates()`) and `reviewQueueDeltaAnalysisMigrated` (`_rqdaMigrate()` calling `_rqdaReclassifyAll()`) both persist their underlying data via `sv()`, which swallows write errors internally, before unconditionally setting their respective one-shot gate flags. A failed underlying write leaves storage unchanged while the gate is still permanently set, diverging the gate from the data — the same failure mode previously remediated under INV-003 and INV-005.

Root Cause:

Identical to KI-003: `sv()` swallows write errors internally, so a failed persistence write does not prevent the subsequent unconditional gate-flag write.

Architectural Note:

Unlike INV-003/INV-005, the underlying persistence calls in both locations live inside shared functions (`scanForDedupCandidates()`, `_rqdaReclassifyAll()`) that are also called from several non-gate contexts. Remediation therefore used Option C: a dedicated, throwing persistence step scoped only to the two one-shot gate wrappers, leaving `sv()`, `scanForDedupCandidates()`, and `_rqdaReclassifyAll()` (and all their other call sites) untouched.

Approved Remediation:

Added a direct, throwing `localStorage.setItem` write of the wrapper's own result (`nw:dedupQueue` / `nw:clashes`) inside the same try block as each gate write, so a failed write prevents the gate from ever being set. The `reviewQueueDeltaAnalysisMigrated` write is additionally guarded by `if(n>0)` to preserve `_rqdaReclassifyAll()`'s own conditional-write semantics exactly.

Implementation Status:

✅ Completed

QA Retest Status:

✅ PASS

Repository Steward Review:

✅ Approved With Observations

Release Manager Status:

✅ Approved

Regression Protection:

Added:

- tests/inv006-asym.spec.js

Coverage includes:

- dedupInitialScan gate/persistence asymmetric-failure path
- dedupInitialScan gate/persistence success path
- reviewQueueDeltaAnalysisMigrated gate/persistence asymmetric-failure path
- reviewQueueDeltaAnalysisMigrated gate/persistence success path

Validation Results:

- inv006-asym.spec.js → 4 / 4 Passed
- Combined targeted validation (inv006-asym, inv003-asym, inv005-asym, dedup-scope-and-signature, dedup-audit-log, review-queue-bulk-delta-approve-source, review-queue-date-guard-fix, review-queue-scope, weekly-incremental-import) → 69 / 69 Passed

Outcome:

The defect has been resolved and verified.

Both `dedupInitialScan` and `reviewQueueDeltaAnalysisMigrated` now safely retry on the next load instead of permanently diverging when a persistence write fails.

The remediation has been committed, pushed, and released under INV-006.

---

# Monitoring

## MI-001

Title:

Migration Complexity

Status:

Monitoring

Description:

Several one-time migration flags remain part of the application's persistence model.

Examples include:

- reviewQueueScopeFixed (verified defect-free — remediated under INV-005)
- reviewQueueDateGuardFixed (verified defect-free — remediated under INV-005)
- dedupInitialScan (verified defect-free — INV-006)
- reviewQueueDeltaAnalysisMigrated (verified defect-free — INV-006)
- dedupRetroCleanup:v1 (verified defect-free — remediated under INV-003)

While functioning correctly, migration behaviour remains an area of elevated regression risk due to the complexity of historical state transitions.

Potential Risks:

- Re-running migrations unexpectedly
- Migration ordering issues
- State corruption during version transitions
- Future persistence refactoring impacts

Recommended Action:

All five tracked one-shot migration flags have been investigated and verified defect-free through INV-003, INV-005, and INV-006.

Continue monitoring during future persistence-related investigations and test development.

---

## MI-002

Title:

Test Timing Sensitivity

Status:

Remediated — test-harness synchronization fix implemented and QA-verified under INV-007 (see KI-005).

Description:

Certain Playwright tests continue to exhibit timing-related behaviour associated with:

- Delayed startup tasks
- Migration execution timers
- IndexedDB initialization
- Persistence synchronization
- Asynchronous UI initialization

Root Cause (confirmed under INV-007):

Test bootstrap helpers across ~30+ spec files wait only for the earliest observable application-ready signal (`S.clashes` + `S.projName` populated), not for `working.html`'s full `window.onload` initialization chain to complete. Several further one-shot migrations run inline inside `initAuth()` (past that early signal) or are deferred via `setTimeout(1500/1600)` from `window.onload`, and fire within the typical runtime of a test body — racing and silently overwriting test-seeded `S.clashes`/`S.dedupQueue` state and, in some cases, colliding with test-owned IndexedDB connections. This is a test-harness synchronization gap, not an application defect — confirmed via Architect review under INV-007.

Potential Risks:

- Test flakiness
- Intermittent failures
- False-positive regression reports
- Genuine regressions masked by "known flaky" pattern-matching

Recommended Action:

Implemented. Human authorization was granted to proceed with the INV-007 remediation; the validated synchronization fix (`await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');` inserted into each affected bootstrap helper, immediately after the existing early-signal wait) has been applied across all 28 affected `tests/*.spec.js` files sharing the shared bootstrap idiom. QA Retest confirms the fix eliminates the previously-intermittent failures (see KI-005 Validation Results). Remediation was test-file-only; no `working.html` changes were made.

---

# Confirmed Issues

None currently recorded.

---

# Under Investigation

None currently recorded.

---

# Summary

Resolved Issues:

- KI-001 — closeApp() Whitelist Drift ✅
- KI-002 — Data Resurrection After Reset ✅
- KI-003 — Migration Gate / Persistence Write Divergence (Review Queue Migrations) ✅
- KI-004 — Residual Migration Gate / Persistence Divergence (Dedup Initial Scan + Review Queue Delta Analysis Migration) ✅
- KI-005 — Test-Harness Startup-Sequencing Race (MI-002 root cause) ✅

Monitoring Items:

- MI-001 — Migration Complexity
- MI-002 — Test Timing Sensitivity (root cause remediated under INV-007 / KI-005)

Confirmed Issues:

- IndexedDB `openIDB()` check-then-act race producing orphaned connections that block `deleteDatabase` (see INV-008 in `INVESTIGATION_LOG.md`) — root cause confirmed, remediation not yet authorized/implemented.

Active Investigations:

- INV-008 — IndexedDB Reset Reliability Investigation (Open — Root Cause Confirmed, stopped at Implementation Required decision gate).