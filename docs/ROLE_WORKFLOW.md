# Role Workflow

This document describes the purpose, inputs, outputs, and handoffs for each role
currently listed in docs/ROLE_INDEX.md, along with a proposed workflow sequence.

## Roles

### 1. Project Analyst

- Purpose: Perform pre-investigation architectural analysis of a reported issue or requested change, identifying affected systems, dependencies, and risks before diagnostic or implementation work begins.
- Expected Inputs: A reported issue, feature request, or area of concern; CLAUDE.md; AI_DISCOVERY_LOG.md.
- Expected Outputs: An investigation plan identifying affected systems, cross-system dependencies, and applicable risks/golden rules.
- Hands off from: (Start of workflow — no preceding role)
- Hands off to: QA Investigator

### 2. QA Investigator

- Purpose: Investigate and validate quality issues (e.g. bugs, regressions, unexpected behavior) within the project.
- Expected Inputs: Investigation plan from Project Analyst identifying affected systems, dependencies, and risks.
- Expected Outputs: Findings/report on the investigated issue, including root cause and evidence.
- Hands off from: Project Analyst
- Hands off to: Developer / Fix Investigator

### 3. Developer / Fix Investigator

- Purpose: Investigate the root cause identified by QA and develop/implement a fix.
- Expected Inputs: QA Investigator's findings/report on the issue.
- Expected Outputs: Implemented fix/code change addressing the issue.
- Hands off from: QA Investigator
- Hands off to: Test Engineer

### 4. Test Engineer

- Purpose: Provide independent verification of fixes and changes before release.
- Expected Inputs: Implemented fix/code change from Developer / Fix Investigator.
- Expected Outputs: Verification report and regression summary confirming the fix is safe to release.
- Hands off from: Developer / Fix Investigator
- Hands off to: Release Engineer (on successful verification); back to Developer / Fix Investigator (if verification fails or regressions are found)

### 5. Release Engineer

- Purpose: Package, verify, and release the fix/change into the appropriate environment.
- Expected Inputs: Verified fix/code change from Test Engineer.
- Expected Outputs: Released/deployed change.
- Hands off from: Test Engineer
- Hands off to: (End of workflow — no succeeding role, on approval); back to Developer / Fix Investigator (on a No-Go decision, if critical issues remain unresolved)

## Proposed Workflow Sequence

1. Project Analyst
2. QA Investigator
3. Developer / Fix Investigator
4. Test Engineer
5. Release Engineer
