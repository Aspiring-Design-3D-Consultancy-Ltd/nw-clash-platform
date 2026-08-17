# Project Analyst Review


## Objective


Perform the initial assessment of a newly reported issue, observation, enhancement request, monitoring concern, governance finding, or repository hygiene item.


The purpose of this review is to:


- Determine what has been reported.

- Establish the known facts.

- Gather evidence.

- Classify the item correctly.

- Assess potential scope.

- Recommend the appropriate workflow path.


This review represents the formal entry point into the governance process.


No implementation decisions should be made during this stage.


---


## Governance Principles


Follow repository governance principles:


- Evidence before conclusions.

- Investigation before implementation.

- Repository documentation is authoritative.

- Minimal-change principle.

- Do not assume root cause.

- Do not propose solutions before classification.


Review:


- CURRENT_STATUS.md

- KNOWN_ISSUES.md

- INVESTIGATION_LOG.md

- RELEASE_SNAPSHOTS.md

- Applicable Decisions (DEC-001 through current)

- Relevant repository files


---


## Intake Assessment


### Reported Item


Summarize:


- What was observed

- Who reported it (if known)

- When it was observed

- Environment involved

- Expected behaviour

- Actual behaviour


Separate facts from assumptions.


---


### Evidence Review


Identify available evidence:


- Screenshots

- Logs

- Test failures

- Console output

- User reports

- Governance findings

- Repository observations


Classify evidence quality:


#### Strong


Directly demonstrates the issue.


#### Moderate


Supports but does not prove the issue.


#### Weak


Suggests a possibility but requires confirmation.


Identify missing evidence.


---


### Historical Review


Search for related records.


Review:


- Current Monitoring Items

- Known Issues

- Past Investigations

- Release Snapshots


Determine whether the item is:


#### Existing Known Issue


Already tracked.


#### Monitoring Escalation


Known observation is worsening.


#### Regression


Previously fixed behaviour has reappeared.


#### Variant


Related to a previously investigated issue.


#### New Observation


No known precedent.


Provide supporting references.


---


## Classification


Determine the most appropriate classification.


Choose one:


### Defect Candidate


Unexpected behaviour requiring investigation.


### Monitoring Item Candidate


Trend, risk, or observation requiring ongoing review.


### Repository Hygiene Item


Documentation, governance, or repository maintenance concern.


### Enhancement Request


New functionality or workflow improvement.


### Governance Concern


Process, workflow, or compliance issue.


### User Error


No system issue identified.


### Insufficient Evidence


Unable to classify confidently.


Provide rationale.


---


## Scope Assessment


Identify:


### Likely Affected Components


Examples:


- working.html

- Governance records

- Tests

- Scripts

- Documentation

- Build workflows


### Potential Impact


Assess:


#### Users


#### Data


#### Releases


#### Governance


#### Testing


Classify:


- Low

- Medium

- High


with justification.


---


## Investigation Requirement


Determine whether further investigation is warranted.


Choose one:


### Investigation Required


Evidence supports opening a formal investigation.


### Additional Evidence Required


Further information needed before opening an investigation.


### Monitoring Recommended


Continue observation.


### No Further Action


Issue does not warrant progression.


Provide rationale.


---


## Workflow Routing Recommendation


Recommend the appropriate workflow:


### Workflow A


Defect Investigation and Remediation


### Workflow F


Repository Hygiene


### Monitoring Process


Monitoring Item lifecycle


### Enhancement Assessment


Feature planning and design


### Governance Review


Governance-specific review


Explain why the recommended workflow is appropriate.


---


## Risk Assessment


Assess:


### Technical Risk


### Governance Risk


### Release Risk


### User Impact


Classify each:


- Low

- Medium

- High


Provide supporting evidence.


---


## Deliverables


Provide:


### Executive Summary


### Observations


### Evidence Assessment


### Historical Context


### Classification


### Scope Assessment


### Impact Assessment


### Risk Assessment


### Recommended Workflow


### Recommended Next Step


### Investigation Recommendation


Choose one:


#### OPEN INVESTIGATION


or


#### GATHER MORE EVIDENCE


or


#### MONITOR


or


#### CLOSE


Provide rationale.


---


## Constraints


- Do not modify files.

- Do not implement fixes.

- Do not assume root cause.

- Do not update governance records.

- Do not create commits.


The purpose of this stage is to accurately classify incoming work and determine the correct governance path.
