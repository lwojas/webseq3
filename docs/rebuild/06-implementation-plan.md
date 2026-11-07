# 06 · Implementation plan (Phase 5)

## Architecture of the new UI layer

```
src/model/ audio/ persistence/ midi/ viz/ guide/     KEEP, unmodified except: roll.ts (+ voice allocator in chord.ts seam)
src/state/
  projectStore.ts      history reducer (V1 historyReducer) behind useSyncExternalStore + selectors; projectRef for handlers
  uiStore.ts           selection, workspace, drawer state, zoom, snap, tabs, library section, clipboard slots, status
  engine.ts            runtime/transport/playback lifecycle, buses, host sync, recovery (V1 App.tsx logic, moved not rewritten)
  controller/*.ts      domain actions: tracks, notes, patterns, arrangement, mixer, devices, library, project io
  midiBridge.ts        wires sequencerContract + dawNoteInput to the stores (same deps interface as today)
src/ui/
  shell/               AppBar, ContextBar, Transport, Workspace switch, Library drawer, DeviceArea, StatusArea, Splitter
  kit/                 TrackHeader, PanelHeader, Tabs, Menu, Segmented, Knob/Slider, Ruler, TimelineScroll, EmptyState, Modal
  pattern/             StepLane (rows+cells), StepDrawer (Graph tabs + Roll), stepView.ts (cell derivation), props registry
  arrange/             ArrangeView, LaneHeader, ClipView, ClipOverview, lane expansion
  mixer/               MixerView, Strip
  devices/             Instrument, Fx, Mod, Route (wrapping V1 panels first, then slimmed)
  library/             Assets, Patterns(+queue), Midi, Projects, Guide
  parity.ts, shortcuts.ts
src/styles/            tokens.css (V1 tokens), kit.css, then one css per area (no 5k-line file)
```
- `main.tsx` switches to the new shell behind `?ui=2` until parity, then becomes default; V1's `App.tsx` stays runnable for
  side-by-side comparison until the checklist is ☑, then is deleted in one commit.
- V1 device panels (`InstrumentPanel`, `FxPanel`, `ModulePanel`, `EqCurveEditor`, `PatchMatrixEditor`, `ChopEditor`,
  `ArpPanel`, `TrackLfoPanel`, `ModulationSlot`, `MusicalGuide`, `AssetsPanel`) are **wrapped first** (they take plain props
  already) and restyled to the panel-header/kit conventions afterwards. That makes feature parity cheap and risk-free.

## Order of work (matches the brief's priorities)

| Step | Deliverable | Exit check |
|---|---|---|
| 0 | `npm ci`, baseline `npm test` + `tsc` green on the clone; record result | **Done:** `tsc --noEmit` clean; vitest 53 files / 816 tests passing (V1 `b41173f`) |
| 1 | `parity.ts` + the two parity tests (red), fixture corpus + round-trip test (03 §10) | tests exist and fail meaningfully |
| 2 | stores + engine extraction from `App.tsx` (no UI change); existing tests green | `?ui=1` (V1) still works on the new stores |
| 3 | Shell + kit: AppBar, Transport, ContextBar, Workspace switch, Library drawer, DeviceArea (wrapped panels), Splitter | Pattern workspace shows empty step lane, transport plays |
| 4 | **Pattern / step lane**: TrackHeader, rows, virtualised cells, cell kinds (03 §3), toggle/resize/move, banks, bars stepper, pattern nav, queue basics | V1 E1–E4, D1–D3, C1–C7 ☑ |
| 5 | **Step graph**: drawer, tab registry, velocity/pitch/length/ratchet/tie/LFO/chord, mixed-step handling, Auto tab (reuse `AutomationLane` logic), scopes | E5–E11, I1–I4 ☑; Track Editor removed |
| 6 | **Piano roll**: port V2 `PianoRoll` + `roll.ts`; voice allocator + tests; explode chord; maximise | polyphonic synth plays; step lane unchanged after visiting roll |
| 7 | **Arrangement**: lanes/clips over V1 composer, clip overview, link badge, open-clip round trip, expanded lane rows, modifiers popover | L1–L10 ☑ |
| 8 | **Mixer** | J1–J3, C8–C10 ☑ |
| 9 | **Instrument/FX/Mod/Route** restyle + copy/paste menus; Library sections (Assets, Patterns+queue, MIDI, Projects, Guide) | F, G, H, K, M ☑ |
| 10 | Remaining V1: recovery, host sync/state, resample, shortcuts registry + cheat-sheet, compact/phone, perf pass | A, B, N, O, P ☑ |
| 11 | Delete V1 UI; docs; final audit with `ui-audit` | whole checklist ☑ |

`ui-audit` (repo skill) runs after each step that edits components/CSS, as `CLAUDE.md` requires.

## Verification (per step and at the end)

