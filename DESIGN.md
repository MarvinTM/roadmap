# aiRoadmap: Design Document

Status: **v5, implemented**
Date: 2026-11-11

## 1. Goal

A lightweight, single-user web app for managing a personal roadmap. You create **big blocks** (initiatives/epics) and place them on a **month-based grid**. Each big block can be stretched across months and across rows. Inside each big block you lay out **small blocks** (stories) as short bars that can be moved, resized, and dragged into other big blocks. Almost every interaction is drag & drop.

### Non-goals (for now)
- Authentication, multiple users, sharing
- Real-time collaboration
- Dependencies/arrows between blocks
- Jira API integration (small blocks only store a link)
- Mobile-first UX (desktop browser is the target)

## 2. Concepts

| Concept | Description |
|---|---|
| **Roadmap** | The single document the app manages. One per installation. |
| **Grid** | The main area: **month columns** × **rows**. Each (month, row) pair is a **cell**. |
| **Big block** | A titled, colored rectangle on the grid that covers `N months × M rows`. Big blocks never share a cell. A block may start in the month right after another block in the same row ends. A big block can also be *unscheduled*, which means it sits in the backlog and keeps its shape and contents. |
| **Track** | A horizontal lane *inside* a big block. A big block has one track per grid row it covers, so a 3-row block has 3 parallel tracks. |
| **Small block** | A bar inside a big block. It sits on one track and covers a range of **quarter-months** (minimum 1 quarter, i.e. ¼ of a month column). It has a title and an optional Jira link. |
| **Quarter (q)** | The unit for positioning small blocks: ¼ of a month column. It is a visual subdivision and is not tied to calendar days. |
| **Backlog** | A side panel of unscheduled big blocks. |
| **Release** | A named, colored boundary at the end of a month. It marks the end of a calendar period, independently of blocks or stories. |

## 3. UI Layout

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ aiRoadmap   [◀] [Today] [▶]  From: [Nov 2026 ▾]  Months: [–] 12 [+]  [+ Big block] ✓│
├─────────────┬─────────────────────────────────────────────────────────────────────┤
│ BACKLOG     │   Nov    │   Dec    │   Jan    │   Feb    │   Mar    │   Apr    │ ... │
│             ├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼─────┤
│ ┌─────────┐ │┌Platform v2 ───────────── ⋮┐┌Hiring ────── ⋮┐                        │ row 0
│ │ Idea X  │ ││[API design ][Auth spike ] ││[JD][Screening]│                        │
│ │ 2m × 1r │ ││[Migration ═══════════]    │└───────────────┘                        │
│ │ 3 items │ ││        [DB  ][Perf]       │                                         │ row 1
│ └─────────┘ │└───────────────────────────┘          ┌Marketing site ──────────── ⋮┐│
│             │                                       │[Copy][Design ════][Launch]  ││ row 2
│             │                                       └─────────────────────────────┘│
│             │                                                                     │ row 3 (empty, drop target)
│ 🗑 drop here│                                                                     │
│   to delete │                                                                     │
└─────────────┴─────────────────────────────────────────────────────────────────────┘
  "Platform v2" covers Nov–Jan × rows 0–1 (two tracks). "Hiring" starts in Feb, right after it.
