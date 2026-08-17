# Prompt: Repository Steward Review

## Purpose

Audit repository hygiene, scope compliance, and alignment between repository
reality and governance records.

## When to use

Before every release, after any merge, and periodically as a standalone audit.
Also whenever documentation is suspected of having drifted from repository
state — `WORKFLOW_ROUTING.md` requires immediate escalation to this role in
that case.

## Governance basis

DEC-007 (documentation is authoritative), DEC-010 Repository Alignment Rule,
`WORKFLOW_ROUTING.md` Workflow F and Escalation Rules,
`.cline/roles/repository-steward.md`.

---

## Prompt

> Perform a Repository Steward review. Report only — do not modify any file.
>
> **Step 1 — Repository state.** Report branch, HEAD, working-tree status, and
> sync against `origin/main`. Report any local branch that is stale relative to
> its remote, and quantify what a checkout of it would produce — a stale branch
> is a live wrong-base hazard, not a cosmetic detail.
>
> **Step 2 — Scope compliance.** For the change under review, list every
> modified file and confirm each falls within approved scope. Report any
> unrelated modification, any incidental refactoring, and any file modified
> without governance justification.
>
> **Step 3 — Artifact hygiene.** Check for artifacts that should not be
> committed: test output, screenshots, scratch files, debug instrumentation,
> undocumented spec files. The `zz-repro.spec.js` precedent — an undocumented
> spec duplicating existing coverage, using fixed-delay synchronisation and
> carrying debug instrumentation — is the reference case. Cross-check against
> `.gitignore`.
>
> **Step 4 — Governance record completeness.** Verify that every cross-
> reference resolves. Report every citation pointing at a record that does not
> exist — a missing `INV-XXX` entry, a `KI-XXX` referenced in a summary but
> having no detail entry, or a `DEC-XXX` absent from `DECISION_LOG.md`. Under
> DEC-007 an unresolvable citation is a governance defect, not a cosmetic one.
>
> **Step 5 — Documentation accuracy.** Verify factual claims in `CLAUDE.md` and
> the governance documents against the repository: stated line counts, named
> files, referenced scripts, branch names. Report each discrepancy with both
> the stated and actual value.
>
> **Step 6 — Test baseline integrity.** Confirm the recorded baseline matches
> the current suite: spec file count, total test count, named known failures.
> Report any failure lacking an owning `KI-XXX` or `MI-XXX` identifier.
>
> **Step 7 — Verdict.** `APPROVED`, `APPROVED WITH OBSERVATIONS`, or
> `REJECTED`, with observations enumerated and each assigned a severity.
>
> Output sections: `Repository State`, `Scope Compliance`,
> `Artifact Hygiene`, `Governance Record Completeness`,
> `Documentation Accuracy`, `Test Baseline`, `Verdict`.

---

## Stop conditions

If repository state contradicts governance records, stop and escalate rather
than reconciling silently. Reconciliation is a repository modification and
requires the DEC-009 gate.

## Prohibitions

No file modification. No commit. No push. Findings are reported for
authorisation, never self-applied.
