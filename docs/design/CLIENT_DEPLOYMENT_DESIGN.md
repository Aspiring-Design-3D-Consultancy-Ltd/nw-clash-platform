# Client Deployment Design Paper

**Status:** Accepted as analysis (Shane, 2026-09-04); design decisions 1–6 ruled, see Section 6 and DEC-017. **No build authorised** — Option A waits on Shane's client-shape answer. No change to `working.html`. Punch list in Section 7a.
**Base:** `main` at `1510f82` (2026-09-04), `working.html` 20,060 lines. Every line reference below is against that commit; re-grep before trusting a number after the next merge.
**Question answered:** how do external client users *use* the app (register, images, charts, exports) rather than receive PDF/PPTX reports from it, and what does each route cost in days and money.

---

## 0. The uncomfortable summary

1. `[Certain]` Nothing in the app today can move a working dataset from Shane's browser to anyone else's. The only export of state is **Backup JSON** (`dlJSON()`, line 18970) and it carries four things: `clashes`, `weekly`, `projName`, `projWeek`. No images, no floor plans, no role roster, no settings, no levels/grids, no designed-condition patterns. The in-app help text at line 15777 ("full project state backup: clashes, weekly snapshots, role roster, settings") is wrong, and the "drag-and-drop a backup onto the app window to restore" claim on the same line has no handler behind it (the only `ondrop` targets are the BCF importer, the batch importer and the group-builder chips at lines 7593, 9303, 14276).
2. `[Certain]` A client who opens `working.html` on their own machine does **not** see an empty app. With no `nw:pin` the auth screen runs first-time setup (line 1708), and completing it seeds the 104-clash January demo register (`DC`/`DW`, line 1717) and makes that person **Administrator** of their own island. They will be looking at fake data with full edit rights.
3. `[Certain]` SharePoint is a file transport, not a data channel. Every browser profile that opens the file gets its own `localStorage` + IndexedDB. Option B on its own cannot work; only a variant that ships *data* alongside the file can.
4. **Recommendation:** ship **Option A, sidecar-package variant** (Section 2.2). It reuses two shipped paths, the JSON restore (`_executeJsonRestore`, line 17795) and the archive re-attach (`reattachImagesFromArchive`, line 9885), and is a 4–6 working-day build including Playwright. The client gets the full register and screenshots, a Viewer PIN for read-only or a Manager PIN for local edits, and a weekly refresh that is one file drop and one click. Option C (hosted, Supabase) is the right end state if the client is ever meant to *edit and be seen editing*; it is a 4–8 week build and ~€30–40/month, and Section 4.6 shows the package format from A becomes its seed importer, so A is not throwaway.

---

## 1. State the facts: what is machine-local

### 1.1 Persistence model

`[Certain]` Two stores, one origin, no server.

| Layer | What | Where in source |
| --- | --- | --- |
| `localStorage`, `nw:*` keys | Every `sv(k,v)` / `lv(k,d)` call not on the routed list | `sv()` line 988, `lv()` line 1043 |
| IndexedDB `NWClashImages` v3, `records` store | `clashes` and `weekly` (the routed keys) via an in-memory cache and a debounced write-through queue | `_IDB_ROUTED_KEYS` line 1104, `_recQueueWrite` line 1144, `_flushPendingWrites` line 1155, store created line 3994 |
| IndexedDB `NWClashImages` v3, `images` store | key `0` = metadata (`imgfix-v1`: `count`, `byTest`, `sets`, `latest`, `dhashByIdx`); keys `1..n` = one screenshot each, stored as a base64 string (legacy) or `{b64, dhash}` | `openIDB()` line 3966, put sites lines 4040 / 4080 / 5519, audit shape check line 5366 |
| IndexedDB `NWClashImages` v3, `plans` store | floor-plan backgrounds keyed `building::level`, value `{imageBlob, mimeType, width, height, calibration, addedAt}` | lines 3984–3990, 4101–4157 |

The app calls `navigator.storage.persist()` at boot (`_recInit`, line 1304). `[Likely]` On a `file://` origin Chromium grants this silently only for engaged sites, so treat the client's data as evictable under disk pressure.

### 1.2 Inventory of `nw:*` keys

`[Certain]` Collected by grep over `working.html` excluding the two minified blobs (lines 13 and 34).

**Written through `sv()` (JSON-encoded):**

| Group | Keys |
| --- | --- |
| Identity / roles | `pin`, `managers`, `projectManager`, `viewers`, legacy `managerPin`, `managerName`, `managerEmail`, `viewerPin`, `viewerName`, `viewerEmail` |
| Project | `proj`, `week`, `iso`, `dataVersion` |
| Register (routed to IDB) | `clashes`, `weekly` |
| Settings | `apikey`, `assigneeRoster`, `bcfCoordUnits`, `bcfGroupKeys`, `cnLocType`, `cnLocVal`, `grpRadius`, `grpUseGridCell`, `grpUseSpatial`, `levelCodeMode`, `levels`, `grid`, `gridActiveB` |
| Workflow | `dedupQueue`, `reviewQueueBanners`, `reviewQueueNoDateBanner` |

