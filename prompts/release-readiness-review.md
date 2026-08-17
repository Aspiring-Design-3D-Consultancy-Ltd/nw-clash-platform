# Prompt: Release Readiness Review

## Purpose

Determine whether an investigation may proceed to release. Release Manager
procedure.

## When to use

Implementation complete, QA Retest passed, Repository Steward review approved —
i.e. DEC-010 state `Steward Approved`, seeking `Release Approved`.

## Governance basis

DEC-009 (Release Authorization gate), DEC-010 (`Steward Approved` →
`Release Approved` → `Closed`), DEC-012 (snapshot is documentation, not a
gate), `WORKFLOW_ROUTING.md` Closure Rules,
`.cline/roles/release-manager.md` (does not approve unverified work).

---

## Prompt

> Perform a release readiness review for `<INV-XXX>`. Report only — do not
> modify any file, do not commit, do not push.
>
> **Step 1 — Stage completeness.** Confirm each prior stage is complete with
> recorded evidence: Developer Assessment, Developer Implementation, QA Retest,
> Repository Steward Review. Name the evidence for each. A stage without
> recorded evidence is a blocker, not an assumption.
>
> **Step 2 — QA evidence review.** Report the actual test results: targeted
> suite, the full suite, and — where the defect was intermittent — results
> under a repeat regime sufficient to demonstrate the intermittency is gone.
> The INV-008 precedent used `--repeat-each=5` against the exact regime that
> previously failed 16/85. Confirm tests were run from `tests/` with
> `--workers=1`.
>
> **Step 3 — Residual failure disposition.** For every failing test, state
> whether it is attributable to this change or pre-existing. Pre-existing
> claims must be backed by a baseline comparison (`git stash` or equivalent)
> reproducing the same failure on unmodified code. An unverified "known flaky"
> claim is a blocker — INV-007 rated masking a genuine regression this way as
> Medium-High and increasing.
>
> **Step 4 — Scope confirmation.** Confirm the diff matches the approved scope
> from the scoping review. Any file outside approved scope is a blocker.
>
> **Step 5 — Repository/governance alignment.** Per DEC-010's Repository
> Alignment Rule, verify claimed commits exist on the claimed branch and that
> `CURRENT_STATUS.md`, `KNOWN_ISSUES.md`, and `INVESTIGATION_LOG.md` agree with
> repository reality. The INV-008 release was correctly held at this step when
> the remediation existed only on a feature branch while governance recorded a
> release to `main`.
>
> **Step 6 — Risk assessment.** State release risk (Low / Medium / High) with
> reasoning: change size, blast radius, regression coverage, and whether the
> pattern matches a previously released remediation.
>
> **Step 7 — Verdict.** `APPROVED`, `APPROVED WITH OBSERVATIONS`, or `BLOCKED`,
> with the specific blockers listed if blocked.
>
> **Step 8 — Post-release actions.** If approved, list what must follow:
> the commit and push (human decision gate), governance documentation updates,
> and generation of the next `RS-XXX` Release Snapshot per DEC-012. Note that
> snapshot generation documents the release and does not gate it (DEC-012
> Rule 4), and that governance fields must be sourced from the authoritative
> documents, never inferred (DEC-012 Rule 3).
>
> Output sections: `Stage Completeness`, `QA Evidence`,
> `Residual Failures`, `Scope Confirmation`, `Repository Alignment`,
> `Release Risk`, `Verdict`, `Post-Release Actions`.

---

## Stop conditions

Stop at `Commit / Push Required`. Repository write actions require explicit
human authorisation (DEC-009 Release Authorization).

## Prohibitions

Do not approve unverified work. Do not accept an unsubstantiated pre-existing-
failure claim. Do not commit, push, or create a release.
