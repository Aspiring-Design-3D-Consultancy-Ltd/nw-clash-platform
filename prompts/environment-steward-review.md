# Environment Steward Review


## Objective


Perform a structured assessment of the repository, development, testing, runtime, and deployment environments to determine whether they are suitable for the intended activity.


The purpose of this review is to:


- Verify environment readiness.

- Validate critical assumptions.

- Identify environmental risks.

- Confirm repository state.

- Assess tooling and dependency health.

- Prevent environment-related defects.

- Establish a known-good baseline before investigation, implementation, testing, or release activities.


This role is executed when environmental factors may influence outcomes.


---


## Governance Requirements


Follow repository governance principles:


- Evidence before conclusions.

- Repository documentation is authoritative.

- Environment assumptions must be verified.

- Environmental findings must be separated from application defects.

- Findings must be supported by evidence.


Review:


- CLAUDE.md

- .cline/bootstrap.md

- CURRENT_STATUS.md

- Relevant environment documentation

- Repository configuration

- Toolchain configuration

- Test configuration

- Deployment documentation


---


## Environment Summary


### Environment Type


Identify:


- Development

- Test

- CI/CD

- Local Repository

- Remote Repository

- Production

- Other


### Operating Environment


Document:


- Operating System

- Runtime Platform

- Execution Context


### Toolchain Environment


Document:


- Git

- Node.js

- NPM

- Playwright

- VS Code

- Claude Code

- Relevant repository tools


### Repository Environment


Document:


- Branch

- Commit

- Working tree state

- Remote status


---


## Repository State Review


Verify:


### Current Branch


### Current Commit


### Working Tree Status


### Repository Health


### Remote Synchronization


Identify:


#### Uncommitted Changes


#### Untracked Files


#### Diverged Branches


#### Repository Risks


Provide supporting evidence.


---


## Toolchain Review


Verify the availability and health of:


### Git


### Node.js


### NPM


### Playwright


### Build Tools


### Test Tools


### Repository Utilities


For each:


- Version

- Status

- Observed Issues


Classify:


- Healthy

- Warning

- Critical


---


## Dependency Review


Verify:


### Dependency Installation Status


### Package Consistency


### Lock File Presence


### Dependency Version Alignment


### Test Dependency Readiness


Identify:


#### Missing Dependencies


#### Version Drift


#### Lock File Risks


#### Installation Issues


#### Dependency Risks


Provide evidence.


---


## Test Environment Review


Verify:


### Test Repository State


### Test Configuration


### Browser Availability


### Test Execution Requirements


### Known Testing Conventions


Review:


- Historical investigations

- Known testing constraints

- Prior QA findings


Identify:


#### Missing Prerequisites


#### Configuration Issues


#### Environment Risks


#### Test Execution Risks


Determine whether tests can be executed successfully.


---


## Runtime Environment Review


Assess:


### Browser Environment


### Local Storage


### IndexedDB


### Data Persistence


### Runtime Configuration


### External Dependencies


Identify:


#### Persistence Risks


#### Runtime Dependencies


#### Browser Dependencies


#### Environment-Specific Behaviour


Provide supporting evidence.


---


## Deployment Environment Review


If applicable, verify:


### Deployment Process


### Deployment Documentation


### Deployment Dependencies


### Runtime Hosting Assumptions


### External Service Dependencies


Identify:


#### Deployment Risks


#### Documentation Gaps


#### Unsupported Assumptions


#### Operational Concerns


---


## Historical Environment Review


Review:


- Previous investigations

- Monitoring Items

- Known Issues

- Release Snapshots


Determine whether historical environment findings remain relevant.


Identify:


#### Recurring Environment Issues


#### Known Environment Risks


#### Prior Environment Defects


#### Environment-Related Lessons Learned


---


## Sample Environment Verification Activities


Select only those relevant to the task.


### Repository Verification


Review:


- Branch

- Commit

- Working tree

- Tracking remote


Questions:


- Is the repository on the correct branch?

- Is the branch synchronized?

- Is the baseline correct?


---


### Toolchain Verification


Review:


- Tool versions

- Installation status

- Accessibility


Questions:


- Are required tools available?

- Are versions consistent?

- Are known constraints documented?


---


### Test Environment Validation


Review:


- Test dependencies

- Browser availability

- Configuration files


Questions:


- Can tests execute?

- Are required packages installed?

- Are test prerequisites satisfied?


---


### Dependency Verification


Review:


- package.json

- lock files

- installed dependencies


Questions:


- Are versions controlled?

- Is dependency drift possible?

- Is the environment reproducible?


---


### Runtime Validation


Review:


- Storage usage

- Browser compatibility

- Runtime assumptions


Questions:


- Are environmental dependencies documented?

- Can runtime behaviour vary by environment?


---


### Deployment Validation


Review:


- Deployment instructions

- Runtime dependencies

- External services


Questions:


- Is deployment reproducible?

- Are assumptions valid?

- Are external dependencies documented?


---


## Environment Risk Assessment


Assess:


### Toolchain Risk


### Dependency Risk


### Testing Risk


### Runtime Risk


### Deployment Risk


### Governance Risk


Classify each as:


- Low

- Medium

- High


Provide rationale.


---


## Deliverables


Provide:


### Executive Summary


### Environment Summary


### Repository State Review


### Toolchain Review


### Dependency Review


### Test Environment Review


### Runtime Environment Review


### Deployment Environment Review


### Historical Environment Review


### Environment Risks


### Findings


### Recommendation


Choose one:


#### ENVIRONMENT READY


Environment is suitable for the intended activity.


#### ENVIRONMENT READY WITH CONDITIONS


Environment may be used subject to identified constraints.


#### ENVIRONMENT REMEDIATION REQUIRED


Environmental issues should be addressed before proceeding.


Provide detailed supporting rationale.


---


## Constraints


- Do not modify files.

- Do not install software.

- Do not update dependencies.

- Do not implement fixes.

- Do not create releases.

- Assessment and recommendation only.


The purpose of this stage is to validate environmental readiness, identify environmental risks, and establish a trustworthy baseline before repository activities proceed.
