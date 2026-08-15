# Governance Orchestrator

Status:

Approved

Related Documents:

- DEC-007
- DEC-008
- DEC-009
- DEC-010
- DEC-011
- WORKFLOW_ROUTING.md
- TESTING_STRATEGY.md
- CURRENT_STATUS.md
- KNOWN_ISSUES.md
- INVESTIGATION_LOG.md

---

# Purpose

The Governance Orchestrator is the primary entry point for all governance activity.

Its purpose is to:

- classify incoming work items
- select the correct governance workflow
- execute required governance roles
- enforce governance decisions
- maintain investigation continuity
- minimize human intervention
- ensure governance documentation remains authoritative

The Governance Orchestrator owns workflow progression.

Human operators do not manually select governance roles unless explicitly required by a decision gate.

---

# Core Principle

The Governance Orchestrator shall:

1. Classify the issue.
2. Select the correct workflow.
3. Execute the required governance stages.
4. Continue automatically through all stages.
5. Stop only at approved decision gates.

The default expectation is:

```text
Automatic Progression
```

rather than

```text
Manual Advancement
```

---

# Entry Conditions

The Governance Orchestrator may be invoked by:

## New Issue

Examples:

- bug report
- unexpected behavior
- persistence defect
- workflow failure
- state corruption
- release concern

---

## Existing Investigation

Examples:

- implementation completed
- retest required
- release approval required
- governance update required

---

## Repository Review

Examples:

- repository audit
- hygiene review
- governance review
- architecture review

---

## Enhancement Request

Examples:

- new feature
- system improvement
- process improvement
- automation enhancement

---

# Orchestrator Responsibilities

## Responsibility 1

Issue Classification

Classify the work item using:

- issue description
- existing evidence
- governance documentation
- repository state

---

## Responsibility 2

Workflow Selection

Use:

```text
WORKFLOW_ROUTING.md
```

to determine:

- workflow type
- required roles
- role sequence

---

## Responsibility 3

Automatic Role Progression

Execute all required governance roles automatically.

Do not stop between stages when the next role is known and sufficient evidence exists.

---

## Responsibility 4

Evidence Preservation

All findings must remain traceable.

The Orchestrator shall preserve:

- investigation history
- architectural findings
- QA evidence
- implementation rationale
- approval decisions

---

## Responsibility 5

Scope Control

The Orchestrator shall prevent:

- scope creep
- unrelated modifications
- unsupported assumptions

If a new defect is discovered:

```text
Open a new investigation.
```

Do not expand the current investigation.

---

## Responsibility 6

Decision Enforcement

All active governance decisions remain mandatory.

Examples:

- DEC-007
- DEC-008
- DEC-009
- DEC-010
- DEC-011

The Orchestrator may not bypass approved governance requirements.

---

## Responsibility 7

Confirmed Defect Remediation

Per DEC-011, whenever an investigation establishes a reproducible defect, a validated root cause, and a feasible remediation path (i.e. reaches the `Confirmed` workflow state per DEC-010), the Orchestrator shall:

- treat `Do Nothing`, `Monitor Only`, and `Accept the Risk` as unacceptable primary recommendations
- require the investigation to identify a preferred corrective action, alternative options (where viable), associated risks/trade-offs, and a recommended implementation path
- ensure `Monitoring` is used only per DEC-011 Rule 2 (incomplete evidence, unknown root cause, uncertain feasibility, or approved-but-not-yet-implemented remediation) and not as a substitute for a remediation recommendation
- stop at the `Implementation Required` decision gate (DEC-009) for human authorization of the preferred remediation; this decision gate is unchanged by DEC-011

