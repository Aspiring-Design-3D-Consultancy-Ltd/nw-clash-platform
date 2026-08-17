# Decision Log

## Purpose

This document records significant project decisions.

The objective is to preserve the reasoning behind major governance, architectural, testing, and process decisions so that future contributors and AI assistants understand not only what was decided, but why.

---

# Decision Status Types

- Proposed
- Approved
- Superseded
- Retired

---

# DEC-001

Title:

Role-Based Workflow (Option A)

Status:

Approved

Date:

2026

Decision:

Adopt a role-based engineering workflow rather than autonomous AI agents.

Roles:

- Project Analyst
- Architect
- QA Investigator
- Developer
- Environment Steward
- Repository Steward
- Implementation Manager
- Release Manager

Reasoning:

- Improves separation of responsibilities.
- Reduces speculative fixes.
- Encourages evidence-driven investigations.
- Creates repeatable governance processes.
- Easier to validate and refine than autonomous-agent workflows.

Impact:

All development activities follow the defined role sequence.

---

# DEC-002

Title:

Repository as Primary Source of Project Memory

Status:

Approved

Date:

2026

Decision:

Store project knowledge within the repository rather than relying on AI conversation history.

Primary locations:

- .cline/
- docs/governance/

Reasoning:

- Supports multiple laptops.
- Supports multiple AI accounts.
- Supports multiple AI tools.
- Preserves project knowledge over time.
- Reduces dependence on chat history.

Impact:

Important project information should be documented in repository files.

---

# DEC-003

Title:

Governance Validation Before Major Development

Status:

Approved

Date:

2026

Decision:

Validate the governance framework before commencing significant bug-fix or enhancement work.

Reasoning:

- Confirms role boundaries.
- Verifies investigation workflow.
- Identifies governance gaps early.
- Establishes repeatable development practices.

Impact:

Role validation is performed before broader implementation work.

---

# DEC-004

Title:

Repository-First AI Bootstrapping

Status:

Approved

Date:

2026

Decision:

AI sessions should begin by loading governance documentation from the repository.

Primary sources:

