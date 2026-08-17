# Prompt Library

Reusable operational procedures for governance work on this repository.

## Purpose

Each file in this folder is a **prompt**: a complete, self-contained instruction
set that can be pasted into an AI session to execute one procedure
consistently. They encode procedures that have already been executed
successfully (INV-002 through INV-008) so that future sessions do not
re-derive them.

These prompts are **operational procedures, not governance decisions**. They
do not create, modify, or override any decision in `DECISION_LOG.md` or the
`DEC-XXX` files. Where a prompt and a governance document disagree, the
governance document wins (DEC-007).

## Two tracks

The library contains two complementary sets of prompts.

**Governance Workflow prompts** execute the formal role-based workflow defined
by DEC-001 and `WORKFLOW_ROUTING.md`. They are stage-gated: each names the
stage before it, the stage after it, and the decision gate at which it stops.

**Operational prompts** support day-to-day repository work — establishing
session context, triaging an observation before it becomes formal work, scoping
an investigation, and evaluating architecture outside a specific investigation.
They are not workflow stages and do not carry stage gates.

The two sets are complementary, not duplicates. An operational prompt may
recommend entering the formal workflow; it never substitutes for a stage.

## Governance basis

| Decision | How these prompts honour it |
|---|---|
| DEC-001 | The Governance Workflow track mirrors the approved role sequence |
| DEC-002 | Procedures live in the repository, not in chat history |
| DEC-007 | Repository documentation is authoritative; prompts read it, never replace it |
| DEC-008 | Prompts codify proven practice; they do not expand the governance model |
| DEC-009 | Every workflow prompt names the decision gates at which it must stop |
| DEC-010 | Findings are reported in terms of the workflow-state model |
| DEC-011 | Assessment prompts may not recommend "monitor only" for a confirmed, remediable defect |
| DEC-012 | The release prompt treats snapshot generation as documentation, not a gate |

---

## Session Startup

### `repository-context-establishment.md`

**Purpose.** Establish verified repository and governance state before any work
begins. Prevents editing a stale base and prevents acting on outdated
governance assumptions.

**When to use.** At the start of every session, before any other prompt. Also
after a long gap, after a merge, or whenever repository state may have moved.

**Expected outputs.** `Repository State`, `Integrity Checks`,
`Governance State`, `Active Investigations`, `Monitoring Items`,
`Most Recent Release`, `State Drift`, `Next Investigation ID`.

**Typical next step.** Any other prompt in the library. Every one assumes this
prompt's output already exists. If the drift report is non-empty, escalate to
`repository-steward-review.md` before doing anything else.

---

## Issue Discovery & Triage

### `potential-issue-assessment.md`

**Purpose.** Rapid triage of an observed symptom into a classification and a
workflow route, before formal work is opened.

**When to use.** Something looks wrong — a user report, an unexpected number, a
failing test, odd behaviour — and it is not yet clear whether it is a defect, a
data problem, a test-harness problem, or expected behaviour.

**Expected outputs.** `Observed Symptom`, `Data vs. Code Assessment`,
`Prior Art`, `Classification`, `Workflow Route`, `Evidence Status`,
`Recommendation`.

**Typical next step.** If the item warrants formal handling,
`project-analyst-review.md`. If evidence is thin, gather more first. If it is
already covered by a monitoring item, attach it there.

### `investigation-scoping-review.md`

**Purpose.** Fix the boundaries of an investigation before implementation
begins — approved scope, explicit exclusions, invariant impact, and marker plan.

**When to use.** After root cause is confirmed and before the
`Implementation Required` decision gate is presented for authorisation.

**Expected outputs.** `Confirmed Root Cause`, `Remediation Options`,
`Approved Scope`, `Explicit Boundaries`, `Marker Plan`, `Invariant Impact`,
`Regression Protection`, `Decision Gates`.

**Typical next step.** `developer-assessment.md`, then
`developer-implementation.md` once scope is authorised.

---

## Governance Workflow

The formal DEC-001 role sequence. Each stage feeds the next:

