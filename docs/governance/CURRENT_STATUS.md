# Current Status

## Governance Framework

Status:

Validated

Validated Roles:

- Repository Steward ✅
- Environment Steward ✅
- Project Analyst ✅
- Architect ✅
- QA Investigator ✅
- Developer ✅
- Implementation Manager ✅
- Release Manager ✅

Governance Framework Version:

v1

Notes:

The governance framework has been validated through execution of real-world investigation and remediation workflows using INV-002 (closeApp() Whitelist Drift) and R1 (Data Resurrection After Reset).

---

## Repository Status

Current Branch:

`claude/governance-review-xjrgfm` (23 commits ahead of `main`; not merged)

Repository Health:

- Repository healthy
- Governance framework committed and pushed
- Project memory established in repository
- INV-002, R1, INV-005, INV-006, INV-007, and INV-008 remediations committed and pushed to `main`
- INV-009 (High) confirmed and unremediated
- INV-010 (Critical) partially remediated: C1 + C2 implemented, QA-verified and Steward-approved (`59a9770`); C3 and C4 outstanding

Known Governance Gaps:

- Stage-order divergence: WORKFLOW_ROUTING.md specifies Architect (stage 2) before QA Investigator (stage 3). INV-009 and INV-010 both executed QA before Architect, because the Architect Review depended on runtime evidence the QA stage produced. Twice is practice, not accident. Recorded, not resolved — amending the sanctioned workflow is a decision-level change and cannot be made by a workflow stage.
- DEC-014 (Clash Status Ownership Model) is recommended by the INV-010 Architect Review and not yet raised. It is required before INV-010 C3, not before C1 + C2.

Current Working Tree:

INV-002 (680cfd5), R1 (a0526bf), INV-005 (3f37f72), INV-006 (136c397), INV-007 (b471e5c), and INV-008 (6995a0e, merging ec6af50/326a93d/f444cfa) remediations are committed and pushed to `main`.

Work on `claude/governance-review-xjrgfm` not yet merged to `main`: the prompt library and DEC-013, the configurable Dedup Queue proximity threshold (b19a676), the INV-010 C1 + C2 remediation (59a9770), and governance records for INV-009 and INV-010. Merge to `main` is a separate DEC-009 decision gate.

Release-scope note: `main` is the deployment source, so a merge releases the dedup tolerance enhancement alongside the INV-010 remediation. Whether to release them together or isolate INV-010 is a Release Manager decision.

---

## Active Investigation Status

### INV-002

Title:

closeApp() Whitelist Drift

Status:

Closed - Released

Summary:

The application previously used a hardcoded validKeys allow-list during closeApp() processing.

Investigation confirmed that 18 actively-used persisted keys were missing from that allow-list and were being deleted during normal application closure.

The approved remediation replaced the allow-list model with an explicit removal-list model that preserves active persisted keys by default while removing only confirmed legacy/orphaned keys.

Implementation Status:

✅ Completed

QA Retest:

✅ Passed

Repository Steward Review:

✅ Approved With Observations

Release Approval:

✅ Approved

Regression Protection:

✅ Added

Files Affected:

- working.html
- tests/close-app-scope-fix.spec.js

Release Commit:

680cfd5146272473b1887ed0cf96d984731164f9 — Committed and pushed.

---

### R1

Title:

Data Resurrection After Reset

Status:

Closed - Released

Summary:

`clearAll()` and `_executeSelectiveReset()` previously removed persisted `nw:*` keys from localStorage without updating the corresponding in-memory `S.*` fields.

Investigation confirmed that subsequent code paths that re-persisted `S.*` state could write stale data back into storage, causing previously cleared data to reappear.

The approved remediation synchronizes in-memory state with persisted-state removal during both `clearAll()` and `_executeSelectiveReset()`, ensuring deleted data cannot be resurrected by later persistence operations.

Implementation Status:

✅ Completed

QA Retest:

✅ Passed

