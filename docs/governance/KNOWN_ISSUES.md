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

Root Cause:

The allow-list model required every persisted key to be manually maintained within `closeApp()`.

As application features evolved, persisted keys were added elsewhere in the codebase but not added to the allow-list.

The result was silent deletion of valid application state.

Approved Remediation:

The allow-list model was replaced with an explicit removal-list model (`DEFUNCT_KEYS`).

Implementation Status:

✅ Completed

QA Retest Status:

✅ PASS

Repository Steward Review:

✅ Approved With Observations

Regression Protection:

Added:

- tests/close-app-scope-fix.spec.js

Validation Results:

- close-app-scope-fix.spec.js → 3 / 3 Passed
- Combined persistence validation suite → 12 / 12 Passed

Outcome:

The defect has been resolved and verified.

Future persisted keys now survive `closeApp()` by default, eliminating the original whitelist-drift failure mode.

---

## KI-002

Title:

Data Resurrection After Reset

Status:

Resolved

Severity:

High

Related Investigation:

- R1

Summary:

`clearAll()` and `_executeSelectiveReset()` removed persisted `nw:*` localStorage keys but left corresponding in-memory `S.*` state intact.

Subsequent persistence operations could therefore write stale values back into localStorage, causing deleted data to reappear after the reset operation had completed.

Affected Areas:

- Clash Register
- Weekly Snapshots
- Dedup Queue
- Review Queue
- Levels
- Grids
- Settings
- ISO Configuration
- Admin PIN

Root Cause:

The reset workflows only removed persisted state.

In-memory state remained populated, creating divergence between application memory and localStorage.

Any subsequent persistence operation that saved `S.*` back to storage could unintentionally resurrect previously deleted data.

Approved Remediation:

Synchronize in-memory state with persisted-state deletion during reset operations.

Implementation includes:

- Factory-default `_RESET_DEFAULT_ISO`
- Memory synchronization in `clearAll()`
- Memory synchronization in `_executeSelectiveReset()`
- Category-aware selective reset handling

Implementation Status:

✅ Completed

QA Retest Status:

✅ PASS

Repository Steward Review:

✅ Approved With Observations

Release Manager Status:

✅ Conditional Approval Granted

Regression Protection:

Added:

- tests/r1-data-resurrection.spec.js

Coverage includes:

- clearAll() memory synchronization
- clearAll() resurrection prevention
- Selective reset memory synchronization
- Selective reset resurrection prevention
- Category symmetry validation

Validation Results:

- r1-data-resurrection.spec.js → 10 / 10 Passed
- Combined persistence validation suite → 22 / 22 Passed

Outcome:

The defect has been resolved and verified.

Previously cleared data can no longer be unintentionally resurrected through subsequent persistence operations.

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
- KI-002 — Data Resurrection After Reset ✅

Monitoring Items:

- MI-001 — Migration Complexity
- MI-002 — Test Timing Sensitivity

Confirmed Issues:

- None

Active Investigations:

- None