```text
project-analyst-review
↓
architect-review
↓
developer-assessment
↓
developer-implementation
↓
implementation-manager-review
↓
qa-retest-review
↓
repository-steward-review
↓
release-readiness-review
```

### `project-analyst-review.md`

**Purpose.** The formal entry point into the governance process. Determine what
has been reported, establish known facts, gather evidence, classify the item,
and recommend a workflow path. No implementation decisions are made here.

**When to use.** A newly reported issue, observation, enhancement request,
monitoring concern, governance finding, or repository hygiene item.

**Expected outputs.** `Executive Summary`, `Observations`,
`Evidence Assessment`, `Historical Context`, `Classification`,
`Scope Assessment`, `Impact Assessment`, `Risk Assessment`,
`Recommended Workflow`, `Recommended Next Step`, and an
`Investigation Recommendation` of `OPEN INVESTIGATION`,
`GATHER MORE EVIDENCE`, `MONITOR`, or `CLOSE`.

**Typical next step.** `architect-review.md` when an investigation is opened.

### `architect-review.md`

**Purpose.** Determine *how* a problem should be solved. Evaluate solution
options, assess architectural impact, identify dependencies, and define
architectural constraints. The Architect does not implement.

**When to use.** After Project Analyst review, before Developer Assessment.

**Expected outputs.** `Executive Summary`, `Current Architecture`,
`Problem Assessment`, `Options Evaluated`, `Preferred Architecture`,
`Dependency Review`, `Data Impact Assessment`, `Test Strategy`,
`Governance Impact Assessment`, `Risk Assessment`,
`Architectural Constraints`, and a recommendation of
`APPROVED FOR DEVELOPER ASSESSMENT` or `FURTHER ANALYSIS REQUIRED`.

**Typical next step.** `developer-assessment.md`.

### `developer-assessment.md`

**Purpose.** Evaluate remediation options against the confirmed root cause and
recommend a preferred implementation approach. Define testing requirements. No
changes are made at this stage.

**When to use.** After investigation and root-cause analysis, before
implementation.

**Expected outputs.** `Executive Summary`, `Root Cause Confirmation`,
`Options Evaluated`, `Preferred Remediation`, `Technical Rationale`,
`Risk Assessment`, `Expected File Changes`, `Required Regression Tests`,
`Residual Risks`, `Alternative Options Considered`, and a `GO` / `NO-GO`
recommendation.

**Typical next step.** `developer-implementation.md` on GO, following human
authorisation at the DEC-009 Repository Modification gate.

### `developer-implementation.md`

**Purpose.** Execute the approved solution under strict scope control, add or
update tests, and prepare the work for independent review.

**When to use.** After Developer Assessment, once implementation is authorised.

**Expected outputs.** `Executive Summary`, `Approved Scope`,
`Implementation Summary`, `Files Modified`, `Files Created`, `Tests Added`,
`Tests Modified`, `Root Cause Resolution Evidence`, `Developer Self-Review`,
`Test Results Summary`, `Known Limitations`, `Risk Assessment`,
`Deviations From Plan`, and a recommendation of
`READY FOR IMPLEMENTATION MANAGER REVIEW` or
`ADDITIONAL DEVELOPMENT REQUIRED`.

**Typical next step.** `implementation-manager-review.md`.

> This is the only prompt in the library that authorises repository
> modification. Its constraints keep that authority bounded: no closing
> investigations, no approving releases, no bypassing stages, no release
> snapshots, and no workflow-state updates beyond implementation completion.

### `implementation-manager-review.md`

**Purpose.** Independently verify that the implementation matches the approved
assessment and architecture, that scope was controlled, and that no
unauthorised changes were introduced.

**When to use.** After Developer Implementation, before QA Retest.

**Expected outputs.** `Executive Summary`, `Scope Verification`,
`Root Cause Resolution Assessment`, `Files Reviewed`,
`Implementation Assessment`, `Code Quality Assessment`,
`Minimal-Change Review`, `Testing Readiness Assessment`,
`QA Retest Requirements`, `Governance Review`, `Risk Assessment`,
`Outstanding Concerns`, and a recommendation of `APPROVED FOR QA RETEST` or
`RETURN TO DEVELOPER`.