Repository Steward Review:

✅ Approved With Observations

Release Approval:

✅ Approved (DEC-007 documentation-commit condition satisfied)

Regression Protection:

✅ Added

Files Affected:

- working.html
- tests/r1-data-resurrection.spec.js

Release Commit:

a0526bfaaf47d0256219f9727279ef190c321925 — Committed and pushed.

---

### INV-005

Title:

Migration Gate / Persistence Write Divergence Remediation

Status:

Closed - Released

Summary:

The `REVIEW-QUEUE-MIGRATE-SCOPE-FIX` and `REVIEW-QUEUE-MIGRATE-DATE-GUARD-FIX` one-shot migrations inside `initAuth()` previously persisted migrated data via `sv()`, which swallows write errors internally. A failed persistence write could therefore leave storage unchanged while the one-shot gate flag was still set unconditionally, permanently and silently diverging the gate from the underlying data — the same failure mode previously remediated under INV-003.

The approved remediation replaced the `sv()` calls with direct, throwing `localStorage.setItem` calls inside the same try block as the gate write, mirroring the INV-003 pattern, so a failed write prevents the gate from ever being set and the migration safely retries on the next load.

Implementation Status:

✅ Completed

QA Retest:

✅ Passed

Repository Steward Review:

✅ Approved With Observations

Release Approval:

✅ Approved

Regression Protection:

✅ Added

Files Affected:

- working.html
- tests/inv005-asym.spec.js

Release Commit:

3f37f724891f42de14571cd198a0fd9c195cbbad — Committed and pushed.

---

### INV-006

Title:

Residual Migration Gate / Persistence Divergence Risk Assessment

Status:

Closed - Released

Summary:

Opened from MI-001 to determine whether `dedupInitialScan` and `reviewQueueDeltaAnalysisMigrated` — the two remaining one-shot migration flags not yet individually verified — contain the same gate/persistence-write divergence defect remediated under INV-003 and INV-005.

Findings:

Both locations were confirmed to contain the identical defect class. `dedupInitialScan`'s wrapper and `reviewQueueDeltaAnalysisMigrated`'s `_rqdaMigrate()` both persist underlying data via `sv()` (which swallows write errors) before unconditionally setting their one-shot gate flags. Unlike INV-003/INV-005, the vulnerable writes live inside shared functions (`scanForDedupCandidates()`, `_rqdaReclassifyAll()`) also used in non-gate contexts, so remediation required a scope-safe approach rather than a literal copy of the INV-003/INV-005 pattern.

Human Decision:

Option C selected — dedicated, throwing persistence step scoped only to the two one-shot wrapper functions, leaving shared helpers (`sv()`, `scanForDedupCandidates()`, `_rqdaReclassifyAll()`) untouched.

The approved remediation added a direct, throwing `localStorage.setItem` write of the wrapper's own result (`nw:dedupQueue` / `nw:clashes`) inside the same try block as each gate write, so a failed write prevents the gate from ever being set and each one-shot operation safely retries on the next load.

Tracked as:

KI-004 (Known Issues)

Implementation Status:

✅ Completed

QA Retest:

✅ Passed (4/4 new; 69/69 combined targeted validation)

Repository Steward Review:

✅ Approved With Observations

Release Manager Review:

✅ Approved

Regression Protection:

✅ Added

Files Affected:

- working.html
- tests/inv006-asym.spec.js (new)

Release Commit:

136c397 — Fix INV-006 migration gate persistence divergence

Status:

Committed and pushed.

---

### INV-007

Title:

MI-002 Test Timing Sensitivity Assessment

Status:

Closed - Released

Summary:

Opened from MI-002 to determine the root cause of recurring, pre-existing intermittent Playwright test failures (`approve-action-*`, `dedup-queue.spec.js`, `img-count-check.spec.js`, `selective-reset-idb-reliability.spec.js`, and others) and whether remediation is required.

Findings:

