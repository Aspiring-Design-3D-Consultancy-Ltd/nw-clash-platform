# INV-002: closeApp() Whitelist Drift

Date:

2026

Status:

Closed - Released

Roles Completed:

- Environment Steward ✅
- Project Analyst ✅
- Architect ✅
- QA Investigator ✅
- Developer ✅
- Implementation Manager ✅
- Release Manager ✅
- Developer Implementation ✅
- QA Retest ✅
- Repository Steward Review ✅
- Final Release Approval ✅

Release:

Commit: 680cfd5146272473b1887ed0cf96d984731164f9

Commit Message: "Fix closeApp persistence whitelist drift"

Branch: main

Status: Committed and pushed.

Summary:

A persistence-layer defect was identified in the closeApp() workflow.

The application used a hardcoded validKeys allow-list. Any persisted nw:* localStorage key not explicitly included in that allow-list was automatically deleted during normal application close operations.

The investigation confirmed that multiple actively-used persisted keys were absent from the allow-list and were therefore removed unintentionally.

Areas Reviewed:

- localStorage persistence
- Review Queue
- Dedup Queue
- Delta Analysis
- Grid System
- Assignee Roster
- Migration Flags
- Audit History
- closeApp()
- Selective Reset
- Clear All Data

Environment Steward Findings:

- Identified persistence-state inconsistencies.
- Confirmed multiple persisted keys existed outside the closeApp() allow-list.
- Classified the issue as affecting multiple application subsystems.

Project Analyst Findings:

- Confirmed affected workflows.
- Documented dependencies and potential user impact.
- Identified risk of state loss affecting user workflows.

Architect Findings:

- Classified the issue as a high-severity state-management integrity defect.
- Identified whitelist-maintenance drift as the underlying architectural weakness.
- Identified similarity to a previously-remediated persistence defect.

QA Investigator Findings:

Independent verification confirmed:

- closeApp() maintained a hardcoded allow-list.
- 18 actively-used persisted keys were absent from that allow-list.
- Keys absent from the allow-list were deleted during normal close operations.
- No automated regression coverage existed for closeApp() persistence behaviour.
- Audit-history and migration-related keys were affected.

Confirmed Affected Keys:

- assigneeRoster
- gridActiveB
- levels
- dedupQueue
- reviewQueueBanners
- reviewQueueNoDateBanner
- reviewQueueScopeFixed
- reviewQueueDateGuardFixed
- dedupInitialScan
- designedConditionPatterns
- designedConditionPatternsV2Seeded
- republishToleranceMm
- reviewQueueDeltaAnalysisMigrated
- dedupActionHistory
- dedupIncidentLog:20260713:v1
- dedupRetroCleanup:v1
- dqShowSkipped
- pendingIdbWipe

Developer Assessment:

- Independently confirmed findings.
- Confirmed issue scope was isolated to closeApp().
- Identified working.html as the implementation target.
- Identified absence of regression coverage.
- Produced implementation and risk assessment.

Implementation Manager Review:

Approved implementation direction:

- Replace allow-list model with explicit removal-list model.
- Mirror the approach previously adopted in CLEAR-ALL-DATA-SCOPE-FIX (commit 1e28df4).
- Preserve active persisted keys by default.
- Remove only confirmed legacy/orphaned keys.
- Maintain minimal implementation scope.

Developer Implementation:

Implemented approved Option C.

Changes:

working.html

- Removed validKeys allow-list model.
- Introduced DEFUNCT_KEYS explicit removal list.
- Preserved all active persisted keys by default.
- Retained cleanup of confirmed legacy/orphaned keys only.

Current DEFUNCT_KEYS categories:

- grpZTol
- managerPin
- managerName
- managerEmail
- viewerPin
- viewerName
- viewerEmail

Regression Coverage Added:

tests/close-app-scope-fix.spec.js

Coverage includes:

- Preservation of all 18 previously affected keys.
- Preservation of existing persisted keys.
- Removal of confirmed defunct keys.
- Confirmation-cancel behaviour.
- Future unknown-key survival behaviour.

QA Retest:

Result:

PASS

Verification:

- Original defect resolved.
- All 18 previously deleted keys survive closeApp().
- Defunct keys continue to be removed.
- New regression suite passes.
- Adjacent persistence suites pass.

Validation Results:

close-app-scope-fix.spec.js

- 3 / 3 Passed

Combined validation:

- close-app-scope-fix.spec.js
- clear-all-data-scope-fix.spec.js
- selective-reset.spec.js

Result:

- 12 / 12 Passed

Repository Steward Review:

Result:

APPROVED WITH OBSERVATIONS

Findings:

- Scope remained limited to working.html and tests/close-app-scope-fix.spec.js.
- No scope creep detected.
- No unrelated modifications detected.
- Repository hygiene acceptable.
- Governance documentation was updated to align workflow state with implementation progress prior to release.

Impact:

Resolved risk of unintended deletion of:

- Dedup Queue state
- Review Queue state
- Grid state
- Assignee Roster
- Delta Analysis configuration
- Migration flags
- Audit-history records

Notable protections now preserved:

- dedupActionHistory
- dedupIncidentLog:20260713:v1

Resolution:

Technical remediation completed.

Regression protection added.

QA verification completed.

Repository review completed.

Final release sign-off granted. Committed and pushed.

Production Changes:

Committed via commit 680cfd5146272473b1887ed0cf96d984731164f9 ("Fix closeApp persistence whitelist drift").

Files committed:

- working.html
- tests/close-app-scope-fix.spec.js

---

# R1: Data Resurrection After Reset

Date:

2026

Status:

Closed - Released

Roles Completed:

- Developer ✅
- QA Retest ✅
- Repository Steward Review ✅
- Release Manager ✅
- Final Release Approval ✅

Release:

Commit: a0526bfaaf47d0256219f9727279ef190c321925

Commit Message: "Fix R1 data resurrection after reset"

Branch: main

Status: Committed and pushed. DEC-007 documentation-commit condition satisfied.

Summary:

A data-integrity defect was identified affecting both `clearAll()` and `_executeSelectiveReset()`.

The application removed persisted `nw:*` localStorage keys during reset operations but failed to update the corresponding in-memory `S.*` state values. This allowed stale in-memory data to remain present after a reset.

Subsequent code paths that persisted the current in-memory state could write the previously-cleared values back into localStorage, effectively resurrecting data that the user had intentionally removed.

Areas Reviewed:

- localStorage persistence
- clearAll()
- _executeSelectiveReset()
- Application state synchronization
- Dedup Queue
- Review Queue
- Levels and Grids
- Settings
- ISO Configuration
- Admin PIN

QA Investigation Findings:

Independent verification confirmed:

- Persisted storage and in-memory state could diverge after reset operations.
- `clearAll()` removed storage keys but left several `S.*` fields populated.
- `_executeSelectiveReset()` exhibited the same behaviour across multiple reset categories.
- Subsequent persistence operations could restore deleted values.
- No regression coverage existed for this specific resurrection failure mode.

Developer Assessment:

- Independently confirmed findings.
- Identified state divergence as the root cause.
- Confirmed implementation scope was limited to reset workflows.
- Identified working.html as the implementation target.
- Produced remediation and risk assessment.

Developer Implementation:

Implemented approved memory-synchronization remediation.

Changes:

working.html

- Added `_RESET_DEFAULT_ISO` factory-default clone.
- Updated `clearAll()` to synchronize in-memory state with reset operations.
- Updated `_executeSelectiveReset()` to synchronize in-memory state with category-specific resets.
- Preserved existing reset semantics while eliminating stale-state resurrection.

Affected state categories:

- clashes
- weekly
- dedupQueue
- reviewQueueBanners
- reviewQueueNoDateBanner
- levels
- grid
- gridActiveB
- assigneeRoster
- projectManager
- managers
- viewers
- apiKey
- projName
- iso
- pin

Regression Coverage Added:

tests/r1-data-resurrection.spec.js

Coverage includes:

- clearAll() memory synchronization
- clearAll() resurrection prevention
- Selective reset memory synchronization
- Selective reset resurrection prevention
- Category symmetry validation
- Scope-protection verification

QA Retest:

Result:

PASS

Verification:

- Original resurrection defect resolved.
- Memory and persistence remain synchronized after reset operations.
- Deleted values do not reappear following subsequent persistence actions.
- New regression suite passes.
- Adjacent persistence suites continue to pass.

Validation Results:

tests/r1-data-resurrection.spec.js

- 10 / 10 Passed

Combined validation:

- close-app-scope-fix.spec.js
- clear-all-data-scope-fix.spec.js
- selective-reset.spec.js
- r1-data-resurrection.spec.js

Result:

- 22 / 22 Passed

Repository Steward Review:

Result:

APPROVED WITH OBSERVATIONS

Findings:

- Scope remained limited to working.html and tests/r1-data-resurrection.spec.js.
- No scope creep detected.
- No unrelated modifications detected.
- Repository hygiene acceptable.

Resolution:

Technical remediation completed.

Regression protection added.

QA verification completed.

Repository review completed.

Final release sign-off granted. Committed and pushed.

Production Changes:

Committed via commit a0526bfaaf47d0256219f9727279ef190c321925 ("Fix R1 data resurrection after reset").

Files committed:

- working.html
- tests/r1-data-resurrection.spec.js

---

# INV-005: Migration Gate / Persistence Write Divergence Remediation

Date:

2026

Status:

Closed - Released

Roles Completed:

- Project Analyst ✅
- Architect ✅
- QA Investigator ✅
- Developer ✅
- Implementation Manager ✅
- Developer Implementation ✅
- QA Retest ✅
- Repository Steward Review ✅
- Release Manager ✅
- Final Release Approval ✅

Release:

Commit: 3f37f724891f42de14571cd198a0fd9c195cbbad

Commit Message: "Fix INV-005 migration gate persistence divergence"

Branch: main

Status: Committed and pushed.

Summary:

A gate/persistence-write divergence defect was identified in the `REVIEW-QUEUE-MIGRATE-SCOPE-FIX` and `REVIEW-QUEUE-MIGRATE-DATE-GUARD-FIX` one-shot migrations that run inline inside `initAuth()`.

Both migrations previously used the `sv()` persistence helper — which internally swallows write errors — to persist the migrated `clashes` register (and, for the date-guard migration, the `reviewQueueNoDateBanner` value) before unconditionally setting the corresponding one-shot gate flag. If the `sv()` write failed silently (for example under a near-quota `QuotaExceededError` condition), the gate flag was still set, permanently marking the migration as complete even though the underlying storage was never actually updated — creating a divergence between the one-shot gate and the persisted data that could not self-correct on a later load.

This defect is architecturally identical to the previously-remediated INV-003 (Migration Gate Persistence Divergence) defect in `_migrateDedupQueueV1()`.

Areas Reviewed:

- localStorage persistence
- Review Queue
- initAuth() migration sequence
- REVIEW-QUEUE-MIGRATE-SCOPE-FIX
- REVIEW-QUEUE-MIGRATE-DATE-GUARD-FIX
- One-shot migration gate flags
- INV-003 remediation pattern

Project Analyst Findings:

- Confirmed affected workflows were limited to the two review-queue one-shot migrations.
- Identified direct architectural parallel with the previously-closed INV-003 defect.

Architect Findings:

- Classified the issue as a migration gate/persistence-write divergence defect.
- Confirmed the correct remediation pattern was already established and released under INV-003.
- Directed alignment of both affected migrations with the INV-003 pattern rather than introducing a new remediation approach.

QA Investigator Findings:

Independent verification confirmed:

- Both migrations persisted via `sv()` before setting their gate flags.
- `sv()` write failures were swallowed, allowing the gate flag to be set unconditionally regardless of write outcome.
- No automated regression coverage existed for this asymmetric-failure scenario in either migration.

Developer Assessment:

- Independently confirmed findings.
- Confirmed issue scope was isolated to the two `initAuth()` review-queue migrations.
- Identified working.html as the implementation target.
- Identified the INV-003 remediation pattern as the correct fix.

Implementation Manager Review:

Approved implementation direction:

- Replace the `sv()` calls in both migrations with direct, throwing `localStorage.setItem` calls, mirroring the INV-003 pattern (`_migrateDedupQueueV1()` / `_rqdaMigrateSeedPatternsV2()`).
- Ensure the persistence write occurs, and can throw, inside the same try block as the gate-flag write, so a failed write prevents the gate from ever being set.
- Add asymmetric-failure regression coverage mirroring `tests/inv003-asym.spec.js`.
- Maintain minimal implementation scope.

Developer Implementation:

Implemented approved remediation.

Changes:

working.html

- `REVIEW-QUEUE-MIGRATE-SCOPE-FIX`: replaced `sv('clashes',S.clashes)` with a direct, throwing `localStorage.setItem('nw:clashes', JSON.stringify(S.clashes))` call preceding the `nw:reviewQueueScopeFixed` gate write.
- `REVIEW-QUEUE-MIGRATE-DATE-GUARD-FIX`: replaced `sv('clashes',S.clashes)` and `sv('reviewQueueNoDateBanner',false)` with direct, throwing `localStorage.setItem` calls preceding the `nw:reviewQueueDateGuardFixed` gate write.
- Prevents gate creation whenever migration persistence fails.
- Aligns both review-queue migrations with the INV-003 remediation pattern.

Regression Coverage Added:

tests/inv005-asym.spec.js

Coverage includes:

- `reviewQueueScopeFixed` failure path: large-payload write fails — gate stays unset, storage unchanged, migration retries and converges on next load.
- `reviewQueueScopeFixed` success path: write succeeds — gate is set, storage updated, gate and storage stay synchronized.
- `reviewQueueDateGuardFixed` failure path: large-payload write fails — gate stays unset, storage (clashes + banner) unchanged, migration retries and converges on next load.
- `reviewQueueDateGuardFixed` success path: write succeeds — gate is set, storage (clashes + banner) updated, gate and storage stay synchronized.

QA Retest:

Result:

PASS

Verification:

- Original gate/persistence divergence defect resolved for both migrations.
- Gate flags and persisted storage remain synchronized under both success and asymmetric-failure conditions.
- Failed migrations safely retry and converge on the next load instead of diverging permanently.
- New regression suite passes.
- Adjacent persistence and migration suites continue to pass.

Validation Results:

tests/inv005-asym.spec.js

- 4 / 4 Passed

Combined validation:

- close-app-scope-fix.spec.js
- clear-all-data-scope-fix.spec.js
- selective-reset.spec.js
- r1-data-resurrection.spec.js
- inv005-asym.spec.js

Result:

- 26 / 26 Passed

Repository Steward Review:

Result:

APPROVED WITH OBSERVATIONS

Findings:

- Scope remained limited to working.html and tests/inv005-asym.spec.js.
- No scope creep detected.
- No unrelated modifications detected.
- Repository hygiene acceptable.
- Remediation correctly reused the INV-003 pattern rather than introducing a divergent approach.

Impact:

Resolved risk of permanent gate/data divergence in the Review Queue scope-fix and date-guard-fix one-shot migrations under persistence-write failure conditions.

Resolution:

Technical remediation completed.

Regression protection added.

QA verification completed.

Repository review completed.

Final release sign-off granted. Committed and pushed.

Production Changes:

Committed via commit 3f37f724891f42de14571cd198a0fd9c195cbbad ("Fix INV-005 migration gate persistence divergence").

Files committed:

- working.html
- tests/inv005-asym.spec.js

---

# INV-006: Residual Migration Gate / Persistence Divergence Risk Assessment

Date:

2026

Status:

Closed - Released

Source:

MI-001 Monitoring Item

Roles Completed:

- Project Analyst ✅
- Architect ✅
- QA Investigator ✅
- Developer Assessment ✅
- Implementation Manager ✅
- Developer Implementation ✅
- QA Retest ✅
- Repository Steward Review ✅
- Release Manager ✅
- Final Release Approval ✅

Summary:

MI-001 (Migration Complexity) identified `dedupInitialScan` and `reviewQueueDeltaAnalysisMigrated` as one-shot migration gate flags that had not been independently verified against the confirmed defect class remediated under INV-003 and INV-005. INV-006 was opened to determine whether either location contains the same gate/persistence-write divergence defect.

Both locations were confirmed to contain the identical defect class:

- `dedupInitialScan` gate wrapper (`working.html` ~1271-1280) calls `scanForDedupCandidates()`, which persists the dedup queue via `sv('dedupQueue', S.dedupQueue)` (`working.html` line 7520). `sv()` swallows write errors internally (`working.html` line 968). If that internal write fails, `scanForDedupCandidates()` still returns normally, and the wrapper unconditionally executes `localStorage.setItem('nw:dedupInitialScan','1')` immediately afterward — permanently marking the one-shot scan as complete even though `nw:dedupQueue` was never actually updated.
- `reviewQueueDeltaAnalysisMigrated` gate function `_rqdaMigrate()` (`working.html` ~2178-2186) calls `_rqdaReclassifyAll()`, which persists the classified register via `sv('clashes', S.clashes)` (`working.html` line 1961, conditional on `if(touched)`). The same silent-swallow behavior applies: if that write fails, `_rqdaMigrate()` still proceeds to unconditionally set `nw:reviewQueueDeltaAnalysisMigrated` to `'1'`, permanently marking the migration as complete even though `nw:clashes` was never actually updated with the classification annotations.

This is architecturally identical to the previously-remediated INV-003 (`_migrateDedupQueueV1()`) and INV-005 (`REVIEW-QUEUE-MIGRATE-SCOPE-FIX` / `REVIEW-QUEUE-MIGRATE-DATE-GUARD-FIX`) defects.

Areas Reviewed:

- localStorage persistence
- Dedup Queue initial scan (`DEDUP-QUEUE-DETECT`)
- `scanForDedupCandidates()`
- Review Queue Delta Analysis migration (`REVIEW-QUEUE-DELTA-ANALYSIS-MIGRATE`)
- `_rqdaMigrate()` / `_rqdaReclassifyAll()`
- `sv()` / `lv()` storage helpers
- One-shot migration gate flags
- INV-003 / INV-005 remediation pattern

Project Analyst Findings:

- Confirmed both suspected locations use the vulnerable `if(!gate){ persist_via_sv(); setGate(); }` shape.
- Classified as a Persistence Defect, High priority, matching the previously-confirmed defect class.

Architect Findings:

- Confirmed the write for `dedupInitialScan` occurs inside `scanForDedupCandidates()` (not inside the gate wrapper's own try block) and is not a direct/throwing write, so the wrapper's own try/catch never observes a failure.
- Confirmed the write for `reviewQueueDeltaAnalysisMigrated` occurs inside `_rqdaReclassifyAll()` under the same silent-swallow pattern.
- Noted that `scanForDedupCandidates()` and `_rqdaReclassifyAll()` are shared functions called from many non-gate contexts (weekly import, Settings pattern edits, tolerance changes, bulk-delta reclassify) where `sv()`'s error-tolerant behavior may be intentionally acceptable — directed that remediation scope stay confined to the two one-shot gate wrappers rather than modifying the shared helper functions or `sv()` itself.
- Recommended Action: Remediation, reusing the INV-003/INV-005 pattern.

QA Investigator Findings:

Independent reproduction using the same asymmetric-failure technique as `tests/inv003-asym.spec.js` / `tests/inv005-asym.spec.js` (mocked `Storage.prototype.setItem` throwing `QuotaExceededError` for payloads >50 characters, small gate-flag writes succeeding) confirmed:

- Probe A (`dedupInitialScan`): gate was permanently set to `'1'` while `nw:dedupQueue` remained `null` in storage; the detected candidate pair existed only in memory for that session.
- Probe B (`reviewQueueDeltaAnalysisMigrated`): gate was permanently set to `'1'` while `nw:clashes` remained `null` in storage; the classification annotations existed only in memory for that session.
- Reproduction rate: 2/2 (100%) under the mocked write-failure condition.
- No automated regression coverage existed for either asymmetric-failure scenario prior to this investigation.

Severity Assessment:

- `dedupInitialScan`: High. No other code path re-triggers a full unscoped initial scan, so divergence is permanent and non-self-correcting.
- `reviewQueueDeltaAnalysisMigrated`: Medium. The one-shot gate itself remains incorrectly and permanently set, but explicit reclassify still runs on every import and every Settings change, providing a partial self-healing path outside the broken gate.

Developer Assessment:

- Independently confirmed QA Investigator and Architect findings.
- Identified `working.html` as the sole implementation target; confirmed defect isolated to the two gate wrappers.
- Raised architectural ambiguity: literally mirroring INV-003/INV-005 by converting the shared functions' internal `sv()` calls to throwing writes risks regressing the many other call sites of `scanForDedupCandidates()` / `_rqdaReclassifyAll()` that currently rely on `sv()`'s error tolerance. Presented two lower-risk, minimal-scope alternatives that preserve shared-helper behavior:
  - Option B: read-after-write verification inside each wrapper before setting the gate.
  - Option C: a dedicated, throwing persistence step scoped only to the two wrapper functions (functionally mirrors the INV-003/INV-005 shape without touching shared helpers).
- Recommended Option C for implementation and test symmetry with the two already-released remediations, but flagged the choice as requiring explicit approval.

Implementation Manager Review:

- Confirmed scope is limited to `working.html` (two one-shot wrapper functions) plus new regression coverage; no shared-helper (`sv()`, `scanForDedupCandidates()`, `_rqdaReclassifyAll()`) modification approved at this stage.
- Recommended Option C, matching the Developer Assessment recommendation, for governance and reviewer consistency with INV-003/INV-005.
- Identified this investigation as requiring two concurrent decision gates before Developer Implementation may proceed: (1) standard Implementation Required (repository modification), and (2) Architectural Ambiguity (Option B vs. Option C final selection), per DEC-009.

Decision Record:

**Option C approved.** Human operator selected Option C — a dedicated, throwing persistence step scoped only to the two one-shot wrapper functions, without altering `sv()`, `scanForDedupCandidates()`, or `_rqdaReclassifyAll()`. Implementation authorized.

Approved Scope:

Files:

- working.html (`DEDUP-QUEUE-DETECT` initial-scan wrapper; `_rqdaMigrate()`)
- tests/inv006-asym.spec.js (new)

Boundaries:

- No changes to `sv()` / `lv()`.
- No changes to `scanForDedupCandidates()` or `_rqdaReclassifyAll()` internals.
- No changes to any other call site of those two shared functions.

Developer Implementation:

Implemented approved Option C remediation.

Changes:

working.html

- `DEDUP-QUEUE-DETECT` one-shot initial-scan wrapper: added a direct, throwing `localStorage.setItem('nw:dedupQueue', JSON.stringify(S.dedupQueue))` call inside the same try block, immediately after `scanForDedupCandidates()` and before the `nw:dedupInitialScan` gate write. `scanForDedupCandidates()` itself is unmodified.
- `_rqdaMigrate()`: added a direct, throwing `localStorage.setItem('nw:clashes', JSON.stringify(S.clashes))` call inside the same try block, immediately after `_rqdaReclassifyAll()` and before the `nw:reviewQueueDeltaAnalysisMigrated` gate write — guarded by `if(n>0)` to exactly mirror `_rqdaReclassifyAll()`'s own conditional `if(touched)` write and avoid introducing an unconditional write side-effect that did not exist before. `_rqdaReclassifyAll()` itself is unmodified.
- Prevents each gate from ever being set whenever the corresponding data write fails.
- Aligns both locations with the INV-003/INV-005 remediation pattern while explicitly preserving the shared helper functions and their other call sites, per Architect/Implementation Manager scope constraints.

Regression Coverage Added:

tests/inv006-asym.spec.js

Coverage includes:

- `dedupInitialScan` gate/persistence asymmetric-failure path (large `dedupQueue` write fails — gate stays unset, storage unchanged, scan retries and converges on next load)
- `dedupInitialScan` gate/persistence success path (write succeeds — gate is set, storage updated, in-memory and persisted queue agree)
- `reviewQueueDeltaAnalysisMigrated` gate/persistence asymmetric-failure path (large `clashes` write fails — gate stays unset, storage unchanged, migration retries and converges on next load)
- `reviewQueueDeltaAnalysisMigrated` gate/persistence success path (write succeeds — gate is set, storage updated, in-memory and persisted classification agree)

QA Retest:

Result:

PASS

Verification:

- Original gate/persistence divergence defect resolved for both `dedupInitialScan` and `reviewQueueDeltaAnalysisMigrated`.
- Gate flags and persisted storage remain synchronized under both success and asymmetric-failure conditions for both locations.
- Failed one-shot operations safely retry and converge on the next load instead of diverging permanently.
- New regression suite (`tests/inv006-asym.spec.js`) passes: 4/4.
- Combined targeted regression run (inv006-asym, inv003-asym, inv005-asym, dedup-scope-and-signature, dedup-audit-log, review-queue-bulk-delta-approve-source, review-queue-date-guard-fix, review-queue-scope, weekly-incremental-import) passes: 69/69, run with `--workers=1` for deterministic timing.
- Full repository-wide suite run identified 22 pre-existing intermittent failures unrelated to `dedupInitialScan` / `reviewQueueDeltaAnalysisMigrated` (e.g. `approve-action-*`, `img-count-check`, `selective-reset-idb-reliability`, `frozen-week-and-chart-year`). These were independently reproduced on the unmodified pre-INV-006 baseline (`git stash` verification) with the same failing tests, confirming they are pre-existing MI-002 (Test Timing Sensitivity) flakiness under this environment's parallel/serial worker scheduling and are not attributable to the INV-006 remediation. No new failures were introduced by this change.
- A first implementation draft unconditionally wrote `nw:clashes` inside `_rqdaMigrate()` regardless of whether reclassification touched any data, which was caught by the existing `clear-all-data-scope-fix.spec.js` "cancelling the first confirm" test failing under regression re-run; corrected to guard the write with `if(n>0)`, matching `_rqdaReclassifyAll()`'s own conditional-write semantics exactly. Re-verified clean afterward.

Validation Results:

tests/inv006-asym.spec.js

- 4 / 4 Passed

Combined targeted validation:

- inv006-asym.spec.js
- inv003-asym.spec.js
- inv005-asym.spec.js
- dedup-scope-and-signature.spec.js
- dedup-audit-log.spec.js
- review-queue-bulk-delta-approve-source.spec.js
- review-queue-date-guard-fix.spec.js
- review-queue-scope.spec.js
- weekly-incremental-import.spec.js

Result:

- 69 / 69 Passed

Repository Steward Review:

Result:

APPROVED WITH OBSERVATIONS

Findings:

- Scope remained limited to working.html (two one-shot wrapper functions), tests/inv006-asym.spec.js, and governance documentation.
- No scope creep detected.
- No unrelated modifications detected.
- `sv()`, `scanForDedupCandidates()`, `_rqdaReclassifyAll()`, and all their other call sites remain untouched, exactly as directed by the Architect/Implementation Manager scope constraints.
- Repository hygiene acceptable.
- Remediation correctly reused the INV-003/INV-005 pattern (direct, throwing write preceding the gate write, inside the same try block) via Option C rather than modifying shared helpers.
- An interim implementation defect (unconditional `nw:clashes` write) was self-corrected by the Developer Implementation step before reaching this review, evidencing effective QA-in-the-loop verification.

Impact:

Resolved risk of permanent gate/data divergence in the `dedupInitialScan` one-shot dedup scan and the `reviewQueueDeltaAnalysisMigrated` one-shot delta-analysis migration under persistence-write failure conditions, without introducing risk to the several other call sites of the shared `scanForDedupCandidates()` / `_rqdaReclassifyAll()` functions.

Release Manager Review:

Executive Summary:

Implementation complete, QA-verified, approved, released, and in production.

Implementation Review:

Completed — Option C applied to both `dedupInitialScan` and `reviewQueueDeltaAnalysisMigrated` wrappers in working.html.

QA Review:

PASS — 69/69 on combined targeted validation; new regression suite 4/4.

Repository Steward Review:

APPROVED WITH OBSERVATIONS.

Release Risk Assessment:

Low. Change is minimal, additive, and scoped to two one-shot migration gate wrappers already covered by new regression tests. Pattern is identical in shape to two previously released remediations (INV-003, INV-005).

Approval Status:

APPROVED

Final Release Approval:

✅ Approved

Release:

Commit: 136c397

Commit Message: "Fix INV-006 migration gate persistence divergence"

Branch: main

Status: Committed and pushed.

---

# INV-007: MI-002 Test Timing Sensitivity Assessment

Date:

2026

Status:

Closed - Released

Release:

Commit: b471e5c

Commit Message: "Fix INV-007 test timing sensitivity"

Branch: main

Status: Committed and pushed.

Source:

MI-002 Monitoring Item

Roles Completed:

- QA Investigator ✅
- Project Analyst ✅
- Architect ✅
- Developer Implementation ✅
- QA Retest ✅
- Repository Steward Review ✅
- Release Manager ✅
- Final Release Approval ✅

Workflow:

Workflow C (Test Failure) per WORKFLOW_ROUTING.md — QA Investigator → Project Analyst → Architect. Investigation determined the issue was a Test Infrastructure Defect in test-harness synchronization rather than an application defect in working.html.

---

## Executive Summary

MI-002 asked whether the recurring, pre-existing intermittent Playwright failures (`approve-action-*`, `dedup-queue.spec.js`, `img-count-check.spec.js`, `selective-reset-idb-reliability.spec.js`, `rq-nw-export.spec.js`, `wipe-verify.spec.js`, `frozen-week-and-chart-year.spec.js`, `batch-import-pick-validation.spec.js`, and others) share a common root cause and whether remediation is required.

This investigation confirms a single, deterministic root cause: **a startup-sequencing race between the test suite's bootstrap helpers and `working.html`'s asynchronous `window.onload` initialization chain.** It is a test-harness defect, not an application defect. Remediation is low-risk and well-scoped (test files only), and a fix pattern has been empirically validated to eliminate the flakiness with 100% reproducibility across repeated runs.

---

## Scope Reviewed

- `tests/playwright.config.js` (`fullyParallel: false`, single browser, no explicit wait strategy beyond `waitForFunction` on `S`)
- `working.html` `window.onload` handler (~line 18345) and its `setTimeout`-scheduled one-shot migrations
- Bootstrap helpers in `tests/dedup-queue.spec.js`, `tests/approve-action-clash-register.spec.js`, `tests/img-count-check.spec.js`, `tests/selective-reset-idb-reliability.spec.js`, and ~30 other spec files sharing the same bootstrap idiom
- `docs/governance/CURRENT_STATUS.md` note (INV-006 section) recording the 22 pre-existing intermittent failures observed during a full-suite run

---

## Problem Statement

Every affected spec file bootstraps the page with the same idiom:

```js
await page.goto(HTML, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);
```

`S.clashes` and `S.projName` are populated synchronously near the *start* of `initAuth()` (an `async function`). Because `waitForFunction` resolves the instant this early state exists, the test proceeds to seed `S.clashes` / `S.dedupQueue` and immediately call application functions (`scanForDedupCandidates()`, `nav('dedup')`, `chgSt()`, etc.) — but `initAuth()` is still executing, and `window.onload` has several more asynchronous/deferred steps still pending:

- `initAuth()` itself continues past the point `waitForFunction` observed, including three one-shot migrations gated on `localStorage` flags (`REVIEW-QUEUE-MIGRATE-SCOPE-FIX`, `REVIEW-QUEUE-MIGRATE-DATE-GUARD-FIX`, `DEDUP-QUEUE-DETECT` initial scan, `_migrateDedupQueueV1()`, `_logDedupIncident20260713V1()`), each of which mutates `S.dedupQueue` / `S.clashes` and writes to `localStorage`.
- `window.onload` schedules three more one-shot migrations via `setTimeout(..., 1500)` / `setTimeout(..., 1600)`: `backfillImportFilenames`, `backfillStatusHistory`, `_rqdaMigrateSeedPatternsV2()` + `_rqdaMigrate()`.

If a test's bootstrap step clears `localStorage` and reseeds `S.clashes`/`S.dedupQueue` *before* these deferred migrations fire, the test's seeded state is silently overwritten in one of two ways:

1. **Direct overwrite** — a still-pending `initAuth()` migration (still executing past the `waitForFunction` resolution point) runs against a stale `S.dedupQueue`/`S.clashes` reference or wipes/reseeds the very state the test just wrote.
2. **Delayed overwrite** — a `setTimeout(1500/1600)` migration fires later in the test body (test bodies typically run for 400–700ms, well within the 1500–1600ms window) and mutates `S.clashes`/`S.dedupQueue` after the test has already asserted against them.

This was empirically reproduced and eliminated:

- Baseline (unmodified `tests/dedup-queue.spec.js`, 13 tests): failure rate varied run-to-run (observed 3–10 failures per run across 5+ runs), always the same locator (`[data-dedup-pair]` resolves to 0 elements) or badge/queue-length mismatches.
- Baseline (`tests/approve-action-clash-register.spec.js`, "bulk-bar" test, `--repeat-each=5`): 5 failed / 5 passed in the same run — a coin-flip, confirming pure timing non-determinism rather than a deterministic defect.
- Fix validation: inserting one additional line into each suite's bootstrap —
  ```js
  await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
  ```
  (i.e., waiting for the *last* `initAuth()`-inline migration gate to be set, which by construction only fires after all earlier inline migrations have completed) — produced:
  - `dedup-queue.spec.js`: 13/13 passed, then 39/39 passed across `--repeat-each=3`.
  - `approve-action-clash-register.spec.js` "bulk-bar" test: 10/10 passed across `--repeat-each=5` (vs. 5/10 baseline).

No application code (`working.html`) was modified during this investigation. The fix is entirely test-side.

---

## Test Methodology

1. Ran the full existing suite (single worker, matching CI-equivalent serial mode) and captured the baseline failure set.
2. Isolated `dedup-queue.spec.js` and `approve-action-clash-register.spec.js` and reran repeatedly (3–6 runs) to confirm non-determinism (same test passes and fails across otherwise-identical runs — ruling out a deterministic logic defect).
3. Built a minimal instrumented reproduction spec that timestamped every await boundary (`waitForFunction` resolution, badge assertion, `nav()` call, card-count assertion) and logged `document.readyState`, the `load` event firing time, and the `nw:dedupInitialScan` gate value at each checkpoint.
4. Confirmed the failure correlates exactly with cases where the test's assertions execute *before* the `load` event (and therefore before the `setTimeout`-deferred migrations) has fired; when `page.waitForLoadState('load')` or an explicit wait on the migration gate was inserted, the race window closed and results became 100% deterministic across every subsequent run.
5. Verified the fix scales: applied the same one-line gate-wait to a second, independent spec file (`approve-action-clash-register.spec.js`) with no other code changes, and the previously-flaky test went from ~50% pass rate to 100% (10/10) pass rate.
6. Restored both modified spec files to their original committed content before concluding the investigation (no working-tree changes left behind; `git status` confirmed clean against `origin/main`).

---

## Evidence Collected

- Baseline flakiness reproduced independently of any INV-006 code change (confirmed against the current `origin/main` HEAD, commit `54b5de4` / `136c397`, which already contains the INV-006 remediation).
- Failure signatures are consistent with the race, not with logic defects:
  - `expect(locator('[data-dedup-pair]')).toHaveCount(1)` → received `0` (queue was overwritten/reset by a still-pending migration before `nav('dedup')` rendered it).
  - `expect(locator).toHaveCount/toHaveText` mismatches in `approve-action-*`, `dedup-queue.spec.js` Merge/Keep-Separate/Skip assertions.
  - `wipe-verify.spec.js` / `selective-reset-idb-reliability.spec.js` IndexedDB "blocked by another connection" timeouts, consistent with a second, still-initializing IndexedDB connection opened by the still-executing `initAuth()`/`initNwImages()`/`initPlans()` chain colliding with the test's own IDB operations.
- `docs/governance/CURRENT_STATUS.md` (INV-006 section, dated prior to this investigation) had already independently observed and documented 22 such pre-existing intermittent failures, reproducible on both modified and unmodified (via `git stash`) baseline code — consistent with this investigation's findings.
- No application code changes were required or made to reproduce or resolve the race in isolated testing.

---

## Reproduction Results

- 100% reproducible non-determinism on unmodified spec files across 6+ repeated runs (both single-run and `--repeat-each` modes).
- 100% reproducible elimination of the race after adding a single explicit wait for the terminal one-shot migration gate (`nw:dedupInitialScan`) in each affected spec's bootstrap, validated across 2 independent spec files and 44 total test executions with zero failures post-fix.

---

## Root Cause Findings

**Confirmed root cause:** Test bootstrap helpers across ~30+ spec files wait only for the earliest observable application-ready signal (`S.clashes` + `S.projName` existing), not for the full `window.onload` initialization chain to complete. `working.html`'s startup sequence performs several further asynchronous mutations of shared state (`S.clashes`, `S.dedupQueue`, `S.reviewQueueBanners`, IndexedDB connections) after that early signal, via:

- Inline one-shot migrations still executing inside the (async) `initAuth()` call past the point where `S.clashes`/`S.projName` first become truthy.
- Three further one-shot migrations deferred via `setTimeout(1500)` / `setTimeout(1600)` from `window.onload`, which fire well within the typical 400–900ms runtime of an individual test body.

Because Playwright's `waitForFunction` resolves the instant the polled predicate becomes true — not when the application is "fully settled" — tests that seed state and assert immediately afterward are racing these deferred migrations. The race is timing-dependent (CPU load, parallelism, machine speed), which explains why the same tests reproduce intermittently on both modified and unmodified (baseline) code, exactly as previously documented under MI-002 and independently observed during INV-006 QA.

This is **not** an application defect. `working.html`'s deferred-migration design (idempotent, gated one-shot flags that are safe to run late) is a reasonable production pattern — a real user's browser has no test racing its `S` object a few hundred milliseconds after `domcontentloaded`. The defect is entirely in the test harness's synchronization contract with the application's startup sequence.

---

## Severity Assessment

Medium.

- No functional/user-facing defect exists.
- Reliability of the regression suite is materially impacted: a full-suite run currently produces ~15–22 intermittent failures unrelated to any real change, which erodes confidence in CI signal and has already required manual `git stash`-based re-verification during at least one prior investigation (INV-006).
- Risk of a genuine regression being masked by "known flaky" pattern-matching increases the longer this remains unaddressed.

---

## Architect Findings

### System Analysis

`working.html` startup is a single `window.onload` handler that fires `initAuth()` (async), `initNwImages()`, and `initPlans()` concurrently, plus three `setTimeout`-deferred one-shot migrations. This is an intentional design tradeoff: deferring non-critical backfills/migrations keeps the critical path to first paint short, and gating each on an idempotent `localStorage` flag makes them safe to run at any point after the primary state hydration. This pattern has been used successfully across INV-003, INV-005, and INV-006 remediations without introducing application defects.

The weakness is not architectural drift in `working.html` — it is that the test suite's synchronization contract (`waitForFunction` on early state) was written against an implicit assumption that state, once present, is stable. That assumption became false the moment deferred one-shot migrations were introduced (well before this investigation), and has silently accumulated as more such migrations were added over time (INV-003, INV-005, INV-006 all added new gated one-shot migrations to this same chain).

### Root Cause Analysis

Confirmed: test-harness synchronization gap, not an application defect. See QA Investigator findings above for full technical detail and empirical validation.

### Risk Matrix

| Risk | Severity | Likelihood |
|---|---|---|
| Continued CI/regression-suite unreliability | Medium | High (already observed repeatedly) |
| A genuine regression masked as "known flaky" | Medium-High | Low-Medium, increases over time |
| Regression fix scope creep if remediation touches `working.html` | Low | Low (fix is test-only) |

### Design Considerations

- **Option A — Wait on the terminal one-shot migration gate** (`nw:dedupInitialScan`, or equivalent last-in-chain flag) in each affected bootstrap helper. Validated in this investigation; minimal, additive, test-only change. Risk: if a future migration is added *after* the current terminal gate in the `onload` chain, the wait would need to be updated to point at the new terminal gate.
- **Option B — `page.waitForLoadState('load')`** after `page.goto`. Also validated empirically to close the race (confirms the `load` event fires after all `setTimeout(1500/1600)` migrations complete in headless Chromium's fast local `file://` load). More resilient to future migration-chain changes since it doesn't name a specific flag, but slightly coarser (waits for the browser's `load` event rather than a specific application milestone).
- **Option C — Expose an explicit "app fully initialized" signal** (e.g. `window.__appReady = true` set as the very last line of the deferred migration chain) and have every bootstrap helper wait on that single signal. Most maintainable long-term (single point of truth, decoupled from any specific migration's implementation detail) but requires an application-code change (`working.html`), which elevates this from a test-only fix to a combined test+application change and would need Developer Assessment + Implementation Manager review under Workflow B rather than remaining a pure test-harness fix.

### Recommended Action

Remediation (test-harness only). Recommend Option A or B — both are test-file-only changes, empirically validated, and require no `working.html` modification. Option C is noted as a future architectural improvement but is out of scope for this investigation's minimal-fix mandate (DEC-009 scope-control principle: prefer the smallest change that resolves the confirmed defect).

### Architecture Decision

Approved: Remediation via test-harness synchronization fix (Option A/B), scoped strictly to spec-file bootstrap helpers. No `working.html` changes required or authorized under this investigation.

---

## Classification Recommendation (Project Analyst)

Test Infrastructure Defect (test-harness synchronization gap) — not an Application Defect, not a Persistence Defect.

## Priority Recommendation (Project Analyst)

Medium — recommend scheduling remediation in a near-term maintenance pass; not release-blocking (no user-facing defect), but actively degrading regression-suite trustworthiness.

## Impact Assessment (Project Analyst)

- User impact: None (test-only).
- Business impact: Reduced confidence in CI/regression signal; wasted investigator time re-verifying flaky failures against baseline (as already occurred once during INV-006).
- Repository impact: ~30+ spec files share the affected bootstrap idiom and would benefit from the same one-line fix; a shared bootstrap helper module would also prevent future drift (noted as an optional follow-on improvement, out of scope here).

---

## Recommendation

Implementation completed, QA verified, approved, committed, pushed, and released.

No further remediation action required.

---

## Authorization Record

Human authorization was granted to implement the validated Option A fix across the affected spec-file population. Implementation proceeded under that authorization and is fully documented below.

---

## Developer Implementation

Authorization: Approved for implementation (Option A — wait on the terminal one-shot migration gate `nw:dedupInitialScan`).

### Enumeration of Affected Spec Files

Searched every `tests/*.spec.js` file for the shared bootstrap idiom (`await page.goto(HTML, ...); await page.waitForFunction(() => typeof S !== 'undefined' && Array.isArray(S.clashes) && S.projName);`, or an equivalent early-signal wait immediately following `page.goto`/`page.reload`). 28 files matched and were modified:

- approve-action-clash-register.spec.js
- approve-action-review-queue.spec.js
- approve-terminal-and-audit.spec.js
- batch-import-folder.spec.js
- batch-import-guidance.spec.js
- batch-import-pick-validation.spec.js
- coord-tier.spec.js
- dedup-audit-log.spec.js
- dedup-queue.spec.js
- dedup-scope-and-signature.spec.js
- frozen-week-and-chart-year.spec.js
- img-count-check.spec.js
- json-restore.spec.js
- pair-id-backfill.spec.js
- r1-data-resurrection.spec.js
- review-queue-date-guard-fix.spec.js
- review-queue-date-guard.spec.js
- review-queue-scope.spec.js
- review-queue.spec.js
- rq-nw-export.spec.js
- selective-reset-idb-reliability.spec.js
- selective-reset-partial-screenshot.spec.js
- selective-reset.spec.js
- weekly-incremental-import.spec.js
- weekly-summary-screenshot.spec.js
- wipe-verify.spec.js

Excluded from scope (deliberately, with rationale):

- `inv003-asym.spec.js`, `inv005-asym.spec.js`, `inv006-asym.spec.js` — these regression suites deliberately trigger and assert against the migration-gate mechanics themselves (asymmetric-failure testing of the gate/persistence divergence fixes); adding a wait on the gate they are testing would alter their intent.
- `review-queue-bulk-delta-approve-source.spec.js` — already carries its own equivalent fix (`await page.waitForTimeout(1700);`, documented inline as `REVIEW-QUEUE-BULK-DELTA-TEST-RACE-FIX`) predating this investigation; left untouched to avoid redundant/conflicting waits.
- `clear-all-data-scope-fix.spec.js`, `close-app-scope-fix.spec.js`, `clear-all-suppress-demo-seed.spec.js`, `clear-all-idb-nonblocking.spec.js`, `pair-id-multi-attr.spec.js`, `pr0`–`pr03`/`pr-a*` files — these bootstrap on a different early-signal predicate (e.g. `typeof clearAll === 'function'`, `typeof importToRegister === 'function'`) or use `waitUntil: 'load'` (which itself resolves after the full onload chain in headless Chromium's fast local `file://` load, per this investigation's Option B finding), and were not observed to exhibit the race.

### Implementation

Added, immediately after each affected bootstrap's existing early-signal wait and before any per-test `localStorage` mutation:

```js
// INV-007: wait for the terminal inline one-shot migration gate so
// window.onload's setTimeout(1500/1600)-deferred migrations don't
// race and silently overwrite this test's seeded state.
await page.waitForFunction(() => localStorage.getItem('nw:dedupInitialScan') === '1');
```

### Follow-up Fix Discovered During Verification

Full-suite verification after the initial wait insertion surfaced 2 new failure clusters (`batch-import-folder.spec.js` ×2, `weekly-incremental-import.spec.js` ×5) not present in the pre-fix baseline. Root-caused via direct instrumentation (`node -e` scripts driving Playwright's Chromium against `working.html` and logging `S.clashes.length` / gate state at each checkpoint): these two bootstraps (plus, preventively, `weekly-summary-screenshot.spec.js`, which shares the identical shape) wipe `localStorage` but never reset the in-memory `S.clashes`/`S.weekly` back to empty. Previously, the race meant these tests' import assertions usually ran *before* `initAuth()`'s demo-seed populated `S.clashes` — an accidental, lucky ordering, not an intentional design. Now that the added gate wait deterministically lets `initAuth()` finish first, `S.clashes` reliably contains the 104-clash demo dataset (and `S.weekly` the 4-week demo snapshot) at bootstrap time, which several tests' own imports then landed on top of, inflating expected register/weekly-bucket counts.

Fix: added an explicit in-memory reset (`S.clashes = []; S.weekly = []; sv('clashes', S.clashes); sv('weekly', S.weekly);`) to these three bootstraps, mirroring the reset pattern already present and working correctly in `img-count-check.spec.js`. This is a pre-existing latent gap in those three bootstraps' test setup (not a new defect introduced by the INV-007 fix) that the synchronization fix's determinism simply surfaced; it is in-scope to correct because it blocks reliable verification of the primary INV-007 fix.

---

## QA Retest

### Method

1. Ran the full test suite (`npx playwright test --workers=1`) three times across the implementation: once immediately after the initial 28-file wait insertion (surfaced the follow-up gap above), once after the follow-up fix (clean), and once more as a final confirmation run.
2. Independently captured a baseline by `git stash`-ing all changes and running the full suite unmodified, for direct before/after comparison.
3. Re-ran the specific files affected by the follow-up fix (`batch-import-folder.spec.js`, `weekly-incremental-import.spec.js`, `weekly-summary-screenshot.spec.js`) with `--repeat-each=3` to confirm determinism.
4. Investigated every residual failure individually (error context, source-line inspection, and where warranted, isolated `--repeat-each` re-runs) to classify as either attributable to this fix or pre-existing/unrelated.

### Results

- Baseline (unmodified, `git stash`): 21 failed / 263 passed.
- Post-fix (final confirmation run): 6 failed / 278 passed.
- The 6 residual failures are: `frozen-week-and-chart-year.spec.js` (`CHART-PERIOD-YEAR-AWARE` ×2), `selective-reset-idb-reliability.spec.js` (`SELECTIVE-RESET-IDB-VERIFY`/`-CLOSE` ×3), `wipe-verify.spec.js` (`WIPE-VERIFY` happy path ×1). All 6 are confirmed present in the unmodified baseline run as well (same test names, same underlying `deleteDatabase blocked by another connection` / chart-ordinal-mismatch failure signatures) — pre-existing, environment-level IndexedDB-connection-timing and chart-range-reset flakiness unrelated to the `S`-object startup race this investigation targeted. An additional isolated `--repeat-each=3` re-run of these three files independently reproduced further intermittent failures among them on both runs, consistent with their already-documented MI-002/KI-005 monitoring status rather than a regression introduced here.
- The other 15 previously-flaky tests (`approve-action-*`, `dedup-queue.spec.js`, `img-count-check.spec.js`, `batch-import-pick-validation.spec.js`, `rq-nw-export.spec.js`, and others) are now deterministically passing.

### Outcome

PASS. The INV-007 remediation is verified effective: it eliminates the confirmed test-harness synchronization race without introducing any new failures, and the remaining failures are independently confirmed pre-existing and out of scope.

---

## Repository Steward Review

Repository state audited prior to release. Scope was limited to the intended 28 `tests/*.spec.js` files plus the governance documents. No unrelated, accidental, or out-of-scope files were modified. No temporary test artifacts (`tests/test-results/`) were left behind. Repository health: clean, healthy, no gaps.

## Release Manager Review

All prior workflow stages (Developer Implementation, QA Retest, Repository Steward Review) are complete with evidence recorded above.

Release readiness: READY.

Outstanding risks: none beyond the two independently-confirmed-unrelated pre-existing flaky categories already tracked under MI-002/KI-005 monitoring notes, which remain explicitly out of scope for this remediation.

Release recommendation: approved, committed, pushed, and released.

---

## Final Release Status

APPROVED

Commit:

b471e5c

Commit Message:

"Fix INV-007 test timing sensitivity"

Branch:

main

Status:

Committed and pushed.

Investigation closed.

## Repository Hygiene Review – 2026-08-15

Finding:
Undocumented test artifact `tests/zz-repro.spec.js`.

Evidence:
- Introduced in commit `00b7086`.
- Not referenced in governance documentation.
- Coverage duplicated by `tests/dedup-queue.spec.js`.
- Included fixed-delay synchronization and debug logging.

Disposition:
Removed as repository-hygiene cleanup.

Impact:
No production code changes.
No investigation reopened.
No release behavior affected.

---

# INV-008: IndexedDB Reset Reliability Investigation

Date:

2026-08-15

Role:

QA Investigator / Architect (combined discovery + root-cause pass)

Status:

Closed - Released. (Originally: Open — Root Cause Confirmed, stopped at "Implementation Required"; authorization to proceed to Developer Assessment was subsequently granted, followed by QA Retest and Repository Steward Review, stopping at "Commit / Push Required"; human authorization to commit and push was then granted — see Developer Assessment / Developer Implementation / QA Retest / Repository Steward Review / Release Manager Review / Final Release Status sections below.)

Primary Scope:

- tests/selective-reset-idb-reliability.spec.js
- tests/wipe-verify.spec.js
- working.html: openIDB(), _closeSharedIdb(), _deleteIdbDatabase(), _clearIdbStores(), _wipeIdbWithVerify(), initNwImages(), initPlans()

Trigger:

Repeated residual "deleteDatabase blocked by another connection" / IndexedDB-timing observations logged under MI-002/KI-005 across INV-006 (22 pre-existing intermittent failures) and INV-007 (6 residual failures, all in these two spec files) — never individually root-caused. Escalated as highest-priority remaining technical issue by the Repository Hygiene review.

---
## Executive Summary

Two independent, evidence-confirmed problems were found:

1. Environment/harness issue (not an application defect): running Playwright from the repository root throws `Playwright Test did not expect test.describe() to be called here`, because the repository has two separate `@playwright/test` installations resolved into the same run (the ambient npx/global cache copy that launches the CLI, and the pinned copy at `tests/node_modules/@playwright/test` that the spec files' own imports resolve to). Running from `tests/` (the documented, intended working directory) works correctly.

2. Application defect (confirmed via direct instrumentation): `openIDB()` in `working.html` has a check-then-act race on the module-level `_idb` singleton. `window.onload` calls `initNwImages()` and `initPlans()` concurrently, both reaching `openIDB()` before either resolves, producing two independent `IDBDatabase` connections while only one is retained in `_idb`. The orphaned connection's own `onversionchange` handler closes over the shared `_idb` variable instead of its own connection, so it never self-closes correctly — leaving it open and blocking subsequent `deleteDatabase` calls up to the 15-second ceiling, exactly matching the `selective-reset-idb-reliability.spec.js` / `wipe-verify.spec.js` failure signatures previously logged (unexplained) under INV-006/INV-007/MI-002/KI-005.

---
## Environment and Test Harness Discovery

Facts (directly observed):

- `tests/package.json` declares `"scripts": {"test": "playwright test"}` and its description states `"... Run: cd tests && npm install && npm test."` — the intended working directory for test execution is `tests/`, not the repository root.
- `tests/playwright.config.js` sets `testDir: '.'` (relative to the config file's own directory), confirming `tests/` is the Playwright project root.
- There is no `package.json` at the repository root; `node_modules` exists only at `tests/node_modules` (contains `@playwright/test`, `playwright`, `playwright-core`, all pinned at v1.62.1 per `tests/package-lock.json`).
- Running `npx playwright test tests/wipe-verify.spec.js` from the repository root reproduces the exact reported error, pointing at `tests\wipe-verify.spec.js:59` (`test.describe('WIPE-VERIFY', ...)`), with the message explicitly naming "two different versions of @playwright/test" as a common cause.
- `npx playwright --version` from the repo root reports `Version 1.62.1` — the same version string as `tests/node_modules`, but this does not guarantee the same loaded module instance. A `DEBUG=pw:*` trace of the same repo-root invocation showed the CLI process itself running out of `C:\Users\...\AppData\Local\npm-cache\_npx\e41f203b7505f1fb\node_modules\playwright`, while `node -e "console.log(require.resolve('@playwright/test'))"` run from the repo root fails with `MODULE_NOT_FOUND`, and the same command run from `tests/` resolves to `tests/node_modules/@playwright/test/index.js`. Two separate `@playwright/test` module graphs are active in the repo-root invocation — the CLI's `test` singleton (npx-cache copy) never observes the `describe()` call registered by the spec file against the `tests/node_modules` copy's singleton.
- Running the identical command from inside `tests/` (`cd tests; npx playwright test wipe-verify.spec.js`) succeeds with no describe-registration error, because both the CLI and the spec file now resolve the same `tests/node_modules/@playwright/test` instance.

Conclusion: This is not a defect. It results from invoking the test runner from the wrong working directory, causing Node module resolution to load two independent `@playwright/test` instances. The repository's own `tests/package.json` and `tests/playwright.config.js` already document/require the correct invocation. No repository change is required for this half of the investigation.

---
## Reproduction Results

Executed via the confirmed-correct workflow (`cd tests; npx playwright test <file> --workers=1`):

- `wipe-verify.spec.js` (4 tests, single run): 3 passed, 1 failed — the happy-path test (`_wipeAllStorage` deletes `NWClashImages`, verify returns empty) timed out at 30s inside `page.evaluate(() => _wipeAllStorage(true))`.
- `selective-reset-idb-reliability.spec.js` (17 tests × `--repeat-each=5` = 85 runs): 69 passed, 16 failed. Every failure was one of exactly three tests, each failing 4 of its 5 repetitions:
  - `SELECTIVE-RESET-IDB-VERIFY › _verifyIdbFreshVersion returns ok:true after a real deleteDatabase`
  - `SELECTIVE-RESET-IDB-VERIFY › _wipeIdbWithVerify("full") retries once when the first delete stub is a no-op`
  - `SELECTIVE-RESET-IDB-CLOSE — partial-clear timeout parity › _verifyIdbEmpty succeeds within the 5000ms default used by _wipeIdbWithVerify`
- All captured failures share the identical error text: `deleteDatabase blocked by another connection — timed out after 15000ms. Close every other browser tab open on this file, then try again.` (thrown from `working.html:15706`, inside `_deleteIdbDatabase`) — matching the signature already documented under INV-006/INV-007.

Direct instrumentation (isolated `node` scripts driving the same Playwright/Chromium install against `working.html`, bypassing the test files entirely) reproduced the mechanism deterministically:

- Loading `working.html` and waiting for the documented bootstrap gate (`S.clashes`/`S.projName` populated, then `nw:dedupInitialScan==='1'`) leaves 2 successful `NWClashImages` connections open from a single page load (both from `working.html:3440`'s `indexedDB.open('NWClashImages',2)` call site — one via `initNwImages()`'s downstream `openIDB()` call, one via `initPlans()`'s `openIDB()` call, fired concurrently by `window.onload`).
- A direct, unmediated `indexedDB.deleteDatabase('NWClashImages')` issued immediately after that bootstrap (no `_closeSharedIdb()` call) reported `blocked: true` and did not resolve within 3 seconds.
- Manufacturing the race explicitly (`_idb = null; Promise.all([openIDB(), openIDB()])`) confirmed: the two returned `IDBDatabase` objects are different instances (`connA !== connB`); the module-level `_idb` ends up aliasing only whichever resolved last (`connB`); firing `connA`'s own `onversionchange` handler does not close `connA` — it nulls the shared `_idb` variable (dropping the last reachable reference to `connB`) while `connA` itself remains fully open and usable (`connA.transaction(...)` still succeeds afterward). `connB` was independently verified to still be open and blocking a subsequent `deleteDatabase` call.

---
## Failure Frequency

| Test file | Command | Result |
|---|---|---|
| `wipe-verify.spec.js` | single run, `--workers=1` | 1 of 4 tests failed (25%) |
| `selective-reset-idb-reliability.spec.js` | `--repeat-each=5`, `--workers=1` | 16 of 85 runs failed (~19% overall); the 3 affected tests failed 4/5 repetitions each (80%), the other 14 tests 0% across all 5 repetitions |
| Direct instrumentation (bypassing spec files) | isolated `node` + Playwright driver | Race and orphaned-connection condition reproduced 3/3 attempts when two concurrent `openIDB()` calls were driven; the naturally-occurring 2-connection state was observed 1/1 times on a plain bootstrap with no synthetic race forced |

Environmental dependencies identified:

- Single-worker (`--workers=1`) sequential execution still exhibits the failure — this is not a cross-worker/cross-process contention issue; it occurs within a single page/single test-file run.
- Failure rate correlates with tests that perform a real, unmediated `deleteDatabase`/verify cycle shortly after page bootstrap — the narrow window where `initNwImages()`'s and `initPlans()`'s concurrent `openIDB()` calls have just resolved. The 14 consistently-passing tests in the same file either mock `indexedDB.deleteDatabase`/`indexedDB.open` (never touching the real orphaned connection) or run later in the file after the shared `_idb` slot has already cycled.
- No dependency on headless vs headed mode, OS, or CI vs local was tested in this investigation (all evidence used the local headless Chromium bundled with `tests/node_modules/playwright-core`); no evidence contradicts prior investigations' findings that this reproduces identically in CI.

---
## IndexedDB Lifecycle Analysis

Traced flows (`working.html`):

- openDatabase (`openIDB()`, line ~3433): guards with `if(_idb)return res(_idb);` then calls `indexedDB.open('NWClashImages',2)`. This guard is check-then-act, not atomic — if `openIDB()` is invoked twice before the first call's `req.onsuccess` fires, both calls see `_idb` as falsy and both proceed to `indexedDB.open()`. There is no in-flight-promise de-duplication (no cached "opening" promise returned to the second caller).
- Connection ownership: `_idb` is a single module-level variable intended to hold "the" shared connection. With the race above, it can only ever hold one of the connections actually opened. Ownership of the other connection(s) is lost the moment the module-level variable is reassigned by a later `onsuccess`.
- onversionchange handler (line ~3466): installed per-connection inside `req.onsuccess`, but its body (`try{_idb.close();}catch(_e){} _idb=null;`) references the shared mutable `_idb` variable, not the specific connection the handler is attached to. Confirmed by direct instrumentation: firing connection A's own `onversionchange` handler does not close connection A; if `_idb` currently aliases connection B, it closes B and nulls the shared slot, leaving A fully open and connectable.
- Connection close behavior: `_closeSharedIdb()` (line ~15679) only closes/nulls whatever `_idb` currently references; it has no visibility into orphaned connections created by the race above.
- deleteDatabase requests (`_deleteIdbDatabase`, line ~15682): calls `_closeSharedIdb()` first (closing only the currently-aliased connection), then `indexedDB.deleteDatabase(name)`. Per spec, `deleteDatabase` fires `onblocked` and stays pending while any open connection (including an orphaned same-page connection) has not closed — confirmed via the reproduced `wasBlocked:true` timeout.
- blocked events: correctly wired (`req.onblocked` sets `wasBlocked` and logs a warning) but there is no mechanism to discover or force-close the specific orphaned connection causing the block — it can only wait out the 15-second ceiling.
- Singleton database references: the `_idb` singleton pattern is architecturally sound in intent (one connection, auto-closing on versionchange) but is not safely enforced under concurrent callers — exactly the shape of `window.onload=()=>{initAuth();initNwImages();initPlans();}` at real-world startup.

Paths capable of leaving open, unreferenced connections: any two (or more) near-simultaneous calls to `openIDB()` before the first has resolved. In production this occurs on every page load (`initNwImages()` + `initPlans()` racing). In tests it additionally occurs whenever a test operation (raw `indexedDB.open`/`deleteDatabase` probe, or an app-level reset call) executes during that same narrow startup window.

---
## Root Cause Analysis

Facts:
- Running Playwright from the repo root loads two separate `@playwright/test` module instances, causing the reported `test.describe()` error (confirmed via `require.resolve` divergence and `DEBUG=pw:*` trace).
- `tests/package.json` and `tests/playwright.config.js` both establish `tests/` as the intended project root.
- `openIDB()`'s `_idb` guard is check-then-act with no promise caching.
- `window.onload` calls `initNwImages()` and `initPlans()` without sequencing, both reaching `openIDB()`.
- The `onversionchange` handler closure references the shared `_idb` variable, not its own connection.
- Direct instrumentation reproduced two live connections from one bootstrap, and reproduced an orphaned, still-open, unreachable connection blocking `deleteDatabase`.
- The failure signatures collected in this investigation are textually identical to those already logged under INV-006/INV-007/MI-002/KI-005.

Observations:
- Failure rate for the three affected tests was ~80% under `--repeat-each=5`, while the other 14 tests in the same file were 0% — consistent with the defect being narrowly timing-dependent on the bootstrap-race window rather than a general IndexedDB instability.
- No failures were observed in tests that mock `indexedDB.open`/`deleteDatabase` (they never exercise the real orphaned-connection path).

Hypotheses (not directly confirmed, offered as candidate contributing factors, not conclusions):
- CI or slower-hardware environments may see a wider or narrower race window than local hardware, changing observed frequency (untested in this investigation — no CI access was exercised).
- Additional deferred `setTimeout`-based one-shot migrations (per INV-007 findings) could occasionally also open `NWClashImages` during the same window, independently increasing the number of orphaned connections; this was not directly instrumented in this investigation.

Conclusions:
1. The `test.describe()` error is an environment/invocation issue, not an application or test-file defect. No code change is required; the fix is procedural (always invoke Playwright from `tests/`, per the repository's own documented workflow).
2. The intermittent `deleteDatabase blocked by another connection` failures are a real, confirmed application defect in `openIDB()`'s connection-singleton management in `working.html` — a check-then-act race that can create orphaned, unreferenced `IDBDatabase` connections, compounded by an `onversionchange` handler that closes the wrong connection due to closing over shared mutable state instead of its own connection reference. This is a persistence-defect classification (Workflow A) affecting application code, not test-harness design — the existing tests are behaving correctly by surfacing a real, reproducible race condition; they are not the source of non-determinism.
3. This is a newly root-caused defect distinct from MI-002/KI-005 (which was specifically the test-bootstrap-vs-deferred-migration race, remediated under INV-007). The residual failures those investigations left unexplained in these two files are explained by this separate defect.

---
## Test Architecture Review

- The existing tests in both files do not rely on arbitrary/unjustified timing assumptions for their core logic — they use deterministic `waitForFunction` gates (per the INV-007 pattern) for bootstrap, and drive the real, unmocked `deleteDatabase`/verify cycle intentionally by design (e.g., `selective-reset-idb-reliability.spec.js`'s own comments note the authors already avoid arranging a real peer-open race in headless Chromium where possible, and direct-fire the handler instead).
- The three specific tests that fail are exactly the ones that cannot avoid the real connection lifecycle (they assert on the real post-`deleteDatabase` schema/version state), so they are not test-only defects — they are legitimately exposing a real, intermittent race in the code under test.
- Additional synchronization is required, but in the application code (`openIDB()`), not the test harness — a test-side workaround (e.g., adding more waits) would mask the defect rather than fix it, and would not protect production users who hit the same startup race on every real page load.
- Recommendation: do not modify test timing/waits as a "fix" for this defect; the root cause lives in `working.html`.

---
## Remediation Options

### Option A — De-duplicate concurrent openIDB() calls with a cached in-flight promise

Description: Change `openIDB()` to cache the pending Promise itself (not just the resolved `_idb` value) in a module-level variable, so a second concurrent caller receives the same in-flight promise instead of issuing a second `indexedDB.open()`. Clear the cached promise alongside `_idb=null` in the `onversionchange` handler and in `_closeSharedIdb()`. This eliminates the possibility of orphaned duplicate connections at the source.

Risk: Low-to-Medium. Requires care that the cached-promise variable is reset in every path that currently nulls `_idb` (the `onversionchange` handler and `_closeSharedIdb()`), or a stale rejected/resolved promise could be handed out after a close. All existing callers (`idbPut`, `idbGet`, `idbGetAll`, `idbGetAllKeys`, `idbClear`, `planPut/Get/List/Delete`, `initPlans`) already `await openIDB()` and would be unaffected by the interface. Regression tests should specifically assert only one connection is opened when `initNwImages()`/`initPlans()` run concurrently.

### Option B — Fix the onversionchange closure to close its own connection, not the shared variable

Description: Change the handler installed in `openIDB()`'s `req.onsuccess` to close over the specific connection it was attached to (e.g., capture `const db=e.target.result;` and reference `db` inside the handler) and only null the module-level `_idb` if `_idb===db` at the time the handler fires. This ensures any orphaned connection created by the Option-A race (if not also fixed) still self-closes correctly when a peer requests a version change, rather than silently leaving it open.

Risk: Low. Narrowly scoped, behavior-preserving for the common (non-raced) single-connection case; only changes behavior in the multi-connection edge case this investigation identified. Should be paired with Option A for a complete fix — Option B alone still permits the race to create the orphan in the first place, it only reduces how long the orphan survives once a versionchange event happens to be triggered.

### Option C — Do nothing (accept as documented monitoring item)

Description: Continue tracking under MI-002/KI-005-style monitoring, relying on `_deleteIdbDatabase`'s existing 15-second timeout, retry-once logic in `_wipeIdbWithVerify`, and the user-facing "close all other tabs" guidance to eventually succeed or fail loudly.

Risk: Medium-High. The defect is confirmed to reproduce on every real page load (two connections opened by `initNwImages()`/`initPlans()`), not just under test. Production users performing a Selective Reset, Clear All Data, or Factory Reset shortly after loading the page could intermittently hit the same 15-second-then-fail path already seen in tests — the exact production incident class `WIPE-VERIFY`'s own code comments (line ~15660) describe having previously occurred. Leaving this unfixed carries real user-facing risk, not just test flakiness.

---
## Recommendation

Proceed to Developer Assessment for Option A + Option B together (complementary, not alternatives) under Workflow A (Persistence Defect). This is a QA Investigator / Architect finding only — per WORKFLOW_ROUTING.md this investigation STOPS at the "Implementation Required" decision gate. No code changes have been made to `working.html` or the test suite as part of this investigation.

---
## Developer Assessment

Date:

2026-08-15

Role:

Developer

Executive Summary:

Independently reviewed `openIDB()`, `_closeSharedIdb()`, and all downstream callers (`idbPut`, `idbGet`, `idbGetAll`, `idbGetAllKeys`, `idbClear`, `planPut/Get/List/Delete`, `initPlans`, `initNwImages`, `_deleteIdbDatabase`, `_clearIdbStores`, `_wipeIdbWithVerify`). Confirms the QA Investigator / Architect findings without qualification: `openIDB()`'s check-then-act guard (`if(_idb)return res(_idb);`) is not atomic across concurrent invocations, and the `onversionchange` handler installed in `req.onsuccess` closes over the shared, reassignable `_idb` variable rather than the specific connection it is attached to.

Root Cause Confirmation:

Agree with both findings in the Root Cause Analysis section above. No new evidence contradicts the investigation.

Technical Analysis:

- Option A and Option B are complementary, not competing: Option A prevents the orphan from ever being created; Option B ensures that if a connection is ever superseded by a later one for any reason, its own `onversionchange` handler still closes it correctly rather than closing the wrong connection or none at all.
- All ten existing callers of `openIDB()` already `await` its return value and only use the resolved `IDBDatabase` object — none inspect `_idb` directly except test files and `_closeSharedIdb()`, so changing `openIDB()`'s internal caching strategy does not change its external contract.
- The two paths that already null `_idb` (`onversionchange` handler, `_closeSharedIdb()`) are the exact two paths identified by the investigation as needing to also clear the new cached-promise variable; a third path (open failure via `req.onerror`) was identified during implementation review as needing the same treatment, since a rejected cached promise would otherwise be handed to every subsequent caller until a successful open cleared it — Requirement 3 ("cache clearing on open failure") added to the approved scope for this reason.

Alternative Options Considered:

None beyond Option C ("Do nothing"), already rejected by the investigation per DEC-011 (confirmed defect, validated root cause, feasible remediation path — monitoring is not an acceptable primary disposition).

Risk Assessment:

Low. Both changes are internal to `openIDB()`/`_closeSharedIdb()`; no external call signature changes. The only new module-level state (`_idbOpenPromise`) is fully encapsulated and cleared on every exit path (success, failure, explicit close, versionchange).

Disposition:

Implementation Approved.

---
## Developer Implementation

Date:

2026-08-15

Role:

Developer

Change Plan:

1. Add a module-level `_idbOpenPromise` cache alongside `_idb`.
2. `openIDB()`: if `_idb` is already set, resolve immediately (unchanged fast path). Otherwise, if an open request is already in flight, return the cached promise instead of issuing a new `indexedDB.open()`. Otherwise, start a new open request, cache its promise, and clear the cache on every settle path (success, error).
3. `onversionchange` handler: capture the connection as `db` (`e.target.result`) instead of relying on the shared `_idb`; close `db` directly and only null `_idb` if it still aliases `db`; also clear `_idbOpenPromise`.
4. `_closeSharedIdb()`: additionally clear `_idbOpenPromise`.
5. Add regression tests to `tests/selective-reset-idb-reliability.spec.js` covering promise de-duplication, connection-owned `onversionchange`, cache clearing on open failure, and cache clearing on `_closeSharedIdb()`.

Files Affected:

- working.html (`openIDB()`, `_closeSharedIdb()`)
- tests/selective-reset-idb-reliability.spec.js (4 new tests added to the existing `SELECTIVE-RESET-IDB-CLOSE` describe block)

Implementation Summary:

Implemented exactly as planned. No other functions were modified; `_deleteIdbDatabase`, `_clearIdbStores`, `_wipeIdbWithVerify`, `initNwImages`, `initPlans`, and all `idbPut`/`idbGet`/`planPut`/etc. callers are unchanged — they continue to `await openIDB()` and receive the same `IDBDatabase` interface as before. No unrelated refactoring was introduced.

Risks:

None beyond those already identified in the Developer Assessment. Verified via regression tests and full-suite QA Retest below.

---
## QA Retest

Date:

2026-08-15

Role:

QA Investigator (retest)

Test Methodology:

Ran the two spec files named in the investigation scope, then the same file under the `--repeat-each=5` regime the original investigation used to surface the intermittent failures, then the full repository-wide suite — all via `cd tests; npx playwright test ... --workers=1` (the documented, correct invocation).

Results:

- `selective-reset-idb-reliability.spec.js` (single run, `--workers=1`): 21/21 Passed (17 pre-existing + 4 new INV-008 regression tests).
- `selective-reset-idb-reliability.spec.js` (`--repeat-each=5`, `--workers=1`, 105 runs): 105/105 Passed. This is the identical regime that previously produced 16/85 failures (three tests failing ~80% of their repetitions) during this investigation's own reproduction phase — the intermittent failure is now fully eliminated.
- `wipe-verify.spec.js` (single run, `--workers=1`): 4/4 Passed (previously 3/4, with the happy-path test timing out at 30s inside `_wipeAllStorage(true)`).
- Full repository-wide suite (`--workers=1`, 288 tests): 286/288 Passed. The 2 residual failures (`frozen-week-and-chart-year.spec.js`, `CHART-PERIOD-YEAR-AWARE` — "default range spans a year boundary correctly" and "resetChartRange restores full range and clears manual narrowing") were independently re-run against the unmodified baseline via `git stash` and reproduced identically (same test names, same assertion values), confirming pre-existing, date-boundary-dependent chart-range flakiness unrelated to the `openIDB()` change. `git stash pop` restored the implementation afterward.

Reproduction Results:

The specific `deleteDatabase blocked by another connection` failure signature that this investigation root-caused did not occur in any of the above runs, including under the repeat-each regime that previously reproduced it reliably.

Recommendation:

PASS. No regressions detected. Residual failures are confirmed pre-existing and out of scope, consistent with the disposition pattern already established under INV-006/INV-007.

---
## Repository Steward Review

Date:

2026-08-15

Findings:

- Scope remained limited to `working.html` (`openIDB()`, `_closeSharedIdb()`) and `tests/selective-reset-idb-reliability.spec.js` (new regression tests only), plus governance documentation updates.
- No scope creep detected: `_deleteIdbDatabase`, `_clearIdbStores`, `_wipeIdbWithVerify`, `initNwImages`, `initPlans`, and all IDB-consuming callers were left untouched, consistent with the minimal-change principle and the Developer role's "no scope expansion" rule.
- No unrelated modifications detected.
- Governance documentation (`CURRENT_STATUS.md`, `KNOWN_ISSUES.md`, `.cline/bootstrap.md`, `CLAUDE.md`) updated to reflect the `Implemented — Commit / Push Required` state, consistent with Workflow A.

Result:

APPROVED WITH OBSERVATIONS — repository state now matches governance state; remaining action was human authorization to commit and push.

---
## Release Manager Review

Date:

2026-08-15

Executive Summary:

Implementation complete, QA-verified, approved, released, and in production.

Implementation Review:

Completed — Option A (in-flight `openIDB()` promise de-duplication) + Option B (self-closing `onversionchange`) applied to `working.html`'s `openIDB()`/`_closeSharedIdb()`.

QA Review:

PASS — 21/21 on `selective-reset-idb-reliability.spec.js` (105/105 under `--repeat-each=5`), 4/4 on `wipe-verify.spec.js`, 286/288 on the full suite (2 residual failures confirmed pre-existing and unrelated).

Repository Steward Review:

APPROVED WITH OBSERVATIONS.

Release Risk Assessment:

Low. Change is minimal and scoped to two functions (`openIDB()`, `_closeSharedIdb()`) already covered by 4 new regression tests plus the full pre-existing `selective-reset-idb-reliability.spec.js` / `wipe-verify.spec.js` coverage. No other call sites of `openIDB()` were modified.

Approval Status:

APPROVED

Next Actions:

Commit and push authorized. Human authorization subsequently granted.

---

## Release Verification

Date:

2026-08-15

Repository State vs. Governance Records:

- Verified `f444cfa`/`326a93d`/`ec6af50` existed and were pushed on branch `repo-hygiene-remove-zz-repro` (`origin/repo-hygiene-remove-zz-repro` identical), but `main`/`origin/main` (at `3a69a1b`/`42730ee`) did not yet contain them — a discrepancy from every prior closed investigation (INV-002/R1/INV-005/INV-006/INV-007), each of which was released via a direct commit to `main`.
- Per DEC-007 (repository documentation is authoritative workflow state) and the Release Manager's "may block release if evidence is insufficient" rule, closure was held pending human decision on how to reconcile this discrepancy.
- Human decision: merge `repo-hygiene-remove-zz-repro` into `main` (fast-forward `main` to `origin/main` first, then merge, then push).
- Local `main` fast-forwarded to `origin/main` (`42730ee`), then merged with `repo-hygiene-remove-zz-repro` via `git merge --no-ff` — merge completed cleanly with no conflicts (`Auto-merging working.html`; `Merge made by the 'ort' strategy`).
- Merge commit: `6995a0e4b37c7cd499ae042e7d7e71640e3bf8ff`.
- Pushed to `origin/main`; CI's `stamp-build.yml` workflow then added an automatic `chore: stamp build 6995a0e` commit (`4f86e0b`), fast-forwarded into local `main`.
- Post-merge, `git status` reports "On branch main / Your branch is up to date with 'origin/main' / nothing to commit, working tree clean" — repository state now matches governance records.
- Confirmed `working.html` retains both the Option A (`_idbOpenPromise`) and Option B (self-closing `onversionchange`) code intact after the merge, with no conflict markers anywhere in the file.

QA Retest (post-merge, on `main`):

- `selective-reset-idb-reliability.spec.js` + `wipe-verify.spec.js` (`--workers=1`): 25/25 Passed.
- Full repository-wide suite (`--workers=1`, 288 tests): 286/288 Passed. The 2 residual failures (`frozen-week-and-chart-year.spec.js`, `CHART-PERIOD-YEAR-AWARE` — "default range spans a year boundary correctly" and "resetChartRange restores full range and clears manual narrowing") are the identical pre-existing, date-boundary-dependent failures already documented in this investigation's pre-merge QA Retest — no regressions introduced by the merge.

Outcome:

PASS. Repository state matches governance records. Release verified.

---

## Final Release Status

APPROVED

Commit:

6995a0e4b37c7cd499ae042e7d7e71640e3bf8ff

Commit Message:

"Merge branch 'repo-hygiene-remove-zz-repro' into main (INV-008 release)"

Branch:

main

Status:

Committed and pushed.

Investigation closed.

---
# INV-009: Silent Persistence Write Failure

Date:

2026-08-17

Status:

Confirmed (DEC-010 State 3) — root cause validated by runtime reproduction 2026-08-17.

Source:

Enhancement Assessment — "Session Persistence and Crash Recovery" (2026-08-17). The enhancement as requested was found to address a failure mode that does not exist; this investigation was opened for the mechanism that does.

Workflow:

Workflow A (Persistence Defect) per WORKFLOW_ROUTING.md.

Roles Completed:

- Project Analyst (via Enhancement Assessment intake) ✅
- QA Investigator ✅ (2026-08-17)
- Architect ✅ (2026-08-17)
- Developer Assessment ✅ (2026-08-18)
- Implementation Manager — pending

Note on stage order: QA Investigation was executed before the Architect
Review, transposing stages 2 and 3 of the Workflow A sequence recorded in
WORKFLOW_ROUTING.md. The Architect Review depended on the runtime evidence
the QA stage produced. This divergence is recorded, not resolved — see the
Repository Steward observation in CURRENT_STATUS.md.

---

## Origin

A "Session Persistence and Crash Recovery" enhancement was assessed on
2026-08-17. It proposed auto-save, manual save, and crash recovery to
prevent work being lost when the application crashes "before all state
changes have been persisted."

Assessment found no such window exists. The application is fully
synchronous write-through:

- `sv()` (working.html line 968) calls `localStorage.setItem` directly,
  which is synchronous and blocking.
- 164 `sv()` call sites plus 28 direct `localStorage.setItem` calls.
- Zero deferred-save machinery: 0 `setTimeout`-wrapped saves, 0 dirty
  flags, 0 `beforeunload` handlers, 0 `visibilitychange` handlers.
- Mutation functions persist inline. `uf()` (line 7008) writes
  `sv('clashes', S.clashes)` in the same statement that mutates the field.

Auto-save cannot improve on synchronous write-through, and crash recovery
has nothing to recover. The enhancement was returned as REQUIRES FURTHER
ANALYSIS, with this investigation opened in its place.

---

## Suspected Defect

`sv()` in full:

```js
function sv(k,v){try{localStorage.setItem('nw:'+k,JSON.stringify(v));}catch(e){}}
```

The trailing `catch(e){}` discards every write failure — quota exceeded,
serialisation error, storage disabled. No toast, no console warning, no
retry, no return value. The UI updates, the user believes the change was
saved, and nothing reached storage. The loss becomes visible only on the
next load, at which point a user would reasonably attribute it to a crash.

`lv()` on the same line has the symmetric problem on read: a parse failure
silently returns the default, which for `clashes` is an empty register.

This is the defect class already remediated under INV-003, INV-005 and
INV-006 — but only at three one-shot migration gate sites, where a gate
flag could diverge from its data. Ordinary user edits still route through
the swallowing helper. INV-006's Architect explicitly scoped `sv()` out
because it is called from many contexts where error tolerance may be
intentional. That scoping was correct for INV-006 and leaves this gap open.

---

## Quota Exposure (static analysis, 2026-08-17)

Two amplifying factors were measured.

**1. Whole-register writes.** `sv('clashes', S.clashes)` appears at 42 call
sites. Every single-field edit re-serialises and rewrites the entire clash
register as one JSON blob.

**2. Unbounded statusHistory.** `_appendStatusHistory()` (line 7704) appends
per status change. There is no cap, trim or rotation anywhere in the file
(0 occurrences of `statusHistory.slice` or a length guard). Review Queue
actions append the fatter entry shape carrying `reviewedAt`, `source` and
`matchedPattern`.

Serialised size of a representative clash record, measured:

| statusHistory entries | Per clash | At 2,253 clashes |
|---|---|---|
| 2 | 739 bytes | 1.59 MB |
| 12 | 2,158 bytes | 4.64 MB |

2,253 is the production register size recorded in the PR-0-RESOLVE-STAMP
comment (working.html ~line 11053, 17-Jul-2026 audit).

Typical Chrome/Edge localStorage quota is approximately 5 MB per origin.
`nw:clashes` is one of 26 distinct `sv()` keys plus 13 direct-write keys;
`weekly`, `dedupQueue`, `dedupActionHistory` and the audit logs consume
further headroom.

The register therefore grows toward the quota ceiling as a function of
review activity, and `sv()` is silent at the moment it is crossed.

---

## Open Questions

Runtime evidence is required before root cause can be confirmed. Per
CLAUDE.md, DevTools console output and a Playwright reproduction are
mandatory before any fix is proposed; static analysis alone is
insufficient.

1. Is `sv()` failing in practice? Requires a console session against a
   production-size register.
2. What is the actual current serialised size of all `nw:*` keys combined,
   against the browser's real quota?
3. Has any reported "crash loss" in fact been silent write failure? No user
   report exists in any governance record; the risk is currently theorised,
   not observed.

---

## Severity Assessment (provisional)

Provisional High, pending confirmation. The failure is silent, affects the
primary persistence path for all user work, and its trigger grows
monotonically with normal use. Provisional because no runtime reproduction
has yet been performed.

---

## Scope Boundaries (provisional)

In scope:

- `sv()` / `lv()` failure visibility (working.html line 968-969)

Out of scope unless evidence redirects:

- `openIDB()` / `_closeSharedIdb()` — closed under INV-008; not to be
  changed without a new investigation
- The three remediated gate sites (INV-003 / INV-005 / INV-006)
- Reducing write volume at the 42 `sv('clashes')` call sites — a separate
  architectural question, noted as Option F in the Enhancement Assessment
- `DATA_VERSION` — must not be bumped

---

## QA Investigation — Runtime Evidence (2026-08-17)

Method: isolated Node scripts driving Playwright/Chromium directly against
`working.html`, bypassing the spec files entirely — the same technique used
under INV-008. No spec file and no application file was modified.

Environment: Playwright 1.62.1 installed into `tests/node_modules`
(resolved from the `^1.55.0` range; no lock file is committed). The
container provides Chromium build 1194 while 1.62.1 expects 1234, so probes
launched with an explicit `executablePath` — the same override
`playwright.config.js` exposes as `PW_CHROMIUM_PATH`.

### Probe A — sv() swallows the failure

With `Storage.prototype.setItem` mocked to raise `QuotaExceededError`:

- quota error raised: 1
- exception escaped `sv()`: **false** — swallowed
- storage changed: **false** — write lost
- `sv()` return value: **undefined** — no caller can detect the failure

### Probe B — end-to-end silent data loss, reproduced

Through the real mutation path `uf('PROBE1','status','Resolved')` with
large-payload writes failing:

- `uf()` threw to caller: **false**
- status in memory (what the UI displays): **Resolved**
- status in `localStorage` (what was saved): **New**
- after reload: the change was gone

**REPRODUCED.** The user sees "Resolved", the register never received it,
and nothing anywhere reports a problem. Note the reloaded register was
re-seeded by the demo dataset because the probe register was synthetic;
that is a probe artefact, not a second defect. The material evidence is
memory "Resolved" against storage "New".

### Probe C — the real ceiling

- current `nw:*` footprint in a clean session: 10 keys, 0.04 MB
- `navigator.storage.estimate()` reports **820.97 MB** — this is the origin
  quota and is **misleading**: it does not govern `localStorage`
- measured bytes per clash: **810** at 2 history entries, **2,060** at 12
- largest register that fits: **2,253 clashes at 12 history entries**
- first failure: **3,000 clashes = 5.91 MB → QuotaExceededError**
- `sv()` behaviour at over-quota: **silent — no write, no error**

2,253 is the production register size recorded in the PR-0-RESOLVE-STAMP
comment. The production register therefore fits, but sits near the ceiling.

### Probe D — normal review activity alone reaches the ceiling

Register held **fixed** at 2,253 clashes, no new imports, varying only
`statusHistory` depth:

| history entries/clash | size | result |
|---|---|---|
| 2 | 1.75 MB | OK |
| 4 | 2.29 MB | OK |
| 6 | 2.83 MB | OK |
| 8 | 3.36 MB | OK |
| 10 | 3.90 MB | OK |
| 12 | 4.44 MB | OK |
| **14** | **4.98 MB** | **QuotaExceededError** |

Every status change appends one `statusHistory` entry; every Review Queue
action appends one. At the current production register size, roughly
**14 review touches per clash** exhausts `localStorage` — with no new
clashes imported at all. `statusHistory` has no cap, trim or rotation
anywhere in the file.

---

## Root Cause

Confirmed. Two independent factors compound:

1. `sv()` discards every write failure (`catch(e){}`), returns no value, and
   emits no signal. Callers cannot detect a failed write; the user cannot
   either, until the next load.
2. The persisted payload grows monotonically with normal use — the whole
   register is rewritten on every edit (42 call sites), and `statusHistory`
   is unbounded — so `localStorage` quota exhaustion is not an edge case but
   an arrival time.

Confidence: **High.** Mechanism and reachability are both reproduced.

Severity: **High** (upgraded from provisional). Silent, affects all user
work, and the trigger is reached by ordinary coordination activity rather
than by misuse.

---

## Open Question Remaining

Whether any loss already reported by users was this defect. No user report
exists in any governance record, so this cannot be answered from the
repository. It does not block remediation.

---

## Architect Review (2026-08-17)

### System Analysis

`sv()`/`lv()` (lines 968-969) are the entire localStorage abstraction, with
no error surface in either direction. 164 `sv()` calls across 26 keys;
`sv('clashes', ...)` alone at 42 call sites, each rewriting the whole
register.

`_appendStatusHistory()` (line 7704) carries a SCHEMA-GUARD that rejects
malformed entries but imposes no size or count guard.

**Key dependency identified:** `_platformWeeks()` (~line 1548) derives the
chart week **axis** by scanning every `statusHistory` entry for `week` and
`year`. The scoped chart reconstruction (~line 5696) reads
`{week, year, status}`; when `scope == 'all'` it uses the `S.weekly`
aggregates instead. Trimming old history entries would therefore remove
weeks from the chart axis entirely, not merely alter counts.

Precedent noted: `WK_MAX=6` with `_reportWds.slice(-WK_MAX)` (line 17039)
shows the codebase already bounds a window in reporting — but nothing
bounds anything in persistence.

### Measured Compression Headroom

The Review Queue writes a fat entry: `reviewedAt`, `reviewedInBatch`,
`source`, `status`, `matchedPattern`, `week`, `year`. The charts read only
`{week, year, status}`.

| Entry shape | Bytes | At 14 entries/clash, 2,253 clashes |
|---|---|---|
| Fat (Review Queue) | 147 | **5.98 MB — over quota** |
| Lean (chart requirement) | 43 | **2.85 MB — under quota** |

71% reduction per entry. At 20 entries/clash: 7.87 MB fat vs 3.40 MB lean.

Audit metadata is riding inside a structure the charts read on every
render. Separating the two roughly doubles headroom with no loss of
function.

### Options Evaluated

- **A - Surface write failure.** `sv()` returns success, logs, raises a
  persistent warning. Low-Medium complexity. Necessary but **not
  sufficient**: a user at quota sees a warning and still cannot save.
- **B - Cap/trim statusHistory.** **Rejected.** Removes weeks from the
  chart axis via the `_platformWeeks()` dependency, degrading the
  STATUS-HIST feature.
- **C - Separate audit metadata from chart data.** Retain
  `{week, year, status}`; relocate or drop the audit fields. Medium
  complexity. Recovers the headroom B would have bought, without the loss.
- **D - Migrate register to IndexedDB.** **Rejected for this defect.**
  Requires `openIDB('NWClashImages', 3)`, reopening INV-008, and converts
  42 synchronous call sites to async on the hottest path.
- **E - Delta writes.** **Rejected as disproportionate.** Restructures
  persistence semantics across 42 call sites.

### Preferred Architecture

**Option A + Option C.** They address the two distinct defects the QA
Investigation separated: A makes failure visible, C removes the condition
causing it. Neither alone suffices — A leaves the user stuck at a visible
dead end, C leaves the next ceiling silent.

### Data Impact

Data-loss risk is **High** — the fix for a data-loss defect itself carries
migration risk, and migrations are this repository's most defect-prone area
(MI-001; three investigations). A pre-migration JSON backup is mandatory,
mirroring the existing `PAIR-ID-BACKFILL` pre-backfill backup.

### Architectural Constraints (binding on implementation)

1. `sv()`'s signature must remain backward-compatible — 164 callers ignore
   the return value today.
2. `statusHistory` must retain `{week, year, status}` on every entry.
3. Audit fields must be migrated, not discarded, unless Developer
   Assessment proves nothing reads them.
4. A pre-migration JSON backup is mandatory.
5. Any migration gate must use the INV-003/005/006 pattern — throwing write
   before gate flag, same try block.
6. `openIDB()` / `_closeSharedIdb()` remain out of scope.
7. `DATA_VERSION` must not be bumped.
8. Marker discipline; the file stands at 192/192 balanced.
9. No new persistence layer.
10. Failure UX must not auto-dismiss. `showToast` is `pointer-events:none`
    with a 2-second lifetime — inadequate for a message requiring action.

### Architect Decision

**APPROVED FOR DEVELOPER ASSESSMENT**, preferred architecture A + C.

Three questions flagged for Developer Assessment to test hardest:

1. Does anything read `reviewedAt`, `source`, `matchedPattern` or
   `reviewedInBatch`? This determines whether C is a compression or a
   restructure.
2. Is a migration warranted at all? New entries could adopt the lean shape
   while existing fat entries are left untouched — no migration, no
   migration risk, headroom recovered gradually.
3. What is the live register's actual size today? All figures here are
   measured against a synthetic 2,253-clash register.

---

## Developer Assessment (2026-08-18)

Answers the three questions the Architect Review flagged, and corrects one
of its measurements.

### Q1 — Does anything read the audit fields?

Exhaustive search of `working.html`, excluding the minified library blobs:

| `statusHistory` field | Readers in `working.html` |
|---|---|
| `reviewedAt` | 0 |
| `source` | 0 |
| `matchedPattern` | 0 |
| `reviewedInBatch` | 0 |
| `approvedAt` | 0 |
| `actor` | 0 |
| `reviewedAtBatchDate` | 0 |
| `reviewedStillOpen` (entry field) | 0 |

**All eight are write-only in the application.** One precision that matters:
`c.reviewedStillOpen` — the *clash-level flag* — IS read (line 10398).
The `statusHistory` *entry field* of the same name is not. Removing the
entry field does not touch the flag.

Every reader of `statusHistory` consumes only `{week, year, status}`:
`_platformWeeks()` (1557), `clashStatusAt()` (1766), `clashExistsAt()`
(1779), the scoped chart reconstruction (5763, 5852),
`_rqLastStatusChange()` (10768), and the JSON restore merge (9586).

**But four spec files assert the audit fields:**
`approve-action-clash-register.spec.js`, `approve-terminal-and-audit.spec.js`
and `review-queue-bulk-delta-approve-source.spec.js` (all on `h.approvedAt`),
and `review-queue.spec.js` (on `h.source`).

Option C is therefore a **compression in the application and a contract
change in the test suite**. The four specs require rewriting, not deleting —
the behaviour they guard is real; only the storage location changes.

### Q2 — Is a migration warranted at all?

No, and the Architect Review's own alternative is the better path: new
entries adopt the lean shape while existing entries are left untouched. No
migration, no migration risk, headroom recovered as the register turns over.
This avoids MI-001 entirely, which is the repository's most defect-prone
area across three prior investigations.

### Q3 — Actual register size

Not answerable from the repository. All figures remain synthetic against a
2,253-clash register. Re-measurement against the live register is required
before implementation.

### Correction to the Architect Review's headroom table

The Architect Review measured the fat entry at **147 bytes** using the
Review Queue shape. Re-measured against both fat shapes actually written:

| Entry shape | Bytes | `statusHistory` at 14 entries x 2,253 clashes |
|---|---|---|
| Lean `{week, year, status}` | 43 | 1.29 MB |
| Review Queue Resolve (line 11136) | 180 | 5.41 MB |
| **Approve (line 11253)** | **288** | **8.66 MB** |

The Approve entry carries nine fields including two full ISO timestamps and
the actor name. It is **96% larger** than the 147-byte figure the Architect
Review assumed.

**Consequence:** an approval-heavy register reaches the quota ceiling
roughly twice as fast as the Architect Review's headroom table predicts.
Option C's benefit is correspondingly larger than assessed, and so is the
urgency.

### Assessment

- **Option A — GO.** Surface write failure. Unchanged from the Architect's
  assessment.
- **Option C — GO, with scope correction.** Proceed without a migration
  (Q2), and budget for four spec rewrites (Q1) that the Architect Review
  did not account for.

### Sequencing dependency (added 2026-08-18)

INV-010 C1 adds a provenance key to `statusHistory` entries; INV-009
Option C reshapes the same entries. Two passes over the same array is the
MI-001 pattern.

Because INV-010 C1 requires **no migration** and Option C requires a shape
change, the low-risk order is:

1. INV-010 C1 + C2 (additive, no migration)
2. INV-009 Option C (subtractive, spec rewrites), authored knowing the
   provenance key exists

The two shapes are compatible — `{week, year, status, s:'i'}` satisfies
Architectural Constraint 2 — so this is an ordering constraint, not a
conflict.

---

## Next Action

**PROCEED TO IMPLEMENTATION MANAGER REVIEW** per Workflow A.

Developer Assessment is complete (2026-08-18). Preferred architecture
remains Option A + Option C, with Option C proceeding without a migration
and carrying four spec rewrites.

Implementation is sequenced after INV-010 C1 + C2 — see the Sequencing
dependency above.

No fix is designed here — the QA Investigator role does not design
solutions, and the Developer Assessment stage does not authorise
implementation. Investigation stops at the DEC-009
`Implementation Required` decision gate, which is a human decision gate.

Per DEC-011, this investigation is in the `Confirmed` state with a
reproducible defect, a validated root cause and a feasible remediation
path, so `Do Nothing`, `Monitor Only` and `Accept the Risk` are not
acceptable primary recommendations.

---

# INV-010: Import Overwrites Reviewed Clash Status

Date:

2026-08-18

Status:

Confirmed (DEC-010 State 3) — reproduced end-to-end 2026-08-18.

Severity:

Critical (confirmed).

Source:

Project Analyst Review — "Status Persistence Failure and Save Capability
Assessment" (2026-08-18), raised from user reports that clash status
changes were not persisting reliably across close/reopen.

Workflow:

Workflow B (Application Defect) per WORKFLOW_ROUTING.md. The defect lives
in `importToRegister()`'s merge logic, not in the persistence layer.
INV-009 owns the persistence layer; keeping the two in separate workflows
preserves the scope boundary each investigation declared.

Roles Completed:

- Project Analyst ✅ (2026-08-18)
- QA Investigator ✅ (2026-08-18)
- Architect ✅ (2026-08-18)
- Developer Assessment ✅ (2026-08-18)
- Implementation Manager ✅ (2026-08-18) — CONDITIONAL GO on C1 + C2

Note on stage order: as with INV-009, QA Investigation was executed before
the Architect Review, transposing stages 2 and 3 of the sequence recorded
in WORKFLOW_ROUTING.md. Recorded, not resolved.

---

## Origin

Users reported that clash statuses changed during normal use had reverted
to older values after closing and reopening the application, and that
nothing indicated whether a change had been persisted.

The Project Analyst Review found two independent mechanisms producing that
symptom: INV-009 (silent write failure at quota) and an unrelated import
overwrite. This investigation covers the second. The two are not
alternatives — both are live, and a user cannot distinguish them.

The review also assessed the "Save Now / Last Saved / save verification /
persistence-health warning / recovery" capability set proposed alongside
the report. Save Now and Last Saved were rejected as addressing no
identified defect under synchronous write-through; save verification and
persistence-health warning are INV-009 Option A and belong there; recovery
already exists as `JSON-BACKUP-RESTORE`. No enhancement was opened.

---

## Confirmed Defect

`working.html:10055`, inside the `importToRegister()` append-mode merge
loop:

```js
exist.status=c.mappedSt;// NW is the authoritative source for clash status
```

Every append-mode import overwrites `status` on every matched clash with
the Navisworks-mapped value. There is no comparison, no precedence rule, no
warning, and no undo.

The behaviour is intentional and documented twice in the file — at line
9781, "Once the register has any clashes, subsequent imports trust NW
statuses as the authoritative source", and inline at the assignment above.

`mapNWSt()` returns `'New'` for any unrecognised or absent
`<resultstatus>`, so a malformed or partial export is indistinguishable
from a register of genuinely new clashes.

---

## QA Investigation — Runtime Evidence (2026-08-18)

Method: Node scripts driving Playwright/Chromium directly against
`working.html`, bypassing the spec files — the technique established under
INV-008 and INV-009. No application file and no spec file was modified.

### Probe A — status matrix

Register status (rows) against the Navisworks `<resultstatus>` in the
re-import (columns). `*` marks a changed register value.

| register \ XML | new | active | reviewed | approved | resolved | absent | unknown |
|---|---|---|---|---|---|---|---|
| New | New | Active* | Reviewed* | Approved* | Resolved* | New | New |
| Active | New* | Active | Reviewed* | Approved* | Resolved* | New* | New* |
| Reviewed | New* | Active* | Reviewed | Approved* | Resolved* | New* | New* |
| Approved | New* | Active* | Reviewed* | Approved | Resolved* | New* | New* |
| Resolved | New* | Active* | Reviewed* | Approved* | Resolved | New* | New* |

**28 of 35 combinations overwrite the register.** The only survivors are the
seven where the two values already agreed. All five statuses are affected,
in both directions — `New` to `Approved` fires as readily as `Approved` to
`New`. The register is a mirror of the last XML, not a review record.

### Probe B — statusHistory rewrite

Seeded: `status: 'Approved'`, history `[{W27,New},{W28,Approved}]`.

Import landing in the **same** ISO week as the approval (W28):

```
hist:  [{W27,New},{W28,New}]
status: New
clashStatusAt(28,2026): "New"
```

The approval entry was rewritten in place. The register now asserts the
clash was `New` in the week a human approved it. No orphan, no tombstone,
nothing to detect it by.

Import landing in a **later** week (W29):

```
hist:  [{W27,New},{W28,Approved},{W29,New}]
clashStatusAt(28,2026): "Approved"
clashStatusAt(29,2026): "New"
```

History is preserved and the reversal is legible as a transition.

The mutation is `pushStatusHistory()` lines 1752-1756:

```js
if(last&&last.week===wy.week&&last.year===wy.year&&last.status===status)return;
if(last&&last.week===wy.week&&last.year===wy.year){last.status=status;return;}
```

`importToRegister()` derives the week from the batch's `weekDate`, so a
weekly import routinely lands in the same ISO week as that week's review
activity. **The same-week collision is the normal case, not the corner
case.**

### Probe C — field delta

```json
{ "status":     {"before":"Approved",     "after":"New"},
  "nwImageRef": {"before":"cd000148.jpg", "after":""} }
```

`priority`, `assignedTo`, `notes`, `date`, `penetration` and coordinates
were all preserved, exactly as the code comment promises. `status` is the
only user-workflow field written unconditionally.

`exist.nwImageRef=c.nwImageRef||''` (line 10078) is also unconditional and
blanks a stored image reference when the incoming clash carries none. Same
defect shape, different field, impact not assessed — recorded here, out of
scope for this investigation.

### Probe D — PAIR-KEY-COORD-TIER isolated

Constructed so the ID, composite and legacy `pairKey()` tiers all miss (no
element IDs; element strings and `nwOrig` deliberately different), leaving
only the 1.0 mm coordinate fall-through:

| Coordinate shift | Register length | Original's status | `pairIdSource` |
|---|---|---|---|
| 0.00 mm | 1 | New | `coord` |
| 0.50 mm | 1 | New | `coord` |
| 0.99 mm | 1 | New | `coord` |
| 1.01 mm | 2 | **Approved** | — |
| 5.00 mm | 2 | **Approved** | — |

`pairIdSource: 'coord'` proves which tier fired. Below the threshold the
coord tier matches and destroys the approval; above it, no match — the
reviewed record survives and a second record is inserted.

**Exposure mechanism, stated precisely:** every widening of `pairKey()`
converts clashes that previously *inserted alongside* the reviewed record
into clashes that *overwrite* it.

An earlier probe attempt failed to isolate the coord tier — the
**composite** tier (sourceA + sourceB + elementA + elementB) matched first.
That is itself a finding: exposure is already broad without the coord tier,
because any clash whose element strings and source models are stable across
exports matches and is overwritten, element IDs or not.

### Probe E — determinism

Three identical runs, three identical results. No timing, no race, no
ordering dependency. The overwrite is an unconditional assignment on a code
path with no branch that can avoid it.

### Probe F — second overwrite path

`_xtResolveSkip()` (line 9493) reproduced independently: `Approved` to
`New`, history `[{W28,New}]`, storage `New`.

---

## Reproduction Conditions

Required:

- `mode === 'append'`
- Register non-empty (`isFirstImport` forces `'New'` on a fresh register)
- `testName` already known (`DUP-FILES-FIX` forces `'New'` for first-time
  test names)
- Incoming clash matches an existing one via any `pairKey()` tier — the
  sole gate
- XML status differs from register status

Not required:

- Quota headroom or any storage condition. Orthogonal to INV-009.
- Any user action beyond running the weekly import.

---

## Overwrite Paths

Three, not two:

| # | Site | Function | Guard | Reproduced |
|---|---|---|---|---|
| 1 | 10055 | `importToRegister()` merge loop | none | Yes |
| 2 | 9493 | `_xtResolveSkip()` | change-detection only | Yes |
| 3 | 6332 | `showBCFImportPanel()` BCF ingest | change-detection only | No |

Path 3 was identified by code read and not probed. Its map includes
`'Closed':'Resolved'` and `'ResolvedWontFix':'Approved'`, and it matches on
UID-in-title plus fuzzy name inclusion — a looser match than any `pairKey()`
tier.

The complete set of `.status =` writes in the file is seven sites. The other
four are legitimate: line 1147 (load-time repair, fires only for values
outside `ST`), 1755 (`pushStatusHistory` internal), 11134 (Review Queue
resolve), 11229 (`_markClashesAsApproved`).

---

## Root Cause

Confirmed. There is no ownership model for `status`. It has five writers and
no precedence rule between them. The import wins because it runs last, not
because anything decided it should.

Contributing factors:

- `mapNWSt()`'s `|| 'New'` fallback conflates missing, empty and
  unrecognised values with a genuine new clash.
- No precedence, provenance or conflict signal exists. Nothing records that
  a register value was human-set.
- Match-tier breadth: composite and coordinate tiers match on data that
  survives re-export, so most of the register is in scope on any import.
- `pushStatusHistory()`'s same-week replacement converts a recoverable
  overwrite into an unrecoverable one.
- `regenWeeklyFromRegister(_batchMaxD)` (line 10515) runs at the end of
  every import, rebuilding the current unfrozen weekly snapshot from the
  overwritten statuses.

---

## Historical Analysis

**When the overwrite logic was introduced cannot be established from this
repository.**

`working.html` entered version control at `8a93b74` (2026-07-31). That
revision already contains the overwrite assignment and all seven
occurrences of `PAIR-KEY-COORD-TIER`. `git log -S` on both strings bottoms
out at that commit.

Consequence: the Project Analyst's regression hypothesis — that the coord
tier widened exposure recently — **cannot be tested here.** There is no
pre-coord-tier baseline in the repository. Answering it requires an
artefact this repository does not hold: an older `working.html` from a
SharePoint copy, a deployment backup, or a user's browser profile.

Classification on available evidence:

- **Latent design defect: confirmed.**
- **Regression: unproven and untestable from this repository.**
- Not "both" on current evidence.

Falsified historical design assumptions:

1. Navisworks status is maintained and therefore authoritative. It is not
   maintained; the platform exists because it is not.
2. Import and review do not compete for the same field. They do, weekly.
3. Same-week history replacement only collapses one user's own edits.
   Imports now use that branch, and land in the review week by
   construction.

The `DUP-FILES-FIX` and `isFirstImport` guards show the assumption was
already recognised as unsafe for new tests and empty registers — the two
cases where an overwrite would be most visible. The general case was left
unguarded.

---

## Impact Assessment

| Area | Impact | Class |
|---|---|---|
| Current status | Silently replaced on every matched clash, every import, in both directions | Critical |
| Status history | Same-week: entry rewritten in place, approval erased with no trace | Critical |
| Reporting | PPTX / PDF / CSV read current status and `clashStatusAt()`; reports issued after an import misstate the review position | High |
| Charts | `clashStatusAt()` returns the rewritten value for past weeks; `_platformWeeks()` derives the axis from the same mutated array | High |
| Weekly metrics | Frozen snapshots (`capturedAt`) are never touched and are safe; the current unfrozen snapshot is rebuilt from overwritten statuses | Medium |
| Coordinator workflow | Review work destroyed by the routine meant to advance it; re-review is the only recovery | Critical |
| Governance integrity | `Approved` is terminal, gated by a typed confirmation and an audit append, yet reversed by an import with no confirmation, no log and no trace | Critical |

Severity rationale for **Critical** rather than High:

1. The audit trail is falsified, not merely lost. Data loss is recoverable
   in principle by re-review; a falsified record that reads as authentic is
   not, because nobody knows to look.
2. A terminal governance status is silently reversible. Entry is gated;
   exit is not.
3. The trigger is the platform's primary routine — the weekly import —
   deterministically, on every matched clash.

---

## Architect Review (2026-08-18)

### System analysis

The platform already holds a ratified answer to the ownership question and
the import path violates it. When a clash *disappears* from the XML — the
strongest possible signal it has been fixed — `REVIEW-QUEUE-DETECT` does
not flip it to `Resolved`; it sets `c.pendingReview = true` (line 10428)
and routes it to a human. CLAUDE.md records that the auto-flip half of
`PAIR-ID-RESOLVED-COUNT` is deliberately deferred.

When a clash *is present* with a stale status — the weakest possible
signal — the import overwrites the human decision unconditionally.

The two policies are inverted relative to the evidential strength of their
triggers.

`statusHistory` is load-bearing, not decorative: six readers depend on it,
including `_platformWeeks()` which derives the **chart week axis** from it.
In-place mutation rewrites the platform's only record of the past under six
consumers that treat it as fact.

`_appendStatusHistory()` (line 7788) is the single insertion point, guarded
by `PR-0-SCHEMA-GUARD` — a genuine architectural asset. But
`pushStatusHistory()`'s same-week branch bypasses it by mutating in place,
an exemption that was reasonable when only humans reached it.

### Options evaluated

- **Option A — Navisworks remains authoritative. Rejected.** Internally
  incoherent with the product: the entire review workflow would be a UI
  over a value discarded weekly. Also empirically false — `mapNWSt()` makes
  "the field was absent" indistinguishable from authority.
- **Option B — Platform authoritative, import never overwrites. Rejected as
  scoped.** Discards real information. A `Resolved` clash reappearing as
  `active` is a regression signal; pure Option B keeps `Resolved` silently.
  Trading loud data loss for quiet data staleness is not an improvement.
- **Option C — Conditional ownership. Adopted**, keyed on **provenance, not
  status value**. A value-keyed rule ("protect Reviewed/Approved/Resolved")
  is wrong: a coordinator who deliberately moves a clash back to `Active`
  has made a real decision that a value-keyed rule leaves unprotected,
  while a clash sitting at `Reviewed` only because a prior import wrote it
  there gets protected for no reason.

### Provenance rule

| Register value last written by | Import may overwrite |
|---|---|
| Import | Yes — silently. Import correcting its own prior value is not a conflict |
| Human | No — the divergence becomes a Review Queue proposal |
| Nothing (legacy, no provenance) | No — fail closed, treat as human-set |

### Assessment answers

1. **Owner:** the platform, for any status a human set; Navisworks, for
   status it set that nothing has since touched. Ownership is per-record,
   established by the last human action. Navisworks is authoritative on
   geometry, existence and detection — not on review state.
2. **Per-status:** `Approved` never, under any provenance. Every other value
   protected by provenance and surfaced, not blocked.
3. **On conflict:** detect, record, surface, do not apply. Do not write
   `status`; record the proposal on the clash; route to the existing Review
   Queue; report the count in the import summary. The import must still
   complete with conflicts outstanding — blocking it converts a
   data-integrity fix into a workflow stoppage that coordinators will route
   around.
4. **statusHistory rewriting by automated processes: never.** The
   distinction is not same-week vs different-week but same-actor vs
   different-actor.
5. **`Approved` protected: yes, absolutely.** A status that requires
   confirmation to enter requires confirmation to leave.
6. **`Resolved` protected: yes, by a different mechanism.** Never
   overwritten silently, but never discarded either — a Navisworks
   contradiction of `Resolved` is a regression signal and the
   highest-priority Review Queue item the system can generate. `Approved`
   is a governance decision Navisworks has no standing to contradict;
   `Resolved` is a factual claim about the model that Navisworks is
   uniquely qualified to contradict.

### Preferred architecture

Option C, provenance-keyed, routed through the existing Review Queue:

| Component | Description |
|---|---|
| **C1** | Status provenance — marker on each `statusHistory` entry, enforced at `_appendStatusHistory()` |
| **C2** | Close the mutation bypass — same-week replace conditioned on provenance |
| **C3** | Conflict detection at all three write sites, replacing the write with a proposal |
| **C4** | Review Queue surfacing plus import-summary conflict count |

Rejected alongside: warn-and-overwrite (the write is the defect; a
2-second `pointer-events:none` toast is not consent);
backup-before-import (mitigates blast radius, addresses no cause);
per-status configurable policy (pushes an architectural decision onto a
settings screen).

### Data impact

Risk High. Already-corrupted entries are **unrecoverable** — no prior value
was retained. Any fix protects from the fix date forward only. Historical
extent is unquantifiable from the repository.

### Architectural constraints (binding on implementation)

1. `statusHistory` entries must remain append-only for automated writers.
2. `{week, year, status}` must survive on every entry (INV-009 Constraint 2).
3. Provenance enforced at `_appendStatusHistory()` (line 7788), not at each
   write site.
4. Absent provenance fails closed — treat as human-set, protected.
5. No migration of existing `statusHistory` entries.
6. `Approved` absolutely protected; no provenance exemption, no
   configuration override.
7. All three write sites treated as one change. Dual-parser discipline per
   CLAUDE.md.
8. Conflicts surfaced through the existing Review Queue. No new persistence
   layer, no second conflict UI (DEC-008).
9. Imports must complete with conflicts outstanding.
10. The import summary must state the conflict count.
11. Conflict notification must not auto-dismiss (INV-009 Constraint 10).
12. Provenance byte cost reconciled with INV-009 Option C before either
    ships — one `statusHistory` shape decision, not two.
13. `DATA_VERSION` must not be bumped. Marker discipline maintained.
14. Pre-change JSON backup mandatory.
15. `nwImageRef` (line 10078) out of scope — separate assessment.

### Governance note

The ownership model is a governance position, not a procedure. Under
DEC-013 Rule 3 a prompt cannot create it. It belongs in DECISION_LOG.md as
**DEC-014 — Clash Status Ownership Model**. Recording it would also settle
whether `PAIR-ID-RESOLVED-COUNT` Phase 2 (deferred auto-flip to `Resolved`)
is still wanted — under Option C it is inconsistent, because it applies
first and asks later.

### Architect decision

**APPROVED FOR DEVELOPER ASSESSMENT.** Preferred architecture Option C.
Recommended split: C1 + C2 first, C3 + C4 second.

---

## Developer Assessment (2026-08-18)

### Scope

C1 (Status Provenance) and C2 (Close Automated Status History Mutation
Bypass).

### Provenance design

A single-character key on each entry, `{week, year, status, s:'i'}`:

| Value | Meaning |
|---|---|
| `'i'` | Import-derived |
| absent | Human-set, backfilled or unknown — **protected** |

Two values, not four. Nothing in C1 or C2 needs to distinguish a register
dropdown from a Review Queue action from a backfill — all three sit on the
protected side. Adding values the logic never reads is surface without
function (DEC-008).

**The design inversion that removes the migration:** stamp only automated
writers, and treat absent provenance as human-set. Architect Constraint 4
is then satisfied by construction, Constraint 5 needs no discipline, and
the diff drops from seven write sites to **two**.

Measured cost:

| Shape | Bytes | At 14 entries x 2,253 clashes |
|---|---|---|
| Lean `{week, year, status}` | 43 | 1.29 MB |
| Lean + `s:'i'` | 51 | 1.53 MB |
| Review Queue fat (current) | 180 | 5.41 MB |
| Approve fat (current) | 288 | 8.66 MB |

8 bytes per entry, on import-written entries only.

### Refinement to Architect Constraint 3

Constraint 3 requires provenance be added at `_appendStatusHistory()` and
not at each write site. That is right for enforcement and impossible for
origin — only the caller knows who it is. Proposed refinement, flagged
rather than silently deviated from:

- Origin supplied by the caller (optional parameter).
- Normalisation, validation and the omit-when-human rule live in
  `_appendStatusHistory()`, inside the existing `PR-0-SCHEMA-GUARD`.

### Writer enumeration

Every `statusHistory` writer in the file:

| # | Site | Function | Class | Passes origin |
|---|---|---|---|---|
| 1 | 7074 | `uf()` — dropdown, board move, group set, detail | Human | No |
| 2 | 9491 | `_xtResolveSkip()` | Automated | `'i'` |
| 3 | 10052 | `importToRegister()` merge loop | Automated | `'i'` |
| 4 | 11133 | Review Queue resolve | Human | No |
| 5 | 11228 | `_markClashesAsApproved()` | Human | No |
| 6 | 1761 | `pushStatusHistory()` to guard | Inherits caller | Threaded |
| 7 | 1823 | `backfillStatusHistory()` | System migration | No — protected |
| 8 | 11136 | Review Queue Resolve audit entry | Human | No |
| 9 | 11139 | Review Queue Still-Open audit entry | Human | No |
| 10 | 11253 | Approve audit entry | Human | No |

**Two sites change.**

One judgement call surfaced: `_xtResolveSkip()` is ambiguous — a human
clicked "Skip dupes", but the status value comes from the XML. Classified
**automated**, because the rule protects human decisions *about status*,
and choosing to skip duplicates is not one.

### Can C2 ship independently of C1?

**Yes, completely.** Both same-week branches inspect only the existing
entry; the C2 rule needs only the incoming writer's identity, which arrives
as a parameter. Human behaviour is bit-for-bit unchanged.

**But shipping C2 alone has a cost.** Every same-week collision between an
import and a human touch produces two entries where there was one. Against
INV-009's measured ceiling of 14 entries per clash at the production
register, C2-alone spends that budget faster on a register already assessed
as near the ceiling. C1 restores the cap by letting an import replace its
own prior same-week entry.

**Recommendation: ship C1 and C2 together**, against the Architect's
suggested split. The whole change is approximately 14 lines of application
code across three functions and two call sites; splitting it introduces a
regression in a Confirmed / High investigation to buy sequencing the change
size does not require.

### Migration

**None. Zero entries touched.** Legacy entries have no provenance key;
absent means protected. Constraints 4 and 5 satisfied by construction, no
migration gate needed, no MI-001 exposure, `DATA_VERSION` untouched.

### Affected paths

Modified: `pushStatusHistory()` (1746, 1752-1756, 1761),
`_appendStatusHistory()` (7788), `_xtResolveSkip()` (9491),
`importToRegister()` (10052).

Read but not modified — all six read only `{week, year, status}`, so the
added key is invisible to them: `clashStatusAt()` (1766), `clashExistsAt()`
(1779), `_platformWeeks()` (1557), scoped chart reconstruction (5763,
5852), `_rqLastStatusChange()` (10768), JSON restore merge (9586).

One coupling recorded: the JSON restore merge dedupes by
`{week, year, status}`. Two entries differing only in provenance would
collapse. Harmless under the two-value vocabulary; must be re-checked if it
expands.

**Explicitly out of scope:** lines 10055, 9493 and 6332 — the current-status
writes. Those are C3. **After C1 + C2 ship, imports still reset reviewed
status.** What changes is that the prior decision is recorded and retained
rather than destroyed. It is not surfaced anywhere in the UI and it does not
change what the charts report — see "Scope Correction" below. The release
note must say so in plain terms.

### Scope Correction (Implementation Manager Review, 2026-08-18)

The Implementation Manager Review verified this assessment's claims against
`working.html` and found one wrong. The correction is recorded here rather
than left in the reviewing stage, because under DEC-007 this record is the
specification implementation will be written against.

**Verified finding:** C1 + C2 **preserve historical evidence but do not
change current historical reporting behaviour.**

`clashStatusAt()` walks the array and keeps the *last* entry at or before
the target week:

```js
for(const e of hist){
  if(_weekYearCmp({week:e.week,year:e.year},target)<=0)result=e.status;
  else break;
}
```

With the post-C2 array shape — the human `{W28, Approved}` entry preserved
and the import's `{W28, New}` entry appended — the probe returns:

```json
{ "clashStatusAt_W28": "New",
  "rqLastStatusChange": "W28 2026 · New",
  "platformWeeks": ["2026W27", "2026W28"] }
```

Explicitly, after C1 + C2:

- **Approved entries survive in `statusHistory`.** The entry is present in
  memory, in `nw:clashes`, and in a JSON export.
- **Automated overwrites become recoverable.** The prior decision can be
  read back, audited and restored. Before C1 + C2 it was destroyed.
- **`clashStatusAt()` still returns the latest same-week value** — `New`,
  not `Approved`.
- **Charts and reporting remain C3 / C4 scope.** No chart, no PPTX / PDF /
  CSV export and no Review Queue display changes as a result of C1 + C2.

A further constraint on the benefit, verified in the same review: there is
**no user-facing render of the full `statusHistory` array anywhere in
`working.html`.** The only surfaces are `_rqLastStatusChange()` (last entry
only) and the charts via `clashStatusAt()`. Both report `New`.

C1 + C2 therefore convert **irreversible erasure** into
**recoverable-but-unsurfaced history**. That is the one INV-010 harm with no
workaround, and it is worth fixing — but it is not a reporting fix, and must
not be released as one.

`_platformWeeks()` is confirmed unaffected: the duplicate week is
deduplicated into a single axis entry.

### De-dupe branch retained (Implementation Manager Review, 2026-08-18)

`pushStatusHistory()` has two same-week branches, and only the second is in
scope for C2:

```js
if(last&&last.week===wy.week&&last.year===wy.year&&last.status===status)return;  // de-dupe — no-op
if(last&&last.week===wy.week&&last.year===wy.year){last.status=status;return;}   // replace — destructive
```

This assessment originally described automated writers as appending
unconditionally, which would have bypassed both. **The de-dupe branch
destroys nothing** — it fires only when the incoming status already matches
the last entry — and must be **retained for all writers**, automated
included. Bypassing it would append identical entries on every repeat
import, spending INV-009 quota headroom for zero information.

### Marker names

- **C1:** `STATUS-PROVENANCE`
- **C2:** `STATUS-PROVENANCE-GUARD`

Both verified unused in `working.html`. The earlier working name for C2
shared a prefix with the existing `STATUS-HIST` inline comment tag; the
CLAUDE.md balance check appends ` start` / ` end` so the two would not have
collided under that command, but a looser grep would have matched both.

### What C1 + C2 Do Not Fix

| Not fixed | Scope |
|---|---|
| Current status overwrite on import | C3 |
| Import resetting `Approved` to `New` | C3 |
| Historical chart interpretation | C3 / C4 |
| Reporting based on `clashStatusAt()` | C3 / C4 |
| Status ownership conflicts | C3 / C4 |

**These remain C3 / C4 scope.** After C1 + C2 ship, every import still
resets reviewed status, the charts still report the import's value for the
affected week, and no conflict is surfaced to the coordinator. What changes
is that the prior decision is no longer destroyed.

Any release note for C1 + C2 must state this in plain terms. A reader who
takes "INV-010 remediation shipped" to mean "imports no longer reset
reviewed status" will be wrong.

### Testing

New spec `tests/status-provenance.spec.js`, **13 tests**:

| # | Test |
|---|---|
| 1 | Human same-week status change replaces the last entry (unchanged behaviour) |
| 2 | Human same-week same-status is de-duped (unchanged behaviour) |
| 3 | Human cross-week change appends (unchanged behaviour) |
| 4 | Import in the same ISO week as a human approval **appends** rather than overwriting |
| 5 | **Corrected — see note below.** After that import: the original `Approved` entry remains present in `statusHistory`; the imported `New` entry is appended; `clashStatusAt(week, year)` still returns `New` |
| 6 | Import-written entries carry provenance; human-written entries do not |
| 7 | Import replacing its own same-week entry does not grow history (the C1 cap) |
| 8 | **New — de-dupe.** Automated writer, same week, same status: **must de-dupe rather than append** |
| 9 | `_xtResolveSkip` path stamps provenance and appends |
| 10 | Legacy entries with no provenance are never replaced by an automated writer |
| 11 | `_appendStatusHistory` still rejects missing `status` / `week` / `year` with provenance present |
| 12 | `_platformWeeks()` axis unchanged by the extra key and the duplicate week |
| 13 | JSON export to restore round-trip preserves provenance |

**Note on Test #5.** The `clashStatusAt()` assertion returns `New`, not
`Approved`. **This is intentional and documents current behaviour.** C1 + C2
preserve the approval entry in the array; they do not change how
`clashStatusAt()` selects among same-week entries. Correcting historical
reporting is C3 / C4 scope. The assertion is written explicitly, rather than
omitted, so that a future reader cannot infer from its absence that
reporting was fixed.

Existing specs assessed, not assumed:

- `pr03-clock2-status-transitions.spec.js` — **not affected.** Both
  re-import tests use different weeks (W23 to W24; W23 to wall-clock), so
  the same-week branch never fires; `historyLen === 2` and the
  `statusHistory[1]` index assertion both hold. Verified by reading the
  fixtures.
- `pr0-pr01-schema-fixes.spec.js` — guard length assertions; covered.
- `review-queue.spec.js`, `approve-*.spec.js` — assert human-path audit
  fields; untouched by C1.

Nothing in the suite currently asserts the same-week replacement behaviour
at all, which is part of why the import path could start using it
unnoticed.

Baseline for the full suite: 298 passed, 2 failed, the two failures being
pre-existing `CHART-PERIOD-YEAR-AWARE` cases in
`frozen-week-and-chart-year.spec.js` that reproduce on the unmodified base.

### Recommendation

**GO on C1 + C2, implemented together as one change.**
**NO-GO on the C2-first / C1-second split as scoped.**

Three items for the Implementation Manager:

1. Confirm the `_xtResolveSkip` classification as automated.
2. Confirm the refinement to Architect Constraint 3 — the constraint as
   written is not literally satisfiable.
3. Confirm ordering with INV-009 Option C — C1 + C2 first.

---

## Implementation Manager Review (2026-08-18)

Scope: C1 + C2 only. C3 and C4 not reviewed.

### Decisions

| # | Decision | Outcome |
|---|---|---|
| 1 | `_xtResolveSkip()` classification | **AUTOMATED** |
| 2 | Provenance architecture | **APPROVED** |
| 3 | Implementation order | **INV-010 C1 + C2 before INV-009 Option C** |

**Decision 1 rationale.** The human's click in the cross-test modal is a
decision about which records to import, not about what status they hold.
Three supporting points: the written value originates in the XML and is
never shown to or alterable by the user; the guard at line 9493
(`if(ex.status !== c.mappedSt)`) is a change gate, not a consent gate, and
cannot distinguish agreement from difference; and the sibling handler
`_xtResolveKeepAll()` writes no status at all, which establishes that the
modal's semantic is record selection rather than status assignment.
Classifying it `HUMAN` would grant an XML-sourced value the protection
reserved for human decisions and let it pass the C3 gate unchallenged.

**Decision 2 rationale.** Provenance-keyed rather than value-keyed is
correct: a coordinator who deliberately returns a clash to `Active` has made
a decision as real as an approval, and a value-keyed rule would leave it
unprotected while pointlessly protecting a `Reviewed` that an earlier import
wrote. Two provenance values rather than four is right — nothing in C1 or C2
reads the finer distinction. Architect Constraint 3 is confirmed as refined:
as literally written it is not satisfiable, because only the caller knows
its own identity. An ambient module-level "current writer" variable was
considered and **rejected** — implicit global state across a path with early
returns is a worse defect than the one being fixed.

**Decision 3 rationale.** C1 requires no migration and INV-009 Option C
does; sequencing the migration-free change first means the migration is
authored once against the final entry shape rather than written, invalidated
and re-reasoned (the MI-001 pattern). INV-010 is `Critical` against INV-009's
`High`, and INV-010's harm is irreversible where INV-009's is at least
visible on the next load. The corollary — C1 and C2 ship together — is
upheld.

### Findings

1. **Developer Assessment test #5 was wrong.** It asserted `clashStatusAt()`
   would return `Approved` for the approval week after C1 + C2. Verified by
   probe: it returns `New`. Corrected in the Developer Assessment record
   above.
2. **The de-dupe branch was not addressed** and must be retained for
   automated writers. Corrected above.
3. **Marker name prefix collision** with the existing `STATUS-HIST` inline
   tag. Corrected above.
4. Claims verified and upheld: six readers consume only
   `{week, year, status}`; `_platformWeeks()` unaffected by the duplicate
   week; `pr03` specs unaffected; ten writers with two automated; no
   migration required; the ~14-line estimate is plausible.
5. **JSON restore dedupe consequence recorded, not fixed.** The cross-test
   merge at line 9585 dedupes on `year:week:status`, so a human
   `{W28, New}` and an import `{W28, New, provenance}` share a key and one
   is dropped. Informationally harmless — same week, same status — but
   provenance is not guaranteed to survive a cross-test merge.

### Conditions

| # | Condition | Status |
|---|---|---|
| 1 | Rewrite test #5 to assert entry survival and `clashStatusAt() === "New"` | **Applied** — Testing section above |
| 2 | Retain the de-dupe branch; add the automated same-week same-status test | **Applied** — Testing section, test 8 |
| 3 | Correct the scope statement in this record before implementation | **Applied** — Scope Correction section above |
| 4 | Use `STATUS-PROVENANCE` and `STATUS-PROVENANCE-GUARD` | **Applied** — Marker names section above |
| 5 | Pre-change JSON backup and standard pre-edit verification | Outstanding — for the implementation stage |

### Outcome

**CONDITIONAL GO** on C1 + C2. Conditions 1 to 4 are applied in this record
as of 2026-08-18. Condition 5 is an implementation-stage obligation.

This review does not authorise implementation. INV-010 remains at the
DEC-009 `Implementation Required` decision gate, which is a human decision
gate.

### Interim mitigation available now

C1 + C2 do not stop imports resetting reviewed status, and C3 is not yet
assessed. The practical interim mitigation is a JSON backup taken before
each weekly import, using the existing `JSON-BACKUP-RESTORE` capability. It
requires no code change and is available today.

---

## Open Questions

1. Whether any loss already reported by users was this defect, INV-009, or
   both. Not answerable from the repository.
2. Historical extent — how many clashes in the production register carry a
   `statusHistory` entry overwritten in place. Requires the live register.
3. When the overwrite logic was introduced. Requires an older
   `working.html` that this repository does not hold.
4. Whether the BCF import path (line 6332) is used in practice. If unused
   it is a documentation fix; if used, its fuzzy name matching may be a
   defect in its own right.

---

## Scope Boundaries

In scope:

- `importToRegister()` merge-loop status write (line 10055)
- `_xtResolveSkip()` status write (line 9493)
- BCF import status write (line 6332)
- `pushStatusHistory()` same-week mutation (lines 1752-1756)
- `_appendStatusHistory()` provenance (line 7788)

Out of scope unless evidence redirects:

- `sv()` / `lv()` failure visibility — INV-009
- `nwImageRef` unconditional write (line 10078) — separate assessment
- The four legitimate `status =` writes (1147, 1755, 11134, 11229)
- `DATA_VERSION` — must not be bumped

---

## Next Action

**HELD AT THE DEC-009 `Implementation Required` DECISION GATE.**

All five Workflow B stages are complete. The Implementation Manager Review
returned CONDITIONAL GO on C1 + C2; conditions 1 to 4 are applied in this
record and condition 5 is an implementation-stage obligation.

The gate is a human decision gate. No stage output authorises
implementation, and per DEC-013 Rule 4 only `developer-implementation.md`
may modify the repository, after the gate.

Per DEC-011, this investigation is in the `Confirmed` state with a
reproducible defect, a validated root cause and a feasible remediation
path, so `Do Nothing`, `Monitor Only` and `Accept the Risk` are not
acceptable primary recommendations.

**Standing exposure while this remains open:** every import continues to
reset reviewed statuses, and where it lands in the same ISO week it erases
the evidence that a clash was approved. Nothing in the current build warns
the user. Documentation of this investigation is not a mitigation.

---
