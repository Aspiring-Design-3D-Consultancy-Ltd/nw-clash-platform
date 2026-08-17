# Architect Review


## Objective


Perform an architectural assessment of a confirmed issue, proposed remediation, enhancement request, monitoring escalation, or governance-driven change.


The purpose of this review is to:


- Evaluate solution options.

- Assess architectural impact.

- Validate alignment with repository design principles.

- Identify risks and dependencies.

- Recommend an implementation approach.

- Define architectural constraints.


This review occurs after Project Analyst review and before Developer Assessment.


The Architect is responsible for determining *how* a problem should be solved, not implementing the solution.


---


## Governance Requirements


Follow repository governance principles:


- Evidence before conclusions.

- Investigation before implementation.

- Repository documentation is authoritative.

- Minimal-change principle.

- Preserve existing behavior unless change is explicitly required.

- Avoid scope expansion.


Review:


- Relevant Project Analyst findings

- CURRENT_STATUS.md

- KNOWN_ISSUES.md

- INVESTIGATION_LOG.md

- RELEASE_SNAPSHOTS.md

- Applicable Decisions (DEC series)

- Relevant code and documentation


---


## Architectural Context


### Problem Statement


Summarize:


- What problem is being addressed.

- Why it matters.

- Scope of impact.

- Constraints.


Separate:


#### Confirmed Facts


#### Assumptions


#### Open Questions


---


### Existing Architecture Review


Review the current implementation.


Identify:


#### Current Design


How the current solution works.


#### Key Components


Relevant:


- Functions

- Modules

- Data structures

- Workflows

- Tests

- Governance records


#### Existing Constraints


Examples:


- Data compatibility

- Migration requirements

- Release requirements

- Browser limitations

- Governance requirements


---


## Solution Option Review


Evaluate all viable solution approaches.


For each option:


### Option Description


Explain the proposed design.


### Architectural Benefits


Assess:


- Simplicity

- Maintainability

- Reliability

- Testability

- Future extensibility


### Architectural Risks


Assess:


- Complexity

- Coupling

- Technical debt

- Operational impact

- User impact


### Compatibility


Assess:


- Existing data

- Existing workflows

- Existing tests

- Governance framework


### Implementation Complexity


Classify:


- Low

- Medium

- High


Provide rationale.


---


## Preferred Architecture


Select the recommended option.


For the preferred option explain:


### Why It Is Preferred


### Why Alternatives Are Inferior


### Alignment With Repository Principles


Reference:


- Minimal-change principle

- Existing design patterns

- Prior investigations

- Lessons learned from previous releases


---


## Dependency Review


Identify:


### Code Dependencies


### Data Dependencies


### Migration Dependencies


### Governance Dependencies


### Test Dependencies


For each dependency:


- Impact

- Risk level

- Required mitigation


---


## Data Impact Assessment


Determine:


### Data Mutation Risk


### Data Loss Risk


### Migration Requirements


### Rollback Considerations


### Recovery Considerations


Classify:


- Low

- Medium

- High


Provide rationale.


---


## Test Strategy Review


Define:


### Existing Tests To Execute


### New Tests Required


### Reliability Testing Requirements


### Regression Testing Requirements


### Full Suite Requirements


Explain why each level of testing is required.


---


## Governance Impact Assessment


Determine whether the change affects:


### Existing Investigations


### Known Issues


### Monitoring Items


### Release Snapshots


### Repository Documentation


### Decision Records


Identify required governance updates.


---


## Risk Assessment


Assess:


### Technical Risk


### Architectural Risk


### Data Risk


### Governance Risk


### Release Risk


Classify:


- Low

- Medium

- High


Provide supporting rationale.


---


## Deliverables


Provide:


### Executive Summary


### Current Architecture


### Problem Assessment


### Options Evaluated


### Preferred Architecture


### Dependency Review


### Data Impact Assessment


### Test Strategy


### Governance Impact Assessment


### Risk Assessment


### Architectural Constraints


### Recommendation


Choose one:


#### APPROVED FOR DEVELOPER ASSESSMENT


Architecture is sufficiently understood and a preferred design approach exists.


or


#### FURTHER ANALYSIS REQUIRED


Additional investigation, evidence, or design work is required.


Provide clear rationale.


---


## Constraints


- Do not modify files.

- Do not implement changes.

- Do not update governance records.

- Do not create commits.

- Do not perform testing.

- Architecture and design review only.


The purpose of this stage is to determine the best architectural approach before implementation planning begins.
