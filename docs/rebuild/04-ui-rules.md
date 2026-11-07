# 04 · Webseq UI rules and patterns

Principles and reusable interaction patterns, **not** a placement algorithm. Each rule states its reason so it can be broken
intelligently (§19). Desktop audio application first: dense, persistent, direct manipulation, keyboard-driven.
Accessibility is met inside that idiom (§18), not by turning it into a web dashboard.

## 1. Application structure and navigation

```
APP BAR      ☰ menu │ project name ● │ Pattern · Arrange · Mixer │ ⟲ ⟳ │ ▶ ■ position │ loop|song │ BPM │ swing │ key │ ● resample │ MIDI ?
CONTEXT BAR  what is being edited (pattern, track) ·········· icon actions: + ⧉ arrange-add   Edit ▾
SIDEBAR      icon rail (Samples · Instruments · Patterns · Guide) + one panel; click the active icon to hide it
WORKSPACE    one of the three workspaces
DEVICE AREA  the selected track's Instrument / FX & Route / Mod    (collapsible, resizable)
```

**Where the non-music things live** (a rule, because the sidebar became a dumping ground once):
- *Content you pull from while composing* → the sidebar: Samples, Instruments, Patterns (+ the queue). Nothing else.
- *The project file and the machine* → the **main menu** (☰, ⌘,): Project (rename, new, open, save, export, import, saved list), MIDI devices, Help (shortcuts, Musical Guide).
- *Actions on the thing being edited* → the context bar: icon buttons, plus **Edit ▾** (the copy/paste rows and bar tools).
- *Occasional settings* (swing, key and scale) → popovers on the transport, not permanent controls.
- **Project management follows the desktop pattern**: the name is edited in place in the app bar; a dirty indicator beside it is also the save button; ⌘S saves, ⌘O opens; New / Open / Import ask before discarding unsaved changes.
- **Icons over words.** Standard DAW glyphs with a tooltip and an aria-label for every icon button (play, stop, record, loop/song, undo, plus, copy…). Text remains where the word *is* the control: M / S, workspace names, tab names, property names in the graph.

- **Three workspaces, one level of navigation.** `PATTERN` (default), `ARRANGE`, `MIXER`. Keys `1 2 3`. Nothing else is a
  top-level mode. Step / Graph / Roll are *depths inside Pattern* (§9), Instrument / FX / Mod / Route are *tabs of the device
  area*, Assets / Patterns / MIDI are *sections of the library*. A fourth workspace must justify itself against "could this be
  a depth, a device tab or a library section?".
- **Why Library is a drawer, not a workspace.** It is reference material you pull from while working (drag an asset to a
  track, queue a pattern); it never replaces the thing being edited.
- **Persistent chrome.** App bar and device area exist in all workspaces; switching workspace keeps the selected track,
  scroll positions and drawer states (per-workspace UI state is remembered).
- **Where do I find X?** Rule of thumb printed in the cheat-sheet: *what it is* → its home. Notes/steps → Pattern. Where in the
  song → Arrange. Level/pan/route/meter → Mixer. How a track sounds → Device area. Files & lists → Library. The project &
  engine → App bar.

## 2. Context bar: "what am I editing"

One line under the app bar answering *what object does this apply to?* — the most common failure of previous UIs.

```
PATTERN ▸ Pattern 03 · 4 bars [− +]  ▸  KICK (01)           ◂ ▸ prev/next track     [Edit ▾] [Duplicate] [⛓ in Arrange ×2]
ARRANGE ▸ Lane 2 · Verse (bars 5–8)                                                      [Open ⏎] [Duplicate] [Delete]
MIXER   ▸ Bank 1 · 16 tracks                                                             [Bank ◂ ▸]
```
- Left: breadcrumb, each segment clickable to retarget (pattern name is an inline-rename field; bars is a stepper).
- Right: **contextual actions** of the current selection (§7). They change with selection; the bar itself never reflows
  the workspace (fixed height, 28 px).
- When a workspace was entered from another (a clip opened from Arrange), the first segment is a **return link**
  `◂ Arrange · Lane 2 · Verse`.

## 3. Track identity

One component, `TrackHeader`, used in the step lane, the arrangement's expanded lanes, the mixer strip and the device-area
title. Its content is the same everywhere; its *density* varies (`dense | strip`).

