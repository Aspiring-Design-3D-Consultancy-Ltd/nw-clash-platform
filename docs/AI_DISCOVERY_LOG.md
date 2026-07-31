# AI Discovery Log

Purpose: Persistent architectural knowledge discovered through AI-assisted code investigation.

Last Updated: 2026-07-31

---

## High Risk Areas

1. Parser 1 ↔ Parser 2 synchronization
2. importToRegister() merge logic
3. rawTestName image matching
4. c.status ↔ c.statusHistory synchronization
5. REVIEW-QUEUE-DETECT logic
6. Dedup Queue rescanning and graduation logic
7. Review Queue ↔ Dedup Queue interaction
8. Status History persistence
9. Dedup audit trail ↔ statusHistory divergence
10. Duplicated BCF export writers
11. Export dependency on reconstructed historical data
12. Dashboard dual-counting paths
13. Weekly reconstruction clock divergence
14. Chart period year-boundary logic
15. Heatmap level-resolution side effects
16. Heatmap building-classification regex dependency
17. Heatmap grid auto-fit and calibration logic
18. Board approval workflow bypass inconsistency
19. Shared global status contract (ST) dependency
20. High-frequency state mutation through uf()

---

## Golden Rules

- Never update only one parser.
- Preserve DATA_VERSION.
- Use rawTestName for image lookups.
- Verify importToRegister side effects.
- Review CLAUDE.md before major changes.
- Never reconstruct architecture from assumptions.
- Status changes must preserve statusHistory integrity.

---

## Core Architecture

### Global State

- S

### Persistence

- localStorage (`nw:*`)
- IndexedDB (`NWClashImages`)

### Startup

- window.onload
- initAuth()
- initNwImages()
- initPlans()

### Workflow Systems

- Status History
- Review Queue
- Dedup Queue

---

## Import Architecture

### Entry Points

Single File

- bloadf()
- bdrop()
- bparse()

Multi File

- batchLoad()
- batchParse()

Folder

- importFolderPick()

### Merge Layer

- importToRegister()

### Merge Priority

1. Element Pair ID
2. Source + Element Composite
3. Coordinate Match (<=1mm)
4. Legacy testName::nwName

### Parsers

Parser 1

- batchParse()

Parser 2

- bparse()

### Critical Rule

Changes to parser fields must be mirrored in both parsers.

### Image Matching

Primary

- rawTestName::filename

Fallback

- IMG-POS positional matching

---

## Status History Architecture

### Statuses

- New
- Active
- Reviewed
- Approved
- Resolved

### Core Fields

Current State

- c.status

Historical State

- c.statusHistory[]

### Core Functions

- pushStatusHistory()
- _appendStatusHistory()
- clashStatusAt()
- clashExistsAt()
- statusCountsAt()
- backfillStatusHistory()

### Key Risk

Dual source of truth:

- c.status
- c.statusHistory

Both must remain synchronized.

---

## Review Queue Architecture

### Entry Path

- REVIEW-QUEUE-DETECT
- importToRegister()

### Membership Flag

- pendingReview

### Supporting Fields

- disappearedAt
- disappearedInBatch
- reviewedStillOpen

### Actions

Resolved

- _rqActionOnUids(...,'resolved')

Still Open

- _rqActionOnUids(...,'stillOpen')

Approved

- _markClashesAsApproved()

### Key Observation

Review Queue is fundamentally controlled by:

- pendingReview

---

## Dedup Queue Architecture

### Detection

Primary Function

- scanForDedupCandidates()

### Storage

- S.dedupQueue
- nw:dedupActionHistory

### Actions

- dedupMerge()
- dedupKeepSeparate()
- dedupSkip()
- dedupUnskip()

### Key Observation

Dedup Queue maintains an audit trail independent from statusHistory.

---

## Export Architecture

### Export Types

- BCF
- PPTX
- PDF
- HTML Report
- CSV
- JSON
- NWX

### Shared BCF Infrastructure

- guid()
- bcfCoord()
- bcfAuthor()
- _bcfDescription()
- _bcfComment()
- _bcfComponents()
- bcfGenBlob()
- dblob()

### Snapshot Resolution

1. getNwImageB64Sync()
2. generateClashSnapshot()

Primary Key

- rawTestName::nwImageRef

Fallback

- IMG-POS

### Key Observation

Export Architecture has no independent data model.

Exports depend on:

- Import
- Status History
- Review Queue
- Dedup Queue
- Images

---

## Dashboard Architecture

### Entry Point

- rDash()

### Data Sources

Current

- S.clashes

Historical

- S.weekly

Reconstruction

- _platformWeeks()

### Historical Functions

- statusCountsAt()
- clashStatusAt()
- clashExistsAt()
- scopedWds()

### Key Observation

Dashboard uses two truth systems:

- c.status
- statusHistory

Divergence causes reporting errors.

---

## Heatmap Architecture

### Entry Path

nav('heatmap')
↓
rv('heatmap')
↓
rHeatmap()
↓
initHeatmap()
↓
hmDraw()

### Data Sources

- S.clashes
- S.levels
- S.grid
- _planCache

### Status Usage

Uses:

- c.status

Does NOT use:

- statusHistory
- clashStatusAt()
- clashExistsAt()

### Key Observation

Heatmap is a live spatial view, not a historical reporting view.

---

## Board Architecture

### Entry Path

nav('board')
↓
rv('board')
↓
rBoard()
↓
renderBoardGrid()

### Status Columns

Driven by:

- ST

Values:

- New
- Active
- Reviewed
- Approved
- Resolved

### Movement Lifecycle

Board is NOT drag/drop.

Workflow:

bmv()
↓
uf()
↓
pushStatusHistory()
↓
sv()
↓
regenWeeklyFromRegister()

### Key Observation

Board is one of the highest-frequency producers of statusHistory entries.

---

## System Dependency Graph

Import
↓
S.clashes
↓
Status History
↓
Review Queue
↓
Dedup Queue
↓
Export Layer
↓
Reporting Layer

Dashboard
→ Status History

Board
→ Status Changes
→ Status History

Heatmap
→ Live Clash Data

---

## Discovery Completion Status

### Completed

- Core Architecture
- Import Architecture
- Status History Architecture
- Review Queue Architecture
- Dedup Queue Architecture
- Export Architecture
- Dashboard Architecture
- Heatmap Architecture
- Board Architecture

### Assessment

Discovery Phase Complete.

---

## Phase 2

Create:

1. Project Analyst
2. Architect
3. Developer
4. QA

All agents must read:

- CLAUDE.md
- AI_DISCOVERY_LOG.md

before performing work.

---

## Next Step

Create the first specialist role:

- Project Analyst

Purpose:

- Identify affected systems
- Identify dependencies
- Identify risks
- Produce investigation plans

Never modifies code.