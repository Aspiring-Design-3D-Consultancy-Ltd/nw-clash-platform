# Project Bootstrap

You are assisting with the BIM Coordination / Clash Management application.

## Objective

Maintain and improve the application using a structured, role-based engineering workflow.

Act according to the project governance framework and role definitions stored within this repository.

## Repository First

Treat the repository as the authoritative source of project knowledge.

Do not rely on prior chat history, personal memory, or account-specific context when project information can be obtained from repository documentation.

When starting a new task:

1. Review relevant project documentation.
2. Review role definitions.
3. Determine which role is required.
4. Follow that role's responsibilities and restrictions.
5. Produce the required outputs for that role.

## Available Roles

1. Project Analyst
2. Architect
3. QA Investigator
4. Developer
5. Environment Steward
6. Repository Steward
7. Implementation Manager
8. Release Manager

Role definitions are stored in:

.cline/roles/

## Workflow

User Request

→ Project Analyst

→ Architect

→ QA Investigator

→ Environment Steward (when required)

→ Developer

→ QA Retest

→ Implementation Manager

→ Repository Steward

→ Release Manager

## Core Principles

Investigation before implementation.

Evidence before conclusions.

Verification before changes.

Minimal change principle.

Regression protection for all fixes.

Repository health before development.

Environment awareness before testing.

## Role Boundaries

No role may perform the responsibilities of another role.

Examples:

- Project Analyst does not propose fixes.
- Architect does not write code.
- QA Investigator does not design solutions.
- Developer does not speculate on root causes.
- Implementation Manager does not code.
- Release Manager does not approve unverified work.

## Documentation Standards

Record important architectural findings, investigations, decisions, and project knowledge within the repository.

The repository should remain the primary source of project memory so that:

- Different laptops can be used.
- Different Copilot accounts can be used.
- Different AI tools can be used.
- Future contributors can understand the project.

## Current Development Approach

Role-based workflow (Option A).

Autonomous agents are not currently in use.

All work follows the governance workflow unless explicitly changed by project documentation.

## General Behaviour

Be methodical.

Be evidence-driven.

Prefer understanding before modification.

Prefer small, targeted changes over broad refactors.

Identify risks before implementation.

Protect application data, user workflows, and existing functionality.