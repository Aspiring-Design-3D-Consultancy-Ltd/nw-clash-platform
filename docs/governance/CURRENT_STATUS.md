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

main

Repository Health:

- Repository healthy
- Governance framework committed and pushed
- Project memory established in repository
- No known governance gaps requiring immediate action
- INV-002, R1, INV-005, INV-006, INV-007, and INV-008 remediations committed and pushed

Current Working Tree:

INV-002 (680cfd5), R1 (a0526bf), INV-005 (3f37f72), INV-006 (136c397), INV-007 (b471e5c), and INV-008 (6995a0e, merging ec6af50/326a93d/f444cfa) remediations are committed and pushed to main.

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

No active investigations.

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

Remaining Activities:

- Continue normal application development.
- Monitor MI-001 (Migration Complexity).
- Monitor MI-002 residual test-infrastructure observations (the IndexedDB-timing subset separately tracked under INV-008 has now been remediated and released; see KI-006).
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