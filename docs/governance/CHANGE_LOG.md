# Change Log

## Purpose

Record major project milestones, releases, and significant changes.

This document is not intended to replace Git history.

Only high-level changes should be recorded here.

---

## Future Entries

Format:

### YYYY-MM-DD

Summary:

Changes:

Notes:

---

### 2026-08-15

Summary:

Release Snapshot capability designed and implemented (DEC-012). First snapshot (RS-001) generated using the already-released INV-008 as the reference implementation.

Changes:

- Added: `docs/governance/DEC-012-RELEASE-SNAPSHOT.md`
- Added: `docs/governance/RELEASE_SNAPSHOTS.md` (includes RS-001)
- Added: `scripts/generate-release-snapshot.mjs`
- Updated: `GOVERNANCE_ORCHESTRATOR.md`, `WORKFLOW_ROUTING.md`, `WORKFLOW_TEMPLATES.md`, `CURRENT_STATUS.md` (cross-references and closure record)

Notes:

Documentation/tooling capability only. No `working.html` changes. No investigation reopened.

---

### 2026-08-17

Summary:

Prompt Library Governance Acceptance. The governance workflow prompt library held in `prompts/` was built, reviewed, and formally accepted as a repository governance asset under DEC-013.

Changes:

- Added: `prompts/` — 20 prompts plus `prompts/README.md` (21 files)
- Added: `docs/governance/DEC-013-PROMPT-LIBRARY.md`
- Updated: `CLAUDE.md` (Prompt Library discoverability section)
- Updated: `DECISION_LOG.md` (DEC-013 entry; index entries added for DEC-009, DEC-010, DEC-011 and DEC-012, which were previously absent from the index)

Library scope:

- 20 prompts across four categories: Session Startup, Issue Discovery & Triage, Governance Workflow, Strategic Reviews
- 8 of 8 governance roles covered (Project Analyst, Architect, QA Investigator, Developer, Environment Steward, Repository Steward, Implementation Manager, Release Manager)
- Complete governance workflow coverage: every workflow stage named by a prompt has a corresponding prompt file
- Discoverable from `CLAUDE.md`, which references `prompts/` and `prompts/README.md`
- Governance acceptance recorded via DEC-013

Notes:

Documentation only. No application code changes. No `working.html` changes. No test changes. No deployment impact. No investigation opened.

DEC-013 records and constrains an existing asset; it creates no new role, workflow or decision gate. DEC-009 gates, DEC-010 workflow states, DEC-011 remediation requirements and DEC-012 snapshot rules are unchanged.