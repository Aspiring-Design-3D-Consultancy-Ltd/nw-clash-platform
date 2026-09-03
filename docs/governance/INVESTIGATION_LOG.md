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
# INV-009: ORPHAN-IDB-SWEEP Deletes the Image Database Under the In-Flight Register Migration

Date:

Defect observed and remediated 2026-08-26 (recovery tooling merged 2026-09-02). Investigation record written retrospectively 2026-09-03.

Status:

Closed - Released (retrospective record — see "Governance Observation" below).

Workflow:

Workflow A (Persistence Defect). The remediation ran through pull-request review (#64, #65, #66) without an investigation being opened in this ledger. This entry was produced under Workflow E (Documentation Issue — missing investigation record) and reconstructs the evidence from the merged commit messages, pull-request descriptions, the code markers in `working.html`, and the regression tests those PRs added. Where a statement below is reconstructed rather than directly re-observed in this session, it is attributed to its source.

Roles Completed (reconstructed):

- QA Investigator ✅ (trace and clean-profile reproduction — recorded in commit `9a0007e`)
- Architect ✅ (root cause and remediation design — recorded in commits `9a0007e`, `d996b8d`)
- Developer Implementation ✅ (`9a0007e`, `d996b8d`, `43705e0`)
- QA Retest ✅ (full-suite counts recorded per PR: 326 → 330 → 338 passed; re-verified 2026-09-03, see "QA Retest" below)
- Repository Steward Review ✅ (pull-request diff review by the repository owner before each merge)
- Release Manager ✅ (merged to `main` by the repository owner)
- Governance record ⚠️ written after release, not before — see "Governance Observation"

Primary Scope:

- working.html: `initAuth()` hydration order, `_recInit()` (IDB-RECORDS-MIGRATION), `initNwImages()` ORPHAN-IDB-SWEEP block, the verify-then-gate migration step, Data Manager (IMG-REATTACH-ARCHIVE)
- tests/idb-records-migration.spec.js
- tests/img-reattach-archive.spec.js

Trigger:

Immediately after IDB-RECORDS-MIGRATION (`ef3d620`, PR #63) was deployed, the live profile reported `verify failed for nw:clashes` during the register migration and the stored clash images were gone. The register itself was not lost (verify-then-gate aborted with every original intact), but `NWClashImages` had been deleted.

---
## Executive Summary

A destructive, irreversible defect: on every launch during the migration window, `ORPHAN-IDB-SWEEP` could call `indexedDB.deleteDatabase('NWClashImages')` while the register migration was writing into that same database. Root cause was an await-ordering regression introduced by PR #63, not a data or encoding problem. Remediated by a positive register-hydration signal that the sweep must observe before it is allowed to delete anything (PR #64). During the same recovery a second, independent hazard was found and fixed: on a profile at 100% of the localStorage cap the 1-byte migration gate write itself threw `QuotaExceededError`, so the migration could never complete on the only profile it exists to rescue (PR #65). A recovery tool that re-attaches a week's images from its archive folder without touching the register shipped as PR #66.

---
## Evidence Collected

Source: commit `9a0007e` message and PR #64 description.

- Ruled out first: encoding, structured clone, payload size. A 4.3 MB register round-trips byte-identically through the `records` store, and eleven content pathologies were tested and all matched.
- `initAuth()` previously assigned `S.clashes` synchronously ahead of its first `await`. PR #63 inserted `await _recInit()` before that assignment.
- `window.onload` does not await `initAuth()`. `initNwImages()` therefore ran during the new window, observed `S.clashes === []` — meaning "not loaded yet", not "empty" — combined that with image metadata being present, treated it as the `ORPHAN-IDB-SWEEP` precondition, and called `deleteDatabase()` on the database the migration was writing to.
- Traced at approximately 664 ms after load; reproduced from a clean profile.

Source: commit `d996b8d` message and PR #65 description.

- On a profile at 100% of the localStorage cap there was no room for even the 1-byte gate value; `setItem('nw:idbRecordsMigrated','1')` threw `QuotaExceededError`.
- A gate-write failure previously threw out of `_recInit()`, sending it into fallback. Fallback reads localStorage — which by then could be empty — so the user would have been shown an empty register while their data sat safely in IndexedDB.

---
## Root Cause Findings

1. **[Certain, from source] Await-ordering regression.** The `ORPHAN-IDB-SWEEP` guard used `S.clashes.length === 0` as its "register is empty" precondition. That was safe when `S.clashes` was populated synchronously before any other `window.onload` work could observe it. PR #63 made hydration asynchronous without giving the sweep a way to distinguish "not yet loaded" from "empty". Deletion is irreversible, so an ambiguous precondition is not acceptable for it.

2. **[Certain, from source] Gate write at full quota.** The migration copied, read back and byte-compared every routed key, then wrote the gate, then deleted the originals. On a profile that is full — the exact profile the migration exists for — step two cannot succeed.

---
## Severity Assessment

High. Irreversible deletion of the user's image store, triggered automatically on launch, on the profile class the feature was built to rescue. The register was protected by verify-then-gate and was not lost.

---
## Remediation

### PR #64 — `9a0007e` — IDB-RECORDS-VERIFY-RACE

- A register-hydration signal (`_registerHydrated` / `_registerReady`) is raised on both `initAuth()` hydration paths.
- `ORPHAN-IDB-SWEEP` waits for it (4-second grace) and requires it before sweeping. If hydration has not happened in time, the sweep is skipped for that launch and a console warning says so, rather than deleting a database whose register state is unknown. Failing to sweep costs a stale image count; sweeping wrongly costs the user's images.
- Verify-then-gate unchanged: same comparison, same abort, same ordering, one gate-set site, one verify-throw site. Only the failure message was enriched to distinguish a vanished record from a content mismatch.
- Regression tests added (tests/idb-records-migration.spec.js): a register migrates cleanly while image metadata is present (the live-profile defect); a multi-MB register survives the round trip and verifies; ORPHAN-IDB-SWEEP still fires when the register is genuinely empty; the register-hydrated signal is raised on both initAuth paths.
- Full suite at merge: 326 passed.

### PR #65 — `d996b8d` — IDB-RECORDS-GATE-QUOTA

- The two post-verification steps are swapped: verified originals are deleted first (freeing ~9.7 MB on the live profile), and the gate is written into that space.
- Nothing destructive happens until every routed key has been copied, read back and byte-compared; a throw there still leaves every original intact and the gate unset.
- Crash window (originals deleted, gate unwritten): the next boot re-enters the migration, `getItem` returns null for those keys and the loop continues without ever calling `_idbPutRecord` for a key it did not read, so an empty localStorage cannot overwrite the verified records store. The gate is then written with an empty `moved` and the register loads from records.
- The gate write is now non-fatal and reported instead of throwing into fallback.
- A profile left by the previous ordering with the gate set and originals still present is detected and reported, not auto-deleted, because those keys may hold newer data written during a fallback session.
- Regression tests added: migration at exactly-full quota completes; a simulated crash between delete and gate-set loses nothing and the next boot recovers; an empty localStorage with the gate unset never overwrites a populated records store; a gate-write failure is not fatal and does not trigger fallback.
- Full suite at merge: 330 passed.

### PR #66 — `43705e0` — IMG-REATTACH-ARCHIVE (recovery tooling)

- Data Manager gains "Re-attach images from archive folder": pick one week's archive folder and its images are restored through the existing `loadNwImages` pipeline (bounded concurrency and dHash-on-store both apply).
- The report/`_files` matcher was factored out of `importFolderPick` into three helpers (`_bifBucketFolderFiles`, `_bifSniffXmlFiles`, `_bifMatchImageJobs`) — one definition, two callers.
- Images only, by construction: never calls `importToRegister`, never parses an XML body, writes nothing to clashes, weekly, snapshots or dedup state. Asserted by a test that byte-compares the records store and every `nw:*` key before and after.
- Idempotent: re-running a week replaces that week's mapping rather than duplicating it.
- Known limitation stated in the PR: superseded IDB image records from a previous run are left behind — this is the orphan-record backlog now tracked as MI-003.
- 8 regression tests (tests/img-reattach-archive.spec.js); full suite at merge: 338 passed.

---
## QA Retest

Per-PR full-suite results at merge time are recorded above (326 / 330 / 338 passed, each with the same 2 pre-existing `frozen-week-and-chart-year.spec.js` failures, which are now the subject of INV-010).

Re-verification on `main` at `dd87585` on 2026-09-03 (`cd tests; PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --workers=1`): see the RS-002 test baseline in RELEASE_SNAPSHOTS.md.

---
## Residual Risk and Follow-ups

- **MI-003** — orphaned IndexedDB image records (PR #63 reported 63,178 image records against roughly 3,670 restorable; PR #66 adds superseded records on every re-run). Audit before any cleanup. Nothing has been wiped.
- **MI-001** — the migration gate set now includes `nw:idbRecordsMigrated`, and the routed write path (`sv()` → debounced flush → IndexedDB) is a new ordering-risk class. MI-001 updated accordingly.
- Images lost on the affected profile before PR #64 are recoverable only from the weekly archive folders via the PR #66 tool.

---
## Governance Observation

A data-loss incident and three remediation PRs shipped between 2026-08-26 and 2026-09-02 while CURRENT_STATUS.md continued to report "No active investigations" and KNOWN_ISSUES.md recorded no confirmed issue. The PR descriptions carried the investigation content; the ledger did not. The Governance Orchestrator's "New Issue" entry condition applies to defects discovered during feature work, not only to user-reported ones. No new decision record is proposed (DEC-008: avoid speculative governance expansion) — the existing rules already cover this case; they were not followed. This retrospective entry, KI-007, MI-003, the CHANGE_LOG entries for PRs #59–#66, and RS-002 close the gap.

---
## Final Release Status

Released.

Commits (all on `main`):

- `9a0007e` — Stop ORPHAN-IDB-SWEEP deleting the DB under the in-flight migration (IDB-RECORDS-VERIFY-RACE) (#64)
- `d996b8d` — Delete verified originals before writing the migration gate (IDB-RECORDS-GATE-QUOTA) (#65)
- `43705e0` — Re-attach images from an archive folder (IMG-REATTACH-ARCHIVE) (#66), merged via `f6a9332`

Status: Committed and pushed. Investigation closed (retrospectively recorded).

---

# INV-010: Persistent CHART-PERIOD-YEAR-AWARE Failures in frozen-week-and-chart-year.spec.js

Date:

Opened 2026-09-03.

Status:

Closed - Released (test-harness defect; no application change). Opened and closed 2026-09-03.

Workflow:

Workflow C (Test Failure).

Primary Scope:

- tests/frozen-week-and-chart-year.spec.js — `CHART-PERIOD-YEAR-AWARE — default range spans a year boundary correctly` and `CHART-PERIOD-YEAR-AWARE — resetChartRange restores full range and clears manual narrowing`
- working.html: chart period default/reset logic (`CHART-DEFAULT-W14`, `CHART-PERIOD-YEAR-AWARE` marker blocks and `resetChartRange`)

Trigger:

The same two tests have failed on every recorded full-suite run from the INV-008 QA Retest (2026-08-15, 286/288) through PR #66 (2026-09-02, 338 passed + 2 failed). Each time they were classified as "pre-existing, date-boundary-dependent chart-range flakiness, reproduced on the unmodified baseline" and excluded from the change under review. Nobody has root-caused them. INV-007's own risk note — genuine regressions masked by "known flaky" pattern-matching — applies directly: a failure that is red on every run for three weeks is not flaky, it is failing.

Questions to answer:

1. Does the failure depend on the wall-clock date (a test that only passes in certain ISO weeks), on seeded data, or on application logic?
2. If date-dependent: is the test's expectation wrong, or does the chart range logic misbehave near a year boundary in a way a user would see?
3. Does the test-harness sequencing fix from INV-007 (KI-005) apply to this spec's bootstrap?

---
## Reproduction Results

Reproduced in headless Chromium (Playwright 1.62.1, system Chromium) against `working.html` at `dd87585` with a standalone script performing exactly the spec's bootstrap and seeding:

| Step | Observation |
| --- | --- |
| After bootstrap (nw:* cleared, auth bypassed) | `S.clashes.length` = 104, `S.projName` = "My Project", clash dates 06/01/25 → 27/01/25, `S.weekly` weeks = [1, 2, 3, 4] (the demo dataset, still in memory) |
| Seed the spec's five `S.weekly` entries, `nav('dashboard')` | `_chartFrom` = 202502, `_chartTo` = 202628, `S.weekly` = [202502, 202503, 202504, 202505, 202541, 202552, 202601, 202614, 202628], `getDisplayWds().length` = 9, `_platformWeeks()` = [] |
| Same, but with `S.clashes = []` first | `_chartFrom` = 202541, `_chartTo` = 202628, `S.weekly` = [202541, 202628], `getDisplayWds().length` = 2 — the spec's exact expectations |

The failure is deterministic. It does not depend on the wall-clock date; the spec's year values are hard-coded and the extra weeks come from the demo register's January 2025 dates.

---
## Root Cause Findings

**[Certain] Test-harness isolation gap, not an application defect.** The spec's `beforeEach` removes every `nw:*` localStorage key and bypasses auth, but does not reset the in-memory `S.clashes`. The demo dataset (104 clashes dated 06–27 Jan 2025) therefore remains loaded. `rDash()` begins with `regenWeeklyFromRegister()`, which — per `WEEKLY-SNAP-PER-CLASH-BUCKET` — adds one snapshot per ISO week that contains at least one clash. Four demo weeks (2025-W02..W05) are prepended to the seeded weeks, and `CHART-PERIOD-YEAR-AWARE`'s "default range = oldest → newest weekly entry" correctly reports 2025-W02 as the oldest. The application did exactly what its documented rule says; the fixture asked it a question with hidden extra input.

This is the same class of gap INV-007 / KI-005 closed for `batch-import-folder.spec.js`, `weekly-incremental-import.spec.js` and `weekly-summary-screenshot.spec.js`, where the fix was an explicit in-memory `S.clashes = []` reset. This spec did not receive it.

**Why the "date-boundary flakiness" label stuck.** Every PR since INV-008 ran the full suite, saw these two failures, confirmed they also failed on the unmodified baseline, and classified them as pre-existing. Each individual classification was correct — they were pre-existing — but "pre-existing" was read as "flaky" and no one asked why a deterministic failure would be date-dependent. The register-hydration and dashboard-regeneration changes of the same period (`PR-A-ALWAYS-RECONSTRUCT`, `WEEKLY-SNAP-PER-CLASH-BUCKET`, INV-007) all landed in the same build-stamp commit as the spec (`3599a8b`, 2026-08-04), so `git log -S` cannot separate which landed first. It does not matter for the remediation.

**Application logic verified correct.** `rDash()` default range, `getDisplayWds()`, `resetChartRange()` and the `_platformWeeks()` fallback all behaved as documented in the reproduction. No `working.html` change is warranted.

---
## Remediation

Test-file-only, mirroring INV-007:

- `tests/frozen-week-and-chart-year.spec.js` `beforeEach`: add `S.clashes = []; S.weekly = [];` after the auth bypass, with a comment citing INV-010. The two FROZEN-WEEK tests already overwrite both fields; the CHART-XAXIS test uses neither.

QA Retest: `frozen-week-and-chart-year.spec.js` with `--repeat-each=3` → 15/15 passed (previously 2 of 5 failed on every run). Full-suite result recorded in CURRENT_STATUS.md "Test Baseline — 2026-09-03 (post-INV-010)".

Tracked as: KI-009 (Resolved).

---
## Final Release Status

Test-only remediation committed on `claude/app-progress-issues-04app5` (see CHANGE_LOG.md 2026-09-03). No application code changed; no release snapshot required until the branch merges to `main`, at which point the next snapshot's test baseline should read 340 / 340.

Investigation closed.

---

# INV-011: Orphaned IndexedDB Image Records — Mechanism, Cleanup and Root Cause

Date:

Opened 2026-09-03 on the live-profile audit result. Remediation implemented the same day.

Status:

Closed - Released (pending merge of the remediation PR; test-only and code changes recorded below).

Workflow:

Workflow A (Persistence Defect). Escalated from MI-003 by Shane's ruling after the audit proved the orphans regenerate rather than being a one-off residue.

Trigger:

`_auditNwImageStore()` (IMG-STORE-AUDIT, PR #67) run on the live profile on 2026-09-03:

```
[IMG-STORE-AUDIT] 81451 keys; metadata imgfix-v1, count 4768, 13 tests;
referenced 4768, orphaned 76682 in 4 runs, missing 0, overlapping 0, non-numeric 0;
referenced 171.4 MB / orphaned 2872.8 MB.
```

Four in five records in the store are unreachable, and they hold 94% of the payload.

---
## Root Cause Findings

**[Certain, from source] `loadNwImages` strands the previous range on every re-load of a test name.** The function keys the per-test tracker `_nwImgByTest` by `testName` — the report filename without extension (`baseName`), which is what `importFolderPick` and `reattachImagesFromArchive` both pass. On re-load it deletes that entry, computes `nextIdx` as the end of the highest *remaining* range, writes the new images from there, and rewrites the metadata block (`byTest`) to point at the new range. Nothing deletes the old range's records. They remain in IndexedDB as numeric keys no `byTest` range covers, which is exactly the class the audit calls orphaned.

**[Certain, from source] A weekly folder import re-loads every test.** `importFolderPick` calls `loadNwImages(matchedImages, baseName)` once per report in the folder. The weekly archive folders carry the same 13 report names each week, so each weekly import re-loads all 13 names and strands the whole previous week's set (about 4,768 records) in one contiguous block above the ranges that survive.

**[Likely, inferred from the audit] 76,682 orphans in 4 runs ≈ 16 stranded import cycles.** Consecutive weekly imports strand adjacent blocks, which the run detector merges into one run; a run boundary appears wherever a surviving referenced range or a partial re-load (archive re-attach, single-test re-load) sits between two stranded blocks. Four runs is consistent with six weekly imports plus re-attach and re-load activity since 26 Aug. The audit does not record per-run sizes; the mechanism does not depend on the exact count.

**[Certain, from source] The orphans are already unreachable.** Every image lookup goes through the composite key `rawTestName::nwImageRef` into `_nwImages`, which `initNwImages` rebuilds from `byTest` only. The positional fallback (`IMG-POS`) also reads `_nwImgByTest`. No code path can reach a record outside the current ranges, so deleting orphans cannot change what any user sees.

---
## Why the Metadata Shows 13 Tests After Six Weekly Imports (Ruling 3)

**[Certain, from source]** `byTest` is keyed by test name alone, and a re-load replaces the entry. The metadata therefore holds exactly one range per distinct report name — the most recently loaded week's — and 13 is the number of distinct report names across the FAB and CUP folders, not the number of test-weeks imported. Older weeks' images for the same name are the orphans above.

**[Likely, from source; not reproduced against the live data]** This is also the mechanism behind missing or wrong images on W33/W34 clashes:

- `IMG-REF-REFRESH` updates a clash's `nwImageRef` and `testIdx` to the newest export's values only when the clash is re-detected in that import. A clash last observed in W33 keeps its W33 filename.
- Lookups resolve that filename against the newest week's file set for the same test name. Navisworks renumbers `cdNNNNNN.jpg` per export, so the W33 filename either points at an unrelated W36 viewport (wrong image) or, if the W36 export has fewer files, at nothing (placeholder). `IMG-POS` cannot rescue it: the positional fallback only fires when the test's image count equals its clash count, which is rarely true once clashes from earlier weeks persist in the register.

Cleaning up orphans does not change this either way, because those records were already unreachable. Making earlier weeks' images reachable again is a design change — image sets keyed by test name **and** week, with lookups choosing the week the clash was last observed in (`weekTag`).

Follow-up (2026-09-03): shipped as IMG-WEEK-KEYING under DEC-016 (Option A). Live-profile migration output to be recorded here when run:

```
await _imgWeekKeyingMigrate()               // dry run
await _imgWeekKeyingMigrate({dryRun:false}) // apply
```

---
## Remediation (IMG-ORPHAN-CLEANUP, this PR)

1. **Shared classifier.** `_classifyNwImageKeys(keys, meta)` now holds the referenced/orphaned/missing/overlapping logic. `_auditNwImageStore` and the new cleanup both call it, so the report and the delete can never disagree about what "orphaned" means. Audit output is unchanged.

2. **Cleanup tool, console-callable, dry run by default.**

   ```js
   await _cleanupNwImageOrphans()               // dry run: reports what would be deleted, changes nothing
   await _cleanupNwImageOrphans({dryRun:false}) // delete mode
   ```

   Delete mode removes exactly the keys the classifier calls orphaned (never key 0, never a referenced key), in batches of 500 per transaction, then re-reads the store and verifies that every referenced key is still present and the metadata block is intact before reporting `verified: true`. It refuses to run under `nw:pendingIdbWipe`, while `_dhashBackfill` is mid-pass (the backfill also yields to it, so neither can re-put a key the other is deleting), and when there is no metadata block at all — a store with no `byTest` ranges has no provable referenced set to protect, and `clearNwImageStore` exists for that case.

3. **Root cause, contained.** `loadNwImages` remembers the range it is superseding, and after the new metadata write has landed deletes every slot of that range that no current range (its own new one included) still covers. If the metadata write fails, nothing is deleted, because the old metadata still points at the old slots. The load result gains a `superseded` count. Single function plus one helper (`idbDeleteKeys`), no change to key allocation, so the folder import, the archive re-attach and the per-test loader all inherit it.

Regression protection — `tests/img-orphan-cleanup.spec.js` (9):

- dry run changes nothing; delete mode removes exactly the orphans and leaves referenced records and key 0 byte-identical with verification passing; refuses with no metadata, under a pending wipe, and during a backfill; audit and cleanup agree on the orphan set.
- re-loading a non-highest test deletes its superseded slots; re-loading the highest range with fewer images overwrites in place and deletes the tail; a failed metadata write keeps the old records; three simulated weekly imports of three tests leave zero orphans.

Image-layer and IndexedDB specs re-run green (84 tests across 9 spec files). Full-suite result in CURRENT_STATUS.md.

---
## Next Action for the Live Profile (Shane)

After deploying the merged build:

1. `await _cleanupNwImageOrphans()` — confirm the dry run reports 76,682 (or thereabouts) to delete and 4,768 kept.
2. `await _cleanupNwImageOrphans({dryRun:false})` — expect `verified: true`, `referencedAfter: 4768`, `orphanedAfter: 0`.
3. `await _auditNwImageStore({sample:0})` — expect 4,769 keys.

Live-profile run (Shane, 2026-09-03, build `92246f5`):

```
[IMG-DHASH-PHASE1] backfill: 0 hashed, 80590 already had a hash, 860 failed, of 81450 images in 11455ms
[IMG-ORPHAN-CLEANUP] dry run: 81451 keys, 4768 referenced (kept), 76682 orphaned in 4 runs would be deleted (keys 1..78453). Nothing was changed.
[IMG-ORPHAN-CLEANUP] deleted 76682 orphaned records; referenced 4768 → 4768, orphaned remaining 0; verification PASSED
[IMG-STORE-AUDIT] 4769 keys in images store; metadata present (imgfix-v1, count 4768, 13 tests); referenced 4768, orphaned 0 in 0 runs, missing 0, overlapping 0, non-numeric keys 0.
```

Per-test ranges after cleanup (all 13 fully present, missing 0): `99_ESMC_v_08_AMHS` 1,766 images at 73691; the eleven current weekly tests contiguous from 78454; two older ranges that were never re-loaded and therefore survived every import — `Exyte AAS_v_08_AMHS` (2 images at 45841) and `12_GMS_v_14_CCD` (3 at 48661). Those two surviving ranges, plus the gap between `99_ESMC` and the weekly block, are what split the stranded set into exactly four runs.

Observations from the run, not acted on:

- [Likely] The backfill's 860 "failed" were orphan records with an empty or unreadable payload; the referenced set is fully indexed and read no payloads. They were inside the deleted set. The next launch's backfill should read `0 hashed, 4768 already had a hash, 0 failed` with no payload reads.
- Three test names carry `AHMS` where the others carry `AMHS` (`04_CHEM`, `05_WWT`, `06_UPW`). They are distinct names to the app and Navisworks alike. Not a defect in this platform; worth correcting at source if those tests are ever renamed, since a rename would re-load them under the new name and orphan the old range (now cleaned up automatically).

---
## Final Release Status

Released. Merge commit `5f339ff` (PR #68), `main` head `92246f5` after the build stamp. Tracked as KI-010 (Resolved). MI-003 closed on the live-profile run above.

Closed 2026-09-03 on Shane's confirmation: dry run 76,682 / 4,768 as predicted; delete verification PASSED, referenced 4,768 → 4,768, orphaned 0; post-audit 4,769 keys, 0 orphaned, 0 missing.

Investigation closed.

---

