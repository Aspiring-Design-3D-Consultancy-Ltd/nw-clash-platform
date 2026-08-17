# Prompt: Architecture Review

## Purpose

Assess a design question, technical-debt area, or cross-cutting risk without
committing to implementation. Workflow D.

## When to use

Scalability or maintainability concerns; a defect pattern recurring across
investigations; before a structural change; or when a defect's root cause
appears architectural rather than local.

## Governance basis

`WORKFLOW_ROUTING.md` Workflow D, DEC-009 (Architectural Ambiguity gate),
DEC-011 (remediation recommendation required once a defect is confirmed),
`.cline/roles/architect.md` (the Architect does not write code),
`ARCHITECTURE_OVERVIEW.md`.

---

## Prompt

> Perform an architecture review of `<area / question>`. Report only — do not
> modify any file and do not write code.
>
> **Step 1 — System analysis.** Describe how the area works today, based on
> reading the code, not on assumption. Cite specific functions and line
> references. Distinguish intentional design decisions from accumulated drift —
> the INV-007 precedent found that a deferred-migration pattern criticised as a
> defect was in fact a sound production design whose *test contract* was wrong.
>
> **Step 2 — Constraint check.** State how the review is bounded by this
> repository's hard constraints: single-file deployment; Chart.js and JSZip
> inlined; PptxGenJS from CDN with fallbacks; `localStorage` + IndexedDB as the
> only persistence layers, with no new layer permitted; SharePoint deployment
> opened locally via `file://`.
>
> **Step 3 — Historical pattern check.** Review `INVESTIGATION_LOG.md` for
> prior findings in or adjacent to this area. Report whether the concern is a
> recurrence of a known pattern. The gate/persistence divergence class
> (INV-003, INV-005, INV-006) is the clearest example: three investigations of
> one architectural weakness.
>
> **Step 4 — Risk matrix.** Tabulate each identified risk with Severity and
> Likelihood, using the format established in the INV-007 Architect findings.
>
> **Step 5 — Design considerations.** Present each viable option with its
> trade-offs. Include the option that requires no application-code change where
> one exists, and say plainly which you prefer and why. Where an option is
> maintainable long-term but elevates the change from documentation-only to
> application code, say so — that distinction changes the workflow.
>
> **Step 6 — Recommendation.** Give a single recommended action and the
> smallest change that achieves it (minimal-change principle). If the review
> confirms a defect with a validated root cause and feasible remediation,
> DEC-011 applies: a remediation recommendation is required, not a monitoring
> disposition.
>
> **Step 7 — Routing.** State whether findings warrant opening an
> investigation, and if so the workflow, role sequence, and next `INV-XXX`.
>
> Output sections: `System Analysis`, `Constraints`, `Historical Patterns`,
> `Risk Matrix`, `Design Considerations`, `Recommendation`, `Routing`.

---

## Stop conditions

Stop at the Architectural Ambiguity gate whenever two or more valid directions
exist. Present the trade-offs; do not choose for the operator.

## Prohibitions

No code. No implementation. No unsolicited UX or design opinions — push back
only on genuine technical risk (`CLAUDE.md` working preference 7).