**Written directly with `localStorage.setItem('nw:…')` (gates, flags, audit logs):**

`dedupActionHistory`, `dedupIncidentLog:20260713:v1`, `dedupInitialScan`, `dedupRetroCleanup:v1`, `designedConditionPatterns`, `designedConditionPatternsV2Seeded`, `dqShowSkipped`, `idbRecordsMigrated`, `imgWeekKeyingMigrated`, `pendingIdbWipe`, `recFlushDirty`, `republishToleranceMm`, `reviewQueueDateGuardFixed`, `reviewQueueDeltaAnalysisMigrated`, `reviewQueueScopeFixed`.

Two of these matter for any bundle design:

- `[Certain]` `nw:apikey` holds the Anthropic API key **in plaintext** (`saveAK()`, line 16858; used at line 13756). Any "copy all `nw:*` keys" packaging would leak Shane's key to the client. The package must exclude it.
- `[Certain]` `nw:dataVersion` must equal `DATA_VERSION` (`'v4-correct-dates-jan25'`, line 1398) or the boot path at line 1492 replaces the register with the demo set. A package must write this key, or the restore is undone on the next reload.

### 1.3 PIN and roles

- `[Certain]` PINs are 4 digits, hashed as `SHA-256(pin + ':nwci')` (`hashPin`, line 1364). The admin hash lives in `nw:pin`; member hashes live inside the `managers` / `projectManager` / `viewers` arrays as `pinHash`.
- `[Certain]` Role resolution is a hash match at login (lines 1726–1729). `ROLES` (line 880) ranks admin 4, manager 3, projectManager 2, viewer 1; `PERMS` (line 887) sets the minimum rank per action; `can()` (line 902) is called at seven sites (`edit_register` ×2, `board_move` ×2, `add_clash` ×2, `export_reports` ×1) and `applyRoleUI()` (line 909) hides nav items carrying `data-minrole` (four elements).
- `[Certain]` This is UI gating, not a security boundary. Everything runs in the client's browser; DevTools, or a 10,000-iteration loop over the salted hash, defeats it. For a trusted client it is adequate as "which buttons show". It must not be sold as access control.

### 1.4 Network surface

`[Certain]` Exactly two outbound calls exist:

| Call | Line | When |
| --- | --- | --- |
| PptxGenJS 3.12.0 from cdnjs, jsdelivr and unpkg fallbacks | 361 | Page load (script tag); only *needed* for Export PPTX |
| `POST https://api.anthropic.com/v1/messages` | 13756 | Only when the user clicks AI analysis with a key saved |

Everything else (XML import, image import via `webkitdirectory`, BCF, CSV, PDF, JSON) is local. Chart.js and JSZip are inlined (lines 13, 34). A client on a locked-down network loses only PPTX export and AI analysis.

### 1.5 What a second user sees, step by step

`[Certain]` Client copies `working.html` (1.6 MB) to their laptop and double-clicks it in Chrome or Edge:

1. `initAuth()` (line 1399) reads `nw:pin` → `null`.
2. Auth screen shows **Set Up Your PIN** (line 1708). Client picks a PIN.
3. Line 1717: `S.pin` set, `S.clashes = DC` (104 demo clashes), `S.weekly = DW` (4 demo weeks), `dataVersion` written, `launch()`.
4. `_ROLE = 'admin'`. All buttons visible. Dashboard shows January 2025 demo data. Images: none (metadata key 0 absent, `initNwImages` returns at line 4719), so every clash card shows the SVG placeholder.
5. Nothing the client does is visible to Shane, and nothing Shane does is visible to the client.

`[Likely]` Chromium treats every `file://` page in one browser profile as the same storage origin, so two copies of `working.html` in different folders on the same machine share one dataset. This is why replacing the file in place has never lost data, and it is the mechanism every option below relies on for "swap the HTML, keep the data".

### 1.6 Volumes on the live profile (for sizing)

`[Certain]` From the IMG-STORE-AUDIT run recorded in `KNOWN_ISSUES.md` line 782 and the IDB-RECORDS-MIGRATION comment at line 1057:

| Item | Figure |
| --- | --- |
| Register (`nw:clashes` + `nw:weekly`) at 4,264 clashes | 10,228 KB of JSON |
| Referenced screenshots after INV-011 cleanup | 4,768 images, 13 tests, 171.4 MB decoded (≈ 228 MB as base64 text) |
| Average screenshot | ≈ 36 KB decoded |
| Growth since DEC-016 | one full set per weekly import, ≈ 171 MB/week (CLAUDE.md line 124) |
| `working.html` | 1,609,488 bytes raw, 476 KB gzipped |

---

## 2. Option A: snapshot bundle

### 2.1 Two shapes, one winner

**A-embed (single file):** write the register and every referenced image as base64 into a `<script type="application/json">` block inside a copy of `working.html`; boot reads it into storage on first run.

`[Likely]` Fails at the current image volume. 1.6 MB + 10 MB + 228 MB base64 = a 240 MB HTML file. Chromium will open it from `file://` but parses the whole block into a JS string before anything runs, peaks at 2–3× that in RAM, and a mid-range client laptop will show a white tab for 20–60 s or crash it. Below ~30 MB of images it would be fine; the live profile passed that point months ago. Not recommended except for an "images-off" demo bundle.

**A-sidecar (recommended):** `working.html` unchanged, plus one `ClashPlatform_Package_<week>.zip` next to it. The client opens the HTML, the auth screen offers **Load client package**, they pick the zip, and the app writes everything into its own `localStorage` / IndexedDB exactly as if Shane's machine had produced it.

`[Certain]` Every primitive already exists:

| Need | Existing code |
| --- | --- |
| Read/write zip in the browser | JSZip inlined at line 34 |
| Validate and replace the register, regenerate weekly, rebuild `_uid`, persist | `_validateRestoreJson` line 17772, `_executeJsonRestore` line 17795, `regenWeeklyFromRegister` line 2705 |
| Load a week-keyed image folder for a test into a `(test, week)` set | `loadNwImages(files, testName, weekTag)` line 4831; `_extractWeekTag` / `_isWeekTag` lines 9532–9538 |
| Bucket a whole archive of `week-YYMMDD/<report>_files/*.jpg` into per-test jobs | `_bifBucketFolderFiles`, `_bifMatchImageJobs` inside `reattachImagesFromArchive`, line 9885 |
| Read image payloads lazily per clash (client RAM stays flat) | `getNwImageB64` line 5882, `getNwImgHtml` line 5852 |

### 2.2 Package format (proposed)

```
ClashPlatform_Package_week-260904.zip
├── package.json          manifest: {format:1, build:'1510f82', exportedAt, projName, projWeek,
│                          weeks:[...], counts:{clashes, images, tests}, mode:'full'|'delta'}
├── register.json         exactly the Backup JSON shape (clashes, weekly, projName, projWeek)
├── settings.json         levels, grid, gridActiveB, levelCodeMode, iso, assigneeRoster,
│                          bcfCoordUnits, bcfGroupKeys, cnLocType, cnLocVal, grp*,
│                          designedConditionPatterns, republishToleranceMm
├── roster.json           {pin: <admin hash>, managers:[…], projectManager, viewers:[…]}  (hashes only)
├── plans/                one entry per plans-store key, blob + calibration sidecar   (optional)
└── images/
    └── week-260904/
        └── <reportName>_files/Clash1.jpg …      same layout the archive re-attach already reads
```

Excluded on purpose: `apikey`, all migration gates (`idbRecordsMigrated`, `imgWeekKeyingMigrated`, `dedupInitialScan`, `reviewQueue*Fixed`, …), the audit logs, `dedupQueue`. The client's own boot runs its own one-shot migrations against what it receives.

Manifest `build` lets the importer warn when the client's HTML is older than the build that produced the package. `DATA_VERSION` is never touched.

### 2.3 Bundle size

`[Certain]` JPEGs do not compress in a zip, so the image part is the decoded size, not the base64 size.

| Package content | Size |
| --- | --- |
| HTML (shipped once per build, separately) | 1.6 MB |
| register.json + settings + roster | ≈ 10–12 MB (zips to ≈ 1.5 MB) |
| Latest week's images only | ≈ 171 MB |
| All 13 current sets | ≈ 171 MB today (one set per test after the DEC-016 migration); grows ≈ 171 MB per future week |
| Delta package (only weeks the client lacks) | ≈ 171 MB per week |

Practical rule: **register always full, images per week.** A weekly package is ≈ 175 MB. Six weeks of history shipped at once is ≈ 1 GB, which is the case for a one-off onboarding package and after that only deltas.

`[Guessing]` Re-encoding screenshots through a canvas at JPEG quality 0.6 and max 1280 px would roughly halve that. It changes what the client sees, so it is a Shane decision, not a default.

### 2.4 `file://` constraints on the client's machine

| Constraint | Status |
| --- | --- |
| Browser | `[Certain]` Chrome or Edge (Chromium). `webkitdirectory`, `crypto.subtle`, IndexedDB and `URL.createObjectURL` all work on `file://` in Chromium; the app already depends on all four. Firefox/Safari untested and out of scope. IE mode: no. |
| Opening from SharePoint web | `[Certain]` SharePoint Online does not render `.html` inline; it downloads or shows source. The client must open from a local or OneDrive-synced folder. Same for the zip. |
| Storage quota | `[Likely]` IndexedDB quota on `file://` is a share of free disk (Shane's profile reported 13.5 GB, line 1058). Six weeks of packages is ≈ 1 GB of IDB on the client. The client needs the prune tool as much as Shane does, or the package importer's *replace* mode (2.6). |
| Zip size for JSZip in-browser | `[Likely]` A 175 MB zip reads fine (JSZip streams entries; the app already loads thousands of files per batch import with bounded concurrency, IMG-BATCH-BACKPRESSURE). A 1 GB onboarding zip should be produced as several weekly zips instead. |
| Multiple tabs | `[Certain]` Same INV-008 rule as Shane's machine: one tab open on the file, or resets and version changes block. The importer must reuse `openIDB()` and `_flushPendingWrites()` rather than opening its own connection. |
| Corporate egress | `[Certain]` None required. PPTX export needs cdnjs/jsdelivr/unpkg reachable; state this in the client instructions. |
| Antivirus / Mark-of-the-Web | `[Likely]` A downloaded `.html` carries MotW on Windows; Chromium still runs it from `file://`. Smart App Control machines may prompt on first open. Zips are opened by the browser, not extracted, so no unblocking is needed. |

### 2.5 PIN handling

Three ways to hand the client a PIN. Recommend (ii).

| Mode | How | Result |
| --- | --- | --- |
| (i) Client sets own PIN | Ship no `roster.json`; the client goes through first-run setup, then loads the package | Client is Administrator of their island. Full edit, sees Settings, can factory reset. Simplest, least control. |
| (ii) Shane's roster, client as Viewer or Project Manager (recommended) | `roster.json` carries Shane's admin hash and the member arrays. Shane adds the client via **Add Member** and sends the PIN with the existing mail flow (line 15883). Importer writes `nw:pin` and the arrays before `launch()` | Viewer: read-only UI (no status edit, no import, no board drag). Project Manager: additionally Weekly Report and PPTX. Shane's own PIN also opens the client's copy, which is useful on site. |
| (iii) Package-specific admin | Generate a throwaway admin hash per package | Only if Shane wants the client to import their own XMLs locally; then they are effectively a second coordinator and Option C is the honest answer. |

`[Certain]` Mode (ii) means the first-run setup screen must be skipped when a package supplies `nw:pin`; that is a small change in `initAuth()` ordering (load package → then run the existing `if(!S.pin)` branch at line 1708). The first-run screen becomes **Set up PIN** *or* **Load client package**.

### 2.6 Read-only versus read-write-local

- **Read-only (Viewer PIN):** the client sees register, images, dashboard, charts, plan view, BCF viewpoint panel, and can export nothing except what `PERMS` allows rank 1 (nothing). Give them Project Manager (rank 2) if they need Weekly Report / PPTX.
- **Read-write-local (Manager PIN):** the client can change statuses, notes, board columns; `STATUS-HIST` appends history with their member name. `[Certain]` Those edits live only on their machine and the next package load **replaces** them (`_executeJsonRestore` is a full replacement, not a merge). There is no merge function in the codebase.
- **Manager sign-in warning (ruling condition, 2026-09-04):** when a Manager-rank PIN opens a copy that carries `nw:packageMeta`, the app must show a blocking notice at sign-in, before the dashboard renders, stating that edits are local to this machine and will be replaced by the next package load. Modal with an explicit acknowledge button, shown every sign-in, not a toast and not a help-panel sentence. Marker `CLIENT-PACKAGE-MANAGER-WARN`. Playwright: Manager PIN on a packaged profile sees the modal; Viewer and PM do not; Shane's admin PIN on his own (non-packaged) profile does not.
- **Round-trip of client edits (Phase A2, not in the first ship):** client exports Backup JSON, sends it back, Shane runs **Merge client edits**: match on `uid`, take status/notes/assignee where the client's `statusHistory` has an entry newer than Shane's, append rather than overwrite history. About 2–3 days extra including tests. Until A2 exists, tell a Manager-PIN client plainly that their edits are advisory and will be overwritten.

### 2.7 Weekly refresh workflow

1. Shane imports week N as today.
2. Settings → Data Management → **Package for client** → tick *latest week images only* (default) → zip downloads (≈ 175 MB, 30–90 s to build in-browser, `[Guessing]`).
3. Shane drops the zip in the shared SharePoint/OneDrive folder; if the build changed, the new `working.html` goes there too.
4. Client: opens `working.html` (same file as before, or the new one; storage is shared per 1.5), Settings → **Load client package** (or the auth-screen button) → picks the zip → REPLACE confirmation → register replaced, images for week N added as a new `(test, week-N)` set (DEC-016 cross-week accumulate), plans/settings/roster overwritten.
5. Header shows the package stamp (`projWeek`, exported date, build) next to the existing BUILD-STAMP so a screenshot from the client tells Shane which package they are on.

Importer modes: **add** (default: register replaced, image sets accumulate, matching the DEC-016 model) and **replace all image sets** (wipe `images` store first via the selective-reset primitive at line 17710, then load) for clients who never need history and should stay at ≈ 171 MB of IDB.

### 2.8 What changes in `working.html` (for the implementation brief, not this PR)

| Marker | Change | Effort |
| --- | --- | --- |
| `CLIENT-PACKAGE-EXPORT` | `dlPackage(opts)`: build manifest, `register.json` (reuse `dlJSON` object), settings/roster/plans, iterate `_nwImgSets` and read slots via `idbGet` into zip entries with the archive folder layout; JSZip `generateAsync({type:'blob', streamFiles:true})` | 1 day |
| `CLIENT-PACKAGE-IMPORT` | `importPackage(file)`: unzip, validate manifest and `register.json` with `_validateRestoreJson`, write roster/settings/`dataVersion`, `_executeJsonRestore`, then feed each `week-YYMMDD/<report>_files` folder to the existing `_bifMatchImageJobs` → `loadNwImages` path with the week tag; `await _flushPendingWrites()` before `launch()` | 1.5 days |
| `CLIENT-PACKAGE-AUTH` | Auth-screen **Load client package** entry; skip first-run PIN setup when the package supplies `nw:pin` | 0.5 day |
| `CLIENT-PACKAGE-MANAGER-WARN` | Blocking acknowledge modal at Manager sign-in on a packaged profile (2.6) | 0.25 day |
| `CLIENT-PACKAGE-STAMP` | Package manifest persisted to `nw:packageMeta`, rendered next to BUILD-STAMP | 0.25 day |
| Tests | `tests/client-package.spec.js`: export shape, import into a clean profile (wait for `nw:dedupInitialScan`, reset `S.clashes`), Viewer gating after import, `apikey` never present in the zip, `dataVersion` written, second import accumulates a week set | 1 day |
| Docs | Help text at line 15777 corrected; a client one-pager (open, load, refresh, PPTX needs internet) | 0.5 day |

Total ≈ 4–5.5 working days plus Shane's Playwright run against a real Muratec package. Dual-parser discipline is untouched (no XML parsing changes). Protected regions untouched.

---

## 3. Option B: SharePoint-shared file

### 3.1 Why the same file on SharePoint does not share data

`[Certain]` SharePoint stores the HTML. The data is written by `sv()` into the browser profile of whoever opened it. Two people opening the same synced file get two independent `localStorage` + `NWClashImages` databases. Shane opening it on a second laptop gets a third. Nothing in the file references SharePoint, Graph, or any URL other than the two in Section 1.4. SharePoint Online also refuses to execute HTML in the browser, so "open from the link" is really "download and open locally", and the download lands in a different folder each time but, per 1.5, still hits the same per-profile storage.

The help section at lines 15887–15896 already describes the only workable form of this: Admin exports Backup JSON weekly to the shared folder, others restore it. `[Certain]` That gives the client the register with **no images, no roster, no settings**: they still go through first-run PIN setup as Administrator, then see every clash with the SVG placeholder. It is Option A minus everything that makes the app worth opening.

### 3.2 Variants that are viable

| Variant | What it is | Verdict |
| --- | --- | --- |
| B1: SharePoint as the transport for the Option A package | The zip and the HTML live in a shared library; the client syncs the folder | This is Option A's step 3. Recommended delivery mechanism, not a separate option. |
| B2: `latest_backup.json` on SharePoint, manual restore | What the help text describes today | Register only. Acceptable for a one-off "show me the numbers", not for using the app. |
| B3: OneDrive-synced folder + File System Access API auto-load | On launch the app asks once for the synced folder (`showDirectoryPicker`, stores the handle in IDB), then checks `package.json` on every boot and offers to load a newer package | `[Likely]` Works on `file://` in Chromium; the handle can be persisted but a permission click is required each session. Removes step 4 of the refresh workflow. Worth ≈ 1 day after A ships. Not a substitute for A. |
| B4: SharePoint Lists / Graph API as the backend | Store clashes in a SharePoint list, images in a library, authenticate with MSAL | `[Certain]` Not possible from `file://`: MSAL needs an `https` redirect URI, so the app must be hosted first. Once hosted, this is Option C with Microsoft plumbing (Section 4.5). |

---

## 4. Option C: hosted multi-user

`[Certain]` The "parked Supabase/APS design" is not in the repository. CLAUDE.md line 131 and CURRENT_STATUS item 7 record only that three paths were outlined in chat history. What follows is a paper-level reconstruction from the code's actual seams, not a retrieval of that design.

### 4.1 Shape

- **Static hosting** for `working.html` (unchanged single-file discipline; PptxGenJS can be inlined once hosted, the CDN concern disappears).
- **Supabase** project (Postgres + Auth + Storage + Row Level Security) as the only backend. No custom server.
- The browser keeps IndexedDB as an **offline cache**; the write-through queue that already exists for the routed keys becomes the sync queue.

**Why Supabase over Autodesk Platform Services (APS):** `[Likely]` APS gives model viewing, ACC issues and Autodesk identity; it does not give a table for this app's clash records, weekly snapshots, dedup queue or review queue, so a database is needed regardless. APS makes sense as a later add-on if the client wants to click through to the model. Requiring every client user to hold an Autodesk account for a clash register is a barrier, not a feature. Recommend Supabase first, APS viewer as a possible Phase C2.

### 4.2 Infrastructure

| Component | Choice | Notes |
| --- | --- | --- |
| Static host | Cloudflare Pages, or Azure Static Web Apps if Exyte IT wants it inside the tenant | `[Likely]` Both have a free tier that covers one HTML file. Azure SWA Standard adds private endpoints and Entra ID auth. |
| Database | Supabase Postgres, region `eu-central-1` (Frankfurt) | Dresden project; keeps data in the EU. |
| Auth | Supabase Auth with **Microsoft (Azure AD) OAuth** provider for Exyte users and **email magic link** for the client | `[Likely]` Both are built-in providers on the Free/Pro tiers. Full SAML SSO is a paid add-on; not needed for a handful of users. |
| Images | Supabase Storage bucket, path `project/test/week-YYMMDD/<file>.jpg`, private, signed URLs | 171 MB/week ≈ 9 GB/year. |
| Plans | Same bucket, `project/plans/<building>_<level>` | Calibration JSON in a table. |
| Backups | Supabase daily backups (Pro) plus the existing Backup JSON as belt-and-braces | |

### 4.3 Data model (minimum)

`projects(id, name, week)` · `members(project_id, user_id, role)` with role ∈ admin/manager/projectManager/viewer · `clashes(project_id, uid, test_name, status, body jsonb, updated_at, updated_by)` · `status_history(project_id, uid, at, from, to, by)` · `weekly_snapshots(project_id, week_tag, body jsonb)` · `image_sets(project_id, test_name, week_tag, first_idx, count, filenames jsonb)` · `plans(project_id, key, calibration jsonb, storage_path)` · `settings(project_id, key, value jsonb)` · `dedup_queue`, `review_queue_flags` as `settings` rows to begin with.

RLS: every table filtered by `members.project_id` for `auth.uid()`; write policies by role rank mirroring `PERMS`.

### 4.4 What changes in `working.html`

Ordered by blast radius. The single-file constraint survives; only the persistence and auth seams move.

| Seam | Today | Change |
| --- | --- | --- |
| Register write | `sv('clashes', S.clashes)` writes the **whole array** (routed queue, line 1144); 41 readers use `lv()` | Biggest change. Per-record upsert to `clashes` keyed by `uid` with `updated_at`, last-write-wins per record. `S.clashes` stays the in-memory model so the 41 readers are untouched; `_recQueueWrite` diffs against the last flushed snapshot and pushes changed records. `[Likely]` 3–5 days including conflict handling and tests. |
| Register read | `_recInit()` fills `_recCache` from IDB | Pull from Postgres on boot (paged), write to IDB cache, subscribe to Realtime changes for `clashes` so a second user's status change appears without reload. |
| Images | `idbPut` / `idbGet` base64 slots, metadata key 0 | Upload on import to Storage; `getNwImageB64` (line 5882) fetches a signed URL and caches the base64 in IDB. `_nwImgSets` metadata comes from `image_sets`. Orphan/prune logic moves server-side (a SQL job), which retires the browser-side audit problem for good. |
| Auth | PIN hash match (lines 1726–1729) | Supabase session; `_ROLE` from `members`. `ROLES`, `PERMS`, `can()`, `applyRoleUI()` unchanged. PIN screen removed for hosted builds; keep it behind a build flag for the `file://` build if both are to coexist. |
| `DATA_VERSION` reset (line 1492) | Replaces register when the gate is missing | Must never touch remote data; becomes a cache-invalidation only. |
| Migration gates | ~15 `nw:*` flags | Stay local (they describe the cache), or move to `settings`. |
| `closeApp()` (line 18428), Selective/Factory reset | Wipe local stores | Wipe cache only; a remote "clear project" is an admin action with its own confirmation. |
| Exports (CSV, BCF, PDF, PPTX, JSON) | Read `S.*` | Unchanged. |
| Parsers (`batchParse`, `bparse`, `_bfParseXml`) | Unchanged | Unchanged. Dual-parser discipline still applies to any later change. |

### 4.5 Cost per month

Prices are from training knowledge; the pricing page was unreachable from this sandbox. Verify before quoting to anyone. All figures `[Likely]` unless marked.

| Item | Monthly |
| --- | --- |
| Supabase Pro (needed: free projects pause after a week idle, 500 MB DB and 1 GB storage limits) | $25 |
| Storage overage above the Pro allowance (100 GB) at ≈ $0.021/GB, after ≈ year one | $0–3 |
| Egress above 250 GB, ≈ $0.09/GB; ten users pulling a 171 MB week set is < 2 GB | $0 |
| Cloudflare Pages / GitHub Pages | $0 |
| Azure Static Web Apps Standard, if Exyte IT insists on tenant hosting | ≈ $9 |
| Domain (optional) | ≈ $1 |
| **Total** | **≈ $25–40 (€30–40)** |

`[Guessing]` An all-Azure variant (SWA + Azure SQL serverless + Blob + Entra ID) lands at €40–90/month and roughly doubles the setup time because auth and storage are three services instead of one SDK.

### 4.6 Build estimate and migration path from A

| Phase | Scope | Effort |
| --- | --- | --- |
| C0: seed | Reuse the Option A package: an admin-only **Import package to project** that streams `register.json`, settings, roster and `images/` into Postgres and Storage. This is why A is not throwaway. | 2 days |
| C1: read path | Hosting, Supabase project, auth, membership, boot from Postgres, images via signed URLs, IDB cache | 1.5–2 weeks |
| C2: write path | Per-record upsert, Realtime, status history, conflict rule, resets scoped to cache | 1.5–2 weeks |
| C3: hardening | RLS tests, Playwright against a local Supabase (`supabase start`), governance records (DEC, INV baseline), client onboarding | 1 week |
| **Total** | | **4–6 weeks of focused work; 6–8 weeks calendar** `[Guessing]` |

The `file://` build must keep working for Shane's offline use during and after C; a build flag (`HOSTED = true/false` set by the stamp workflow) selecting the persistence adapter is the cleanest way and keeps the file single.

### 4.7 What C gives that A cannot

Real access control (RLS, not a 4-digit hash) · concurrent editing with visibility · one register, no weekly shipping · server-side image pruning · audit trail with user identity · multi-project by adding a `projects` row, which is the other item on the CLAUDE.md horizon.

---

## 5. Recommendation matrix

| Option | Users | Capability | Data freshness | Time to first client use | Cost | Security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| A-embed | any number, each an island | view; edit-local possible | per package | 3–4 days | €0 | PIN (UI only) |
| **A-sidecar (recommended)** | any number, each an island | **view (Viewer/PM PIN) or edit-local (Manager PIN)** | weekly package, ≈ 175 MB | **4–6 days** | €0 | PIN (UI only) |
| A + B3 auto-load | same | same | picks up new package on launch | +1 day | €0 | same |
| A + A2 merge | same | edit-local with round-trip back to Shane | weekly, two-way | +2–3 days | €0 | same |
| B2 JSON on SharePoint | any | register only, no images | weekly | 0 days (exists) | €0 | none (client is admin) |
| B4 SharePoint/Graph backend | Exyte tenant users | shared edit | live | needs hosting first, so ≥ C | tenant | Entra ID |
| **C Supabase hosted** | shared, roles per user | **shared view and edit, concurrent** | live | 6–8 weeks | ≈ €30–40/mo | real (RLS + OAuth) |
| C + APS viewer | same | plus model viewing | live | +2–4 weeks | + APS credits | same |

### 5.1 Path for "client using it within days"

1. Build **A-sidecar** (Section 2.8) on a feature branch; Playwright against a real Muratec package.
2. Shane adds the client as **Viewer** (or Project Manager if they need PPTX), sends the PIN by the existing mail flow.
3. First package = register + latest week images (≈ 175 MB) + `working.html`, via SharePoint/OneDrive link.
4. Weekly: import → Package for client → drop the zip. Client: Load client package.
5. Client instructions, one page: Chrome/Edge, open from a local or synced folder, one tab, PPTX needs internet, edits are local (Manager) or off (Viewer).

### 5.2 Migration path to multi-user

- Ship A first; the package format is C0's seed import, and the `CLIENT-PACKAGE-IMPORT` code becomes the server-side loader's reference implementation.
- Trigger for starting C: the client asks to edit *and* be seen, a second coordinator appears, or the weekly 175 MB shuffle becomes the complaint. Any one of those is enough.
- Order: C0 → C1 (read-only hosted, still fed by weekly packages) → C2 (writes). C1 alone is already better than A for a view-only client and can ship at ≈ 2–3 weeks.

---

## 6. Decisions surfaced for spot-check

Made in this paper without asking. **Ruled by Shane on 2026-09-04** (recorded as DEC-017 in `DECISION_LOG.md`); the ruling follows each item.

1. **Sidecar zip, not embedded HTML** (2.1). Overturn if images are cut to < 30 MB; then A-embed is 1 day less. **Ruling: APPROVED.**
2. **Client role = Viewer by default, PM on request, Manager only with the "edits are local" warning** (2.5, 2.6). **Ruling: APPROVED.**
3. **Register always full, images latest-week-only by default** (2.3). **Ruling: APPROVED**, with a full onboarding package for first delivery.
4. **Importer accumulates image sets (DEC-016 semantics) with an explicit "replace all" mode**, rather than replacing silently (2.7). **Ruling: APPROVED.**
5. **Supabase over APS for C**, APS as a later viewer add-on (4.1). **Ruling: APPROVED.**
6. **No merge of client edits in the first ship** (A2 deferred) (2.6). **Ruling: APPROVED with condition** — the "edits overwritten by next package" warning must be prominent in the client UI at Manager sign-in, not documentation only. Captured as `CLIENT-PACKAGE-MANAGER-WARN` in 2.6 and 2.8.
7. **Correct the help text at line 15777 in the same PR as the feature**, not separately (2.8). **Ruling: SUPERSEDED** — stays on the punch list (7a) for the session that owns `working.html`.

## 7. Discrepancies found while reading (no action taken)

Ruled 2026-09-04: items 8 and 9 below RECORDED (punch list stands); item 10 key rotation ACCEPTED, Shane actions it himself; remediation is KI-011-FIX (option 3, session-only key), queued for the `working.html`-owning session.

- `[Certain]` Help text line 15777: Backup JSON does not include roster or settings; no drag-and-drop restore exists.
- `[Certain]` CLAUDE.md "Deployment" says `deploy.bat` in the repo root automates the SharePoint copy; there is no `deploy.bat` in the repository at `1510f82`.
- `[Certain]` `nw:apikey` is stored in plaintext (line 16858). Not a client-deployment defect on its own, but any "copy the profile" or "export all keys" shortcut would ship it.
- `[Certain]` `_selectiveResetCategories()` settings list (line 17753) excludes `week`, `levels`/`grid` live in their own category; the package settings list in 2.2 was derived from `sv()` call sites, not from that list, and should be checked against it at implementation time.

## 7a. Punch list for `working.html` (not edited here; the file is owned by another session)

Ruling 2026-09-04: paper accepted as analysis, no build authorised. These are the small, non-feature corrections that fall out of it. Each is a one-line edit to be made by whichever session next holds `working.html`, wrapped in its own marker per the edit discipline.

| # | Line at `1510f82` | Current text (abridged) | Replace with | Marker |
| --- | --- | --- | --- | --- |
| P1 | 15777 | `↓ Backup JSON — full project state backup: clashes, weekly snapshots, role roster, settings. Use this for SharePoint/OneDrive distribution or audit archival. Drag-and-drop a previous backup JSON onto the app window to restore it.` | `↓ Backup JSON — exports the clash register, weekly snapshots, project name and project week only. It does not include screenshot images, floor plans, the role roster, PINs, levels/grids or settings. Use it for audit archival or to move the register to another machine. Restore it with ↻ Restore from JSON on this row; there is no drag-and-drop restore.` | `HELP-BACKUP-JSON-SCOPE` |
| P2 | 15891–15895 | "Sharing data with your team": team members "import the latest JSON via Data Manager → Restore Backup" and "their role-based permissions apply automatically" | Restore lives in Settings → Data Management, not Data Manager. Roles do not travel in the JSON: a team member on another machine goes through first-run PIN setup as Administrator. Say so, and point to this paper's Option A for the intended route. | `HELP-SHARING-SCOPE` |
| P3 | 1423 / 16819 / 16858 / 17755 / 18305 / 18442 | Anthropic key stored in plaintext in `nw:apikey` | KI-011-FIX (ruled: option 3, session-only key). Change sketch in `KNOWN_ISSUES.md` KI-011. | `KI-011-SESSION-KEY` |
| P4 | CLAUDE.md "Deployment" | "A `deploy.bat` in repo root automates this." | Remove the sentence or add the script. No such file at `1510f82`. | docs only |

P1 and P2 are documentation strings inside `working.html`; they need no test beyond the existing help-panel render check. P3 is tracked as KI-011 in `KNOWN_ISSUES.md`.

## 8. Related records

- DEC-016 (image sets keyed by test and week): the package's `images/` layout is that model's on-disk form.
- INV-008 / INV-009: single-tab rule and `openIDB()` reuse apply to the importer.
- KI-010 / INV-011: orphan cleanup; the importer's *replace all* mode is the client-side answer to the same growth.
- KI-011 (Anthropic API key persisted in plaintext): raised from this paper's Section 1.2.
- Proposed decision record on approval: **DEC-017 Client deployment path (Option A-sidecar; Option C as target)**, using the `Future Decisions` template in `DECISION_LOG.md`.
