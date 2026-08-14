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