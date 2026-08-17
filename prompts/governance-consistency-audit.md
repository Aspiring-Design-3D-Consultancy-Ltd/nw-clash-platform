# Governance Consistency Audit


## Objective


Perform a comprehensive governance consistency audit across the repository.


The purpose of this audit is to identify:


- Missing records

- Broken references

- Orphaned references

- Status mismatches

- Documentation drift

- Governance inconsistencies

- Workflow-state inconsistencies

- Conflicting repository guidance


This audit is focused on governance integrity and repository truthfulness.


It does not investigate application defects unless governance records indicate a potential defect.


---


## Governance Principles


Follow repository governance principles:


- Repository documentation is authoritative.

- Evidence before conclusions.

- Governance records must be internally consistent.

- Referenced records must exist.

- Workflow state must be accurately represented.

- Historical records must not be rewritten.

- Findings must be evidence-based.


Review:


- CLAUDE.md

- .cline/bootstrap.md

- CURRENT_STATUS.md

- KNOWN_ISSUES.md

- INVESTIGATION_LOG.md

- RELEASE_SNAPSHOTS.md

- CHANGE_LOG.md

- DECISION_LOG.md

- All standalone DEC records

- Governance templates

- Workflow documentation

- Prompt library README (if present)


---


## Audit Activities


### Governance Record Inventory


Identify all:


#### Decisions (DEC)


#### Investigations (INV)


#### Known Issues (KI)


#### Monitoring Items (MI)


#### Release Snapshots (RS)


For each category provide:


- Identifier

- Location

- Status

- References


Identify:


### Missing Numbers


### Duplicate Identifiers


### Unreferenced Records


### Orphaned Records


---


### Reference Validation


Verify that all references resolve correctly.


Confirm:


#### Referenced Decisions Exist


#### Referenced Investigations Exist


#### Referenced Known Issues Exist


#### Referenced Monitoring Items Exist


#### Referenced Release Snapshots Exist


Identify:


### Broken References


### Missing Targets


### Incorrect Filenames


### Incorrect Identifiers


### Invalid Links


For each issue provide evidence.


---


### Status Consistency Review


Cross-check all governance documents.


Validate consistency for:


#### Active Investigations


#### Closed Investigations


#### Released Investigations


#### Monitoring Items


#### Known Issues


#### Workflow States


#### Release Status


Identify:


### Status Mismatches


### Duplicate Status Claims


### Contradictory Statements


### Workflow Drift


---


### Decision Record Review


Review:


- DECISION_LOG.md

- Standalone DEC documents


Verify:


#### Accurate Numbering


#### Proper References


#### Index Completeness


#### Decision Relationships


Identify:


### Missing Index Entries


### Missing References


### Incorrect References


### Duplicate Content


---


### Investigation Consistency Review


Verify:


#### Every Referenced Investigation Exists


#### Investigation Status Is Consistent


#### Investigation References Are Valid


#### Related Known Issues Are Present


#### Related Release Records Exist


Identify:


### Missing Investigations


### Partial Investigations


### Missing Closure Information


### Investigation Drift


---


### Known Issue Review


Verify:


#### Every Known Issue Exists


#### Numbering Is Consistent


#### Severity Information Exists


#### Investigation Relationships Are Valid


#### Closure Status Is Accurate


Identify:


### Missing Entries


### Orphaned References


### Numbering Gaps


### Missing Detail Sections


### Status Conflicts


---


### Monitoring Item Review


Verify:


#### Monitoring Records Exist


#### Monitoring Status Is Accurate


#### Monitoring References Resolve


#### Monitoring Justification Exists


Identify:


### Missing Monitoring Records


### Inconsistent Monitoring Status


### Unsupported Monitoring Claims


---


### Release Review


Verify:


#### Release Snapshots Exist


#### Investigation References Resolve


#### Commit References Exist


#### Test Baselines Match Referenced Data


#### Known Failure Lists Are Supported


Identify:


### Missing Release Documentation


### Unsupported Claims


### Release Drift


### Historical Inconsistencies


---


### Documentation Accuracy Review


Assess factual accuracy of repository guidance.


Verify:


#### File References


#### Branch References


#### Line Counts


#### Commit References


#### Workflow Descriptions


#### Test Instructions


#### Build Instructions


Identify:


### Outdated Guidance


### Incorrect Facts


### Misleading Instructions


### Historical Drift


---


### Repository-State Alignment


Determine whether repository state and governance state agree.


Verify:


#### Current Branch Information


#### Active Investigation Counts


#### Monitoring Counts


#### Release Counts


#### Decision Counts


#### Referenced Files


Identify:


### Repository / Governance Mismatches


### Missing Repository Records


### Unsupported Governance Statements


---


## Classification


For each finding classify as:


### Governance Defect


A governance record is incorrect or incomplete.


### Documentation Drift


Documentation no longer reflects reality.


### Repository Hygiene


Non-critical maintenance issue.


### Monitoring Candidate


Should be tracked but not investigated.


### Investigation Candidate


Evidence suggests formal investigation may be required.


### Informational


No action required.


Provide rationale.


---


## Severity Assessment


Assign:


### High


Likely to mislead future investigations, releases, or governance decisions.


### Medium


Impacts repository understanding or workflow execution.


### Low


Minor inconsistency or informational issue.


Provide supporting rationale.


---


## Deliverables


Provide:


### Executive Summary


### Governance Record Inventory


### Reference Validation Results


### Status Consistency Review


### Decision Record Review


### Investigation Review


### Known Issue Review


### Monitoring Item Review


### Release Review


### Documentation Accuracy Review


### Repository-State Alignment Review


### Findings


Classify findings into:


#### High Severity


#### Medium Severity


#### Low Severity


### Recommended Actions


For each finding identify:


- Immediate Action

- Future Action

- No Action Required


### Overall Governance Health


Choose one:


#### HEALTHY


No material inconsistencies identified.


#### HEALTHY WITH IMPROVEMENTS RECOMMENDED


Minor inconsistencies identified.


#### REMEDIATION RECOMMENDED


Material inconsistencies should be corrected.


#### GOVERNANCE INVESTIGATION RECOMMENDED


Evidence suggests governance defects requiring formal investigation.


Provide supporting rationale.


---


## Constraints


- Do not modify files.

- Do not create investigations.

- Do not update governance records.

- Do not implement fixes.

- Do not create commits.

- Audit and reporting only.


The purpose of this stage is to assess governance consistency, identify discrepancies, and provide evidence-based recommendations before governance issues become workflow problems.