Confirmed a test-harness synchronization gap, not an application defect. Test bootstrap helpers wait only for `working.html`'s earliest observable ready signal (`S.clashes` + `S.projName`), not for the full `window.onload` initialization chain (inline `initAuth()` migrations plus three further `setTimeout(1500/1600)`-deferred migrations). Deferred migrations fire within a typical test body's runtime and race/overwrite test-seeded state, producing the intermittent failures.

Empirically validated fix (adding a single explicit wait on the terminal migration gate) eliminated the flakiness across 44/44 test executions on two independent spec files during pre-implementation validation, with zero application-code changes required. Implementation has since been completed across all 28 affected spec files and re-verified via full-suite QA Retest.

Tracked as:

KI-005 (Known Issues)

Implementation Status:

✅ Implemented — `await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');` added immediately after the existing early-signal wait in every affected bootstrap helper across 28 `tests/*.spec.js` files. Two bootstraps (`batch-import-folder.spec.js`, `weekly-incremental-import.spec.js`) plus `weekly-summary-screenshot.spec.js` also received a small additional in-memory `S.clashes = []` / `S.weekly = []` reset (mirroring the existing `img-count-check.spec.js` pattern) — the deterministic wait exposed that these bootstraps had been relying on lucky race timing to observe an empty register before the demo dataset finished seeding.

QA Investigation / Architect Review:

✅ Completed — root cause confirmed, remediation approach approved (test-file-only).

QA Retest:

✅ Completed — full-suite run (`--workers=1`): 278/284 passed. The remaining 6 failures (`frozen-week-and-chart-year.spec.js` ×2, `selective-reset-idb-reliability.spec.js` ×3, `wipe-verify.spec.js` ×1) were confirmed via `git stash` baseline comparison to be pre-existing, unrelated IndexedDB/chart-range timing flakiness present on the unmodified codebase too — out of scope for this remediation. Baseline (unmodified) comparison run showed 21 pre-existing intermittent failures; post-fix only the 6 confirmed-unrelated ones remain.

Files Affected:

- 28 files under `tests/*.spec.js` sharing the affected bootstrap idiom (enumerated and modified; see KI-005 for the full list of the three files requiring the additional in-memory reset)

Release Commit:

b471e5c — Fix INV-007 test timing sensitivity

Status:

Committed and pushed.

---

## Known Issues

### Confirmed

None currently outstanding.

### Monitoring

#### MI-001

Migration Complexity

Status:

Monitoring

Description:

Multiple one-time migration flags remain a long-term regression risk area:

- reviewQueueScopeFixed (verified defect-free — INV-005)
- reviewQueueDateGuardFixed (verified defect-free — INV-005)
- dedupInitialScan (verified defect-free — INV-006)
- reviewQueueDeltaAnalysisMigrated (verified defect-free — INV-006)
- dedupRetroCleanup:v1 (verified defect-free — INV-003)

Continue monitoring for future migration-related regressions.

---

#### MI-002

Test Timing Sensitivity

Status:

Resolved under INV-007 / KI-005.

Description:

Certain Playwright suites continue to exhibit timing-related behaviour.

Areas include:

- Delayed startup tasks
- Migration execution timers
- IndexedDB initialization
- Persistence synchronization

INV-007 confirmed the root cause: test bootstrap helpers race `working.html`'s deferred one-shot migrations (inline `initAuth()` continuation plus `setTimeout(1500/1600)` migrations from `window.onload`). This is a test-harness synchronization gap, not an application defect. The validated, test-file-only fix has now been implemented across all 28 affected spec files, and full-suite QA Retest confirms 278/284 passing with the remaining 6 failures confirmed pre-existing and unrelated (see the INV-007 investigation entry above for full QA Retest detail).

---

## Testing Status

Framework:

Playwright

Recent Validation:

### INV-002 Regression Coverage

Test:

- tests/close-app-scope-fix.spec.js

Results:

- close-app-scope-fix.spec.js → 3/3 Passed
- Combined persistence validation suite → 12/12 Passed

Outcome:

PASS

---

### R1 Regression Coverage

Test:

- tests/r1-data-resurrection.spec.js

Coverage:

- clearAll() in-memory synchronization
- clearAll() resurrection-vector prevention
- Selective reset memory synchronization
- Selective reset resurrection-vector prevention
- Category symmetry validation

Results:

- r1-data-resurrection.spec.js → 10/10 Passed
- Combined persistence validation suite → 22/22 Passed

Outcome:

PASS

---

### INV-005 Regression Coverage

Test:

- tests/inv005-asym.spec.js

Coverage:

- reviewQueueScopeFixed gate/persistence asymmetric-failure path
- reviewQueueScopeFixed gate/persistence success path
- reviewQueueDateGuardFixed gate/persistence asymmetric-failure path
- reviewQueueDateGuardFixed gate/persistence success path

Results:

- inv005-asym.spec.js → 4/4 Passed
- Combined persistence validation suite → 26/26 Passed

Outcome:

PASS

---

### INV-006 Regression Coverage

Test:

- tests/inv006-asym.spec.js

Coverage:

- dedupInitialScan gate/persistence asymmetric-failure path
- dedupInitialScan gate/persistence success path
- reviewQueueDeltaAnalysisMigrated gate/persistence asymmetric-failure path
- reviewQueueDeltaAnalysisMigrated gate/persistence success path

Results:

- inv006-asym.spec.js → 4/4 Passed
- Combined targeted validation suite (inv006-asym, inv003-asym, inv005-asym, dedup-scope-and-signature, dedup-audit-log, review-queue-bulk-delta-approve-source, review-queue-date-guard-fix, review-queue-scope, weekly-incremental-import) → 69/69 Passed

Outcome:

PASS

Note: a full repository-wide suite run surfaced 22 pre-existing intermittent failures unrelated to this change (`approve-action-*`, `img-count-check`, `selective-reset-idb-reliability`, `frozen-week-and-chart-year`, etc.). These were independently reproduced on the unmodified pre-INV-006 baseline via `git stash`, confirming pre-existing MI-002 (Test Timing Sensitivity) flakiness rather than a regression from this change.

---

## Current Priority

Two confirmed defects remain open. Both produce the same user-facing
symptom — clash statuses reverting to older values — by independent
mechanisms, and a user cannot distinguish them.

INV-010 C1 + C2 shipped first, as recommended, and is awaiting Release
Manager Review. INV-009 Option A + C follows: both touch `statusHistory`,
and authoring INV-009's migration once, knowing the provenance key already
exists, avoids two passes over the same array (the MI-001 pattern).

INV-010 remains only partially remediated. C1 + C2 stop the destruction of
historical evidence; imports still reset current clash status. C3 and C4
are not assessed and C3 requires DEC-014 first.

### INV-010 (Steward Approved — Critical)

Title:

Import Overwrites Reviewed Clash Status

Status:

Steward Approved (DEC-010 State 7). Opened 2026-08-18 from the Project
Analyst Review "Status Persistence Failure and Save Capability
Assessment"; reproduced, remediated (C1 + C2), QA-verified and
Steward-approved the same day.

**Partially remediated.** States 4 through 7 cover C1 + C2 only. C3 and C4
are not implemented and not assessed.

Workflow:

Workflow B (Application Defect).

Summary:

Every append-mode import overwrites `status` on every matched clash with
the Navisworks-mapped value, unconditionally. Where the import lands in the
same ISO week as the review activity — the normal case, since the import
week derives from the batch date — `pushStatusHistory()` rewrote the
history entry in place, so the approval disappeared from current status,
from history, and from `clashStatusAt()`.

QA Investigation Result:

Reproduced. 28 of 35 register-status x XML-status combinations overwrite
the register; deterministic across three runs. Full probe evidence in
INVESTIGATION_LOG.md (INV-010).