| Element | Rule |
|---|---|
| Number | `01`–`64`, always shown, tabular figures. Bank = ⌊(n−1)/16⌋. Same on controller labels. |
| Colour | A 3 px identity bar at the header's left edge, derived from index (stable) — **identity only**, never state. |
| Name | The asset/instrument name by default; double-click to rename. Truncated with ellipsis; full name in tooltip. |
| Source glyph | `◉` sample · `∿` synth · `✂` chop · `—` empty. Also in text for screen readers. |
| M / S | Toggle buttons *with letters* (not colour alone). Lit background + inverted letter. Solo implies "downstream stays audible" with a dotted S for "heard via solo". |
| Pattern-notes toggle | `◐` secondary toggle, only in `PAT`/`ARR` (per-pattern notes off). |
| ▶ audition | trigger / hold-to-play; loop tracks toggle. |
| Meter | 2 px vertical level at the right edge; clip LED turns the identity bar red. |
| Selection | selected header gets the selection treatment (§6) *and* the device area retitles to the track. |

Master is the same header with a different glyph and no step lane.

## 4. Transport

Lives in the app bar, right of navigation; **identical in every workspace** and never scrolls away.

`⏮ ▶/⏸ ⏹ ⏺?  │ PATTERN | SONG │ pos 03.2.04 │ BPM ▾ │ swing │ key ♪ C min │ ⏺ resample`