```

- **Top bar**
  - App title.
  - **Range widget**:
    - ◀ / ▶ shift the window by one month.
    - **Today** jumps to the current month.
    - **From** is a month picker for the first visible month.
    - **Months** is a stepper (`–` / `+`, range 3–36) for the number of visible months.
  - A **+ Big block** button.
  - A **Release** creation button and a saved **Tint release periods** checkbox, off by default.
  - A save-status indicator (saved / saving / error).
- **Backlog (left, collapsible)**: compact cards for unscheduled big blocks, showing the title, shape (e.g. "2m × 1r") and item count. Clicking a card's chevron expands it to show a compact list of its small blocks, which can be dragged out onto big blocks on the grid. Cards are also drop targets for small blocks (see 4.2). There is a trash drop zone at the bottom.
- **Grid**:
  - A sticky month header, with the current month tinted and a stronger divider at year boundaries. A 28 px release-label strip sticks immediately below it. Each release header spans the period from the previous release boundary to its own boundary, clipped to the visible calendar range, independently of the tint toggle.
  - Rows have a fixed height. There is always at least one empty row at the bottom as a drop target, and trailing empty rows beyond that are trimmed.
  - The grid is its own scroll container and scrolls **horizontally and vertically**. The month header stays sticky at the top, and the top bar and backlog stay fixed.
  - Faint quarter-month tick lines are shown inside big blocks, and while dragging a small block.
- **Big block**:
  - A colored rectangle with a 24 px header (title + `⋮` menu).
  - Its body is split into tracks, one per row it covers.
  - Resize handles on the **left, right and bottom** edges.
- **Small block**:
  - A rounded chip filling the available track height with a small gap above and below. Its title wraps to at most **two lines**, with an ellipsis for overflow and the full title in a tooltip. The drag handle and small **Jira icon button** remain alongside the title; the icon opens the link in a new tab and is hidden when no link is set.
  - Backlog items retain their compact, single-line layout. Grid row height and scheduling units are unchanged.
  - Resize handles on its left and right edges.

### Sizing
- **Column width** = available grid width ÷ visible months, with a **minimum of 120 px**. Below that minimum the grid scrolls horizontally, so even at 36 months a quarter stays at least 30 px wide.
- **Row height**: 64 px. A big block of `M` rows has a height of `M × 64 px`: 24 px of header plus the rest split evenly into `M` tracks.
- **No limits** on the number of rows, the number of rows per big block, or the months per big block. The grid grows to fit and scrolls.

## 4. Interactions (drag & drop first)

### 4.1 Big blocks
| Action | Gesture | Result |
|---|---|---|
| Create | "+ Big block" | A new block (1 month × 1 row) appears in the backlog with its title in edit mode. |
| Schedule | Drag a backlog card onto the grid | It is placed with its stored shape, with its top-left cell at the hovered (month, row). |
| Move | Drag the block's header | It moves across months and/or rows. Its shape and contents are preserved. |
| Stretch horizontally | Drag the left or right edge | Changes the start or end month, snapping to whole months. The minimum is 1 month. |
| Stretch vertically | Drag the bottom edge | Changes the number of rows (and therefore tracks). The minimum is 1 row. Growing into blocks below pushes them down; shrinking pulls blocks stacked beneath back up (see the rules below). |
| Unschedule | Drag it to the backlog, or use menu → Unschedule | It goes to the backlog and keeps its shape and small blocks. |
| Delete | Drag it to the trash, or use menu → Delete | It is removed, with an **Undo** snackbar for about 5 s. |
| Rename / color | Double-click the title / `⋮` menu | Inline edit. A palette of about 8 colors. |

**Rules**
- **No shared cells**: a move, resize or schedule is valid only if every cell of the new rectangle is free (the block's own cells don't count). Blocks may touch edge to edge.
- **Changing rows reflows the blocks below**: the one exception is changing the rows to a scheduled block in place (bottom-edge drag, or only changing *Rows* in the edit dialog). Adding rows pushes:. Each block it would overlap moves down just far enough to clear it, cascading to the blocks those then hit; blocks that are not in the way stay put. Removing rows the same way does the reverse: a block touching the old bottom edge, and the stack touching it in turn, moves up as far as the free space above it allows; blocks separated by an empty row stay put. The preview shows dotted outlines where pushed or pulled blocks will land.
- **Contents constrain shrinking**: a big block cannot be shrunk (from the left, the right or the bottom) past the extent of its small blocks. Resizing from the left keeps small blocks at their absolute months by shifting their offsets.
- **Feedback**: during the gesture, a ghost rectangle shows the snapped target. It is blue when the drop is valid and red when it isn't. An invalid drop snaps back. A tooltip shows e.g. "Jan 2027 – Apr 2027 · 2 rows".
- The grab offset is preserved, so the block doesn't jump to the pointer.

### 4.2 Small blocks
| Action | Gesture | Result |
|---|---|---|
| Create | Double-click empty space on a track, or `⋮` → "Add item" | It is created at the clicked quarter with a default length of 4 q (1 month), shortened to the free space. "Add item" uses the first free slot. The title starts in edit mode. |
| Move within a block | Drag the chip | It moves horizontally (snapping to quarters) and/or to another track. |
| Move to another block | Drag the chip onto another big block on the grid | It is placed at the hovered quarter and track of the target block, keeping its length. |
| Move to a backlog block | Drag the chip onto a backlog card | It goes into the **first free slot** (lowest track, then earliest quarter) and keeps its length. If no slot fits, the unscheduled block grows: a new track is added, and if needed it is widened to the item's length. This lets you assemble a big block with its stories in the backlog and then drop the whole thing onto the calendar. |
| Move out of a backlog block | Drag an item from an expanded backlog card onto a big block on the grid or another backlog card | It is placed as above. |
| Resize | Drag the left or right edge | It snaps to quarters. The minimum is **1 q** and the maximum is the big block's width. |
| Rename | Double-click the title | Inline edit |
| Set Jira link | Click the Jira icon, or use the chip's context menu → "Edit link" | A small popover with a URL field. Clicking the icon when a link is set opens it in a new tab. |
| Delete | Drag it to the trash, or use the context menu → Delete | It is removed, with an Undo snackbar. |

**Rules**
- Small blocks on the same track cannot overlap. They may touch.
- A small block must lie entirely within its big block's bounds.
- An invalid target shows a red ghost and snaps back on drop.

### 4.3 Range widget
- **Months** (3–36) and **From** are saved in the roadmap file (`settings`), so the view is restored on reload.
- ◀ / ▶ shift **From** by 1 month, and **Today** sets it to the current month.
- Big blocks that extend outside the visible window are drawn clipped, with a ◀ / ▶ fade showing that they continue.
- Dragging near any edge of the grid auto-scrolls it: up and down vertically, and left and right horizontally. When the scroll reaches the end of the visible window, the window shifts by a month.

### 4.4 Releases
| Action | Gesture | Result |
|---|---|---|
| Create | Top bar → Release | A dialog asks for a name, with an editable default end month and automatically selected color. Cancel creates nothing. The first release defaults to the first visible month; subsequent releases default to one month after the chronologically last release. The view shifts only as much as necessary to reveal it. |
| Move | Drag a release label horizontally | The boundary snaps to whole months. A November release appears between November and December. Labels preserve their grab offset, with blue/red boundary previews. |
| Rename / month / color | Label menu → Rename or Change month & color | Opens the release dialog. Focusing a label and pressing Enter or Space opens it with the month field focused, providing a keyboard alternative to dragging. |
| Tint | Top bar → Tint release periods | Adds very faint release-colored backgrounds without replacing block colors. This setting is saved. |
| Delete | Label menu → Delete | Removes only the release boundary, with five-second Undo. Blocks and stories are unchanged. |

**Rules**
- Releases may cross and are sorted chronologically, retaining their IDs, names and colors. Two releases cannot end in the same month: invalid drops snap back and invalid form edits leave the dialog open.
- A release colors the period ending at its boundary, including the ending month. Before the first boundary, use the first release's color; between boundaries, use the color of the release ending that period. After the last boundary, leave the calendar untinted. Off-screen boundaries still determine the correctly clipped shading.
- Release lines and tints never intercept clicks or block gestures. Only labels initiate release dragging. A release cannot be dragged into the backlog or trash.
- Release dragging uses horizontal auto-scroll and the existing delayed month-window shifting, including when dragging in the sticky strip. It never scrolls vertically or grows the row count. Escape, pointer cancellation and window blur cancel the gesture.
- Undo restores the original boundary without reverting subsequent edits. If another release now occupies that month, Undo shows a conflict message and leaves both the existing release and all blocks untouched.

## 5. Architecture

```
┌──────────────── Browser ────────────────┐        ┌──────── Node ─────────┐
│ React + MUI                             │  HTTP  │ Express                │
│  ├─ RoadmapProvider (useReducer)        │◀──────▶│  /api/roadmap          │
│  ├─ Grid geometry (px ⇄ month/q/row)    │  JSON  │  storage.js            │
│  └─ Pointer-based drag/resize engine    │        │   └─ data/roadmap.json │
└─────────────────────────────────────────┘        └────────────────────────┘
```

### 5.1 Tech choices
| Area | Choice | Why |
|---|---|---|
| Language | **Plain JavaScript (ES modules)**. Data shapes are documented with JSDoc. | As requested |
| Frontend build | **Vite** (React template, JS) | Fast, minimal config |
| UI | **MUI v6** (`@mui/material`, `@mui/icons-material`) | As requested |
| Drag & drop | One **custom pointer-events engine** (`useGridDrag` hook) for grid moves/resizes, backlog transfers, trash drops, and horizontal release-label moves. No dnd-kit. | Shared snapping, hit-testing, collision checks, previews, cancellation, and scrolling avoid coordinating two gesture engines. Menus provide keyboard-accessible alternatives. |
| State | `useReducer` + Context | The app is small |
| IDs | `crypto.randomUUID()` | Built in |
| Months | Stored as `"YYYY-MM"`, with small helpers (`addMonths`, `diffMonths`, `monthIndex`) | No date library is needed |
| Backend | **Express 5** | As requested |
| Storage | One JSON file: `server/data/roadmap.json` | A simple, human-readable text file |
| Dev | npm workspaces (`client`, `server`) + `concurrently` | `npm run dev` starts both |

### 5.2 Project structure
```
aiRoadmap/
├─ package.json              # workspaces + scripts (dev, build, start)
├─ server/
│  ├─ package.json
│  ├─ src/index.js           # express app; serves client build in prod
│  ├─ src/storage.js         # load/save, atomic write, backup, revision check
│  ├─ src/validate.js        # shape validation for PUT
│  └─ data/roadmap.json      # created on first run
└─ client/
   ├─ package.json, vite.config.js, index.html
   └─ src/
      ├─ main.jsx, App.jsx, theme.js
      ├─ state/              # reducer.js, actions.js, RoadmapContext.jsx, useAutosave.js
      ├─ lib/months.js       # month arithmetic
      ├─ lib/geometry.js     # px ⇄ (month, quarter, row) conversions
      ├─ lib/collision.js    # cell occupancy, rectangle/interval overlap, bounds checks
      ├─ dnd/useGridDrag.js  # pointer engine: move + resize with snapping & preview
      └─ components/
         ├─ TopBar.jsx, RangeWidget.jsx, SaveIndicator.jsx
         ├─ Backlog.jsx, BacklogCard.jsx, TrashZone.jsx
         ├─ Grid.jsx, MonthHeader.jsx, GridBackground.jsx, DragGhost.jsx
         ├─ ReleaseHeader.jsx, ReleaseDialog.jsx
         ├─ BigBlock.jsx, BigBlockHeader.jsx, Track.jsx
         └─ SmallBlock.jsx, JiraLinkPopover.jsx
