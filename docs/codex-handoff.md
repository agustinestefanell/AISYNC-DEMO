# AISync Codex Handoff

Last updated: 2026-04-06  
Project: `AISYNC-DEMO`

## Purpose

This file exists to help a new Codex session understand the current product state before making changes.

Primary rule:
- Do not start refactoring blindly.
- Read this file first.
- Then inspect the current git diff/status.
- Then inspect the target files named in the active OE.

## Current Product Focus

The recent work concentrated on:
- `Documentation Mode`
- `Teams Map`
- `Review & Forward` hierarchy rules
- compact documentary list layouts
- `Audit View` behavior and manifest help
- `Knowledge Map` interaction and layout iterations

The repo has been evolving through a long sequence of OEs. Some areas are stable, some are still visually iterative.

## High-Level Status

### Stable enough to treat carefully

- `Documentation Mode -> Repository View`
- `Documentation Mode -> Audit View`
- `Documentation Mode -> Investigate View`
- `Documentation Mode -> Knowledge Map`
- `Teams Map -> Map`
- `Review & Forward` routing logic

### Sensitive / regression-prone areas

- `src/pages/PageB.tsx`
  Main Documentation Mode screen. Very large and high-impact.
- `src/pages/PageD.tsx`
  Teams Map and structural editing behavior.
- `src/pages/PageF.tsx`
  Team Workspace routing and forwarding behavior.
- `src/reviewForwardPolicy.ts`
  Central policy logic for `Review & Forward`.
- `src/components/SecondaryWorkspacePanel.tsx`
- `src/components/TeamSubManagerPanel.tsx`
- `src/components/LockIconButton.tsx`
- `src/styles/tokens.css`

If a new OE touches any of these, read them carefully first.

## Documentation Mode Summary

### Repository View

Intent:
- main operational documentary view
- search, filters, compact list reading, detail panel

Important behavior:
- uses the shared documentary base from `documentationModel`
- includes main workspace entities
- supports document detail
- supports opening items/files

Recent direction:
- rows/list reading instead of heavy cards
- tighter filters and compact headers

### Audit View

Intent:
- operational traceability
- document + auditable event

Important behavior:
- `Open` must open locally in a floating window/overlay, not in a new tab
- `Audit manif.` exists under `(Manif.)`
- `Reset Search` is the intended reset label

Recent direction:
- compact audit row aligned to a visual reference
- one single action: `Open`
- preserve Audit context behind the opened document

### Investigate View

Intent:
- reconstruct temporal/contextual evolution
- not a duplicate of Repository or Audit

Important behavior:
- local filters by view are valid
- compact top controls / scrollable main content pattern was tuned here and used as reference for other views

### Knowledge Map

Intent:
- graph-based documentary/contextual reading

Important note:
- this area has gone through many visual iterations
- some responsive/framing expectations were still being tuned
- avoid broad refactors unless the active OE explicitly targets it

If touching `Knowledge Map`, inspect the latest code path in `PageB.tsx` instead of assuming older behavior.

## Teams Map / Structural Editing Summary

### Teams Map -> Map

Important recent rule:
- clicking a node/label must no longer trigger inline rename
- `Edit` is the only valid path for editing

If this regresses, re-check `src/pages/PageD.tsx`.

### Structural mutations that matter

The system supports mutations like:
- create team
- edit team
- delete team / erase team
- add agent
- erase agent
- promote worker to sub-manager

These mutations affect routing and hierarchy and must be treated as the source of truth.

## Review & Forward Summary

This is very important.

### Main principle

`Review & Forward` must be derived from the live hierarchy, not from static or manually maintained lists.

### Central source

Current policy logic lives in:
- `src/reviewForwardPolicy.ts`

### Current intended rules

#### General Manager

Can forward to:
- direct main workspace workers
- valid top-level sub-managers only

Must not forward directly to:
- secondary / deeper sub-managers

#### Sub-managers

Can forward to:
- direct workers
- valid subordinate sub-managers
- upward only where hierarchy permits

#### Workers

Can forward to:
- their direct sub-manager
- other workers in the same team/active branch

Must not forward to:
- workers in other teams
- arbitrary nodes outside the live hierarchy

### Critical separation

Do not mix normal `Review & Forward` with:
- `Cross Verification`
- `AUDIT AI ANSWER`

Those systems were intentionally kept separate.

## Lock / Unlock Button Summary

Current intended visual rule:
- locked state: `Lock`
  - black background
  - white text
- unlocked state: `Unlock`
  - white background
  - black border
  - black text

This is a visual rule only.
Do not break the underlying lock wiring.

Files involved:
- `src/components/LockIconButton.tsx`
- `src/styles/tokens.css`

