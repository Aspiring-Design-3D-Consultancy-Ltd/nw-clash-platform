# Working Agreements

## Purpose

This document captures the day-to-day operating agreements for the BIM Coordination / Clash Management application.

These agreements supplement the governance framework and help ensure consistent decision-making across contributors, devices, and AI sessions.

---

# Investigation First

Production changes should not be made before:

- Problem understanding
- Architectural assessment
- Evidence collection
- Verification

have been completed.

Investigation precedes implementation.

---

# Minimal Change Principle

Prefer:

- Small, targeted fixes
- Clearly scoped changes
- Localized modifications

Avoid:

- Broad refactors
- Scope expansion
- Unrelated cleanup

unless separately reviewed and approved.

---

# Evidence Standards

Conclusions should be supported by evidence.

Evidence may include:

- Code references
- Reproduction steps
- Test results
- Repository history
- Environment analysis

Assumptions must be clearly identified as assumptions.

---

# Testing Expectations

Where practical:

- Verified defects should receive regression protection.
- Existing tests should continue to pass.
- Test coverage should be maintained or improved.

Testing is part of implementation, not an afterthought.

---

# Repository Standards

Before implementation:

- Review repository status.
- Review existing investigations.
- Check for known issues.
- Check for existing decisions affecting the work.

Before release:

- Verify repository health.
- Verify test status.
- Verify governance workflow completion.

---

# Documentation Standards

Significant discoveries should be recorded.

Potential destinations:

- CURRENT_STATUS.md
- KNOWN_ISSUES.md
- INVESTIGATION_LOG.md
- ARCHITECTURE_OVERVIEW.md
- DECISION_LOG.md

Repository documentation should remain the authoritative project record.

---

# Environment Standards

When investigating state-related behaviour, consider:

- localStorage
- IndexedDB
- migrations
- dataVersion
- seed data
- demo data
- reset procedures

before drawing conclusions.

---

# AI Usage Standards

The repository is the primary source of project knowledge.

AI chat history is temporary.

Project knowledge should be captured within:

- Governance documentation
- Investigation logs
- Decision logs
- Architecture documentation

This ensures portability across:

- Personal laptops
- Work laptops
- Different AI accounts
- Different AI tools

---

# Continuous Improvement

The governance framework may evolve over time.

When gaps are discovered:

1. Record the gap.
2. Assess the impact.
3. Update documentation.
4. Validate the change.
5. Record the decision when appropriate.

Continuous improvement should be deliberate and documented.

---

# Current Working Approach

The project currently follows:

- Role-Based Workflow (Option A)
- Repository-first project memory
- Investigation before implementation
- Evidence-driven decision making

Autonomous agents are not currently part of the approved workflow.