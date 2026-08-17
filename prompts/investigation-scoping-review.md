# Prompt: Investigation Scoping Review

## Purpose

Fix the boundaries of an investigation before implementation begins. Scope
creep is the failure mode this repository has most actively defended against —
INV-006 constrained remediation to two wrapper functions specifically to avoid
touching shared helpers, and every Repository Steward review to date has
reported explicitly on scope compliance.

## When to use

After root cause is confirmed and before the `Implementation Required` decision
gate is presented for authorisation.

## Governance basis

DEC-009 (Repository Modification Required gate; Architectural Ambiguity gate),
DEC-010 (`Confirmed` → `Implementation Approved`), DEC-011 (preferred
remediation required), `GOVERNANCE_ORCHESTRATOR.md` Responsibility 5 (Scope
Control), `WORKFLOW_ROUTING.md` Escalation Rules.

---

## Prompt

> Review and fix the scope of investigation `<INV-XXX>` before implementation.
> Report only — do not modify any file.
>
> **Step 1 — Restate the confirmed root cause** in one paragraph, citing the
> evidence that confirmed it. If root cause is not yet confirmed, stop: this
> investigation is not ready for scoping.
>
> **Step 2 — Enumerate remediation options.** Per DEC-011 Rule 3, where
> multiple viable approaches exist, describe each with risks and benefits and
> identify the preferred one. `Do Nothing` / `Monitor Only` / `Accept the Risk`
> are not acceptable as the primary recommendation at this state.
>
> **Step 3 — Define approved scope explicitly.** List:
> - Files to be modified, with the specific functions or regions in each
> - New test files or new tests within existing files
> - Governance documents requiring update
>
> **Step 4 — Define boundaries explicitly.** List what must *not* change, and
> why. Pay specific attention to shared helpers called from multiple contexts —
> the INV-006 precedent established that a remediation which is correct for a
> gated one-shot caller may regress the same helper's other call sites. Name
> every other call site you have checked.
>
> **Step 5 — Marker plan.** Per `CLAUDE.md`, every meaningful change is wrapped
> in a named marker pair. Propose the marker name(s) and confirm the post-edit
> balance check will be run. Note the documented pre-existing orphans
> (`BCF-PANEL-B`, `SPATIAL-HEATMAP-GRID`) are accepted and must not be "fixed".
>
> **Step 6 — Invariant impact.** State explicitly whether the proposed scope
> touches: `DATA_VERSION` (must not be bumped); either XML parser (dual-parser
> discipline — any parsing change must be evaluated against both); the
> persistence layer (`localStorage` `nw:*` keys, IndexedDB `NWClashImages`); or
> `openIDB()` / `_closeSharedIdb()` (closed to changes under INV-008 without a
> new investigation).
>
> **Step 7 — Regression protection plan.** Name the test file and the specific
> cases that will prove the fix and guard the regression. Confirm tests will be
> run from `tests/`, never from the repository root.
>
> **Step 8 — Decision gates.** Identify every DEC-009 gate this investigation
> must stop at, including whether an Architectural Ambiguity gate applies
> because multiple viable options exist.
>
> Output sections: `Confirmed Root Cause`, `Remediation Options`,
> `Approved Scope`, `Explicit Boundaries`, `Marker Plan`, `Invariant Impact`,
> `Regression Protection`, `Decision Gates`.

---

## Stop conditions

Stop at `Implementation Required`. Where two or more viable options exist, also
stop at the Architectural Ambiguity gate and present the choice — do not select
for the operator.

## Prohibitions

No implementation. No scope expansion mid-review. If a new defect surfaces
during scoping, record it and recommend a separate investigation — do not
absorb it (`WORKFLOW_ROUTING.md` Escalation Rules).