## Manifest / Help Links

### Documentation Mode `(Manif.)`

The `(Manif.)` content for Documentation Mode was translated to English.

### Audit manif.

There is also a dedicated `Audit manif.` link under `(Manif.)` when `Audit View` is active.

Its content is in English and explains:
- Audit is not Repository
- Audit is not Investigate
- Audit is operational traceability

## Current Design Doctrine

Across recent OEs, the direction has been:
- reduce visual bloat
- remove redundant explanatory boxes
- keep filters compact
- keep scroll in the real content area
- move from heavy cards toward more list-like documentary reading
- keep professional/sober UI language

If a new change makes the product more card-heavy, more decorative, or less dense, it is likely going in the wrong direction unless explicitly requested.

## What To Inspect Before Any New OE

1. Read this file.
2. Run `git status`.
3. Read the active OE carefully.
4. Inspect the exact files it targets.
5. If the OE concerns:
   - Documentation Mode -> inspect `PageB.tsx`
   - Teams Map -> inspect `PageD.tsx`
   - Team Workspace / forwarding -> inspect `PageF.tsx`, `reviewForwardPolicy.ts`, and the workspace panels
6. Only then implement.

## Known Caution

Some previous OEs involved many iterations against visual screenshots.
That means:
- there may be code paths that look slightly redundant
- a “clean refactor” can easily destroy approved behavior

Bias toward:
- minimal, scoped edits
- preserving existing wiring
- changing only the target behavior of the active OE

## Recommended Prompt For A New Codex Session

Use something close to this:

> Read `docs/codex-handoff.md` first. Then inspect `git status`. Do not change code yet. Summarize the current state, the sensitive files, and the non-regression rules before implementing anything.

## Final Rule

If unsure whether behavior is intentional:
- do not normalize it by instinct
- inspect the active OE history in the code paths involved
- prefer preserving approved behavior over "cleaning up" aggressively

## Session Update - 2026-04-10

This session touched Teams Map / Tree and the full workspace selection/save pattern.

### OEs / Adjustments Covered

- OE-04 Depuration
- Tree/Map chromatic correspondence correction
- OE-05 Workspace System Refinement + tick-based selection
- OE-05B Save enabled from tick-based selection
- micro-adjustment for `Connect Team` spacing and Tree placeholder sizing

### Files Modified In This Session

- `src/pages/PageD.tsx`
- `src/components/DividerRail.tsx`
- `src/components/CollapsibleManagerSidebar.tsx`
- `src/context.tsx`
- `src/data/seed.ts`
- `src/components/MessageSelectionToggle.tsx`
- `src/components/AgentPanel.tsx`
- `src/components/SecondaryWorkspacePanel.tsx`
- `src/components/TeamSubManagerPanel.tsx`
- `src/pages/PageG.tsx`
- `src/styles/tokens.css`

### Teams Map / Tree - Current Real State

#### Chapter 4 depuration

The chapter 4 work on Teams Map / Tree was depurated to remove accumulation problems and improve runtime manifestation.

Important resulting state:
- dead placeholder residue from the old Add User Team path was removed from `PageD.tsx`
- `team_clients` was normalized to the sub-manager structure:
  - `SM-Clients / Projects`
  - `W-CL01`
  - `W-CL02`
- old fallback label handling was preserved in `context.tsx` only as compatibility glue

Key files:
- `src/pages/PageD.tsx`
- `src/data/seed.ts`
- `src/context.tsx`

#### Connect Team placeholder

Current intended behavior:
- `Connect Team` / `Link external User` remains a structural placeholder connected to the GM
- it must remain visually integrated into the system, not a floating random button
- it now sits with a bit more breathing room from the GM in both `Map` and `Tree`
- in `Tree`, the placeholder uses the same structural size as the team node size for that view

Do not regress:
- text
- structural connection line
- GM-relative placement
- same-size expectation in Tree

File:
- `src/pages/PageD.tsx`

#### Tree/Map chromatic correspondence

Tree must not go neutral if Map is team-colored.

Current intended rule:
- Tree keeps a minimal structural reading
- Tree still inherits team identity from the same `getTeamTheme(node.teamId)` source used by Map
- color must be visible and meaningful, not washed out
- each Tree node should visibly belong to the same team family as in Map

Current implementation direction:
- team color is expressed in the upper portion of the Tree node
- there is visible colored surface area, not only a tiny accent
- workers also inherit the team family visually

File:
- `src/pages/PageD.tsx`

#### SM collapsible panel

The Sub-Manager sidebar pattern was restored and then clarified.

Current intended rule:
- panel can collapse and expand without moving layout
- collapsed state must still communicate what it is
- the rail must remain understandable as the collapse/expand control

