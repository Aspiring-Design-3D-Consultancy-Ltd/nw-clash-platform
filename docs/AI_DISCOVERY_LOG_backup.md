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

---

## Golden Rules

- Never update only one parser.
- Preserve DATA_VERSION.
- Use rawTestName for image lookups.
- Verify importToRegister side effects.
- Review CLAUDE.md before major changes.

---

## 2026-07-29

### Core Architecture

#### Global State

- S

#### Persistence

- localStorage (`nw:*` namespace)
- IndexedDB (`NWClashImages`)

#### Startup Sequence

- window.onload
- initAuth()
- initNwImages()
- initPlans()

#### Workflow Systems

- Review Queue
- Dedup Queue
- Status History

#### Notes

Initial architecture discovery completed.

---

## 2026-07-29

### Import Architecture

#### Entry Paths

##### Single File

- bloadf()
- bdrop()
- bparse()

##### Multi File

- batchLoad()
- batchParse()

##### Folder Import

- importFolderPick()

#### Common Merge Layer

- importToRegister()

#### Merge Priority

1. Element Pair ID
2. Source + Element Composite
3. Coordinate Match (<=1mm)
4. Legacy testName::nwName

#### Parsers

##### Parser 1

- batchParse()
- Line ~8622

##### Parser 2

- bparse()
- Line ~8986

#### Critical Rule

Changes to parser fields must be mirrored in both parsers.

#### Image Matching

##### Primary Key

- rawTestName::filename

##### Fallback

- IMG-POS positional matching

#### Major Risks

- Parser drift
- rawTestName vs testName
- IMG-POS count mismatch
- Merge-key regressions

---

## 2026-07-30

### Status History Architecture

#### Canonical Status Values

- New
- Active
- Reviewed
- Approved
- Resolved

#### Core Data Structure

Current Status:

- `c.status`

Historical Status:

- `c.statusHistory[]`

Both must remain synchronized.

#### Status History Entry

```text
{
  week,
  year,
  status
}
```

Optional audit metadata:

- reviewedAt
- source
- matchedPattern
- actor
- approvedAt

#### Primary Functions

- pushStatusHistory()
- _appendStatusHistory()
- clashStatusAt()
- clashExistsAt()
- statusCountsAt()
- backfillStatusHistory()

#### Persistence

Stored inline within:

- S.clashes

Persisted through:

- localStorage
- sv('clashes', S.clashes)

#### Critical Risks

1. Dual source of truth
   - c.status
   - c.statusHistory

2. Same-week mutation bypasses guard

3. Schema guard silently drops invalid entries

4. Multiple week/year clocks

5. Dedup merge can collapse audit history

6. Review Queue approval/resolution double-write paths

7. Legacy backfill accuracy limitations

#### Key Observation

The highest architectural risk discovered so far is:

```text
c.status
+
c.statusHistory
```

These represent two sources of truth that must remain synchronized.

---

## 2026-07-30

### Review Queue Architecture

#### Queue Entry Conditions

A clash enters the Review Queue only during append-mode imports via:

- REVIEW-QUEUE-DETECT
- importToRegister()

#### Entry Requirements

- Clash existed before import
- Clash belongs to a test included in the current batch
- Clash was not matched during import
- Status is not:
  - Resolved
  - Approved
- reviewedStillOpen is not true
- Date guard succeeds
- Delta detection determines the clash disappeared from the latest XML

#### Queue Membership Fields

Primary Membership Flag:

- pendingReview

Supporting Metadata:

- disappearedAt
- disappearedInBatch

Permanent Exclusion:

- reviewedStillOpen

Related Fields:

- status
- _bucket
- _deltaAnalysisCandidate
- _bucketPattern
- _bucketFallback

#### Queue Exit Actions

##### Mark Resolved

- _rqActionOnUids(...,'resolved')

##### Mark Still Open

- _rqActionOnUids(...,'stillOpen')

##### Mark Approved

- _markClashesAsApproved()

#### Bucket Classification

Bucket 1
- Likely Resolved

Bucket 2
- Likely Republish

Bucket 3
- Designed Condition

Classification Engine:

- _rqdaReclassifyAll()

Supporting Configuration:

- S.reviewQueueDeltaAnalysisPatterns
- republishToleranceMm

#### Persistence

Stored on individual clashes:

- pendingReview
- disappearedAt
- disappearedInBatch
- reviewedStillOpen

Banner State:

- S.reviewQueueBanners
- S.reviewQueueNoDateBanner

Persisted via:

- localStorage
- sv()

#### Critical Risks

1. Delta detection logic incorrectly flagging clashes
2. Date guard failures creating false review candidates
3. Cross-test contamination
4. reviewedStillOpen preventing legitimate re-review
5. Review Queue and Status History becoming unsynchronized
6. Bucket classification masking true root causes

