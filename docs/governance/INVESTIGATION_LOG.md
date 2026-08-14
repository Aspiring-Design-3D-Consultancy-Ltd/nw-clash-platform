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
- Governance documentation requires workflow-state updates to remain aligned with implementation progress.

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

Implemented — Awaiting Human Decision (Commit / Push Authorization)

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

Roles Pending:

- Final Release Approval (blocked — human decision gate: commit/push authorization)

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

Human Decision:

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

Implementation complete and QA-verified. Ready for commit/push pending human authorization.

Implementation Review:

Completed — Option C applied to both `dedupInitialScan` and `reviewQueueDeltaAnalysisMigrated` wrappers in working.html.

QA Review:

PASS — 69/69 on combined targeted validation; new regression suite 4/4.

Repository Steward Review:

APPROVED WITH OBSERVATIONS.

Release Risk Assessment:

Low. Change is minimal, additive, and scoped to two one-shot migration gate wrappers already covered by new regression tests. Pattern is identical in shape to two previously-released remediations (INV-003, INV-005).

Approval Status:

CONDITIONAL APPROVAL — approved for commit/push pending human authorization per DEC-009 (repository write actions require human authorization).

Next Actions:

Awaiting human authorization to commit and push:

- working.html
- tests/inv006-asym.spec.js
- docs/governance/CURRENT_STATUS.md
- docs/governance/INVESTIGATION_LOG.md
- docs/governance/KNOWN_ISSUES.md

Decision Gate Status:

STOPPED — awaiting human decision at:

- Commit / Push Authorization (per DEC-009, repository write actions require human authorization)

Repository code has been modified in the working tree (`working.html`, `tests/inv006-asym.spec.js`) and governance documentation updated, but nothing has been committed or pushed.


