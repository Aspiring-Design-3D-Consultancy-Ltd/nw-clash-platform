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


