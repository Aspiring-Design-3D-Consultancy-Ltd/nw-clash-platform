# Known Issues

## Purpose

This document tracks known issues, discoveries, risks, and investigation targets.

Items should be classified as:

- Under Investigation
- Confirmed
- Resolved
- Monitoring

No issue should be considered resolved until validated through the project governance workflow.

---

# Under Investigation

## KI-001: closeApp() Whitelist Drift

Status: Under Investigation

Source:

- Environment Steward
- Project Analyst
- Architect

Summary:

The application maintains a hardcoded `validKeys` whitelist within `closeApp()`.

Analysis identified multiple persisted keys that do not appear to be included within the whitelist.

Potentially affected areas include:

- Dedup Queue
- Review Queue
- Delta Analysis
- Assignee Roster
- Grid State

Potential Impact:

- Loss of persisted state
- Loss of user configuration
- Re-triggering of one-time migrations
- Loss of workflow history

Current Status:

- Issue identified
- Architectural risk assessed
- Independent QA verification pending

Approved Fix:

None

Implementation Status:

Not Started

---

# Confirmed

None currently recorded.

---

# Monitoring

## MI-001: Migration Complexity

Status: Monitoring

Summary:

Application contains multiple one-time migration mechanisms including:

- reviewQueueScopeFixed
- reviewQueueDateGuardFixed
- dedupInitialScan
- reviewQueueDeltaAnalysisMigrated

Risk:

Future changes may introduce migration-related regressions.

Current Action:

Monitor during future investigations.

---

## MI-002: Test Timing Sensitivity

Status: Monitoring

Summary:

Certain migration and initialization routines execute on delayed timers.

Examples include:

- Delta Analysis migration timers
- Pattern seeding operations

Risk:

Potential test flakiness and timing-related failures.

Current Action:

Monitor during QA investigations.

---

# Resolved

## RI-001: ReviewQueueBulkDelta Source Tagging

Status: Resolved

Summary:

Investigation confirmed correct behaviour for:

- source = ReviewQueueBulkDelta
- bucket isolation
- pendingReview cleanup

Regression Test:

tests/review-queue-bulk-delta-approve-source.spec.js

Resolution:

No production fix required.

Outcome:

Regression test added and committed.

Validation Status:

Passed