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

### 2026-08-26

Summary:

Protected-region invariant gate corrected and recorded in the repository
(DEC-013). The fingerprints previously carried in briefs did not reproduce under
any stated algorithm, leaving the gate unrunnable.

Changes:

- Added: `docs/governance/PROTECTED_REGIONS.md` (gate procedure, algorithm,
  corrected fingerprints, failure handling)
- Updated: `docs/governance/DECISION_LOG.md` (DEC-013)
- Updated: `docs/governance/WORKING_AGREEMENTS.md` (cross-reference under
  Repository Standards)

Notes:

Documentation only. No `working.html` changes. Both protected blocks were
verified unchanged at `161894f` before the fingerprints were recorded.