```

## 6. Data model

`roadmap.json`:

```jsonc
{
  "schemaVersion": 2,
  "revision": 42,                    // incremented on every save
  "updatedAt": "2026-11-10T10:00:00Z",
  "settings": {
    "startMonth": "2026-11",         // first visible month
    "monthsVisible": 12,             // 3–36
    "tintReleasePeriods": false
  },
  "bigBlocks": [
    {
      "id": "b1f…",
      "title": "Platform v2",
      "color": "#1976d2",
      "months": 3,                   // width in months  (≥ 1)
      "rows": 2,                     // height in rows   (≥ 1) = number of tracks
      "placement": {                 // null → in backlog
        "start": "2026-11",          // first month (inclusive); end = start + months − 1
        "row": 0                     // top row index
      },
      "backlogOrder": null,          // number when unscheduled
      "smallBlocks": [
        {
          "id": "s9a…",
          "title": "API design",
          "jiraUrl": "https://acme.atlassian.net/browse/PLAT-12",  // or null
          "track": 0,                // 0 … rows − 1
          "offset": 0,               // quarters from the big block's start (≥ 0)
          "length": 4                // quarters (≥ 1); offset + length ≤ months × 4
        }
      ],
      "releases": [
        {
          "id": "r3a…",                 // globally unique, including block/story IDs
          "title": "Public launch",
          "month": "2027-01",           // boundary after January; unique among releases
          "color": "#00897b"
        }
      ]
    }
  ]
}
```

Design notes:
- A big block's shape (`months`, `rows`) is stored separately from its `placement`, so unscheduling and rescheduling preserves both its shape and its contents.
- Small block positions are **relative** to their big block, so moving the big block moves its contents for free. Moving a small block to another scheduled big block follows the pointer at the target quarter, preserving the grab offset and item length; it does not preserve the original calendar date.
- Rows are plain integers. Blocks may leave empty rows between them, which is allowed. Trailing empty rows are not stored, because the grid height is derived from the content.
- Releases reference calendar months, not blocks or stories. Moving or deleting a release never changes block contents, geometry or assignment.

## 7. Backend API

The API loads and saves the whole document, since it is small.

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/api/roadmap` | none | `200` with the Roadmap. If the file is missing, an empty roadmap is created. |
| `PUT` | `/api/roadmap` | Roadmap with the `revision` the edit was based on | `200` with `{ revision, updatedAt }`, `409` on a revision mismatch, or `400` if validation fails |
| `GET` | `/api/health` | none | `200` |