Files:
- `src/components/DividerRail.tsx`
- `src/components/CollapsibleManagerSidebar.tsx`
- `src/pages/PageB.tsx`
- `src/pages/PageC.tsx`
- `src/pages/PageD.tsx`
- `src/pages/PageE.tsx`

### Workspace System - Current Real State

#### OE-05 visual refinement

This session also refined the shared workspace system without changing layout.

Current intended direction:
- professional multichat
- sober and structured
- stronger workspace consistency across main/team/sub-manager/cross-verification surfaces
- cleaner headers, viewport, and action sections

Primary shared styling lives in:
- `src/styles/tokens.css`

#### Tick-based selection

This is now a cross-workspace rule.

Current intended rule:
- selected messages use a tick/check indicator
- do not reintroduce full-box fill behavior
- selected state may have a light border/halo only
- the pattern must remain visually consistent across all relevant workspace surfaces

Implemented in:
- `src/components/MessageSelectionToggle.tsx`
- `src/components/AgentPanel.tsx`
- `src/components/SecondaryWorkspacePanel.tsx`
- `src/components/TeamSubManagerPanel.tsx`
- `src/pages/PageG.tsx`

Affected surfaces:
- Main Workspace
- Team Workspace worker lanes
- Team Workspace sub-manager lane
- Cross Verification sub-manager thread

#### Save from selection

Important clarification:
- Save from selected messages already existed at the content level in several places
- this session made the selection-driven Save behavior explicit in the CTA layer

Current intended rule:
- if there is at least one tick-selected message, Save must clearly respond to that state
- the button may switch to `Save Selected`
- the saved content must be derived from `selectedMessages`, not the whole thread
- this must coexist with `Review & Forward`, not replace it

Current behavior:
- Main Workspace: selection activates save CTA and save modal path
- Team Workspace worker lane: same
- Team Workspace sub-manager lane: same
- Cross Verification sub-manager thread: same

Do not regress:
- `Review & Forward` still depends on the same selection
- `Save` must not require saving the full thread
- selection visual pattern from OE-05 must stay intact

Files:
- `src/components/AgentPanel.tsx`
- `src/components/SecondaryWorkspacePanel.tsx`
- `src/components/TeamSubManagerPanel.tsx`
- `src/pages/PageG.tsx`

### Validation Reality For This Session

Validation performed repeatedly in this session:
- `npm run build` -> passing
- no `lint` script exists
- no `tests` script exists
- preview/runtime checks were performed against local pages with HTTP `200`

Important limitation:
- there was no browser screenshot tool reliably available inside this session
- visual confirmation was done through code inspection + runtime availability, not through an in-session graphical browser proof

### Sensitive Non-Regression Rules Now Active

- Do not alter Teams Map / Tree layout geometry unless an OE explicitly authorizes it.
- Do not move ribbons or global controls.
- Do not turn Tree back into a neutral gray structure disconnected from Map team colors.
- Do not shrink or detach `Connect Team` in Tree.
- Do not reintroduce hidden/dead alternate placeholder strategies in `PageD.tsx`.
- Do not revert the `SM-Clients / Projects` + two-worker default fix.
- Do not bring back full-fill selection styling for message cards.
- Do not split selection behavior so Main / Team / Sub-Manager / Cross Verification diverge again.
- Do not make Save act like a whole-thread action when ticks are active; selection must remain first-class.

### What To Inspect First Next Session

If the next OE touches these areas, inspect these files first:
- Teams Map / Tree:
  - `src/pages/PageD.tsx`
- Workspace shared styling:
  - `src/styles/tokens.css`
- Main Workspace selection/save/forward:
  - `src/components/AgentPanel.tsx`
- Team Workspace selection/save/forward:
  - `src/components/SecondaryWorkspacePanel.tsx`
  - `src/components/TeamSubManagerPanel.tsx`
- Cross Verification selection/save/forward:
  - `src/pages/PageG.tsx`

### Pending / Watch Items

- A proper human/browser visual pass is still recommended for any future OE that depends on subtle manifestation details.
- `PageD.tsx` remains a sensitive file with many chapter 4 layers; avoid broad cleanup unless the OE explicitly asks for it.
- Teams Map and workspace surfaces are now carrying several validated micro-adjustments; prefer minimal scoped edits over refactors.

## 2026-04-10 - OE-07 Saved Objects Architecture

### What Changed

