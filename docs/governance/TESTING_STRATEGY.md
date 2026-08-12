# Testing Strategy

## Purpose

Define the testing principles used by the BIM Coordination / Clash Management application.

This document establishes expectations for:

- Regression testing
- Bug-fix validation
- Test isolation
- Environment preparation
- Quality assurance

---

# Primary Test Framework

Framework:

Playwright

Purpose:

- Regression testing
- Feature verification
- Workflow validation
- Persistence validation

---

# Testing Principles

## Principle 1

Every confirmed bug fix should include validation.

Preferred:

- Automated regression test

Alternative:

- Documented manual verification when automation is not practical.

---

## Principle 2

Evidence before implementation.

Bugs should be:

1. Identified
2. Investigated
3. Verified
4. Reproduced

before implementation begins.

---

## Principle 3

Regression protection.

Where practical:

- New regression tests should accompany bug fixes.
- Existing tests should remain green.

---

# Test Isolation

Tests should not depend on:

- Previous test runs
- Existing localStorage state
- Existing IndexedDB state
- User-specific configuration

Tests should establish their own starting conditions.

---

# Environment Preparation

Before testing:

- Verify repository status.
- Verify application state.
- Verify storage state.
- Verify required seed/demo data.

When required:

- Clear localStorage
- Clear IndexedDB
- Reload application

---

# Persistence Testing

Special attention should be given to:

- localStorage
- IndexedDB
- Migration behaviour
- dataVersion handling
- Reset procedures

Because these areas affect multiple features simultaneously.

---

# Investigation Workflow

Testing supports the governance model.

Typical flow:

Project Analyst
→ Architect
→ QA Investigator
→ Developer
→ QA Retest
→ Implementation Manager
→ Repository Steward
→ Release Manager

QA activities should focus on:

- Evidence
- Reproduction
- Verification
- Coverage

---

# Known Risk Areas

Current monitoring areas:

- Migration complexity
- Delayed startup timers
- Review Queue persistence
- Dedup Queue persistence
- IndexedDB synchronization

---

# Success Criteria

A change should be considered validated when:

- Intended behaviour is verified.
- No regression is introduced.
- Test coverage is maintained or improved.
- Evidence supports the conclusion.