Server behavior:
- **Atomic writes**: the server writes `roadmap.json.tmp` and then `rename`s it over the real file.
- **Serialized writes**: an in-process promise queue ensures that writes never interleave.
- **Backup**: the previous file is copied to `roadmap.json.bak` before each write.
- **Schema upgrade**: a valid schema-1 file is upgraded on first load, preserving blocks and range settings, adding empty releases and tinting off, and advancing the revision once. The original is retained byte-for-byte in `roadmap.json.v1.bak`, which subsequent saves never overwrite. The upgraded file is written atomically. Invalid legacy files are reported without replacement.
- **Old clients**: schema-1 PUTs and incomplete schema-2 documents are rejected, preventing older tabs from silently erasing release data. Reload the page after upgrading.
- **Validation**: checks the document shape, month format and numeric ranges. It also enforces the integrity rules: big blocks never share a cell, small blocks are within bounds and don't overlap on a track, and release months and all object IDs are unique.
- **Production**: `express.static` serves `client/dist`, so there is a single port (default `3001`). In dev, Vite proxies `/api` to it.

**Client persistence**: every action updates the UI immediately, and `useAutosave` PUTs the document about 500 ms after the last change (debounced). Previews during a drag are local and only saved on drop. On a save error, the indicator turns red and offers a retry. On `409`, a dialog offers "Reload latest" or "Overwrite".