- Space = play/stop; the play button *is* pause/resume (one key, one button).
- **Source toggle** (Pattern/Song) is transport state, not a view; Arrange shows a "SONG" tag in the transport when armed.
  Switching workspace does *not* change the source. Opening Arrange offers "Play song" in the context bar; Pattern view offers
  "Loop this pattern" (V1's queue plays the *queue*, not necessarily the viewed pattern — the context bar says which).
- Position text and the playhead are written by `requestAnimationFrame` directly into DOM/canvas (§14).
- Controls that cannot act now are **disabled with a reason** in the tooltip (BPM during resample; follow-host).
- Host-follow shows BPM as a read-only `HOST 128` chip.

## 5. Timeline and grid controls

Shared by Steps, Graph, Roll, Arrange. One *Grid* control cluster per scrolling timeline, left-to-right:
`[ Snap ▾ ] [ − zoom + ] [ ⇥ follow ]`

- **Musical time is primary**: ruler shows bars (`1 2 3 4`), beat ticks inside a bar (4 groups of 4 steps, V1's
  16 steps/bar), step numbers on zoom-in. Never seconds in editors.
- **Snap** values `1 · ½ · ¼ · ⅛ step`, plus `Off`; holding `Alt` while dragging bypasses snap (V1 free placement 1/64).
  Snap is one global setting shared by Steps and Roll; Arrange snaps to bars only.
- **Zoom** is horizontal only, in the pattern workspace shared by the step lane, Graph and Roll so columns **always line up**
  (the Graph is "under" the steps). Ctrl+wheel zooms around the cursor; the control shows %.
- Loop/playhead: the playhead appears in a timeline only when that timeline's pattern is the one sounding (V1 rule).
- `Follow` (auto-scroll) is off by default (V1 behaviour: never auto-scroll).

## 6. Selection

A single `selection` value, a discriminated union, drives context bar, device area and shortcuts:

```
none | track(id) | steps(trackId, columns[]) | notes(ids[]) | clip(ids[]) | lane(id) | device(trackId, fxId?)
```
Rules: there is **always a selected track** (selecting steps/notes/clips also selects their track; Master is a valid track
selection). Clicking background clears the sub-selection, not the track.

| Object | Visual (shape + colour, never colour alone) |
|---|---|
| Track | header surface raised + 2 px accent edge opposite the identity bar; the track's lane row gets a faint wash |
| Step | 2 px accent outline + inner highlight; marquee for multiple |
| Note (roll) | accent outline + resize handles visible; velocity stem highlighted in the graph |
| Clip | accent outline, resize handle, name in bold |
| Not selected but "related" | e.g. other placements of the same pattern: dotted outline |

Multi-select: shift-click adds/ranges, marquee on empty space, ⌘A selects all of the current object kind. Esc clears
sub-selection, then track.

## 7. Actions: primary and contextual

- **Primary actions** (create/destroy/transfer for the *current container*) live in the context bar's right side and in the
  workspace toolbar: Add, Duplicate, Delete, Copy, Paste, Edit/Open, Close/Back. They use the same words and glyphs
  everywhere, and the same shortcuts: `⌘D` duplicate, `Delete`, `⌘C/⌘V`, `⏎` open/edit, `Esc` back/close.
- **Contextual actions** (belong to the selected thing): right-click menu on the object **and** the same items under the
  context bar's `Edit ▾`. A context menu is never the only way to reach an action (keyboard + visible menu exist).
- **Destructive actions** don't ask for confirmation when undoable (almost everything: history is 100 deep) — they report
  "Deleted 3 clips · Undo" in the status area instead. They confirm only when not undoable (delete saved project from
  storage, remove asset used by tracks).
- **Verbs by object**:
  | | Add | Duplicate | Delete | Open/Edit | Copy/Paste |
  |---|---|---|---|---|---|
  | Pattern | + in context bar | ⧉ | Library › Patterns | `[ ]` step | — |
  | Step/note | click empty | `⌘D` (note: repeat after) | `Delete` | graph/roll | `⌘C/V` of a track's notes |
  | Clip | double-click lane / Library drag | `⌘D` (independent) / `Alt`-drag (linked) | `Delete` | `⏎`/double-click | `⌘C/V` |
  | Lane | `+ lane` | — | lane menu | — | — |
  | FX | `+ ▾` in rack | — | ✕ on module | click module | module/chain copy |

## 8. Panel headers

Every panel that can be resized/collapsed has the **same header** (24 px), built from one component:

```
▾ TITLE · subject                [tabs]                  ··········  [panel actions]  [⤢ maximise?] [— collapse]
```
- `TITLE` uppercase micro-label (10 px, 0.05em tracking, V1 convention). `subject` names the object it relates to
  ("INSTRUMENT · 01 KICK"); the subject is a live link to the selection.
- Tabs sit after the title, actions at the right, collapse at far right; maximise only where a panel has a "focus" mode (Roll).
- A header is always at least keyboard-focusable and `Enter` toggles collapse. Resizable panels expose a splitter that is
  itself focusable (arrow keys resize by 16 px).
- If a panel has no meaningful subject (Library) the subject is omitted, not "—".

## 9. Tabs: when, and when not

Use **tabs** when sibling views of *the same object* are mutually exclusive and equally likely: Device area (Instrument · FX ·
Mod · Route), Library (Assets · Patterns · MIDI · Projects), Graph property (Velocity · Pitch · Length · …).

Use **depth (expansion)** when one view *refines* another and both must stay visible: Steps → Graph → Roll. The Roll and Graph
are tabs of the *same drawer* under the step lane; the step lane never disappears while they're open.

Use **separate workspaces** only for different jobs on different objects (Pattern / Arrange / Mixer).

Use **contextual controls** (dropdown, segmented, toggle) for a mode of one thing (scope: This pattern ⇄ Track; Source:
Pattern ⇄ Song). Don't make a tab out of a setting.

Tab labels are nouns; max 6 per strip; overflow collapses into a `⋯` menu. The last-used tab per panel is remembered.

## 10. Menus: when instead of another button

A visible button needs (a) frequent use, or (b) a state to show. Otherwise it's a menu item.
- `Project ▾` (new, save, load, export, import, rename, recovery), `Edit ▾` (the V1 Edit panel's rows: Track / Sequence /
  Instrument / FX / Modulation / Bank copy-paste and bar tools), lane `⋯`, clip `⋯`, track header right-click.
- Menu items show their shortcuts, disabled items state why. Menus open at the cursor / button, close on `Esc`, are
  keyboard operable (arrows, type-ahead), and never contain more than ~12 items before grouping with separators.
- A single-use setting never gets its own button; it lives in the nearest menu or popover.

## 11. Empty states and modals

**Empty states** say what the thing is and the one next action, inline, in the place the content will appear:
- Empty step lane track (no source): `◦ No sound — drop a sample here or pick an instrument` with `Instrument…` / `Sample…`.
- Empty pattern: lanes still show the grid (the grid *is* the affordance), a single hint line in the context bar.
- Empty arrangement: ruler + lane with a ghost clip at bar 1: `Drag a pattern here, or press + to place Pattern 01`.
- Empty library section: one line + the primary action (Import samples…).
No illustrations. Text is 11 px dim, never centred in a large blank area.

**Modals** are for decisions that *block* other work and are short: unsaved-changes on new/load, destructive non-undoable
delete, export/import progress or errors that need acknowledgment, the Musical Guide (a task flow that borrows the keyboard).
Everything else is inline (rename in place, popovers for key/scale, drawers for the roll). A modal traps focus, closes on
`Esc`, restores focus to its opener, and never nests.

## 12. Resizing

- Resizable: library width, device-area height, graph/roll drawer height, lane heights in Arrange (per-lane expand), mixer
  strip width in compact/expanded modes. Everything else is fixed.
- One mechanism: **Splitter** — drags write a CSS variable, commit to state + `localStorage` on release (R1). No component
  re-renders mid-drag.
- Size changes reveal *more* information, never rearrange: library wider → longer names; device height ↑ → more controls
  per row in the same order; drawer taller → more pitch rows (roll) / finer bars (graph); lane taller → expanded track rows.
- Collapse is a first-class state (zero height/width, one header still visible) and is remembered per panel.
- Min/max sizes are defined next to the splitter and a collapsed panel shows its header so it can be reopened.

## 13. Scrolling

- **Scrolls**: the step lane list (vertical, headers fixed), the timeline's horizontal axis (shared by lane + graph +
  roll in a workspace), the roll's pitch axis, library lists, device-area content (vertical), arrangement (both axes).