1. `npm test` green (all existing + new); `tsc --noEmit` green.
2. Parity tests green (Action + handler coverage).
3. Browser run via the `playwright-browser`/`run` skills: golden path (load V1 fixture → play → edit a step → expand graph →
   roll → place in arrangement → open clip → mixer → device edit → export/import), screenshots saved in
   `docs/rebuild/verification/`.
4. Performance: trace 8 bars of playback with Pattern + Graph + Roll open; **0 React commits attributable to playback**
   (React Profiler / `perfOverlay`), main-thread long tasks < 50 ms during playback, no audio dropouts reported by the engine.
5. Manual checklist walk: each ☐ in `01` becomes ☑ only with the surface named and how it was exercised.

## Risks and how they are handled

| Risk | Mitigation |
|---|---|
| Missing a V1 feature | checklist + `parity.ts` tests + keep all V1 tests; V1 UI stays runnable until sign-off |
| Poly roll on synths wrong | voice allocator is pure and unit-tested; no-op for V1 projects (bit-identical compile output tested) |
| Step lane perf with 64 tracks × many bars | virtualisation (rows and columns), delegated events, memo by notes signature, verified by trace |
| Controller sprawl (V2's `useWebseq`) | domain slices with selectors; lint rule/test: no component imports the whole controller |
| MIDI contract bit-rot | adapter keeps the exact `SequencerRegistryDeps` interface; contract tests stay |
| Plugin (webvst) hosting | no host-specific code in UI; host seams kept in `engine.ts` unchanged |

## Status (end of first implementation session)

Run the new UI with `npm run dev` → `http://localhost:5174/?ui=2` (V1 remains the default). `tsc` clean, 56 test files / 835 tests green.

| Step | State |
|---|---|
| 1 parity tests (`src/ui/parity.ts`, `test/parity.test.ts`) | ☑ (reducer actions + controller handlers) |
| 2 controller extraction (`src/state/useController.tsx`; V1 `App.tsx` now a thin view over it, MIDI contract kept) | ☑ |
| 3 shell + kit (AppBar, ContextBar, Library drawer, DeviceArea, Splitter, PanelHeader, TrackHeader) | ☑ first cut; V1 TransportBar/ProjectBar reused as-is |
| 4 step lane (derived cells, toggle/resize/move, multi-note guard, rows memoised, rAF playhead) | ☑ browser-verified |
| 5 step graph (velocity/pitch/length/ratchet/tie/LFO, Chord tab, Auto tab; one undo step per gesture, mixed bars) | ☑ per-note rows of V1 TrackEditor retired (device "Mod" tab keeps only its Arp / Track LFO / Ties). Pitch tab speaks in note names, snaps to the key's notes when Snap is on, and flags out-of-key bars (E6 covered) |
| 6 piano roll (V2 port in the drawer, `roll.ts`, voice allocator + tests, Explode chord) | ☑ roll shares the step lane's zoom and horizontal scroll (gutter = track-header width, so beats align across lane, graph and roll); maximise moves the drawer into a workspace-sized panel with its own zoom/scroll, Esc restores |
| 7 arrangement | ◐ V1 ComposerTimeline wrapped; double-click opens the pattern with a return link. Clip mini track overview, ⛓×N shared-pattern badge, and lanes that expand into per-track rows (identity, M/S, mini roll across the lane's clips; `ui/arrange/LaneTracks.tsx`) done |
| 8 mixer | ◐ V1 MixerPanel wrapped |
| 9 device area / library | ◐ V1 panels wrapped (Instrument, FX & Route, Mod & Notes; Assets, Patterns+queue, MIDI, Edit, Guide) |
| 10 shortcuts registry (`src/ui/shortcuts.tsx`, `?` cheat-sheet) ☑; perf check ☑: 5 s of playback with step lane + roll open = 0 DOM changes besides the playhead/readout, 0 long tasks (headless Chromium, MutationObserver + longtask observer); compact/phone layout ☑ (≤768px: Pattern · Arrange · Mixer · Track · Library tabs, ⋯ for project/tempo; checked at 390×844, no horizontal overflow); a11y pass ☐ | ◐ |
| 11 delete V1 UI | ☐ |

### UX reorganisation (after first review)
App bar is one row with an editable project name and a dirty/save indicator; project management moved to the main menu modal (☰ / ⌘,): rename, new, open from a saved list, save (⌘S), export/import, delete. MIDI is in the main menu with a status icon in the app bar. The sidebar is an icon rail with Samples, Instruments (new: click a synth to load it on the selected track) and Patterns; the dead "Library" chevron is gone. V1's Edit panel became an **Edit ▾** popover in the context bar. Transport, context bar, track headers and panel headers use an inline icon set (`ui/kit/Icon.tsx`) with tooltips. Controller gained `isDirty`.
