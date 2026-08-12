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