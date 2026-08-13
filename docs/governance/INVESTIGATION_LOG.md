# INV-002: closeApp() Whitelist Drift

Date:

2026

Status:

Resolved - Release Approval Pending Commit

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

Pending:

- Final Release Approval
- Commit and Push
- Governance Status Updates

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

Awaiting final release sign-off and commit/push.

Production Changes:

Not yet committed at time of record update.

Working tree contains:

- working.html
- tests/close-app-scope-fix.spec.js

---

# R1: Data Resurrection After Reset

Date:

2026

Status:

Resolved - Release Approval Conditional Pending Documentation Commit

Roles Completed:

- Developer ✅
- QA Retest ✅
- Repository Steward Review ✅
- Release Manager ✅

Pending:

- Governance Documentation Commit
- Final Release Approval
- Commit and Push

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

tests/r1-data