- Installed a formal saved-objects layer so AISync no longer treats save as one ambiguous action.
- Added typed `savedObjects` and separate `activityEvents` to app state and persistence.
- `Save Version` now creates a formal `Checkpoint` object and a separate lifecycle event, while still keeping legacy workspace version and calendar compatibility for the current demo.
- `Save Selection` now creates a formal `Saved Selection` object and a separate lifecycle event, while still emitting legacy `SavedFile` and `CalendarEvent` bridges so existing Documentation Mode and Audit Log surfaces keep working.
- Added official placeholder types for:
  - `Session Backup`
  - `Checkpoint`
  - `Saved Selection`
  - `Handoff Package`
  - `Source Document Reference`
  - `Derived Document`
  - `Activity / Lifecycle Event`

### Files Touched

- `src/types.ts`
- `src/context.tsx`
- `src/versioning.ts`
- `src/components/AgentPanel.tsx`
- `src/components/SecondaryWorkspacePanel.tsx`
- `src/components/TeamSubManagerPanel.tsx`
- `src/pages/PageF.tsx`
- `src/pages/PageG.tsx`
- `src/components/SaveBackupModal.tsx`

### Contract Now Active

- Visible action `Save Version` means: create a `Checkpoint`.
- Visible action `Save Selection` means: create a `Saved Selection`.
- `Session Backup` is now a formal object type but still not exposed as its own completed UI flow.
- `Handoff Package` is now a formal object type but still not wired to a full transfer flow.
- `savedObjects` and `activityEvents` are conceptually distinct:
  - `savedObjects` = reusable / consultable operational objects
  - `activityEvents` = chronological system events

### Compatibility Rule

The app still keeps these legacy bridges active on purpose:
- `workspaceVersions`
- `savedFiles`
- `calendarEvents`

Reason:
- `PageH`, `Audit Log`, and current `Documentation Mode` still depend on them
- OE-07 installs the architecture first without forcing a broad integration refactor out of order

Do not regress this bridge layer until OE-10 / OE-12 / OE-13 absorb it intentionally.

### Sensitive Non-Regression Rules

- Do not collapse `savedObjects` and `activityEvents` back into one structure.
- Do not rename `Save Version` away from checkpoint semantics.
- Do not let `Save Selection` fall back to “save whole thread” behavior.
- Do not remove legacy `savedFiles/calendarEvents/workspaceVersions` until the downstream modules are migrated on purpose.

### Explicitly Deferred

- OE-08 Save Window Redefinition
- OE-09 Metadata + Automatic Tags Framework
- OE-10 Persistence & Storage Layer
- OE-11 Handoff Formalization
- OE-12 Audit Log Integration Layer
- OE-13 Documentation Mode Integration Layer

### Validation

- `npm run build` passing after OE-07
- no `lint` script
- no `tests` script

### Next Session Starting Point

If the next OE continues this track, inspect first:
- `src/types.ts`
- `src/context.tsx`
- `src/versioning.ts`
- `src/components/AgentPanel.tsx`
- `src/components/SecondaryWorkspacePanel.tsx`
- `src/components/TeamSubManagerPanel.tsx`
- `src/pages/PageF.tsx`
- `src/pages/PageG.tsx`

## 2026-04-10 - OE-08 Save Window Redefinition

### What Changed

- Redefined the `Save Selection` modal so it no longer reads like a generic save form.
- The modal is now split into two explicit layers:
  - `User Definition`
  - `System Metadata`
- The only primary editable field is now the saved object title.
- `Save timestamp` is now shown as structural system metadata and is no longer editable.
- `Project` and `Origin` are now shown as system-known metadata instead of arbitrary user inputs.
- The selected message preview remains visible and operational.

### Files Touched

- `src/components/SaveBackupModal.tsx`
- `src/components/AgentPanel.tsx`
- `src/components/SecondaryWorkspacePanel.tsx`
- `src/components/TeamSubManagerPanel.tsx`
- `src/pages/PageG.tsx`

### Contract Now Active

- `Save Selection` modal is for creating a `Saved Selection` object.
- User defines:
  - object title only
- System defines and shows:
  - object type
  - save timestamp
  - project
  - origin panel/workspace
  - selected messages being preserved

### Important Non-Regression Rules

- Do not reintroduce editable date inputs for save.
- Do not reintroduce editable project/type controls in this modal unless a later OE explicitly requires it.
- Do not blur the distinction between:
  - user naming the object
  - system assigning structural metadata
- Do not mix `Session Backup` back into this modal flow.

### Explicitly Deferred To OE-09

- metadata enrichment beyond the current structural base
- automatic tags
- tag editing or suggestion UX
- richer metadata authoring beyond what the system already knows

### Validation

- `npm run build` passing after OE-08
- no `lint` script
- no `tests` script

### Watch Items