- .cline/bootstrap.md
- .cline/roles/*
- docs/governance/*

Reasoning:

- Consistent behaviour across AI sessions.
- Portable between environments.
- Reduced reliance on AI memory.

Impact:

New AI sessions can reconstruct project understanding directly from repository documentation.

---

# DEC-005

Title:

Investigation Before Implementation

Status:

Approved

Date:

2026

Decision:

No production changes should be implemented without investigation and verification.

Required stages:

- Problem understanding
- Architectural assessment
- Evidence collection
- Validation
- Implementation review

Reasoning:

- Reduces regressions.
- Reduces speculative changes.
- Improves confidence in fixes.

Impact:

Development work should not bypass investigation stages.

---

# DEC-006

Title:

Governance Framework v1 Validation

Status:

Approved

Date:

2026

Decision:

Governance Framework v1 is considered validated after successful execution of all defined roles against a real-world investigation.

Validation investigation:

- INV-002
- closeApp() Whitelist Drift

Validated roles:

- Repository Steward
- Environment Steward
- Project Analyst
- Architect
- QA Investigator
- Developer
- Implementation Manager
- Release Manager

Reasoning:

A real defect investigation was used to exercise every governance role from discovery through release assessment.

The workflow successfully:

- Identified a defect.
- Assessed architectural risk.
- Independently verified evidence.
- Produced implementation planning.
- Applied implementation review.
- Applied release governance.

Role boundaries were respected throughout the validation process.

Additional governance gaps identified during validation were incorporated back into repository documentation.

Impact:

Governance Framework v1 becomes the approved project workflow.

Future investigations and development efforts should follow the documented governance process unless superseded by a future decision.

---

# DEC-007

Title:

Repository Documentation is Authoritative Workflow State

Status:

Approved

Date:

2026

Decision:

Governance workflow state must be reflected in repository documentation before subsequent governance stages may rely on it.

Primary documents:

- CURRENT_STATUS.md
- INVESTIGATION_LOG.md
- KNOWN_ISSUES.md

Reasoning:

Governance validation identified situations where completed workflow activities were not reflected in project records.

This created differences between:

- Actual workflow state
- Recorded workflow state

Several governance reviews correctly reported stages as incomplete because repository records had not yet been updated.

Impact:

Completion of major workflow stages should be recorded before subsequent governance reviews are performed.

Repository documentation remains the authoritative project record.

---

# DEC-008

Title:

Governance Framework Maintenance Strategy

Status:

Approved

Date:

2026

Decision:

Focus on using the governance framework rather than continuously expanding governance documentation.

Reasoning:

The project now contains:

- Governance roles
- Workflow definitions
- Project context
- Investigation history
- Architecture documentation
- Decision history
- Testing strategy
- Working agreements
- Startup procedures

Further expansion of governance documentation should occur only when a genuine process gap is discovered.

Impact:

Future effort should prioritize:

- Investigations
- Development
- Testing
- Project delivery

Governance documentation should evolve through practical use rather than speculative expansion.

---

# DEC-009

Title:

Governance Workflow Automation

Status:

Approved

Date:

2026

Recorded In:

`docs/governance/DEC-009-GOVERNANCE-AUTOMATION.md` (index entry only — see that document for the full decision)

Decision:

Adopt a Governance Orchestrator model. The Orchestrator classifies work items, selects the workflow, executes the required governance roles in order, and advances between stages automatically, stopping only at defined human decision gates.

Reasoning:

The role-based framework was proven, but stage-to-stage advancement remained manual, creating operator effort, delay, and process inconsistency.

Impact:

Investigations progress automatically until a decision gate is reached. Five human decision gates are defined: Repository Modification Required, Repository State Validation Required, Architectural Ambiguity, Release Authorization, and Insufficient Evidence.

---

# DEC-010

Title:

Workflow State Automation

Status:

Approved

Date:

2026

Recorded In:

`docs/governance/DEC-010-WORKFLOW-STATE-AUTOMATION.md` (index entry only — see that document for the full decision)

Decision:

Adopt a mandatory workflow-state lifecycle. All investigations progress through defined states, with the Governance Orchestrator assigning, advancing and validating transitions.

Reasoning:

Investigations previously relied on implicit status determination, making governance status non-deterministic and release readiness ambiguous.

Impact:

Nine states are defined (New, Under Investigation, Confirmed, Implementation Approved, Implemented, QA Verified, Steward Approved, Release Approved, Closed) plus the special states Rejected, Deferred and Monitoring. The Repository Alignment Rule establishes that repository state takes precedence over documentation state, and that drift must be identified and reported.

Extended By:

DEC-011.

---

# DEC-011

Title:

Confirmed Defect Remediation

Status:

Accepted

Date:

2026-08-15

Recorded In:

`docs/governance/DEC-011-CONFIRMED-DEFECT-REMEDIATION.md` (index entry only — see that document for the full decision)

Decision:

Once an investigation establishes a reproducible defect, a validated root cause, and a feasible remediation path, `Do Nothing`, `Monitor Only` and `Accept the Risk` are not acceptable primary recommendations.

Reasoning:

Governance artifacts could present monitoring as equivalent to corrective action even after a defect had been conclusively demonstrated, delaying correction without adding investigative value.

Impact:

Confirmed defects must produce a preferred corrective action, viable alternatives with risks and trade-offs, and a recommended implementation path. Monitoring remains valid only while evidence is incomplete, root cause unknown, feasibility uncertain, or remediation approved but not yet implemented. Decision gates are unchanged.

Related Investigations:

INV-008.

---

# DEC-012

Title:

Release Snapshot Capability

Status:

Approved

Date:

2026-08-15

Recorded In:

`docs/governance/DEC-012-RELEASE-SNAPSHOT.md` (index entry only — see that document for the full decision)

Decision:

Adopt a Release Snapshot capability. A Release Snapshot is a dated, immutable, point-in-time record of repository state, governance state, investigation state, test baseline and release status, recorded in `RELEASE_SNAPSHOTS.md` using sequential `RS-XXX` identifiers.

Reasoning:

CURRENT_STATUS.md, KNOWN_ISSUES.md and INVESTIGATION_LOG.md are accurate for "now" but are edited by later investigations, so no stable artifact answered "what was true at release X?".

Impact:

Snapshots accumulate in a single ledger file and are never edited once recorded. Repository facts may be captured mechanically; governance-state fields must be sourced from the authoritative governance documents, not inferred by automation. Snapshot generation documents a release and does not gate one.

Related Investigations:

INV-008 (reference implementation: RS-001).

---

# DEC-013

Title:

Prompt Library Acceptance

Status:

Accepted

Date:

2026-08-17

Recorded In:

`docs/governance/DEC-013-PROMPT-LIBRARY.md` (index entry only — see that document for the full decision)

Decision:

The Prompt Library held in `prompts/` is accepted as an official repository governance asset. Prompts should be preferred over ad-hoc governance procedures where an applicable prompt exists.

Reasoning:

Governance procedures were previously reconstructed manually between sessions, creating inconsistency, repetition and risk of workflow drift. Following implementation of prompt-library discoverability, CLAUDE.md instructed sessions to prefer the library, but no decision record established that instruction — a gap in the authority DEC-007 assigns to repository documentation.

Impact:

Seven rules govern the library: governance documents remain authoritative (DEC-007); governance documentation prevails on conflict; prompts are procedures, not decisions; exactly one prompt (`developer-implementation.md`) may authorise repository modification; every stage prompt must state its workflow position and decision gate; new prompts require justification under DEC-008; and prompts must be updated when governance changes invalidate them. No new role, workflow or decision gate is created.

---

# Future Decisions

Record future decisions using the following structure:

## DEC-XXX

Title:

Status:

Date:

Decision:

Reasoning:

Impact:

Related Investigations:

Related Issues: