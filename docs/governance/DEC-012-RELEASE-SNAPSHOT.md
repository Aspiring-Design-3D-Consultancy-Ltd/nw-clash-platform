# DEC-012

Title:

Release Snapshot Capability

Status:

Approved

Date:

2026-08-15

Decision Type:

Governance Framework

Related Decisions:

- DEC-007
- DEC-009
- DEC-010
- DEC-011

Related Documents:

- GOVERNANCE_ORCHESTRATOR.md
- WORKFLOW_ROUTING.md
- WORKFLOW_TEMPLATES.md
- CURRENT_STATUS.md
- KNOWN_ISSUES.md
- INVESTIGATION_LOG.md
- RELEASE_SNAPSHOTS.md

Related Investigations:

- INV-008 - IndexedDB Reset Reliability Investigation (reference implementation: RS-001)

---

# Context

DEC-007 established that repository documentation is the authoritative
workflow state. DEC-009 and DEC-010 automated workflow progression and
introduced a deterministic workflow-state model. DEC-011 ensured confirmed
defects resolve to a remediation recommendation rather than indefinite
monitoring.

Together these decisions make CURRENT_STATUS.md, KNOWN_ISSUES.md, and
INVESTIGATION_LOG.md accurate at any given moment, but none of them produce
a single, point-in-time, cross-referenced record that ties repository state
(branch/commit), governance state (investigations, monitoring items), and
test baseline (pass/fail counts) together for a specific release.

This information currently exists but is scattered across three living
documents that continue to change after a release. There is no fixed
artifact that answers, unambiguously, "what was true about the repository,
governance, and tests at the moment release X shipped?"

---

# Problem Statement

Without a Release Snapshot mechanism:

- Reconstructing the state of a past release requires manually cross-
  referencing CURRENT_STATUS.md, KNOWN_ISSUES.md, and INVESTIGATION_LOG.md
  at a specific point in git history.
- Living governance documents are correct for "now" but are not a stable
  reference for "then" — they are edited by later investigations.
- There is no single artifact release auditing, onboarding, or future AI
  sessions can read to understand a specific release's full state without
  reconstructing it from git history and diffed documentation.
- Future automation (e.g. Release Engineer / Release Manager tooling) has
  no defined, mechanical process to produce this record consistently.

---

# Decision

A Release Snapshot capability is adopted.

A Release Snapshot is a dated, immutable, point-in-time record capturing:

1. Repository state (branch, release commit, HEAD at time of capture).
2. Governance state (active investigations, closed/released investigations,
   monitoring items — sourced from CURRENT_STATUS.md and KNOWN_ISSUES.md at
   capture time).
3. Investigation state (which investigations are closed/released as of this
   snapshot — sourced from INVESTIGATION_LOG.md).
4. Test baseline (total/passed/failed test counts and named known failures
   — sourced from the most recent QA Retest / Release Manager evidence).
5. Release status (what was released, at what commit, and its approval
   record).

Release Snapshots are recorded in `docs/governance/RELEASE_SNAPSHOTS.md`
using sequential IDs (`RS-001`, `RS-002`, ...). See RELEASE_SNAPSHOTS.md for
the file location, naming convention, generation process, and template.

INV-008 (the most recently completed release) is adopted as the first
reference implementation: `RS-001`.

---

# Rules

## Rule 1 - One Ledger File

Release Snapshots accumulate as dated entries within a single ledger file
(`RELEASE_SNAPSHOTS.md`), consistent with the existing pattern used by
`DECISION_LOG.md`, `INVESTIGATION_LOG.md`, and `CHANGE_LOG.md`.

A new file per snapshot is not created. This minimizes documentation
sprawl.

## Rule 2 - Snapshots Are Immutable

Once recorded, a Release Snapshot entry is not edited to reflect later
repository state. If a later investigation affects a past snapshot's
accuracy (e.g. a monitoring item is later resolved), that is recorded in a
*new* snapshot or in the relevant living document — not by rewriting
history.

## Rule 3 - Repository Facts Are Automatable; Governance Judgment Is Not

Repository-state facts (branch, HEAD, release commit, clean/dirty working
tree) may be captured automatically by a script (see RELEASE_SNAPSHOTS.md
"Automation").

Governance-state facts (active investigations, monitoring items, test
baseline) must be sourced from the authoritative governance documents
(CURRENT_STATUS.md, KNOWN_ISSUES.md, INVESTIGATION_LOG.md, and the most
recent QA Retest evidence) at the time of capture, not inferred or
fabricated by automation. This is consistent with DEC-009's "Repository
State Validation Required" and "Insufficient Evidence" decision gates.

## Rule 4 - Snapshot Generation Is Not a Release Gate

Generating a Release Snapshot documents a release; it does not gate one.
Existing decision gates (DEC-009 Release Authorization, DEC-010 `Release
Approved` state, WORKFLOW_ROUTING.md `Commit / Push Required`) are
unchanged by this decision. A snapshot is normally generated after a
release has already been approved and committed/pushed, as a closing
governance record.

## Rule 5 - Decision Gates Remain Unchanged

DEC-012 does not remove or modify any decision gate established by DEC-009,
any workflow state established by DEC-010, or any remediation requirement
established by DEC-011.

---

# Success Criteria

The Release Snapshot capability is considered successful when:

- Every completed release can produce a snapshot using a documented,
  repeatable process.
- Snapshot generation does not require inventing a new document format
  per release.
- Repository-state fields can be generated mechanically and consistently.
- Governance-state fields remain sourced from authoritative governance
  documents rather than automation guesswork.
- Future AI sessions or contributors can reconstruct "what was true at
  release X" by reading a single snapshot entry.

---

# Consequences

## Positive

- Provides a stable, point-in-time reference that living documents cannot
  offer on their own.
- Minimal new documentation surface (one ledger file, one script).
- Reinforces DEC-007 (repository as authoritative state) with a permanent,
  non-drifting record.
- Establishes a repeatable pattern reusable across future releases and
  future projects.

## Trade-Offs

- Requires discipline to generate a snapshot at each release; it is not
  currently a hard release gate (Rule 4).
- Repository-fact automation still requires a human/AI operator to source
  and confirm governance-state fields before the entry is finalized.

---

# Related Decisions

- DEC-007 - Repository Documentation is Authoritative Workflow State
- DEC-009 - Governance Automation
- DEC-010 - Workflow State Automation
- DEC-011 - Confirmed Defect Remediation

---

# Related Investigations

- INV-008 - IndexedDB Reset Reliability Investigation (reference
  implementation: RS-001)

---

# Final Decision

Adopt the Release Snapshot capability as defined in RELEASE_SNAPSHOTS.md.

Generate RS-001 using the current released state (INV-008, commit
`6995a0e`, HEAD `5720adf`) as the first reference implementation.

Future releases should generate a new Release Snapshot entry using the
documented process and, where practical, the automation script in
`scripts/generate-release-snapshot.mjs`.
