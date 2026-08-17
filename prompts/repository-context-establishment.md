# Prompt: Repository Context Establishment

## Purpose

Establish verified repository and governance state before any work begins.
Prevents editing a stale base and prevents acting on outdated governance
assumptions.

## When to use

At the start of every session, before any other prompt. Also after any long
gap, after a merge, or whenever repository state may have moved.

## Governance basis

DEC-007 (documentation is authoritative), DEC-010 Repository Alignment Rule
(repository state takes precedence over documentation state; drift must be
reported), `AI_STARTUP_CHECKLIST.md`.

---

## Prompt

> Establish the current state of this repository before performing any work.
> Report only — do not modify any file.
>
> **Step 1 — Repository facts.** Report: absolute path, current branch, HEAD
> SHA (short and full), working-tree clean/dirty, and ahead/behind status
> against `origin/main`. State when remote refs were last refreshed.
>
> **Step 2 — Integrity checks.** Verify and report:
> - `working.html` line count, taken from the file and cross-checked against
>   `git show HEAD:working.html | wc -l`. Do **not** treat `CLAUDE.md`'s stated
>   line count as authoritative — it is known to drift.
> - `DATA_VERSION` value and line number. It must be
>   `v4-correct-dates-jan25`. A changed value is a stop condition.
> - Presence of the most recent release's marker or identifier, to confirm the
>   tree contains the latest released remediation.
> - Marker balance for any marker you intend to work near.
>
> **Step 3 — Governance state.** Read `.cline/bootstrap.md`,
> `docs/governance/CURRENT_STATUS.md`, `KNOWN_ISSUES.md`,
> `INVESTIGATION_LOG.md`, and `RELEASE_SNAPSHOTS.md`. Report:
> - Framework version and validated roles
> - Active investigations and their DEC-010 workflow state
> - Any investigation stopped at a DEC-009 decision gate
> - Monitoring items and their status
> - The most recent release and its commit
> - The most recent Release Snapshot (`RS-XXX`) and whether HEAD has moved
>   past it
>
> **Step 4 — Drift report.** Per DEC-010's Repository Alignment Rule, compare
> repository reality against governance records and report every discrepancy,
> including: branch named in `CURRENT_STATUS.md` vs. actual branch; release
> commits claimed vs. present in `git log`; files referenced by governance
> documents but absent from the tree; cross-references pointing at records
> that do not exist.
>
> **Step 5 — Next investigation number.** Report the next available `INV-XXX`,
> derived from `INVESTIGATION_LOG.md` headings, and note any gaps in the
> sequence.
>
> Output sections: `Repository State`, `Integrity Checks`, `Governance State`,
> `Active Investigations`, `Monitoring Items`, `Most Recent Release`,
> `State Drift`, `Next Investigation ID`.

---

## Stop conditions

Stop and report rather than proceeding if `DATA_VERSION` has changed, if the
working tree is dirty with unexplained modifications, or if the branch does not
match what governance records expect.

## Prohibitions

No file modification. No commit. No push. No fetch if the session's constraints
exclude network operations — state when refs were last refreshed instead.
