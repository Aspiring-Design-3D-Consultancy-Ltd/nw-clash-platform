# Workflow Routing

Status:

Approved

Related Decisions:

- DEC-007
- DEC-008
- DEC-009
- DEC-010
- DEC-011
- DEC-012

Purpose:

Provide deterministic routing rules for governance workflows.

This document allows the Governance Orchestrator to determine:

- investigation type
- required roles
- workflow order
- stopping conditions

---

# Workflow Selection Rules

When a new issue is raised:

1. Classify issue.
2. Select matching workflow.
3. Execute required stages.
4. Continue automatically until a decision gate is encountered.

---

# Workflow A

## Persistence Defect

Examples:

- localStorage issues
- IndexedDB issues
- migration failures
- state corruption
- reset failures
- data resurrection
- data loss

Workflow:

1. Project Analyst
2. Architect
3. QA Investigator
4. Developer Assessment
5. Implementation Manager

STOP

Decision Gate:

Implementation Required

While stopped at this gate, the investigation is in the `Confirmed` workflow state (DEC-010) and is subject to the Confirmed Defect Remediation requirements of DEC-011: `Do Nothing`, `Monitor Only`, and `Accept the Risk` are not acceptable primary recommendations. The investigation must identify a preferred corrective action, viable alternatives with risks/trade-offs, and a recommended implementation path, resolving to `Implementation Approved`, `Deferred`, or `Monitoring` (only where DEC-011 Rule 2 conditions apply).

After implementation:

1. QA Retest
2. Repository Steward
3. Release Manager

STOP

Decision Gate:

Commit / Push Required

After the investigation reaches `Closed` (DEC-010) with a recorded release commit, generate a Release Snapshot per RELEASE_SNAPSHOTS.md / DEC-012 (documentation step, not a release gate).

---

# Workflow B

## Application Defect

Examples:

- business-logic errors
- calculation errors
- workflow failures
- import/export defects

Workflow:

1. Project Analyst
2. Architect
3. QA Investigator
4. Developer Assessment
5. Implementation Manager

STOP

Decision Gate:

Implementation Required

After implementation:

1. QA Retest
2. Repository Steward
3. Release Manager

STOP

---

# Workflow C

## Test Failure

Examples:

- flaky tests
- intermittent failures
- timing sensitivity
- CI failures

Workflow:

1. QA Investigator
2. Project Analyst

If infrastructure issue:

3. Repository Steward

If application defect suspected:

3. Architect
4. Developer Assessment

Continue as required.

---

# Workflow D

## Architecture Review

Examples:

- scalability concerns
- design reviews
- technical-debt audits
- modernization initiatives

Workflow:

1. Architect

If defect risk found:

2. Project Analyst
3. QA Investigator

Continue based on findings.

---

# Workflow E

## Documentation Issue

Examples:

- governance drift
- stale status reporting
- missing investigation records

Workflow:

1. Repository Steward
2. Release Manager

Decision:

Update Documentation

STOP

---

# Workflow F

## Repository Hygiene

Examples:

- branch strategy
- governance compliance
- repository organization
- stale artifacts

Workflow:

1. Repository Steward

If release impact exists:

2. Release Manager

STOP

---

# Workflow G

## Security Issue

Examples:

- credential exposure
- permission failures
- authentication issues
- data-leak risks

Workflow:

1. Project Analyst
2. Architect
3. QA Investigator
4. Developer Assessment
5. Implementation Manager

Priority:

High

STOP

Decision Gate:

Implementation Required

After implementation:

1. QA Retest
2. Repository Steward
3. Release Manager

STOP

---

# Workflow H

## Enhancement Request

Examples:

- new feature
- functionality extension
- quality-of-life improvement

Workflow:

1. Project Analyst
2. Architect
3. Developer Assessment
4. Implementation Manager

Decision:

Approve or Reject

If approved:

Developer Implementation

↓

QA Retest

↓

Repository Steward

↓

Release Manager

---

# Escalation Rules

If evidence contradicts previous findings:

Return to:

- QA Investigator
- Architect

as appropriate.

---

If implementation reveals new defects:

Open new investigation.

Do not expand scope.

---

If documentation becomes inconsistent with repository state:

Escalate immediately to:

Repository Steward.

---

# Closure Rules

An investigation may be closed only when:

- remediation completed
- QA retest passed
- Repository Steward approved
- Release Manager approved
- governance documentation updated

and

- repository state matches governance state

---

# Default Rule

If workflow classification is unclear:

Use:

1. Project Analyst
2. Architect

to classify the issue before selecting a workflow.

---

# Final Principle

The Governance Orchestrator owns workflow progression.

Human intervention is required only at decision gates defined by DEC-009.

Confirmed defects remain governed by DEC-011: `Do Nothing`, `Monitor Only`, and `Accept the Risk` are not acceptable primary recommendations once a defect is reproducible, root-caused, and has a feasible remediation path.

Closed/released investigations remain governed by DEC-012: generate a Release Snapshot (RELEASE_SNAPSHOTS.md) recording repository state, governance state, investigation state, and test baseline at closure.