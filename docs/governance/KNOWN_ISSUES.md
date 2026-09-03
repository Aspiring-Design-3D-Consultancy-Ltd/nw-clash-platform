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

## KI-006

Title:

IndexedDB `openIDB()` Check-Then-Act Race / Wrong-Connection `onversionchange`

Status:

Resolved

Severity:

High (confirmed to reproduce on every real page load, not just under test).

Related Investigation:

- INV-008

Summary:

`openIDB()`'s module-level `_idb` singleton had a check-then-act race: `window.onload`'s concurrent `initNwImages()`/`initPlans()` calls could both observe `_idb` as falsy and each issue their own `indexedDB.open()`, producing an orphaned second `IDBDatabase` connection. That orphan's own `onversionchange` handler closed over the shared, reassignable `_idb` variable instead of its own connection, so it never self-closed correctly when a peer requested a version change — leaving it open and blocking subsequent `deleteDatabase` calls up to the 15-second ceiling. This matched the intermittent `deleteDatabase blocked by another connection` failures previously observed (unexplained) in `selective-reset-idb-reliability.spec.js` / `wipe-verify.spec.js` under MI-002/KI-005/INV-006/INV-007.

Root Cause:

Check-then-act race on `_idb` (no in-flight-promise de-duplication) combined with an `onversionchange` closure that referenced the shared mutable `_idb` variable instead of the specific connection it was attached to.

Approved Remediation (Option A + Option B combined, per `INVESTIGATION_LOG.md`):

- Option A: `openIDB()` now caches the in-flight `indexedDB.open()` promise in a module-level `_idbOpenPromise` variable; concurrent callers before the first resolves share that single promise instead of racing separate connections. Cleared on open success, open failure, `_closeSharedIdb()`, and the `onversionchange` handler.
- Option B: the `onversionchange` handler installed in `openIDB()`'s `req.onsuccess` now captures its own connection (`db`) and closes that connection directly, only nulling the shared `_idb` if `_idb` still aliases that exact connection.

Implementation Status:

✅ Completed

QA Retest Status:

✅ PASS — `selective-reset-idb-reliability.spec.js` (21/21, including under `--repeat-each=5` → 105/105), `wipe-verify.spec.js` (4/4), full suite (286/288 — the 2 residual failures are the pre-existing, independently-reproduced-on-baseline `frozen-week-and-chart-year.spec.js` `CHART-PERIOD-YEAR-AWARE` date-boundary flakiness, unrelated to this change).

Regression Protection:

Added to `tests/selective-reset-idb-reliability.spec.js`:

- concurrent `openIDB()` callers de-duplicate into a single `indexedDB.open()` call and share one connection (Option A)
- an orphaned connection's own `onversionchange` handler closes only itself, leaving a different active `_idb` untouched (Option B)
- `openIDB()` clears the cached in-flight promise when the open request errors, allowing a fresh retry to succeed
- `_closeSharedIdb()` clears the cached in-flight promise, not just `_idb`

Outcome:

The defect has been resolved and verified. Concurrent `openIDB()` callers no longer produce orphaned connections, and any connection superseded by a later one still self-closes correctly on `onversionchange`.

The remediation has been committed, pushed, and released under INV-008 (commit `6995a0e`, merged into `main`).

---

## KI-007

Title:

ORPHAN-IDB-SWEEP Deletes the Image Database Under the In-Flight Register Migration

Status:

Resolved

Severity:

High (irreversible deletion of the user's image store, triggered automatically on launch)

Related Investigation:

- INV-009 (retrospective record)

Summary:

PR #63 (IDB-RECORDS-MIGRATION) moved `nw:clashes` and `nw:weekly` from localStorage into an IndexedDB `records` store and, in doing so, made `initAuth()`'s hydration of `S.clashes` asynchronous (`await _recInit()` inserted ahead of the assignment). `window.onload` does not await `initAuth()`, so `initNwImages()` could observe `S.clashes === []` — "not loaded yet" — while image metadata was present, treat that as the `ORPHAN-IDB-SWEEP` precondition, and call `indexedDB.deleteDatabase('NWClashImages')` while the migration was writing into that database. Observed on the live profile as `verify failed for nw:clashes` plus loss of all stored clash images. The register itself was protected by verify-then-gate and was not lost.

A second, independent hazard was found during the same recovery: on a profile at 100% of the localStorage cap the 1-byte gate write threw `QuotaExceededError`, so the migration could never complete on the profile class it exists to rescue, and the resulting throw sent `_recInit()` into fallback — which reads a now-empty localStorage.

Root Cause:

Await-ordering regression: the sweep's "register is empty" precondition (`S.clashes.length === 0`) could no longer distinguish empty from not-yet-loaded, and it guards an irreversible operation.

Approved Remediation:

- `9a0007e` (IDB-RECORDS-VERIFY-RACE, #64): a register-hydration signal raised on both `initAuth()` paths; the sweep waits up to 4 s and requires the positive signal, otherwise skips this launch and reports.
- `d996b8d` (IDB-RECORDS-GATE-QUOTA, #65): verified originals are deleted before the gate is written; the gate write is non-fatal and reported; a profile left with gate set and originals present is detected and reported, never auto-deleted.
- `43705e0` (IMG-REATTACH-ARCHIVE, #66): Data Manager recovery tool that re-attaches one week's images from its archive folder, images-only by construction.

Implementation Status:

✅ Completed

QA Retest Status:

✅ PASS — full suite 326 / 330 / 338 passed at each merge (2 pre-existing failures each time, now INV-010). Re-verified 2026-09-03, see RS-002.

Regression Protection:

Added:

- tests/idb-records-migration.spec.js (8 tests across #64 and #65, including the live-profile scenario, exactly-full quota, and crash-between-delete-and-gate recovery)
- tests/img-reattach-archive.spec.js (8 tests)

Outcome:

Resolved and released. Residual: images lost on the affected profile before `9a0007e` are recoverable only via the archive re-attach tool; superseded image records left behind by re-runs are tracked under MI-003.

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
- idbRecordsMigrated (added 2026-08-26 by IDB-RECORDS-MIGRATION; verify-then-gate, with delete-before-gate ordering per IDB-RECORDS-GATE-QUOTA — see KI-007 / INV-009)

New since 2026-08-26 — the routed write path:

`sv()` remains synchronous and boolean for callers, but writes to the two routed keys (`nw:clashes`, `nw:weekly`) now land on a debounced IndexedDB flush (400 ms, 2000 ms max latency) rather than synchronously in localStorage. The three earlier one-shot gates that relied on a throwing `localStorage.setItem` for `nw:clashes` now go through `_recWriteDurable()`, which awaits the flush and rethrows, preserving "the gate is never set on a failed write". Any code path that writes a routed key and then immediately reloads, closes, or compares storage must flush first (`_flushPendingWrites()`); INV-009 recorded three such sites (`clearAll`, `factoryReset`, selective reset) that had to be corrected in PR #63 itself.

While functioning correctly, migration behaviour remains an area of elevated regression risk due to the complexity of historical state transitions.

Potential Risks:

- Re-running migrations unexpectedly
- Migration ordering issues
- State corruption during version transitions
- Future persistence refactoring impacts

Recommended Action:

The five original one-shot migration flags were verified defect-free through INV-003, INV-005, and INV-006. The sixth (`idbRecordsMigrated`) was hardened under INV-009 and carries its own regression tests.

Treat "write a routed key, then reload or compare" as a review checklist item for any change touching `clearAll`, `factoryReset`, selective reset, import completion, or unload. Continue monitoring during future persistence-related investigations and test development.

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

## MI-003

Title:

Orphaned IndexedDB Image Records

Status:

Monitoring — audit required before any action

Description:

PR #63 (IDB-RECORDS-MIGRATION, 2026-08-26) reported the live profile's `NWClashImages.images` store holding approximately 63,178 image records against roughly 3,670 that the current register can restore. PR #66 (IMG-REATTACH-ARCHIVE) adds to this: re-running a week's re-attach replaces that week's mapping but leaves the previous run's image records in the store.

Not yet known:

- How the orphans break down by origin (superseded weekly imports, re-attach re-runs, images for clashes since deleted or merged, pre-`imgfix-v1` metadata shapes).
- Whether any orphan is referenced by an older metadata block that a restore path could still read.
- Storage cost on the live profile and whether it affects `navigator.storage.persist()` headroom.

Potential Risks:

- Store growth on every re-import cycle.
- Slower `_dhashBackfill` and any future PIXEL-DEDUP Phase 2 bulk-hash read, both of which walk every record.
- A future cleanup that deletes by the wrong key would repeat KI-007's failure mode.

Recommended Action:

Read-only audit first: count, classify, and report; wipe nothing. Cleanup, if any, is a separate change with its own investigation and tests. Escalate to Under Investigation if the audit shows records the app can still reach through any restore path.

Audit Tool (2026-09-03, `IMG-STORE-AUDIT`):

`_auditNwImageStore()` in `working.html` performs the audit without writing anything (getAllKeys, get(0), and a bounded sample of get(k) reads only). Run on the live profile from the DevTools console:

```js
await _auditNwImageStore()          // default: 200-record sample per class
await _auditNwImageStore({sample:0}) // counts only, no payload reads
```

It reports total keys, metadata shape and count, referenced vs orphaned keys against the `byTest` slot ranges, missing slots (referenced but absent), overlapping ranges, the ten largest contiguous orphan runs (where re-import churn came from), per-test present/missing, record-shape and hash coverage per class, and an estimated decoded payload size per class. Regression protection: `tests/img-store-audit.spec.js` (8 tests, including a byte-identical before/after store comparison). Record the live-profile output here when it has been run.

---

# Confirmed Issues

## KI-008

Title:

Frozen-Week Terminal Refresh Double-Counts a Clash Across Historical and Refreshed Counters

Status:

Confirmed — Deferred (DEC-010 Special Workflow State)

Severity:

Medium (reporting accuracy on the trend chart; no data loss)

Summary:

`FROZEN-WEEK-TERMINAL-REFRESH` refreshes a frozen weekly snapshot's terminal-status counters (approved / resolved) when a clash dated in that week reaches a terminal status today, while leaving the historical `new` / `active` / priority counters untouched. Documented in the code as a KNOWN EDGE CASE: a clash that was Active during the frozen week and is Approved today appears in both `frozen.active` (historical) and `frozen.approved` (refreshed), so tallying lines across the trend chart double-counts it.

Confirmation basis:

Confirmed by design analysis recorded in the marker block; not yet reproduced under Playwright. The first step of any remediation is a failing test that demonstrates the double count.

Remediation Path Identified:

A `clashStatusAt(c, wk, yr)` projection applied across every counter so each clash is counted once per week at the status it held in that week. Deferred in the original PR to keep scope contained.

Tracked as: task item 5 in the 2026-09-03 backlog (CURRENT_STATUS.md).

---

# Under Investigation

## INV-010

Title:

Persistent CHART-PERIOD-YEAR-AWARE Failures in frozen-week-and-chart-year.spec.js

Status:

Under Investigation (opened 2026-09-03, Workflow C)

Summary:

Two tests have failed on every recorded full-suite run since at least 2026-08-15 and have been classified each time as pre-existing date-boundary flakiness without being root-caused. See INVESTIGATION_LOG.md INV-010 for scope and questions.

---

# Summary

Resolved Issues:

- KI-001 — closeApp() Whitelist Drift ✅
- KI-002 — Data Resurrection After Reset ✅
- KI-003 — Migration Gate / Persistence Write Divergence (Review Queue Migrations) ✅
- KI-004 — Residual Migration Gate / Persistence Divergence (Dedup Initial Scan + Review Queue Delta Analysis Migration) ✅
- KI-005 — Test-Harness Startup-Sequencing Race (MI-002 root cause) ✅
- KI-006 — IndexedDB `openIDB()` Check-Then-Act Race / Wrong-Connection `onversionchange` (INV-008 root cause) ✅
- KI-007 — ORPHAN-IDB-SWEEP Deletes the Image Database Under the In-Flight Register Migration (INV-009, retrospective) ✅

Monitoring Items:

- MI-001 — Migration Complexity (updated 2026-09-03: `idbRecordsMigrated` gate and the routed write path added)
- MI-002 — Test Timing Sensitivity (root cause remediated under INV-007 / KI-005)
- MI-003 — Orphaned IndexedDB Image Records (audit required before any action)

Confirmed Issues:

- KI-008 — Frozen-Week Terminal Refresh Double-Count (Confirmed — Deferred)

Active Investigations:

- INV-010 — Persistent CHART-PERIOD-YEAR-AWARE Failures (Under Investigation)