- **Never scrolls**: app bar, context bar, panel headers, track headers horizontally (they pin), ruler (it follows the
  timeline's horizontal scroll but doesn't scroll vertically), transport.
- One horizontal scroll container per workspace; step lane, graph, roll and ruler are children sharing it, so alignment is
  structural, not synchronised by JS.
- Scrolling never resizes a neighbour; regions have fixed size, content scrolls inside (V1's rule, kept).

## 14. Performance rules (binding)

The UI must not interfere with audio. Rules, each with a check:

1. **The playhead and position readout are not React state.** One rAF loop reads `Transport` and writes `transform` /
   text nodes (`usePlayheadAnimation`, `RafText`). Loops pause when their timeline is hidden.
2. **Project state and UI state are separate stores.** Project = history reducer (unchanged). UI state (selection, drawer
   state, zoom, tabs) = a small `useSyncExternalStore` store; components subscribe to **selectors**, not the whole store.
3. **No component receives the controller.** Props are primitives, ids, or memoised slices (V2's `c: Webseq` defeated
   `memo`; do not repeat). Handlers are stable (`useCallback` on a ref'd controller or dispatch-from-store).
4. **Step lane**: rows memoised by `(trackId, notesSignature, selection slice)`; cells virtualised to the visible
   column window (`useVisibleColumnWindow`); per-cell DOM is a plain element with data attributes + delegated pointer
   events (no per-cell React handlers).
5. **Graph and Roll are canvas**, one rAF `draw` that runs only while dirty (set a flag on data/selection/scroll/zoom changes,
   not a perpetual 60 fps loop), live values in refs (R2). DOM only for chrome.
6. **Arrangement clips**: DOM per clip (few), thumbnails drawn once on canvas and cached by `(patternId, patternVersion,
   size)`; drag via transform (R3). No per-frame React work during drag.
7. **Gestures are transactions**: pointer drags update a ref and a visual preview; exactly one `dispatch` on release →
   one history entry.
8. **No layout thrash during playback**: no measuring (`getBoundingClientRect`) in the rAF path; cache rects on resize.
9. **Hot-path CSS**: no blur/shadow/filter or non-transform/opacity transitions on cells, notes, rows, clips (existing
   `ui-audit` rule).
10. **Budget check**: the existing `debug/perfOverlay` plus a Chrome performance trace of 8 bars playing with all of Pattern,
    Graph and Roll open must show no React commits triggered by playback (checked in verification, §06).

## 15. Compact windows and phone

Desktop is the design target; compact is a *reduction*, not a second design.
- ≤ 960 px: library becomes a drawer over the workspace; device area stays docked, shorter.
- ≤ 768 px (the V1 breakpoint, kept in `layout.ts` + CSS with its guard test): single-section tabs — **Pattern · Arrange ·
  Mixer · Track** (Track = device area). Library from the app-bar ☰. The graph/roll drawer takes the full workspace
  ("maximise") instead of splitting it. Same context bar, same actions, fewer simultaneous panels.
- Coarse pointers increase hit areas only (V1's `pointer: coarse` block); they never hide features.

## 16. Contextual device controls

The device area is **the selected track's** and nothing else. Its title shows the track header (§3).

```
▾ DEVICE · 01 KICK     [ Instrument | FX | Mod | Route ]                       [copy ▾] [— ]
```
| Tab | Contains | Notes |
|---|---|---|
| Instrument | source switch (sample ⇄ synth), kind, parameters, sample controls (ADSR, gain, mode, chop), choke group, voice/playback mode | one generic control renderer from the instrument/FX defs |
| FX | the ordered chain strip + the selected module's controls (EQ curve, sidechain) | add ▾ is the extension point for new FX types |
| Mod | LFO slots, track (event) LFO, arp, scale-aware options; each with the **scope switch** "This pattern ⇄ Track" where V1 supports per-pattern override | |
| Route | output, send + amount, pan, volume mirror, sidechain sources listing | mixer mirrors this |

Selecting Master swaps the tab set to FX · Route. The scope switch is a segmented control in the module header, never
a tab. Anything that has an automatable parameter shows the same affordance (click the label → the Graph's Auto tab targets
it; V1 "Automate this parameter").

## 17. Extension points (where new things go)

| New thing | Home |
|---|---|
| New step property | graph tab registry (03 §9) |
| New FX / instrument kind | `FX_DEFS` / `INSTRUMENT_DEFS` → generic renderers (no UI code) |
| New device-level tab (e.g. Sidechain matrix, MIDI FX) | device area tab strip (≤ 6) |
| New library section | library tab strip |
| New workspace | only via the §1 test; adds one app-bar entry + one shortcut |
| New per-object action | its context menu + `Edit ▾`; primary only if used constantly |
| New per-lane/track arrangement info | the track header's density modes and the lane's expand state |
| New transport feature | transport cluster: before position (control), after BPM (tempo-related) |
| New status/indicator | status area (right end of app bar), not new panels |

The question is always "what *is* this?", and the table above answers it before any layout is touched.

## 18. Visual language and accessibility

Base: V1's tokens (`--bg --panel --panel-alt --border --border-strong --text --text-dim --accent --accent-dim --amber
--danger`), monospace stack, 12 px base, 10–13 px scale, 3 px radius, uppercase micro-labels with 0.05em tracking,
hardware-inspired surfaces. Rules added:
- Panels are **flat regions separated by 1 px hairlines**, not cards. No nested bordered boxes; a region has a header or it
  doesn't need a box.
- Spacing: 2/4/6/8/12 px only. Row heights: track row 28 px (dense) / 40 px (expanded); header 24 px; control 22 px.
- Density first; hit areas ≥ 20 px with a pseudo-element expanding to 24+ where visually smaller. Coarse pointer adds.
- State is never colour-only: letters on M/S, shapes for step kinds (§3), outlines + handles for selection, text in menus.
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for UI shapes (verify tokens once).
- Full keyboard path for every action (menus, tabs with arrow keys, roving tabindex in the step lane: arrows move a
  step cursor, `Space`/`Enter` toggles, `Shift+arrows` extends, `Delete` removes). Roles: grid for the step lane, tablist for
  tabs, `aria-pressed` for toggles, live region for the status area.
- Reduced motion: no animation exists on size/position (V1 rule); only the playhead moves.

## 19. When to break a rule

These rules exist to make the mental model consistent. If following one causes awkward markup, wrapping, cramped controls,
nesting, tiny targets, a worse information hierarchy, or bad keyboard interaction — break it and improve the UI. Record the
exception with a one-line comment at the component ("deviates from 04 §8: no header because …") so a pattern emerges
instead of a pile of one-offs. Typical legitimate exceptions: the step lane's cell sizing, roll's own scroll model, the mixer
strip's vertical header, the plugin-hosted window.