## 8. Drag & resize engine notes

- **Geometry**: the grid keeps `colWidth`, `rowHeight` and `startMonth`.
  - `pxToCell(x, y)` returns `{ month, row }`.
  - `pxToQuarter(x)` returns an absolute quarter index (`monthIndex × 4 + q`).
  - Small-block tracks within a big block are derived from its rect.
- **Gesture lifecycle**: `pointerdown` on a handle or chip, then `setPointerCapture`. On each `pointermove`, the engine computes the snapped candidate, runs the collision check, and updates the ghost (valid/invalid). On `pointerup`, it dispatches the action if the candidate is valid, or cancels otherwise. `Esc` cancels.
- A **4 px movement threshold** before starting a drag, so that double-click to edit still works.
- **Hit-testing for cross-block small-block moves**: on each move, the engine finds the big block under the pointer from its rect (not the DOM), then the track and quarter within it. If the pointer is over a backlog card instead, the drop target is that card (first-free-slot placement).
- **Scroll awareness**: geometry conversions account for the grid's `scrollLeft` and `scrollTop`, and the engine recomputes the candidate on scroll as well as on pointer move.
- **Sticky headers**: month and release strips share a central header-height calculation for body hit-testing and vertical auto-scroll. Releases can be dragged within the header and use whole-month deltas; block and story geometry remains relative to the body.
- **Backlog ⇄ grid / trash**: the same pointer engine hit-tests backlog cards and the trash zone by their bounding rects, with no handoff to another library.
- **Keyboard / accessibility**: everything that can be done by dragging is also available from the menus (move to month or row, resize, add item, delete).