#### Key Observation

Review Queue membership is fundamentally controlled by:

- pendingReview

Everything else is layered on top of that single membership flag.

---

## 2026-07-30

### Dedup Queue Architecture

#### Purpose

The Dedup Queue identifies likely duplicate clashes that survived normal import matching and require user review.

#### Candidate Detection

Primary Function:

- scanForDedupCandidates()

Candidate Requirements:

- Same testName
- Same normalized sourceA
- Same normalized sourceB
- Matching elementA strings
- Matching elementB strings
- Distance > 1mm
- Distance <= 500mm

#### Queue Storage

Primary Queue:

- S.dedupQueue

Audit Storage:

- nw:dedupActionHistory

UI State:

- nw:dqShowSkipped

#### Entry Paths

##### Initial Scan

- nw:dedupInitialScan

##### Import Scan

Triggered by:

- importToRegister()

#### Resolution Actions

##### Merge

- dedupMerge()

##### Keep Separate

- dedupKeepSeparate()

##### Skip

- dedupSkip()
- dedupUnskip()

#### Relationship To Other Systems

##### Import Pipeline

Strongly coupled through:

- importToRegister()

##### Review Queue

Independent workflow.

##### Status History

Not integrated.

Dedup actions do not update:

- pushStatusHistory()
- _appendStatusHistory()

#### Persistence

Stored via:

- sv('dedupQueue', S.dedupQueue)

Audit Trail:

- nw:dedupActionHistory

#### Critical Risks

1. Silent candidate loss during rescans
2. Dedup actions not recorded in statusHistory
3. UID-format dependency in pair-key generation
4. Audit trail bypasses sv()/lv()
5. Rule duplication between scanner and migration logic
6. Manual maintenance of localStorage key lists

#### Key Observation

Dedup Queue maintains its own audit trail independent of status history.

---

## 2026-07-31

### Export Architecture

#### Purpose

Export Architecture covers:

- BCF
- PPTX
- PDF
- HTML Reports
- CSV
- JSON Backup
- Grouped NWX

Exports are read-only consumers of platform state.

#### Export Entry Paths

##### BCF

- exportSingleBCF()
- dlBCF()
- dlBCFSelected()
- exportGroupBCF()
- exportAllGroupsBCF()
- dlBCFSpatialGroups()

##### PPTX

- exportPPTX()

##### PDF

- exportPDF()
- exportReport('pdf')

##### CSV

- dlCSV()

##### JSON

- dlJSON()

##### NWX

- exportGroupedNWX()

#### Shared BCF Infrastructure

- guid()
- bcfCoord()
- bcfAuthor()
- _bcfDescription()
- _bcfComment()
- _bcfComponents()
- bcfGenBlob()
- dblob()

#### Image Resolution Chain

1. getNwImageB64Sync()
2. generateClashSnapshot()

Primary image key:

- rawTestName::nwImageRef

Fallback:

- IMG-POS match

#### Shared Reporting Data Sources

- _reportWeeklyRows()
- _reportTestBreakdownRows()
- buildLevelBreakdown()
- scopedWds()

#### Persistence

Exports do not modify:

- S.clashes
- S.weekly

Export configuration persistence:

- S.bcfGroupKeys
- grpUseGridCell

#### Critical Risks

1. Duplicated BCF-writing logic
2. Silent snapshot fallback masking image errors
3. Dependency on weekly reconstruction logic
4. exportReport() mutates weekly data through regenWeeklyFromRegister()
5. External PPTX CDN dependency
6. Future export paths bypassing bcfGenBlob()

#### Key Observation

Export Architecture has no independent data model.

All export correctness depends on:

- Import Architecture
- Status History
- Review Queue
- Dedup Queue
- Image matching

---

## System Dependency Graph

```text
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
```

### Dependency Notes

Import Architecture feeds all downstream systems.

Status History drives:

- Reporting
- Dashboards
- PDF exports
- PPTX exports
- Analytics

Review Queue depends on:

- Imports
- Status values
- Delta detection

Dedup Queue depends on:

- Imports
- Coordinates
- Source matching

Export Layer depends on:

- S.clashes
- Status History
- Images
- Weekly reconstruction
- Review Queue outcomes

---

## Discovery Completion Status

### Completed

- Core Architecture
- Import Architecture
- Status History Architecture
- Review Queue Architecture
- Dedup Queue Architecture
- Export Architecture

### Remaining

- Reporting Architecture

### Next Phase

After Reporting Architecture is documented:

1. Project Analyst
2. Architect
3. Developer
4. QA

All future agents must read:

- CLAUDE.md
- AI_DISCOVERY_LOG.md

before performing work.

---

## Next Investigations

### Remaining

- Reporting Architecture

Reason:

Reporting Architecture is the final major subsystem required before transitioning from discovery mode into agent-based workflows.