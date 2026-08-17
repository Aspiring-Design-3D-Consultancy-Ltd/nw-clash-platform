# QA Investigation


## Objective


Perform a structured investigation of a reported defect, unexpected behaviour, test failure, regression, user-reported issue, monitoring escalation, or repository concern.


The purpose of this stage is to:


- Reproduce the issue.

- Gather evidence.

- Validate observations.

- Determine impact.

- Establish scope.

- Identify the likely root cause.

- Define what additional investigation may be required.


This stage does not implement fixes.


The purpose is to establish facts and produce evidence suitable for architectural, development, and governance decision-making.


---


## Governance Requirements


Follow repository governance principles:


- Evidence before conclusions.

- Repository documentation is authoritative.

- Investigation before implementation.

- Root cause before remediation.

- Reproducibility is required where possible.

- Assumptions must be clearly identified.


Review:


- Project Analyst Review

- Architect Review (if available)

- CURRENT_STATUS.md

- KNOWN_ISSUES.md

- INVESTIGATION_LOG.md

- RELEASE_SNAPSHOTS.md

- Relevant source code

- Relevant tests

- Relevant logs and reports


---


## Investigation Intake


### Investigation Identifier


Document:


#### Investigation ID


#### Investigation Title


#### Report Source


#### Date Opened


#### Current Status


---


### Reported Behaviour


Describe:


#### Expected Behaviour


#### Actual Behaviour


#### User Impact


#### Business Impact


Separate:


### Confirmed Facts


### Assumptions


### Unknowns


---


## Reproduction Assessment


Determine whether the issue can be reproduced.


Document:


### Reproduction Steps


### Test Environment


### Inputs Used


### Result


Classify:


#### Reproduced


#### Partially Reproduced


#### Not Reproduced


Provide evidence.


---


## Evidence Collection


Gather all available evidence.


Sources may include:


### Test Failures


### Logs


### Screenshots


### Browser Console Output


### User Reports


### Existing Investigations


### Monitoring Items


### Governance Reviews


For each evidence source:


- Description

- Relevance

- Reliability


Classify evidence strength:


### Strong


### Moderate


### Weak


---


## Scope Assessment


Identify:


### Affected Functionality


### Affected Components


### Affected Files


### Related Features


### Potentially Impacted Areas


Determine:


### Known Scope


### Suspected Scope


### Unknown Scope


Provide rationale.


---


## Historical Analysis


Review repository history.


Identify:


### Similar Investigations


### Related Known Issues


### Related Monitoring Items


### Relevant Releases


### Prior Defects


For each:


- Reference

- Relevance

- Similarity


Determine whether the issue appears to be:


### New


### Regression


### Variant


### Previously Observed Pattern


---


## Root Cause Analysis


Based on available evidence assess:


### Most Likely Root Cause


### Alternative Explanations


### Unknown Factors


Classify confidence as:


#### High


#### Medium


#### Low


Provide evidence supporting the classification.


If root cause cannot be determined:


State what additional evidence is required.


---


## Risk Assessment


Assess:


### Technical Risk


### Data Integrity Risk


### Governance Risk


### User Impact


### Operational Risk


Classify each as:


- Low

- Medium

- High


Provide supporting rationale.


---


## Investigation Findings


Summarize:


### Confirmed Findings


### Rejected Hypotheses


### Open Questions


### Additional Evidence Required


---


## Remediation Feasibility Assessment


Determine:


### Root Cause Confirmed


### Remediation Likely Feasible


### Additional Investigation Required


### Monitoring More Appropriate


Do not design fixes.


Only assess whether remediation appears possible.


---


## Deliverables


Provide:


### Executive Summary


### Reported Behaviour


### Reproduction Results


### Evidence Collected


### Scope Assessment


### Historical Analysis


### Root Cause Analysis


### Risk Assessment


### Investigation Findings


### Confidence Assessment


### Recommended Next Step


Choose one:


#### PROCEED TO DEVELOPER ASSESSMENT


Root cause sufficiently understood.


#### RETURN FOR ADDITIONAL INVESTIGATION


More evidence required.


#### CONVERT TO MONITORING ITEM


Insufficient evidence for a defect, but continued observation warranted.


#### CLOSE


Issue not substantiated.


Include supporting rationale.


---


## Constraints


- Do not modify files.

- Do not implement fixes.

- Do not update governance records.

- Do not create releases.

- Do not create commits.

- Investigation and evidence gathering only.


The purpose of this stage is to establish facts, determine root cause, and provide evidence-based findings for downstream decision-making.