Architect Result:

Option C (conditional ownership, keyed on provenance rather than status
value), routed through the existing Review Queue. Decomposed C1-C4;
C1 + C2 approved for Developer Assessment.

Developer Assessment Result:

GO on C1 + C2 implemented together — no migration, no `DATA_VERSION`
change, no reader affected.

Implementation Manager Result:

CONDITIONAL GO, five conditions. `_xtResolveSkip()` classified AUTOMATED;
provenance architecture APPROVED with Architect Constraint 3 confirmed as
refined; order INV-010 C1 + C2 before INV-009 Option C. The review found
and corrected one error in the Developer Assessment — see the scope note
below.

Implementation Result:

Complete. Commit `59a9770`. `STATUS-PROVENANCE` (4/4) and
`STATUS-PROVENANCE-GUARD` (1/1); 196 markers, 0 imbalanced; `DATA_VERSION`
unchanged; **no migration** — zero existing `statusHistory` entries read,
rewritten or deleted. Five diff hunks confined to four functions. One
addition not covered by the Developer Assessment or Implementation Manager
Review — the de-dupe branch clearing the import marker when a human
re-affirms an import-written value — is recorded as such in
INVESTIGATION_LOG.md and was independently verified at retest.

QA Retest Result:

**RETEST PASSED.** All 8 required cases pass plus one additional,
exercised through the real `importToRegister()` and `uf()` paths rather
than the helpers the implementation spec drives. Historical evidence
preservation verified; current-status overwrite behaviour verified
unchanged as a positive expectation. Targeted import and status workflows
107/107. Full suite 311 passed / 2 failed against a 298/2 baseline, the
two failures being the pre-existing `CHART-PERIOD-YEAR-AWARE` cases
independently confirmed on the unmodified base.

Repository Steward Result:

**APPROVED.** Scope containment PASS — five hunks, four functions, no
creep: the three C3 current-status writes, `mappedSt`, `pendingReview`,
`DATA_VERSION`, `sv()` / `lv()` and `openIDB()` are all untouched. Marker
compliance confirmed. Two governance findings recorded: the un-reviewed
provenance-clearing addition (accepted, now recorded) and bundled release
scope (see Next Action).

Next Action:

**Release Manager Review**, then the DEC-009 `Commit / Push Required`
decision gate (a human decision gate). Two items for that review:

1. **Bundled release scope.** Merging this branch to `main` — the
   deployment source — also releases the configurable Dedup Queue
   proximity threshold (`b19a676`), an independent enhancement with no
   investigation. Release together, or isolate INV-010.
2. **Release-note accuracy.** See the scope note below.

Severity:

Critical (confirmed). First use of the `Critical` tier defined in
WORKFLOW_TEMPLATES.md.

Standing Exposure:

**Reduced, not removed.** Historical evidence loss is remediated: a
reviewed status overwritten by an import is now preserved in
`statusHistory` and recoverable. Imports still reset current status, and
the preserved entry is not surfaced anywhere in the UI. Until C3 ships the
interim mitigation remains a JSON backup before each weekly import, using
the existing `JSON-BACKUP-RESTORE` capability.

Note on scope (corrected 2026-08-18 by the Implementation Manager Review,
confirmed by QA Retest):

C1 + C2 **preserve historical evidence but do not change current
historical reporting behaviour.** Verified twice — once at review, once
against the shipped implementation:

- Approved entries survive in `statusHistory`, so automated overwrites
  become recoverable rather than destroyed.
- `clashStatusAt()` still returns the latest same-week value — `New`, not
  `Approved`.
- There is no user-facing render of the full `statusHistory` array
  anywhere in `working.html`, so the preserved entry is not surfaced.
- Charts, PPTX / PDF / CSV reporting, the current-status overwrite, the
  `Approved` to `New` reset, and status ownership conflicts all remain
  C3 / C4 scope.

