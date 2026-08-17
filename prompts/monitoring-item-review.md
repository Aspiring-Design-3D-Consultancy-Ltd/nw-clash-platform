# Monitoring Item Review


## Objective


Perform a structured review of an active Monitoring Item (MI) to determine whether it should:


- Remain under observation.

- Be reclassified.

- Be escalated to a formal investigation.

- Be converted into a Known Issue.

- Be closed.


The purpose of this review is to ensure Monitoring Items remain evidence-based, actionable, and aligned with repository governance.


Monitoring Items are intended to track elevated risk, uncertainty, unusual patterns, emerging concerns, or areas requiring continued observation where evidence does not yet justify a formal defect investigation.


This review does not implement fixes.


---


## Governance Requirements


Follow repository governance principles:


- Evidence before conclusions.

- Repository documentation is authoritative.

- Monitoring is not a substitute for investigation.

- Escalate when evidence supports escalation.

- Do not assume root cause without evidence.

- Monitoring must have a clear purpose and review outcome.


Review:


- CURRENT_STATUS.md

- KNOWN_ISSUES.md

- INVESTIGATION_LOG.md

- RELEASE_SNAPSHOTS.md

- Relevant Monitoring Item records

- Related investigations

- Related release records

- Related test results

- Relevant source code (if applicable)


---


## Monitoring Item Assessment


### Monitoring Item Summary


Document:


#### Monitoring Item ID


#### Monitoring Item Title


#### Date Introduced


#### Original Reason For Monitoring


#### Current Status


#### Last Review Date


Summarize the monitoring objective.


---


### Historical Context Review


Review:


- Original creation rationale

- Related investigations

- Related Known Issues

- Related Release Snapshots

- Previous monitoring assessments


Determine:


#### Original Concern


#### Evidence Previously Collected


#### Subsequent Findings


#### Trend Direction


Classify:


- Improving

- Stable

- Worsening

- Unknown


Provide supporting evidence.


---


### Evidence Review


Review all available evidence.


Potential sources:


- Test results

- Repeat-test results

- Regression testing

- User reports

- Release records

- Investigation findings

- Governance reviews

- Repository audits

- Source-code analysis


Classify evidence quality as:


### Strong Evidence


Direct evidence supporting conclusions.


### Moderate Evidence


Partially supportive evidence.


### Weak Evidence


Suggestive but inconclusive evidence.


### No New Evidence


No meaningful evidence gathered since last review.


Provide rationale.


---


### Current Risk Assessment


Assess:


#### Technical Risk


#### Regression Risk


#### Governance Risk


#### Data Integrity Risk


#### Operational Risk


#### User Impact


Classify each:


- Low

- Medium

- High


Provide supporting rationale.


---


### Trend Analysis


Determine how the monitored condition has changed since the previous review.


Assess:


#### Improving


Risk decreasing.


#### Stable


Risk largely unchanged.


#### Worsening


Risk increasing.


#### Escalating


Evidence now supports formal investigation.


Provide evidence.


---


### Investigation Escalation Assessment


Determine whether escalation to an investigation is warranted.


Consider:


#### Repeat Occurrences


#### New Failures


#### New Reproduction Evidence


#### Increased User Impact


#### Increased Data Risk


#### Architectural Concerns


#### Related Defects


Choose one:


### Investigation Not Required


### Investigation May Be Required


### Investigation Required


Provide detailed rationale.


---


### Monitoring Effectiveness Review


Assess:


#### Is the monitoring still providing value?


#### Is the monitoring scope correct?


#### Is the review frequency appropriate?


#### Does the monitoring objective remain valid?


Provide recommendations.


---


### Related Records Review


Verify consistency with:


- CURRENT_STATUS.md

- KNOWN_ISSUES.md

- INVESTIGATION_LOG.md

- RELEASE_SNAPSHOTS.md


Identify:


#### Missing References


#### Broken References


#### Status Mismatches


#### Governance Drift


Provide findings.


---


## Recommendation Assessment


Choose one:


### Continue Monitoring


Risk remains under observation.


### Increase Monitoring Frequency


Risk appears to be increasing.


### Reduce Monitoring Frequency


Risk appears stable and low.


### Convert To Known Issue


Condition is understood and should be formally tracked.


### Escalate To Formal Investigation


Evidence now supports investigation.


### Close Monitoring Item


The risk no longer warrants monitoring.


Provide supporting rationale.


---


## Deliverables


Provide:


### Executive Summary


### Monitoring Item Summary


### Historical Context


### Evidence Review


### Risk Assessment


### Trend Analysis


### Monitoring Effectiveness Assessment


### Governance Consistency Review


### Findings


### Recommendation


Choose one:


#### CONTINUE MONITORING


#### INCREASE MONITORING


#### REDUCE MONITORING


#### CONVERT TO KNOW ISSUE


#### ESCALATE TO INVESTIGATION


#### CLOSE MONITORING ITEM


Include evidence-based justification for the recommendation.


---


## Constraints


- Do not modify files.

- Do not implement fixes.

- Do not update governance records.

- Do not create investigations.

- Do not perform releases.

- Review and recommendation only.


The purpose of this stage is to determine the appropriate lifecycle outcome for a Monitoring Item based on evidence and risk.
