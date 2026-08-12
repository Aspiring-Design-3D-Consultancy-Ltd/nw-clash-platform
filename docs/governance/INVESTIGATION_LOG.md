# INV-002: closeApp() Whitelist Drift

Date:

2026

Status:

Confirmed

Roles Completed:

- Environment Steward ✅
- Project Analyst ✅
- Architect ✅
- QA Investigator ✅
- Developer ✅

Pending:

- Implementation Manager
- Release Manager

Summary:

Potential persistence-layer issue involving the validKeys whitelist used by closeApp().

Areas Reviewed:

- localStorage persistence
- Review Queue state
- Dedup Queue state
- Delta Analysis configuration
- Grid state
- Assignee roster
- Migration gate flags
- Audit history

Findings To Date:

Environment Steward:

- Identified multiple persisted keys not present within validKeys.

Project Analyst:

- Confirmed affected feature areas.
- Documented user impact and dependencies.

Architect:

- Classified issue as a state-management integrity defect.
- Assessed severity as high.
- Identified hidden coupling and whitelist maintenance risk.

QA Investigator:

- Independently verified whitelist contents.
- Independently verified persisted key inventory.
- Confirmed 18 active persisted keys are absent from validKeys.
- Confirmed closeApp() removes all non-whitelisted nw:* keys.
- Confirmed the issue through static analysis and independent verification paths.
- Identified zero automated regression coverage for closeApp() whitelist behaviour.

Confirmed Missing Keys:

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

- Independently confirmed QA findings.
- Confirmed issue scope is confined to closeApp().
- Identified working.html as the primary implementation target.
- Identified absence of automated regression coverage.
- Produced implementation assessment and risk review.
- Noted alignment with previously resolved persistence-scope issue addressed in commit 1e28df4.

Impact:

Potential loss of:

- User-authored configuration
- Dedup Queue state
- Review Queue state
- Grid state
- Migration state
- Audit history

Notably:

- dedupActionHistory
- dedupIncidentLog:20260713:v1

are currently removed by closeApp() despite equivalent protection existing in Selective Reset workflows.

Current Status:

Issue confirmed.

No implementation approved.

No production changes made.

Production Changes:

None.

Resolution:

Pending Implementation Review and Release Assessment.