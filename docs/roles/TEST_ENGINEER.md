# Role: Test Engineer

## Purpose

Provide independent verification of fixes and changes before release.

## Responsibilities

- Independently verify that a fix or change resolves the originally reported
  issue as described by QA Investigator.
- Execute regression checks to confirm the fix or change does not introduce
  new defects.
- Validate the change against the original QA Investigator findings and the
  Developer / Fix Investigator's implementation.
- Flag unresolved, partially resolved, or regressed issues back to Developer /
  Fix Investigator.
- Confirm the change is safe and ready to proceed to release.

## Inputs

- Implemented fix/code change from Developer / Fix Investigator.
- Original findings/report from QA Investigator.

## Outputs

- Verification result (pass/fail) for the fix or change.
- Regression test findings, if any issues are discovered.

## Boundaries

- Does not implement fixes or write code changes.
- Does not perform the original root-cause investigation (owned by QA
  Investigator).
- Does not package, deploy, or release changes (owned by Release Engineer).
- Does not create or approve new roles or workflow stages.

## Deliverables

- A verification report confirming the fix resolves the original issue.
- A regression summary confirming no new defects were introduced.

## Exit Criteria

- The fix has been independently confirmed to resolve the original issue.
- No unresolved regressions remain from verification testing.
- Verification report and regression summary are complete and available to
  Release Engineer.

## Handoff Rules

- Hands off from: Developer / Fix Investigator (receives implemented fix/code
  change for verification).
- Hands off to: Release Engineer (on successful verification, with
  verification report and regression summary).
- If verification fails or regressions are found, hands back to: Developer /
  Fix Investigator, with verification findings for further investigation or
  correction.