- The modal now relies on caller-provided `projectLabel`, `sourceLabel`, and `saveTimestamp`.
- Main Workspace, Team Workspace worker lane, Team Workspace sub-manager lane, and Cross Verification must stay aligned if the modal evolves further.

## 2026-04-10 - OE-09 Metadata + Automatic Tags Framework

### What Changed

- Installed a real distinction between structural metadata and tags for saved objects.
- Saved objects now carry structural `projectLabel` in addition to `projectId`.
- Installed optional structural `savePurpose` to prepare smarter future classification without turning it into a tag-first system.
- Replaced the single ambiguous `tags` field with:
  - `automaticTags`
  - `userTags`
- Added a shared helper in `src/savedObjects.ts` to generate automatic tags consistently.

### Structural Metadata Is Now Source Of Truth

Do not treat tags as the main ontology.

Structural metadata now includes at least:
- `objectType`
- `projectId`
- `projectLabel`
- `sourceWorkspace`
- `sourceTeamId`
- `sourceTeamLabel`
- `sourcePanelId`
- `sourcePanelLabel`
- `createdBy`
- `createdAt`
- `updatedAt`
- `provenance`
- `status`
- optional `savePurpose`

### Automatic Tags Now Active

Current automatic tags are intentionally compact and derived, not exhaustive copies of metadata.

They currently cover:
- object type
- workspace
- team
- status
- purpose
- action
- selection/checkpoint semantics
- cross-verification flow when relevant
- locked checkpoint state when relevant

Examples:
- `type:saved-selection`
- `workspace:main-workspace`
- `team:team-legal`
- `status:active`
- `purpose:preserve-useful-selection`
- `action:save-selection`
- `selection:multi-message`
- `checkpoint:operational`
- `state:locked`
- `flow:cross-verification`

### User Tags

- `userTags` is now present as the correct placeholder in the architecture
- there is still no UI editor for user tags
- this is intentional and belongs to later OEs

### Save Purpose

- `savePurpose` is now installed as structural metadata
- current values used:
  - `preserve-useful-selection`
  - `create-operational-checkpoint`

This is deliberate:
- useful for future classification and filtering
- not promoted as a user-facing tag system

### Files Touched

- `src/types.ts`
- `src/context.tsx`
- `src/versioning.ts`
- `src/savedObjects.ts`

### Non-Regression Rules

- Do not collapse `automaticTags` and structural metadata back into one bucket.
- Do not treat automatic tags as the primary source of truth.
- Do not remove `userTags` placeholder just because the UI is not there yet.
- Do not overgenerate tags by mirroring every structural field one-to-one without purpose.

### Prepared For Next OEs

- OE-10 Persistence & Storage Layer
- OE-11 Handoff Formalization
- OE-12 Audit Log Integration Layer
- OE-13 Documentation Mode Integration Layer

### Validation

- `npm run build` passing after OE-09
- no `lint` script
- no `tests` script

## 2026-04-10 - OE-10 Persistence & Storage Layer

### What Changed

- Installed a persistence/storage abstraction for saved objects that separates:
  - human-readable body
  - system metadata
- This is implemented without pretending there is a real filesystem yet.
- The current demo now persists `savedObjectStorage` entries in local storage, where each entry contains:
  - `.md`-equivalent body content
  - `.meta.json`-equivalent structured metadata

### Strategy Now Active

For each saved object, the system now creates a storage entry with:
- `directory`
- `storageKey`
- `bodyFileName`
- `metaFileName`
- `bodyContent`
- `metadata`
- `updatedAt`

This is the canonical persistence abstraction for the demo phase.

### Human-Readable Body vs Structural Metadata

Human-readable body:
- generated in `src/savedObjects.ts`
- checkpoint -> snapshot body
- saved selection -> selected message body
- handoff/source ref/derived doc/session backup -> placeholder or structured body when applicable

Structural metadata:
- stored as the `metadata` object inside each storage entry
- remains the source of truth for:
  - ids
  - object type
  - project/workspace/team/panel origin
  - provenance
  - status
  - purpose
  - automatic tags
  - user tags placeholder

### Reconstruction Rule

- `savedObjectStorage` is persisted in local storage
- if `savedObjects` are absent but `savedObjectStorage` exists, objects can be restored from storage metadata
- if storage is absent but objects exist, storage entries are regenerated

### Compatibility Rule

Legacy bridges still remain active on purpose:
- `workspaceVersions`
- `savedFiles`
- `calendarEvents`

Reason:
- Resume Work, Audit Log bridge, and Documentation Mode still depend on them
- OE-10 adds persistence structure without breaking current demo flows

### Files Touched

- `src/types.ts`
- `src/context.tsx`
- `src/savedObjects.ts`
- `src/components/AgentPanel.tsx`
- `src/pages/PageF.tsx`

### Non-Regression Rules

- Do not collapse storage back into opaque in-memory save blobs.
- Do not remove the body/metadata duality from saved object persistence.
- Do not duplicate source documents by default for source references.
- Do not remove legacy bridges until OE-11/12/13 intentionally absorb them.

### Prepared For Next OEs

- OE-11 Handoff Formalization
- OE-12 Audit Log Integration Layer
- OE-13 Documentation Mode Integration Layer

### Validation

- `npm run build` passing after OE-10
- no `lint` script
- no `tests` script

## 2026-04-10 - OE-11 Handoff Formalization

### Scope Closed

Formalized `Handoff` as a real saved object and distinct operational flow.

This OE does **not** replace `Review & Forward`.

Current semantic split:
- `Review & Forward` = punctual human-controlled content forwarding
- `Handoff` = formal transfer package with context, destination, responsibility, continuity and its own lifecycle event

### Files Touched

- `src/types.ts`
- `src/savedObjects.ts`
- `src/context.tsx`
- `src/components/AgentPanel.tsx`
- `src/components/SecondaryWorkspacePanel.tsx`
- `src/components/TeamSubManagerPanel.tsx`
- `src/pages/PageG.tsx`

### Handoff Package Now Active

`handoff-package` payload now carries:
- `handoffTitle`
- `origin`
- `destination`
- `actor`
- `issuedAt`
- `objective`
- `minimumContext`
- `transferredMessageIds`
- `transferredMessages`
- `transferredContent`
- `linkedCheckpointId`
- `linkedSourceDocumentIds`
- `linkedDerivedDocumentIds`
- `linkedSourceObjectIds`
- `riskNotes`
- `continuityExpected`

### Lifecycle Separation

Every created handoff now generates:
- one saved object (`handoff-package`)
- one separate `activity event` of type `handoff`

Do not collapse object and event back into one ambiguous structure.

### UI / Flow Rule Now Active

Panels that already had `Review & Forward` now also expose `Create Handoff`:
- Main Workspace
- Team worker workspace
- Team sub-manager workspace
- Cross Verification sub-manager

The destination selector is reused, but the behaviors stay distinct:
- `Review & Forward` routes content immediately
- `Create Handoff` persists a formal transfer package and logs its lifecycle event

### Metadata / Tags Rule

Structural metadata remains source of truth.

Automatic tags for handoff are secondary and currently include:
- `action:handoff`
- workspace/team/panel/status/purpose tags from the shared framework
- destination marker
- checkpoint-linked marker when applicable

Do not turn destination/origin/provenance into tag-only truth.

### Persistence Rule

Handoff packages already persist through the dual storage abstraction:
- human-readable body
- structured metadata

The handoff body now includes:
- objective
- minimum context
- origin
- destination
- transferred content
- risk notes
- continuity expected

### Non-Regression Rules

- Do not rename `Review & Forward` into handoff.
- Do not remove the punctual forward action.
- Do not let handoff bypass the saved object architecture.
- Keep lock behavior conservative: locked panels should not create handoffs.
- Do not redesign Audit Log UI or Documentation Mode UI as part of handoff work.

### Prepared Next

- OE-12 Audit Log Integration Layer
- OE-13 Documentation Mode Integration Layer

### Validation

- `npm run build` passing after OE-11
- no `lint` script
- no `tests` script

## 2026-04-11 - OE-12 Audit Log Integration Layer

### Scope Closed

Audit Log now consumes the formal activity layer first and only falls back to legacy calendar entries when no formal activity equivalent exists.

This is the active precedence rule now:
- `activityEvents` = primary chronology source
- `savedObjects` = linked operational objects
- `calendarEvents` = backward-compatibility bridge only

### Files Touched

- `src/auditLog.ts`
- `src/pages/PageC.tsx`
- `src/auditLogLaunch.ts`
- `src/components/AgentPanel.tsx`
- `src/components/SecondaryWorkspacePanel.tsx`
- `src/components/TeamSubManagerPanel.tsx`
- `src/pages/PageG.tsx`
- `src/pages/PageH.tsx`

### Audit Log Model Now Active

`PageC` no longer builds its primary timeline directly from raw `calendarEvents`.

It now uses `buildAuditLogEntries(...)` to normalize:
- formal `activityEvents`
- linked `savedObjects`
- linked `savedFiles`
- legacy `calendarEvents` only when no formal equivalent exists

### Event ↔ Object Rule

Audit Log entries now separate chronology from content:
- the row is built from an event
- the linked object is attached separately when available

Current linked-object cases already covered:
- `save-version` -> checkpoint object
- `save-selection` -> saved selection object
- `handoff` -> handoff package object
- `resume` -> linked checkpoint when available

### Legacy Bridge Rule

Legacy layers still remain alive but are now subordinate:
- `calendarEvents`
- `savedFiles`
- `workspaceVersions`

They are preserved to avoid breaking:
- Saved Chat Detail
- View History
- Resume Work
- earlier demo flows

But Audit Log should not be moved back to calendar-first chronology.

### Additional Event Coverage Installed

The following actions now emit formal activity events beyond saves:
- `Review & Forward`
- `Resume Work`

`lock`, `unlock`, and `refresh` remain typed and ready, but are not yet fully wired across all surfaces.

### Non-Regression Rules

- Do not collapse Audit Log back into a calendar-only source.
- Do not make Audit Log replace saved objects; it should link them.
- Keep `Resume Work` routed through Saved Chat Detail / Page H.
- Keep Documentation Mode separate from chronological Audit Log concerns.

### Prepared Next

- OE-13 Documentation Mode Integration Layer
- OE-14 Audit Log V2 Visual Refinement

### Validation

- `npm run build` passing after OE-12
- no `lint` script
- no `tests` script

## 2026-04-11 - Micro-OE Correctiva - Cierre real de OE-12

### Corrections Applied

This pass fixed the operational issues that remained after the first OE-12 integration.

### Save Version / Audit Log Rule

Audit Log now starts from the current operating date instead of the old demo-focused March seed date.

Reason:
- newly saved checkpoints were easy to miss because the page opened on an older month

Current rule:
- new save events should be visible in the current operating period without forcing the user to manually navigate away from an old month

### Event Opening Rule

Opening an event from Audit Log should no longer relaunch the page or reset the base view.

Current rule:
- clicking an event in Month / Week / Day opens the detail locally inside Audit Log
- the base surface remains stable
- the current `viewMode` is preserved
- there is no popup-first behavior for normal in-page use

### Saved Chat Detail Path Rule

For version events, the detail modal now makes the route explicit:
- Audit Log -> Saved Chat Detail -> View History -> Resume Work

Also added:
- direct `Open Saved Chat Detail`
- direct `Open View History`

### Handoff Usability Rule

`Create Handoff` was too gray/implicit in practice.

Current rule:
- label is now `Create Handoff Package`
- it uses the existing selection and destination selector above
- an inline helper now states exactly:
  - how many selected messages will be packaged
  - which destination will receive the handoff package

This applies to:
- Main Workspace
- Team worker workspace
- Team sub-manager workspace
- Cross Verification sub-manager

### Resume Event Rule

`Resume Work` now continues to generate a formal `resume` activity event.

### Files Adjusted in This Corrective Pass

- `src/pages/PageC.tsx`
- `src/pages/PageH.tsx`
- `src/components/AgentPanel.tsx`
- `src/components/SecondaryWorkspacePanel.tsx`
- `src/components/TeamSubManagerPanel.tsx`
- `src/pages/PageG.tsx`

### Non-Regression Notes

- Do not bring back popup-first opening for normal Audit Log event clicks.
- Do not reset Audit Log to Month when opening an event.
- Keep `Review & Forward` separate from `Create Handoff Package`.
- Keep the version route explicit and easy to follow from Audit Log detail.

### Validation

- `npm run build` passing after the corrective OE-12 pass
- no `lint` script
- no `tests` script

## 2026-04-11 - Micro-OE final - Audit Log / Saved Chat Detail / Handoff visibility

### Corrections Applied

This pass closed the last visible issues before moving on from the Audit Log block.

### Saved Chat Detail Rule

`Saved Chat Detail` should now expose:
- one single `View History`
- one clear `Back to Audit Log`
- `Resume Work` as the primary action

Current structure:
- primary: `Resume Work`
- secondary: `View History`
- navigation: `Back to Audit Log`

Do not reintroduce duplicated `View History` buttons inside the detail view.

### Handoff Visibility Rule

`Create Handoff Package` now uses a filled secondary treatment instead of the previous flat neutral button.

Also preserved:
- helper text below the action area explaining that handoff uses:
  - the current selection
  - the configured destination above

Do not downgrade this button back into a gray low-signal action.

### Audit Log Saturation Seed Rule

April 2026 now includes a dense seed for stress-testing Audit Log:
- 100 events
- distributed across all teams
- distributed across workers and manager/sub-manager roles
- mixed event categories via phase/action rotation
- spread across the month for Month / Week / Day checks

March seed remains in place.

Current intent:
- April is the operational saturation month for validating filters, detail opening, and visual density.

### Files Adjusted in This Final Pass