**Typical next step.** `qa-retest-review.md`.

> This is the scope-control checkpoint of the workflow — the only stage that
> classifies changes as `Unauthorized`, and the stage that reviews the output
> of the one prompt permitted to change the repository.

### `qa-retest-review.md`

**Purpose.** Independent QA validation that the original issue is resolved, no
regressions were introduced, and test evidence supports progression.

**When to use.** After Implementation Manager Review, before Repository Steward
Review.

**Expected outputs.** `Executive Summary`, `Original Issue Validation`,
`Root Cause Validation`, `Test Results Summary`, `Targeted Test Results`,
`Regression Test Results`, `Reliability Test Results`,
`Full Suite Assessment`, `Coverage Assessment`, `Known Issue Assessment`,
`Governance Compliance Review`, `Risk Assessment`, `Residual Risks`,
`Open Concerns`, and a recommendation of
`PASS - PROCEED TO REPOSITORY STEWARD REVIEW` or
`FAIL - RETURN FOR FURTHER WORK`.

**Typical next step.** `repository-steward-review.md`.

### `repository-steward-review.md`

**Purpose.** Audit repository hygiene, scope compliance, and alignment between
repository reality and governance records.

**When to use.** Before every release, after any merge, and periodically as a
standalone audit. Also whenever documentation is suspected of having drifted —
`WORKFLOW_ROUTING.md` requires immediate escalation to this role in that case.

**Expected outputs.** `Repository State`, `Scope Compliance`,
`Artifact Hygiene`, `Governance Record Completeness`,
`Documentation Accuracy`, `Test Baseline`, `Verdict`.

**Typical next step.** `release-readiness-review.md`.

### `release-readiness-review.md`

**Purpose.** Determine whether an investigation may proceed to release.

**When to use.** DEC-010 state `Steward Approved`, seeking `Release Approved`.

**Expected outputs.** `Stage Completeness`, `QA Evidence`,
`Residual Failures`, `Scope Confirmation`, `Repository Alignment`,
`Release Risk`, `Verdict`, `Post-Release Actions`.

**Typical next step.** Human authorisation at the DEC-009
`Commit / Push Required` gate, then governance documentation updates and
generation of the next `RS-XXX` Release Snapshot per DEC-012.

---

## Strategic Reviews

### `architecture-review.md`

**Purpose.** Broader architectural evaluation outside a specific investigation —
design questions, technical-debt audits, and cross-cutting risks. Workflow D.

**When to use.** Scalability or maintainability concerns; a defect pattern
recurring across investigations; before a structural change; or when a root
cause appears architectural rather than local.

**Expected outputs.** `System Analysis`, `Constraints`,
`Historical Patterns`, `Risk Matrix`, `Design Considerations`,
`Recommendation`, `Routing`.

**Typical next step.** If defect risk is found, `project-analyst-review.md` to
open formal work. Otherwise the recommendation stands as a strategic record.

---

## How to use

1. Open every session with `repository-context-establishment.md`. Every other
   prompt assumes its output exists.
2. Pick the prompt matching the work. If unsure, use
   `potential-issue-assessment.md` — it routes.
3. Paste the prompt verbatim. Add specifics (symptom, file, investigation ID)
   below it.
4. Honour the stop conditions. Every workflow prompt names the DEC-009 gate
   where the session must stop and wait for a human.

## Expected outputs

Every prompt except `developer-implementation.md` produces a **report**, not a
change. No other prompt authorises editing `working.html`, editing governance
documents, committing, or pushing. Those actions require the human decision
gates defined in DEC-009.

## Maintenance

Update a prompt when the procedure it encodes actually changes — a new
decision, a new workflow, a changed invariant. Do not add prompts
speculatively (DEC-008). A new prompt is justified when a procedure has been
executed at least twice and the repetition is provably wasteful.
