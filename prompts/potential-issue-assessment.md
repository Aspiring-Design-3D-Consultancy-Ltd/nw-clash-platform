# Prompt: Potential Issue Assessment

## Purpose

Triage an observed symptom into a governance classification and a workflow
route, before an investigation is formally opened. Prevents both premature
implementation and unnecessary investigations.

## When to use

Something looks wrong — a user report, an unexpected number, a failing test, an
odd behaviour — and it is not yet clear whether it is a defect, a data problem,
a test-harness problem, or expected behaviour.

## Governance basis

DEC-009 (decision gates), DEC-010 (states `New` → `Under Investigation`),
DEC-011 (once confirmed, monitoring is not an acceptable primary outcome),
`WORKFLOW_ROUTING.md` (workflow selection), `.cline/roles/project-analyst.md`,
`.cline/roles/qa-investigator.md`.

---

## Prompt

> Assess the following potential issue. Report only — do not modify any file,
> and do not propose code changes.
>
> **Symptom:** `<describe the observed behaviour, with evidence>`
>
> **Step 1 — Restate the symptom as observed behaviour**, separating what was
> observed from what is being inferred. Do not speculate on root cause at this
> stage (Developer role restriction: no root-cause speculation; QA Investigator
> restriction: no solution design).
>
> **Step 2 — Apply the stale-data-first rule.** Per `CLAUDE.md`: if a platform
> that worked previously now shows wrong numbers, a data shift is more likely
> than a code regression. Explicitly assess and report whether the symptom is
> better explained by input data, by user state (localStorage / IndexedDB), or
> by application code.
>
> **Step 3 — Check for prior art.** Search `INVESTIGATION_LOG.md`,
> `KNOWN_ISSUES.md`, and `CURRENT_STATUS.md` for the same or an adjacent
> failure signature. Report whether this is new, a recurrence of a closed
> issue, or an instance of an existing monitoring item. Recurrences of closed
> issues are higher severity than new findings.
>
> **Step 4 — Classify.** Assign exactly one primary classification:
> Persistence Defect, Application Defect, Test Failure, Architecture Concern,
> Documentation Issue, Repository Hygiene, Security Issue, or Enhancement.
> Justify the choice against the examples in `WORKFLOW_ROUTING.md`.
>
> **Step 5 — Route.** Name the workflow (A–H), the role sequence it requires,
> and the decision gate at which it will stop.
>
> **Step 6 — Evidence assessment.** State what evidence exists, what is
> missing, and what would be required to move from `New` to `Under
> Investigation` and then to `Confirmed`. Where runtime behaviour is involved,
> note that `CLAUDE.md` requires DevTools console output and a Playwright
> reproduction before any fix is proposed — static analysis alone is
> insufficient.
>
> **Step 7 — Recommend.** Either open an investigation (give the next
> `INV-XXX` and a proposed title), attach to an existing monitoring item, or
> reject with reasoning. If you recommend monitoring, justify it explicitly
> against DEC-011 Rule 2 — monitoring is valid only where evidence is
> incomplete, root cause unknown, feasibility uncertain, or remediation
> approved but not yet implemented.
>
> Output sections: `Observed Symptom`, `Data vs. Code Assessment`,
> `Prior Art`, `Classification`, `Workflow Route`, `Evidence Status`,
> `Recommendation`.

---

## Stop conditions

Stop at the routed workflow's first decision gate. Do not proceed to Developer
Assessment or implementation within this prompt.

## Prohibitions

No code changes. No root-cause claims without reproduction evidence. No
recommendation of "monitor only" for a defect that is already reproducible,
root-caused, and remediable (DEC-011).
