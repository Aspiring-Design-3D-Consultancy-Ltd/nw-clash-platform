# DEC-010

Title:

Workflow State Automation

Status:

Approved

Date:

2026

Decision Type:

Governance Framework

Related Decisions:

- DEC-007
- DEC-008
- DEC-009

Extended By:

- DEC-011 (governs the required content of remediation recommendations once an investigation in the `Confirmed` state defined below has a reproducible defect, a validated root cause, and a feasible remediation path; DEC-010 remains Approved and unmodified)

Related Documents:

- GOV_ORCHESTRATOR.md
- WORKFLOW_ROUTING.md
- CURRENT_STATUS.md
- INVESTIGATION_LOG.md
- KNOWN_ISSUES.md

---

# Context

DEC-009 established the Governance Orchestrator and delegated responsibility for workflow progression to an automated governance process.

The governance framework now supports:

- automated workflow routing
- automatic role execution
- controlled decision gates
- investigation orchestration

However, investigations currently rely on implicit status determination.

A formal workflow-state model is required so that:

- investigations progress consistently
- governance status remains deterministic
- automation can determine next actions
- documentation remains synchronized with repository reality

---

# Problem Statement

Without standardized workflow states:

- investigations may become stuck
- workflow ownership becomes unclear
- documentation may drift
- automation cannot reliably determine next actions
- release readiness becomes ambiguous

An automated governance framework requires a consistent state model.

---

# Decision

A mandatory workflow-state lifecycle is adopted.

All investigations shall progress through defined states.

The Governance Orchestrator shall:

- assign states
- advance states
- validate state transitions
- identify invalid transitions
- stop workflow progression only at approved decision gates

---

# Workflow States

## State 1

### New

Description:

Issue has been identified.

No formal investigation has begun.

Entry Conditions:

- issue reported
- symptom identified
- potential defect observed

Permitted Next State:

```text
Under Investigation
```

---

## State 2

### Under Investigation

Description:

Evidence collection and evaluation are active.

Typical Roles:

- Project Analyst
- Architect
- QA Investigator

Entry Conditions:

- investigation officially opened
- workflow classification completed

Permitted Next States:

```text
Confirmed
Closed
```

---

## State 3

### Confirmed

Description:

Sufficient evidence demonstrates that:

- defect exists
- remediation required

Typical Roles:

- Architect
- QA Investigator
- Developer

Entry Conditions:

- evidence validated
- root cause identified

Permitted Next States:

```text
Implementation Approved
Closed
```

Governance Requirement:

While in this state, DEC-011 (Confirmed Defect Remediation) applies: since a reproducible defect, validated root cause, and feasible remediation path are all present by definition of this state, `Do Nothing`, `Monitor Only`, and `Accept the Risk` are not acceptable primary recommendations. The investigation must identify a preferred corrective action, any viable alternatives with risks/trade-offs, and a recommended implementation path before this state may resolve to `Implementation Approved`, `Deferred` (DEC-010 Special Workflow State), or `Monitoring` (DEC-010 Special Workflow State, valid only per DEC-011 Rule 2).

---

## State 4

### Implementation Approved

Description:

Governance review completed.

Remediation approved.

Implementation has not yet occurred.

Typical Roles:

- Developer Assessment
- Implementation Manager

Entry Conditions:

- approved remediation selected
- scope approved

Decision Gate:

```text
Human Implementation Required
```

Permitted Next State:

```text
Implemented
```

---

## State 5

### Implemented

Description:

Approved code changes completed.

Awaiting validation.

Typical Roles:

- Developer Implementation

Entry Conditions:

- implementation completed
- implementation evidence provided

Permitted Next States:

```text
QA Verified
Implementation Approved
```

---

## State 6

### QA Verified

Description:

Independent QA validation completed.

Implementation behaves as intended.

Typical Roles:

- QA Retest

Entry Conditions:

- regression coverage reviewed
- validation passed
- unrelated failures assessed

Permitted Next States:

```text
Steward Approved
Implemented
```

---

## State 7

### Steward Approved

Description:

Repository review completed.

Typical Roles:

- Repository Steward

Entry Conditions:

- repository hygiene acceptable
- scope compliance confirmed
- governance compliance confirmed

Permitted Next States:

```text
Release Approved
QA Verified
```

---

## State 8

### Release Approved

Description:

Investigation approved for release.

Repository changes ready for commit.

Typical Roles:

- Release Manager

Entry Conditions:

- QA approved
- Steward approved
- no release blockers

Decision Gate:

```text
Commit / Push Required
```

Permitted Next State:

```text
Closed
```

---

## State 9

### Closed

Description:

Investigation complete.

Repository state and governance state are aligned.

Entry Conditions:

- release completed
- documentation updated
- repository synchronized

Terminal State:

```text
Closed
```

---

# Special Workflow States

## Rejected

Description:

Investigation disproved.

No defect exists.

May transition directly from:

```text
Under Investigation
```

or

```text
Confirmed
```

when evidence invalidates findings.

Terminal State:

```text
Rejected
```

---

## Deferred

Description:

Issue acknowledged but intentionally postponed.

Examples:

- low priority
- resource constraints
- dependency on future work

Permitted Return State:

```text
Under Investigation
```

---

## Monitoring

Description:

Issue requires observation but no remediation.

Examples:

- MI-001
- MI-002

The issue remains active but does not enter implementation workflow.

Permitted Return State:

```text
Under Investigation
```

if evidence escalates.

---

# State Transition Rules

Valid Transition Example:

```text
New
↓
Under Investigation
↓
Confirmed
↓
Implementation Approved
↓
Implemented
↓
QA Verified
↓
Steward Approved
↓
Release Approved
↓
Closed
```

---

Invalid Examples:

```text
New
↓
Implemented
```

```text
Under Investigation
↓
Release Approved
```

```text
Confirmed
↓
Closed
```

without justification

The Governance Orchestrator shall reject invalid transitions.

---

# Documentation Requirements

State transitions must be reflected in:

## INVESTIGATION_LOG.md

Required:

- current investigation state
- completed stages
- pending stages

---

## CURRENT_STATUS.md

Required:

- active investigation summary
- repository status

---

## KNOWN_ISSUES.md

Required:

- issue classification
- resolution state
- monitoring state

For `Confirmed` defects specifically, see DEC-011 (Confirmed Defect Remediation) for the requirement that a preferred remediation recommendation (not indefinite monitoring) be produced.

---

# Automation Rules

The Governance Orchestrator may automatically transition states when sufficient evidence exists.

Examples:

```text
New
→ Under Investigation
```

```text
Under Investigation
→ Confirmed
```

```text
QA Verified
→ Steward Approved
```

---

The Orchestrator shall stop at decision gates:

```text
Implementation Approved
```

and

```text
Release Approved
```

because human repository actions are required.

---

# Repository Alignment Rule

Repository state always takes precedence over documentation state.

Example:

If:

```text
CURRENT_STATUS.md
```

shows:

```text
Release Approval Pending
```

but:

```text
git log
```

shows the fix committed and pushed,

then governance documents must be updated.

The Governance Orchestrator shall identify and report state drift.

---

# Success Criteria

Workflow State Automation is considered successful when:

- every investigation has a defined state
- state transitions are deterministic
- workflow progression is predictable
- governance documents remain synchronized
- automation can determine next actions without human role selection

---

# Final Decision

Adopt Workflow State Automation.

All future investigations shall use the state model defined in this document.

The Governance Orchestrator is responsible for enforcing workflow-state progression and identifying state drift.