A reader who takes "INV-010 remediation shipped" to mean "imports no
longer reset reviewed status" will be wrong.

---

### INV-009 (Confirmed)

Title:

Silent Persistence Write Failure

Status:

Confirmed (DEC-010 State 3). Opened 2026-08-17 from the "Session
Persistence and Crash Recovery" Enhancement Assessment; root cause
validated by runtime reproduction the same day.

Workflow:

Workflow A (Persistence Defect).

Summary:

`sv()` (working.html line 968) discards every write failure via a trailing
`catch(e){}`. Quota, serialisation and storage errors are all swallowed:
the UI updates, the user believes the change persisted, and nothing reached
storage. This is the defect class remediated under INV-003, INV-005 and
INV-006, but only at three one-shot migration gate sites; ordinary user
edits still route through the swallowing helper.

Static analysis measured two amplifying factors: whole-register writes at
42 `sv('clashes')` call sites, and an unbounded `statusHistory` with no cap
or trim anywhere in the file. A 2,253-clash register (the production size
recorded in the PR-0-RESOLVE-STAMP comment) serialises to 1.59 MB at two
history entries per clash and 4.64 MB at twelve, against a typical ~5 MB
Chrome/Edge localStorage quota.

QA Investigation Result:

Reproduced. Through the real mutation path, a failed write left the UI
showing "Resolved" while storage retained "New", with no exception, no
return value and no user-visible signal. Measured ceiling: at the
production register size of 2,253 clashes, `localStorage` is exhausted at
14 status-history entries per clash (4.98 MB) with no new imports at all.
Every status change and every Review Queue action appends one entry, and
`statusHistory` has no cap anywhere in the file. Full probe evidence in
INVESTIGATION_LOG.md (INV-009).

Architect Result:

Preferred architecture Option A (surface write failure) + Option C
(separate audit metadata from chart data). Option B (cap/trim
`statusHistory`) rejected — it would remove weeks from the chart axis via
the `_platformWeeks()` dependency.

Developer Assessment Result:

GO on Option A. GO on Option C with a scope correction: proceed without a
migration, and budget for four spec rewrites. All eight `statusHistory`
audit fields are write-only in the application but asserted by four spec
files. The Approve entry measures 288 bytes, not the 147 the Architect
Review assumed — an approval-heavy register reaches the quota ceiling
roughly twice as fast as the headroom table predicts.

Next Action:

Implementation Manager review, then the DEC-009 `Implementation Required`
decision gate (a human decision gate). Sequenced after INV-010 C1 + C2.
DEC-011 applies: monitoring is not an acceptable primary recommendation.

Severity:

High (confirmed).

---

All confirmed defects identified through INV-002, R1, INV-005, INV-006, INV-007, and INV-008 have been remediated, verified, committed, pushed, and released.

---

### INV-008 (Closed - Released)

Title:

IndexedDB Reset Reliability Investigation

Status:

Released / Closed. Human authorization was granted to proceed to Developer Assessment and Developer Implementation for the combined Option A + Option B remediation. QA Retest passed (see "INV-008 Regression Coverage" below). Repository Steward Review and Release Manager Review both approved. Human authorization to commit and push was subsequently granted; the remediation branch (`repo-hygiene-remove-zz-repro`, commits `f444cfa`/`326a93d`/`ec6af50`) was merged into `main` via `6995a0e` and pushed to `origin/main` (fast-forward-verified, no conflicts). Full-suite QA Retest re-run post-merge on `main`: 286/288 Passed, identical residual failures to the pre-merge QA Retest (see "Final Release Verification" below). Investigation closed.

Summary:

Opened following completion of INV-002/R1/INV-005/INV-006/INV-007 and the Repository Hygiene review, to root-cause the residual `selective-reset-idb-reliability.spec.js` / `wipe-verify.spec.js` "deleteDatabase blocked by another connection" failures left unexplained under MI-002/KI-005. Confirmed two independent findings: (1) the reported `test.describe()` error is an environment/invocation issue (two `@playwright/test` module instances loaded when Playwright is run from the repository root instead of `tests/`) — no code defect; (2) a real, confirmed application defect in `openIDB()`'s connection-singleton management in `working.html` — a check-then-act race on the module-level `_idb` variable (triggered every page load by `window.onload`'s concurrent `initNwImages()`/`initPlans()` calls) that can create an orphaned, unreferenced `IDBDatabase` connection, compounded by an `onversionchange` handler that closes over the shared `_idb` variable instead of its own connection and therefore fails to close the orphan when a peer requests a version change. Full findings, evidence, and remediation options in `INVESTIGATION_LOG.md` (INV-008).

Implemented Remediation:

- Option A: `openIDB()` now caches the in-flight `indexedDB.open()` promise in a new module-level `_idbOpenPromise` variable. Concurrent callers arriving before the first `openIDB()` call resolves now share that single in-flight promise instead of each issuing their own `indexedDB.open()` request, eliminating the source of orphaned duplicate connections. The cached promise is cleared on open success, open failure, and everywhere `_idb` is already nulled (`onversionchange` handler, `_closeSharedIdb()`).
- Option B: the `onversionchange` handler installed in `openIDB()`'s `req.onsuccess` now captures its own connection (`const db=e.target.result`) and calls `db.close()` directly, only nulling the shared `_idb` if `_idb===db` at the time the handler fires — so a connection superseded by a later `openIDB()` call still self-closes correctly instead of silently leaving the true orphan open.
- `_closeSharedIdb()` also clears `_idbOpenPromise`, so a caller racing a close can never be handed a resolved reference to the connection just closed.

Files Modified:

- working.html (`openIDB()`, `_closeSharedIdb()`)
- tests/selective-reset-idb-reliability.spec.js (4 new regression tests)

Next Action:

None. Released. No further code changes should be made to `openIDB()`/`_closeSharedIdb()` under this investigation without opening a new investigation.

Release:

Commit: 6995a0e4b37c7cd499ae042e7d7e71640e3bf8ff (merge of `repo-hygiene-remove-zz-repro`, containing `f444cfa`/`326a93d`/`ec6af50`)

Commit Message: "Merge branch 'repo-hygiene-remove-zz-repro' into main (INV-008 release)"

Branch: main

Status: Committed and pushed.

---

### INV-008 Regression Coverage

Test:

- tests/selective-reset-idb-reliability.spec.js (new tests added within the existing `SELECTIVE-RESET-IDB-CLOSE` describe block)

Coverage:

- Concurrent `openIDB()` callers de-duplicate into a single `indexedDB.open()` call and resolve to the same connection (Option A)
- An orphaned connection's own `onversionchange` handler closes only itself, leaving a different, currently-active `_idb` untouched (Option B)
- `openIDB()` clears the cached in-flight promise when the open request errors, so a subsequent retry succeeds instead of hanging on a stale rejected promise
- `_closeSharedIdb()` clears the cached in-flight promise in addition to `_idb`

Results:

- selective-reset-idb-reliability.spec.js → 21/21 Passed (single run); 105/105 Passed under `--repeat-each=5` (the exact regime that previously showed 16/85 intermittent failures under INV-008's own investigation run — now fully eliminated)
- wipe-verify.spec.js → 4/4 Passed
- Full repository-wide suite (`--workers=1`) → 286/288 Passed. The 2 residual failures (`frozen-week-and-chart-year.spec.js`, `CHART-PERIOD-YEAR-AWARE` ×2) were independently reproduced on the unmodified baseline via `git stash`, confirming pre-existing, date-boundary-dependent chart-range flakiness unrelated to this change.

Outcome:

PASS

---

### INV-008 Final Release Verification

Date:

2026-08-15

Repository State vs. Governance Records:

- `main` fast-forwarded from `3a69a1b`/`origin/main` `42730ee` to include the INV-008 branch via merge commit `6995a0e`, then fast-forwarded again to `4f86e0b` (automated `chore: stamp build 6995a0e` from `.github/workflows/stamp-build.yml`).
- Merge was clean (`git merge --no-ff repo-hygiene-remove-zz-repro`) — no conflict markers, no manual conflict resolution required.
- `working.html` confirmed post-merge to contain the Option A (`_idbOpenPromise`) and Option B (self-closing `onversionchange`) remediation intact.
- `git status` confirms working tree clean and `main` up to date with `origin/main` after push.

QA Retest (post-merge, on `main`):

- `selective-reset-idb-reliability.spec.js` + `wipe-verify.spec.js` (`--workers=1`): 25/25 Passed.
- Full repository-wide suite (`--workers=1`, 288 tests): 286/288 Passed. The 2 residual failures (`frozen-week-and-chart-year.spec.js`, `CHART-PERIOD-YEAR-AWARE` ×2) are the same pre-existing, independently-confirmed date-boundary chart-range failures already documented under the pre-merge QA Retest — no new failures introduced by the merge.

Outcome:

PASS. Repository state matches governance records. Release verified.

---

All confirmed defects identified through INV-002, R1, INV-005, INV-006, INV-007, and INV-008 have been remediated, verified, committed, pushed, and released.

INV-009 is confirmed and **not** remediated; it is held at the DEC-009 `Implementation Required` decision gate awaiting Implementation Manager review and human authorization.

INV-010 is **partially** remediated. C1 + C2 are implemented (`59a9770`), QA-verified and Steward-approved, and await Release Manager Review and the `Commit / Push Required` decision gate. C3 and C4 remain outstanding, so imports still reset reviewed clash status.

Remaining Activities:

- Continue normal application development.
- Monitor MI-001 (Migration Complexity).
- Monitor MI-002 residual test-infrastructure observations (the IndexedDB-timing subset separately tracked under INV-008 has now been remediated and released; see KI-006).
- Progress INV-010 C1 + C2 through Release Manager review to the DEC-009 `Commit / Push Required` decision gate.
- Progress INV-009 (High) through Implementation Manager review to the DEC-009 `Implementation Required` decision gate.
- INV-010 C3 / C4 remain outstanding; C3 requires DEC-014 (Clash Status Ownership Model) first.
- Use real-world project workflows to identify future enhancements or defects.

Repository Status:

Healthy.

INV-008 remediation committed, pushed, and released on `main` (commit `6995a0e`).

---

## Next Planned Activity

Return to normal application usage and enhancement work.

Future investigations should originate from:

- Real-world usage feedback
- Newly discovered defects
- Enhancement requests
- Monitoring-item escalation if new evidence emerges

### Repository Hygiene

Date: 2026-08-15

Repository Steward review identified an undocumented test artifact
(`tests/zz-repro.spec.js`) introduced in commit `00b7086`.

Findings:
- Not referenced in governance records.
- Duplicated coverage already provided by `tests/dedup-queue.spec.js`.
- Used deprecated fixed-delay synchronization (`waitForTimeout(2500)`).
- Contained investigation-era debug instrumentation.

Resolution:
- File removed.
- No application defect identified.
- No investigation reopened.

---

### Release Snapshot Capability (DEC-012)

Date: 2026-08-15

The Release Snapshot capability was designed and implemented per DEC-012.

Summary:
- New ledger file `docs/governance/RELEASE_SNAPSHOTS.md` records dated, immutable, point-in-time snapshots of repository state, governance state, investigation state, and test baseline at release closure.
- New automation script `scripts/generate-release-snapshot.mjs` mechanically captures repository-state facts (branch, HEAD, working-tree/sync state) for each new snapshot.
- `RS-001` was generated using the already-released INV-008 as the first reference implementation (release commit `6995a0e`, HEAD `5720adf` at capture time).

This is a documentation/tooling capability only. No `working.html` changes were made and no investigation was reopened.
