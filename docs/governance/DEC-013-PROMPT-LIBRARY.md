# DEC-013

Title:

Prompt Library Acceptance

Status:

Accepted

Date:

2026-08-17

Decision Type:

Governance Framework

Related Decisions:

- DEC-001
- DEC-002
- DEC-004
- DEC-007
- DEC-008
- DEC-009
- DEC-010

Related Documents:

- CLAUDE.md
- prompts/README.md
- GOVERNANCE_ORCHESTRATOR.md
- WORKFLOW_ROUTING.md
- WORKFLOW_TEMPLATES.md
- AI_STARTUP_CHECKLIST.md

Related Investigations:

- INV-002, R1, INV-003, INV-005, INV-006, INV-007, INV-008 (the
  investigations whose executed practice the library codifies)

---

# Context

The repository has developed a governance workflow prompt library, held in
`prompts/`.

The library:

- Covers all governance roles.
- Covers the full governance workflow.
- Provides reusable operational procedures.
- Codifies practices proven through repository investigations and reviews.

As of this decision the library contains 20 prompts plus a README (21 files),
organised into four categories: Session Startup, Issue Discovery & Triage,
Governance Workflow, and Strategic Reviews. All eight roles validated under
DEC-001 and DEC-006 have at least one prompt, and every workflow stage named
by any prompt has a corresponding prompt file.

Discoverability was implemented separately: `CLAUDE.md` carries a
`Prompt Library` section referencing `prompts/` and `prompts/README.md`.

---

# Problem Statement

Governance procedures were previously reconstructed manually between
sessions.

This created inconsistency, repetition, and risk of workflow drift.

A further problem arose once discoverability was implemented: `CLAUDE.md`
now instructs sessions to prefer the library over ad-hoc review processes,
but no decision record established that instruction. Under DEC-007,
repository documentation is the authoritative workflow state; a binding
instruction with no supporting decision is a gap in that authority.

---

# Decision

The Prompt Library is accepted as an official repository governance asset.

Prompts should be preferred over ad-hoc governance procedures where an
applicable prompt exists.

---

# Rules

## Rule 1 - Governance Documents Remain Authoritative

Governance documents remain authoritative under DEC-007. Acceptance of the
Prompt Library does not alter that position.

## Rule 2 - Governance Documentation Prevails On Conflict

If a prompt conflicts with governance documentation, governance
documentation prevails. A conflict is a defect in the prompt, and the prompt
is corrected — never the governance document, unless a separate decision
authorises that change.

## Rule 3 - Prompts Are Procedures, Not Decisions

Prompts are operational procedures, not governance decisions. A prompt may
not create, modify, or override any decision recorded in `DECISION_LOG.md`
or in a standalone `DEC-XXX` document.

## Rule 4 - Single Modification Authority

Exactly one prompt may authorise repository modification:

```text
prompts/developer-implementation.md
```

Every other prompt produces a report. This constraint keeps repository
changes routed through the DEC-009 `Repository Modification Required`
decision gate, and is the reason
`prompts/implementation-manager-review.md` — the stage that reviews that
prompt's output — is the only prompt permitted to classify a change as
`Unauthorized`.

## Rule 5 - Workflow Position And Decision Gate Must Be Stated

Every governance stage prompt must identify its workflow position and its
decision gate. A stage prompt that does not name the stage before it, the
stage after it, and the DEC-009 gate at which it stops is incomplete.

## Rule 6 - New Prompts Require Justification

New prompts should only be created when:

- a process is repeated,
- the repetition is demonstrably wasteful,
- or a genuine workflow gap exists.

This applies DEC-008 to the library itself: prompts are added because
practice demanded them, not because they would be useful to have.

## Rule 7 - Prompt Updates Follow Governance Changes

Prompt updates are required when workflow, governance, or repository
decisions invalidate existing prompt guidance.

Any investigation that changes a workflow, a decision, or a repository
invariant must check whether a prompt encodes the superseded version.

---

# Success Criteria

Prompt Library acceptance is considered successful when:

- Governance procedures are executed consistently across sessions without
  being reconstructed from memory or chat history.
- Every governance role can be executed from a documented procedure.
- Repository modification remains confined to the single authorised prompt
  and its reviewing stage.
- Prompts remain aligned with the governance documents they serve, with
  conflicts resolved in favour of the governance document.
- The library does not grow speculatively.

---

# Consequences

## Positive

- Governance procedures become repeatable across sessions, machines, and AI
  tools, satisfying DEC-002 and DEC-004.
- Role boundaries defined in `.cline/roles/` become enforceable in practice
  rather than aspirational.
- Decision gates are stated explicitly in each stage prompt, so automation
  cannot silently cross a human approval point.
- Practice proven across INV-002 through INV-008 is preserved in the
  repository instead of being re-derived.

## Trade-Offs

- The library is documentation surface that must be maintained; Rules 6 and
  7 exist to bound that cost.
- Prompts can drift from the governance documents they serve. Rule 2
  resolves the conflict but does not prevent it; periodic verification is
  required.
- A prompt makes a procedure easy to follow, which can encourage running a
  stage where none is warranted. The governance workflow, not the library,
  determines which stages apply.

---

# Related Decisions

- DEC-001 - Role-Based Workflow (Option A)
- DEC-002 - Repository as Primary Source of Project Memory
- DEC-004 - Repository-First AI Bootstrapping
- DEC-007 - Repository Documentation is Authoritative Workflow State
- DEC-008 - Governance Framework Maintenance Strategy
- DEC-009 - Governance Workflow Automation
- DEC-010 - Workflow State Automation

---

# Final Decision

Accepted.

The Prompt Library is an official repository governance asset. Prompts are
preferred over ad-hoc governance procedures where an applicable prompt
exists, subject to Rules 1 through 7 above.

This decision records and constrains an existing asset. It creates no new
role, workflow, or decision gate. DEC-009 gates, DEC-010 workflow states,
DEC-011 remediation requirements and DEC-012 snapshot rules are unchanged.
