# Known Issues

## Purpose

Track confirmed defects, active investigations, monitoring items, and resolved issues.

This document provides a consolidated view of project risks and known problem areas.

The repository remains the authoritative source of project status.

---

# Status Definitions

## Under Investigation

Issue has been identified and is currently being investigated.

Evidence collection and verification are in progress.

## Confirmed

Issue has been verified and reproduced.

Implementation has not yet been completed.

## Monitoring

No active defect is confirmed.

Area requires ongoing observation due to complexity, historical issues, or elevated regression risk.

## Resolved

Issue has been remediated and verified.

Regression protection has been implemented where appropriate.

---

# Resolved Issues

## KI-001

Title:

closeApp() Whitelist Drift

Status:

Resolved

Severity:

High

Related Investigation:

- INV-002

Summary:

The application previously used a hardcoded `validKeys` allow-list within `closeApp()`.

Investigation confirmed that 18 actively-used persisted `nw:*` keys were absent from the allow-list and were being unintentionally deleted whenever a user performed a normal application close operation.

Affected areas included:

- Dedup Queue
- Review Queue
- Delta Analysis
- Assignee Roster
- Grid State
- Migration Flags
- Audit History

Confirmed affected keys:

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

Root Cause:

The allow-list model required every persisted key to be manually maintained within `closeApp()`.

As application features evolved, persisted keys were added elsewhere in the codebase but not added to the allow-list.

The result was silent deletion of valid application state.

Approved Remediation:

The allow-list model was replaced with an explicit removal-list model (`DEFUNCT_KEYS`).

The new implementation:

- Preserves active persisted keys by default
- Removes only confirmed legacy/orphaned keys
- Mirrors the previously approved `CLEAR-ALL-DATA-SCOPE-FIX` remediation pattern

Implementation Status:

✅ Completed

QA Retest Status:

✅ PASS

Repository Steward Review:

✅ Approved With Observations

Regression Protection:

Added:

- tests/close-app-scope-fix.spec.js

Coverage includes:

- Preservation of all 18 previously affected keys
- Preservation of existing persisted keys
- Removal of legacy/orphaned keys
- Confirm-cancel behaviour
- Future unknown-key survival behaviour

Validation Results:

- close-app-scope-fix.spec.js → 3 / 3 Passed
- Combined persistence validation suite → 12 / 12 Passed

Outcome:

The defect has been resolved and verified.

Future persisted keys now survive `closeApp()` by default, eliminating the original whitelist-drift failure mode.

---

# Monitoring

## MI-001

Title:

Migration Complexity

Status:

Monitoring

Description:

Several one-time migration flags remain part of the application's persistence model.

Examples include:

- reviewQueueScopeFixed
- reviewQueueDateGuardFixed
- dedupInitialScan
- reviewQueueDeltaAnalysisMigrated
- dedupRetroCleanup:v1

While functioning correctly, migration behaviour remains an area of elevated regression risk due to the complexity of historical state transitions.

Potential Risks:

- Re-running migrations unexpectedly
- Migration ordering issues
- State corruption during version transitions
- Future persistence refactoring impacts

Recommended Action:

Continue monitoring during future persistence-related investigations and test development.

---

## MI-002

Title:

Test Timing Sensitivity

Status:

Monitoring

Description:

Certain Playwright tests continue to exhibit timing-related behaviour associated with:

- Delayed startup tasks
- Migration execution timers
- IndexedDB initialization
- Persistence synchronization
- Asynchronous UI initialization

Potential Risks:

- Test flakiness
- Intermittent failures
- False-positive regression reports

Recommended Action:

Continue monitoring and improve test stability when future investigations involve startup sequencing or persistence workflows.

---

# Confirmed Issues

None currently recorded.

---

# Under Investigation

None currently recorded.

---

# Summary

Resolved Issues:

- KI-001 — closeApp() Whitelist Drift ✅

Monitoring Items:

- MI-001 — Migration Complexity
- MI-002 — Test Timing Sensitivity

Confirmed Issues:

- None

Active Investigations:

- None