- `src/pages/PageH.tsx`
- `src/components/AgentPanel.tsx`
- `src/components/SecondaryWorkspacePanel.tsx`
- `src/components/TeamSubManagerPanel.tsx`
- `src/pages/PageG.tsx`
- `src/data/seed.ts`

### Validation

- `npm run build` passing after the final micro-OE
- no `lint` script
- no `tests` script

## 2026-04-12 - OE-13 - Documentation Mode Integration Layer

### What Changed

Documentation Mode now starts consuming the real saved-object architecture instead of relying only on the older bridge layers.

The integration keeps one single documentary base and extends it with real objects derived from:
- `checkpoint`
- `saved-selection`
- `handoff-package`
- `source-document-reference`
- `derived-document`

`session-backup` was intentionally deferred from the documentation surface in this pass to avoid muddying Repository and Audit views before the next refinement OE.

### Integration Rule

`Documentation Mode` should now be understood as:
- a documentary/query surface over real saved objects
- not a parallel dataset
- not a second ontology beside `savedObjects`

The active doctrine remains:
- structural metadata = source of truth
- automatic tags = secondary access layer
- Audit Log = chronology
- Documentation Mode = documentary access and recovery layer

### Technical Integration Notes

- `src/documentationModel.ts`
  - now accepts `savedObjects` and `activityEvents`
  - translates official saved object types into `repositoryItems`, `indexEntries`, `auditEntries`, and `knowledgeMap` nodes
  - keeps legacy `savedFiles/calendarEvents/mainWorkspace` support as compatibility, but no longer as the only documentary source

- `src/pages/PageB.tsx`
  - now passes `savedObjects` and `activityEvents` into `buildDocumentationModeModel(...)`
  - treats `saved-object` as a real documentary item in Repository / Investigate / Knowledge Map flows
  - Repository type filter now includes `Saved objects`
  - Repository detail now exposes object metadata such as:
    - object type
    - source panel
    - provenance summary
    - automatic tags

- `src/types.ts`
  - documentation types were extended to represent `saved-object` entries and their linkage cleanly

### Non-Regression Notes

- Do not split `Structure View` and `Repository View` onto different documentary bases.
- Do not reintroduce a fake or parallel documentation dataset for Repository View.
- Do not collapse event chronology into document objects; event/object separation must remain intact.
- Do not break `Audit Log`, `Saved Chat Detail`, `View History`, or `Resume Work` while refining Documentation Mode.

### Validation

- `npm run build` passing after OE-13 integration
- no `lint` script
- no `tests` script

## 2026-04-12 - Documentation Mode follow-up - header clarifications and contextual help

### Header Clarification Rule

The shared top ribbon now carries explicit contextual subtitles for:
- `Audit Log` -> `what happened`
- `Documentation Mode` -> `what exists and how to consult it`

This was implemented in the shared top bar layer, not page-local headers.

Files involved:
- `src/pageLabels.ts`
- `src/components/TopBar.tsx`

Non-regression rule:
- keep these clarifiers lightweight
- do not turn them into large ribbon blocks
- do not affect other page labels unless explicitly requested

### Documentation Mode Help Links

Documentation Mode now includes local contextual help links in the header area, following the same pattern used in Audit Log:
- `How to use Repository review`
- `How to use Structure view`
- `How to use Audit View`
- `How to use Investigate View`
- `How to use Knowledge Map`

Behavior:
- each link opens a floating modal inside `Documentation Mode`
- no route change
- no reset of the active documentation view
- no reset of filters or current repository context
- all help content is in English

Implementation notes:
- this was kept local to `src/pages/PageB.tsx`
- the links are intentionally rendered as lightweight documentation/help links, not primary CTAs

### Documentation Mode Help Alignment

The new help-link block in the right side of the Documentation Mode header is now left-aligned internally.

Reason:
- the first version rendered correctly but felt visually right-anchored inside the reserved help area
- the fix was intentionally minimal and limited to the local container

### Current Documentation Mode Assessment

Important working conclusion for future MVP planning:
- Documentation Mode should not be discarded wholesale
- the strongest reusable asset is `src/documentationModel.ts`
- the main refactor target is `src/pages/PageB.tsx`, which is now too monolithic

Recommended preservation:
- one shared documentary base
- Repository View as operational core
- Structure View as provenance support
- saved-object integration from checkpoints / saved selections / handoffs

Recommended reduction or deferment:
- heavier auxiliary text/manifests embedded in `PageB`
- advanced/secondary layers if the MVP needs tighter focus
- Knowledge Map and parts of Investigate View can be simplified before being removed

### Validation

- `npm run build` passing after the Documentation Mode follow-up changes
- no `lint` script
- no `tests` script
