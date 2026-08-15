# Workflow Templates

Status:

Approved

Related Documents:

- DEC-007
- DEC-008
- DEC-009
- DEC-010
- DEC-011
- DEC-012
- GOV_ORCHESTRATOR.md
- WORKFLOW_ROUTING.md
- RELEASE_SNAPSHOTS.md

Purpose:

Define standard deliverable formats for all governance roles.

The Governance Orchestrator shall use these templates when producing governance reports.

Use of standardized templates ensures:

- consistent reporting
- easier reviews
- easier automation
- comparable investigations
- reusable governance workflows

---

# General Rules

All reports shall include:

- Investigation ID
- Title
- Role
- Date
- Status

All findings must be evidence-based.

Assumptions must be identified as assumptions.

Speculation must be clearly identified.

---

# Project Analyst Template

## Executive Summary

Overview of issue.

---

## Scope

Areas reviewed.

---

## Problem Statement

Description of observed issue.

---

## Impact Assessment

Potential impacts:

- user impact
- business impact
- repository impact

---

## Risk Assessment

Likelihood and severity.

---

## Classification Recommendation

Examples:

- Application Defect
- Persistence Defect
- Architecture Concern
- Documentation Issue
- Enhancement

---

## Priority Recommendation

Examples:

- Critical
- High
- Medium
- Low

---

## Recommended Next Action

---

## Recommendation

Proceed / Defer / Reject

---

# Architect Template

## Executive Summary

Architectural findings summary.

---

## Scope Reviewed

Components reviewed.

---

## System Analysis

Architectural observations.

---

## Root Cause Analysis

If applicable.

---

## Risk Matrix

Include:

- risk
- severity
- likelihood

---

## Design Considerations

Alternative solutions considered.

---

## Recommended Action

- No Action
- Investigation
- Remediation
- Enhancement

---

## Architecture Decision

Approved recommendation.

---

# QA Investigator Template

## Executive Summary

Investigation summary.

---

## Scope Reviewed

Files, workflows, behaviors examined.

---

## Test Methodology

Approach used.

---

## Evidence Collected

Observed results.

---

## Reproduction Results

Reproduction rate and consistency.

---

## Root Cause Findings

Validated findings only.

---

## Severity Assessment

Examples:

- Critical
- High
- Medium
- Low

---

## Recommendation

Investigation recommendation.

---

# Developer Assessment Template

## Executive Summary

Technical assessment summary.

---

## Technical Analysis

Code-level findings.

---

## Root Cause Confirmation

Agreement / disagreement with findings.

---

## Remediation Options

Option A

Option B

Option C

---

## Risk Assessment

Implementation risks.

---

## Required Changes

Files and areas impacted.

---

## Test Strategy

Required regression coverage.

---

## Recommended Solution

Preferred implementation.

---

# Implementation Manager Template

## Executive Summary

Implementation review summary.

---

## Scope Review

Validate proposed scope.

---

## Risk Assessment

Implementation risk.

---

## Option Review

Review of proposed solutions.

---

## Decision

Approved / Rejected

---

## Approved Scope

Explicitly identify:

- files
- systems
- boundaries

---

## Developer Instructions

Approved implementation guidance.

---

## QA Expectations

Retest expectations.

---

# Developer Implementation Template

## Executive Summary

Implementation summary.

---

## Files Changed

Complete list.

---

## Diff Summary

Summary of modifications.

---

## Scope Compliance

Confirmation of approved scope.

---

## Regression Coverage

Tests added or modified.

---

## Local Validation Results

Executed tests and outcomes.

---

## Outstanding Issues

If any.

---

## Implementation Status

Completed / In Progress

---

# QA Retest Template

## Executive Summary

Retest outcome.

---

## Diff Review

Verify approved implementation only.

---

## Scope Compliance Review

Validate scope restrictions.

---

## Test Execution Results

Executed test suites.

---

## Validation Results

Expected behavior verification.

---

## Regression Assessment

Regression evaluation.

---

## Failure Attribution

Classify failures:

- New
- Existing
- Unrelated

---

## Risk Assessment

Residual risk.

---

## QA Decision

PASS / FAIL

---

## Recommendation

Next workflow action.

---

# Repository Steward Template

## Executive Summary

