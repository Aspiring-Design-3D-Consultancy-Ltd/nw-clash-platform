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