## 9. Visual design
- MUI default theme, light mode.
- Big blocks use a soft tint of their color for the body and a saturated header. Small blocks are white "paper" chips with a 3 px left border in the parent's color.
- A selected or dragged item gets an elevation shadow. The ghost is a dashed outline, blue when valid and red when invalid.
- The current-month column is tinted, and year boundaries get a stronger divider.

## 10. Implementation sequence
1. Scaffold the workspaces: Vite React (JS) + MUI client and the Express server.
2. Server: storage (atomic write, backup, revision), validation, API.
3. Client state: reducer, actions, load, autosave. Plus `months.js`, `geometry.js` and `collision.js` with unit tests (Vitest), since these hold the trickiest logic.
4. Static rendering: top bar with the range widget, grid, big blocks with tracks, small blocks, backlog.
5. Drag engine for big blocks: move, resize on the left, right and bottom edges, collision ghost.
6. Drag engine for small blocks: move within a block or across blocks, resize.
7. Backlog ⇄ grid moves, trash, Undo snackbar.
8. Inline editing, menus, colors, Jira link popover.
9. Polish: auto-shift at the edges, clipping indicators, save indicator and the 409 dialog, empty states.

## 11. Resolved decisions
- **Rows**: there is no limit on rows per big block or on total rows. The grid scrolls both horizontally and vertically.
- **Jira**: each small block stores the full URL.
- **Backlog cards**: they accept small blocks (first free slot, growing the block if needed), so you can build a big block with its stories before scheduling it.
- **Cross-block item moves**: follow the pointer, preserving grab offset and length, rather than preserving the original calendar position.
- **Full-block creation**: prevent creation in full scheduled blocks; grow full backlog blocks using the existing allocation rules.
- **Backlog authoring**: cards offer Add item, and expanded lists provide rename, edit-link, and delete controls.
- **Single drag engine**: use the custom pointer engine for all grid, backlog, and trash gestures; do not add dnd-kit.

## 12. Running and validation

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev       # UI: http://127.0.0.1:5173; API: http://127.0.0.1:3001
npm test          # Domain rules, reducer, geometry, storage, and API
npm run lint
npx playwright install chromium webkit
npm run test:e2e  # Chromium + WebKit; isolated storage, ports 3107 and 4177
npm run build
npm start        # Production UI and API: http://127.0.0.1:3001
```

The server creates `server/data/roadmap.json` on first start. `PORT`, `HOST`, and
`ROADMAP_DATA_FILE` override the server defaults; `API_PORT` changes the Vite proxy
target during development. The server binds to loopback by default: this is an
unauthenticated personal application, not an Internet-facing service.

The previous saved document is kept in `roadmap.json.bak`. Storage is locked
against concurrent server processes; if a server is forcibly killed, remove its
`.lock` file only after confirming the recorded PID is no longer running.
Corrupt data is reported rather than silently replaced. Stop the server before
restoring a backup or editing the JSON file manually.

The client and server share the domain rules in `shared/domain.js` to keep drop
validation and persisted-document validation consistent. User-facing row, track,
and quarter numbers in editing forms count from 1; JSON offsets count from 0.
Undo restores just the deleted object, preserving subsequent edits. If its old
location is occupied, a block or story is restored to the backlog instead.
Releases have no backlog location: if their old month is occupied, Undo reports
the conflict without changing the document.