Repository review summary.

---

## Scope Compliance Review

Verify approved scope only.

---

## Repository Hygiene Review

Review:

- files changed
- branch state
- commit readiness

---

## Governance Review

Verify:

- documentation alignment
- decision compliance
- workflow compliance

---

## Test Coverage Review

Assess adequacy.

---

## Risk Assessment

Repository-level concerns.

---

## Steward Decision

APPROVED

APPROVED WITH OBSERVATIONS

REJECTED

---

## Required Actions

If applicable.

---

# Release Manager Template

## Executive Summary

Release readiness summary.

---

## Implementation Review

Implementation status.

---

## QA Review

QA outcome summary.

---

## Repository Steward Review

Steward outcome summary.

---

## Release Risk Assessment

Evaluate release risk.

---

## Approval Status

APPROVED

CONDITIONAL APPROVAL

REJECTED

---

## Conditions

If applicable.

---

## Next Actions

Commit / Push / Documentation

---

# Confirmed Defect Remediation Recommendation Template

Reference:

DEC-011

Use whenever an investigation establishes a reproducible defect, a validated root cause, and a feasible remediation path (i.e. reaches the `Confirmed` workflow state (DEC-010) and stops at the `Implementation Required` decision gate (DEC-009)).

## Investigation

ID and title.

---

## Root Cause Summary

Confirmed findings only.

---

## Preferred Remediation

The recommended corrective action, with supporting rationale.

---

## Alternative Remediation Options

For each viable alternative: description, risks, and benefits.

---

## Risk Assessment

Risks and trade-offs of the preferred option versus alternatives, and of leaving the defect unremediated.

---

## Disposition

Implementation Approved / Deferred / Monitoring (Monitoring valid only per DEC-011 Rule 2)

---

# Documentation Update Template

## Executive Summary

Documentation updates required.

---

## Files Requiring Updates

Examples:

- CURRENT_STATUS.md
- INVESTIGATION_LOG.md
- KNOWN_ISSUES.md

---

## Required Changes

Detailed update list.

---

## Consistency Validation

Cross-document review.

---

## Recommended Final State

Post-update status.

---

# Investigation Closure Template

## Investigation

ID and title.

---

## Summary

Issue summary.

---

## Resolution

Resolution summary.

---

## Validation

QA outcome.

---

## Repository Status

Commit/push status.

---

## Documentation Status

Documentation updated.

---

## Closure Decision

Closed / Deferred / Monitoring

---

# Governance Orchestrator Template

## Executive Summary

Issue overview.

---

## Workflow Classification

Workflow selected.

Reference:

WORKFLOW_ROUTING.md

---

## Current State

Reference:

DEC-010

Current workflow state.

---

## Roles Executed

Completed governance stages.

---

## Findings Summary

Consolidated findings.

---

## Decision Gate Check

Determine whether a decision gate exists.

Examples:

- Implementation Required
- Repository Evidence Required
- Release Approval Required

If the gate is Implementation Required, apply DEC-011 (Confirmed Defect Remediation): the investigation must identify a preferred corrective action, viable alternatives with risks/trade-offs, and a recommended implementation path — `Do Nothing`, `Monitor Only`, and `Accept the Risk` are not acceptable primary recommendations once a reproducible defect, validated root cause, and feasible remediation path exist.

---

## Next Required Action

Automatic progression or human action.

---

## Workflow Status

Active / Waiting / Closed

---

# Release Snapshot Template

Reference:

DEC-012

Use whenever an investigation reaches the `Closed` workflow state (DEC-010) with a recorded release commit.

The full template lives in RELEASE_SNAPSHOTS.md ("Template" section) and is reproduced there rather than duplicated here to avoid documentation drift between the two files.

Summary of required sections:

- Repository State (branch, release commit, HEAD, working-tree/sync state)
- Governance State (active investigations, closed/released investigations, monitoring items)
- Investigation State (closure summary per INVESTIGATION_LOG.md)
- Test Baseline (total/passed/known failures)
- Release Status (released commit, approval reference, Closed/Released)

---

# Final Principle

All governance reports should be generated using these templates unless a documented exception exists.

Consistency is preferred over customization.

Template compliance supports:

- governance automation
- investigation traceability
- repository portability
- future project reuse