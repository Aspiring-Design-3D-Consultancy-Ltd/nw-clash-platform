# Role Workflow

This document describes the purpose, inputs, outputs, and handoffs for each role
currently listed in docs/ROLE_INDEX.md, along with a proposed workflow sequence.

## Roles

### 1. QA Investigator

- Purpose: Investigate and validate quality issues (e.g. bugs, regressions, unexpected behavior) within the project.
- Expected Inputs: A reported issue, symptom, or area of concern to investigate.
- Expected Outputs: Findings/report on the investigated issue, including root cause and evidence.
- Hands off from: (Start of workflow — no preceding role)
- Hands off to: Developer / Fix Investigator

### 2. Developer / Fix Investigator

- Purpose: Investigate the root cause identified by QA and develop/implement a fix.
- Expected Inputs: QA Investigator's findings/report on the issue.
- Expected Outputs: Implemented fix/code change addressing the issue.
- Hands off from: QA Investigator
- Hands off to: Release Engineer

### 3. Release Engineer

- Purpose: Package, verify, and release the fix/change into the appropriate environment.
- Expected Inputs: Verified fix/code change from Test Engineer.
- Expected Outputs: Released/deployed change.
- Hands off from: Test Engineer
- Hands off to: (End of workflow — no succeeding role)

### 4. Test Engineer

- Purpose: Provide independent verification of fixes and changes before release.
- Expected Inputs: Implemented fix/code change from Developer / Fix Investigator.
- Expected Outputs: Verification report and regression summary confirming the fix is safe to release.
- Hands off from: Developer / Fix Investigator
- Hands off to: Release Engineer (on successful verification); back to Developer / Fix Investigator (if verification fails or regressions are found)

## Proposed Workflow Sequence

1. QA Investigator
2. Developer / Fix Investigator
3. Test Engineer
4. Release Engineer


