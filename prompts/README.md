# Prompt Library

Reusable operational procedures for governance work on this repository.

## Purpose

Each file in this folder is a **prompt**: a complete, self-contained instruction
set that can be pasted into an AI session to execute one governance procedure
consistently. They encode procedures that have already been executed
successfully (INV-002 through INV-008) so that future sessions do not
re-derive them.

These prompts are **operational procedures, not governance decisions**. They
do not create, modify, or override any decision in `DECISION_LOG.md` or the
`DEC-XXX` files. Where a prompt and a governance document disagree, the
governance document wins (DEC-007).

## Governance basis

| Decision | How these prompts honour it |
|---|---|
| DEC-007 | Repository documentation is authoritative; prompts read it, never replace it |
| DEC-008 | Prompts codify proven practice; they do not expand the governance model |
| DEC-009 | Every prompt names the decision gates at which it must stop |
| DEC-010 | Every prompt reports findings in terms of the workflow-state model |
| DEC-011 | Assessment prompts may not recommend "monitor only" for a confirmed, remediable defect |
| DEC-012 | The release prompt treats snapshot generation as documentation, not a gate |

## The prompts

| Prompt | Use when | Produces |
|---|---|---|
| `repository-context-establishment.md` | Starting any session | Repository state, governance state, active work, drift report |
| `potential-issue-assessment.md` | Something looks wrong, before opening an investigation | Classification, workflow route, evidence gaps, INV number recommendation |
| `investigation-scoping-review.md` | An investigation is about to move to implementation | Approved scope, explicit boundaries, out-of-scope list |
| `architecture-review.md` | Design question, tech-debt audit, or a defect risk spanning subsystems (Workflow D) | System analysis, risk matrix, design options, recommendation |
| `release-readiness-review.md` | Implementation is QA-verified and steward-approved | Release readiness verdict, blockers, snapshot recommendation |
| `repository-steward-review.md` | Before any release, and for periodic hygiene audits | Scope compliance, hygiene findings, drift between repo and governance |

## How to use

1. Open a session with `repository-context-establishment.md`. Always. Every
   other prompt assumes its output exists.
2. Pick the prompt matching the work. If unsure, use
   `potential-issue-assessment.md` — it routes.
3. Paste the prompt verbatim. Add specifics (symptom, file, investigation ID)
   below it.
4. Honour the stop conditions. Every prompt names the DEC-009 gate where the
   session must stop and wait for a human.

## Expected outputs

Every prompt produces a **report**, not a change. No prompt in this folder
authorises editing `working.html`, editing governance documents, committing,
or pushing. Those actions require the human decision gates defined in DEC-009
and remain outside prompt scope.

## Maintenance

Update a prompt when the procedure it encodes actually changes — a new
decision, a new workflow, a changed invariant. Do not add prompts
speculatively (DEC-008). A new prompt is justified when a procedure has been
executed at least twice and the repetition is provably wasteful.
