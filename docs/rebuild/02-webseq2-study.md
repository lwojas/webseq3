# 02 · What webseq2 teaches us

`webseq2` is one commit (`0aa0626`, "V2: DAW-style interface") on top of V1's `b41173f`: +7.3k / −6.4k lines, 58 files.
It left `model/ audio/ persistence/` essentially intact (`audio/compile.ts` is byte-identical to V1) and replaced the UI
with `src/v2/` (Arrange / Editor / Mixer + Browser + DeviceArea) over a new `controller/useWebseq.tsx`.

## Reuse (patterns worth carrying forward)

| # | Pattern | Where in V2 | How we use it |
|---|---|---|---|
| R1 | **Splitter writes a CSS variable during drag, commits to state + localStorage on release.** Dragging a panel edge never re-renders the app. | `Splitter.tsx`, `workspace.ts` (`--v2-browser-w`, `--v2-device-h`) | Adopt as the only resize mechanism for every resizable region (04 §12), including the step-graph drawer. |
| R2 | **Roll drawn on `<canvas>`, one rAF `draw`, live values in a `useRef` snapshot**, DOM only for chrome. Selection, drag state, colours cached in refs. | `PianoRoll.tsx` | Reuse as the starting point for `ROLL`. Same technique for `GRAPH` (a bar/point graph is a much simpler canvas). |
| R3 | **Pointer-capture drags that mutate a ref/DOM style and dispatch once on `pointerup`.** Clip move/resize translate the element in-place and call the reducer only at the end. | `ClipView` in `Arrange.tsx` | Standard for clip move/resize, note drags, graph-bar drags. One undo entry per gesture. |
| R4 | **Double-click a clip opens it for editing**, selecting clip → track → pattern in one `select()` so Instrument/FX panels follow. | `clipActions.ts`, `ClipView onDoubleClick` | Kept as the interaction. Target changes: opens the *pattern* in `PAT` (step lane first), not a piano roll (03 §7). |
| R5 | **Pitch-slot overlap rule** (`rollSlot`): notes may overlap in time unless same pitch; chord note occupies slot `"chord"`. Pure functions `rollAddNote/MoveNotes/ResizeNote/Duplicate/Paste/…` with all-or-nothing moves. | `model/roll.ts` (+ `test/roll.test.ts`) | Port into the new model layer as the *roll* edit policy; it is already V1-shape-compatible. Extend (not replace) with the voice allocator (03 §6). |
| R6 | **Velocity lane synchronised to roll scroll; automation strip under velocity lane with a lane picker.** | `PianoRoll.tsx` (`velRef`, `velScrollSync`, `automationPicker`) | Validates the "properties under the notes" idea; in our design the same strip is the step graph and is shared by Steps and Roll. |
| R7 | **Chop-aware roll rows** (a chop track shows slices as rows) and **scale shading / root marking**. | `PianoRoll.tsx` (`chordRows`, `slices`, `scale`, `root`) | Keep. |
| R8 | **Memoised workspace components with stable props**, `useStableTrackNotes`, `memo` on `TrackHeader`/`ClipView`/`Arrange`/`MixerView`/`DeviceArea`. | `v2/*.tsx`, `hooks/useStableTrackNotes.ts` | Keep as rule (04 §14). |
| R9 | **Keyboard focus guard** (ignore keys while typing in input/select/textarea/contentEditable) and **view hotkeys `1 2 3`, `B` browser, `D` device area**. | `AppV2.tsx` | Keep and centralise into one shortcut registry (§ "Shortcut registry" below). |
| R10 | **Compact window: browser becomes a drawer**, remembered desktop setting kept separate from the drawer state. | `AppV2.tsx` (`narrow`, `drawer`) | Same for `LIB`. |
| R11 | **Transient status line** (`say()` with timeout) for clipboard/edit feedback. | `workspace.ts` | Keep as the app status area (A5/M3). |
| R12 | **Copy slots per kind** so copying notes never discards a copied clip. | `Clipboard` in `workspace.ts` | Keep. |
| R13 | **Cheap clip thumbnails** (`ClipPreview`) drawn on canvas from the pattern. | `Arrange.tsx` | Keep, extended to a multi-track mini overview (03 §7). |
| R14 | **Mixer as its own destination with channel strips**, inline FX/instrument unaffected. | `MixerView.tsx` | Base for `MIX`; V1's `MixerPanel` features (clip LED, pan reset, meters) are the checklist. |
| R15 | **Controller extraction** — moving state/handlers out of `App.tsx` so views are pure arrangement. | `controller/useWebseq.tsx` | Right instinct, wrong size (see A5). We split into domain slices. |
| R16 | **Recorder** (`recorder.ts`, `useRecorder`) — MIDI → pattern, tested. | `v2/recorder.ts`, `test/recorder.test.ts` | Not V1 functionality; candidate extension after parity. Kept on the list (N4), not in scope for the rebuild. |

## Abandon (decisions we are intentionally not carrying over)

| # | Decision in V2 | Why we abandon it |
|---|---|---|
| A1 | **Arrangement-first**: default view `"arrange"`, clips are per-track, `Editor` = piano roll by default. | This is the central problem in the brief. Default is the step lane. |
| A2 | **A clip is a single-track pattern** (`Pattern.clipOf = trackId`), one lane per track (`ComposerLane.trackId`), and `normaliseSong` **splits V1 songs per track on load, baking lane modifiers in**. | Destroys the pattern-as-groovebox-unit (a V1 sequence places *all* tracks of a pattern) and is a lossy, one-way rewrite of the V1 song. We keep V1's lane/sequence model untouched (03 §7). |
| A3 | **The step grid disappears** from the main flow; V1's TrackRow/SequencerGrid is only a "launcher pattern" fallback (`patternEdit`). | The step overview of track relationships is the product identity. |
| A4 | **V1 MIDI control contract deleted**: `sequencerContract.ts` (1620 lines), `controlAdapter.ts`, `dawNoteInput.ts`, `useMidiControls.ts` and their two test files were removed and replaced by a thin `midiInput`/`useMidi`. | This is exactly the "left functionality behind" failure. Launchpad/Push control, pattern-launcher MIDI, FX MIDI controls and the plugin's native MIDI routing (N1–N3) are all gone in V2. We keep them. |
| A5 | **One 1813-line `useWebseq` controller** that every view takes whole (`c: Webseq`). Every view re-renders on any controller change unless it is `memo`'d, and `memo` is defeated by passing `c`. | We use narrow domain hooks and selectors so each view subscribes only to what it draws (04 §14). |
| A6 | `Pattern.clipOf` + `launcherPatterns` filter: patterns split into "launcher" and "clip content" populations. | One population of patterns. A pattern can be queued (Pattern mode) *and* placed (Song mode), as in V1. |
| A7 | `Header` carries view switch, project, transport and browser toggle in one dense bar with no breadcrumb/context concept. | We add a context bar (04 §2) so "what object am I editing" is always visible. |
| A8 | Setting `setMainView("composer"); handleSetSource("song")` on mount, i.e. V2 *forces* Song mode. | Default source stays Pattern; the launcher/queue remains the groovebox loop. |
| A9 | Track device area is always the bottom panel but **Browser/Device/Editor each invent their own header and tabs** (`v2-*` classes). | Panel header pattern defined once (04 §8). |
| A10 | Parallel `v2.css` (1455 lines) beside the 5024-line V1 `index.css`; two styling systems. | One token layer + one component stylesheet set; V1 tokens (palette, 3 px radius, monospace, 10–13 px) are the base. |

## Findings about V1 that V2 did not solve (inputs to our model)

1. **Polyphonic roll notes on synths are not voiced.** `roll.ts` allows simultaneous different-pitch notes, but a webdsp
   instrument is monophonic per engine instance. Only chord expansion assigns `note.voice`; `audio/instruments.ts` sizes
   voices from `chordVoicesNeeded` (chord notes only). So a V2 roll triad on a synth plays as one voice. Sampled tracks are
   fine (each note is a separate trigger). → voice allocator (03 §6).
2. **Step-view semantics for poly material were never defined** (V2 stopped using the step view). → 03 §4.
3. **Clip identity vs pattern identity**: V1 doc says sequences are independent clones (`composerOwned`); the code
   (commit `a964f7f`) shares patterns between placements with Duplicate making copies. The code is the truth. → 03 §7.

## Shortcut registry (from R9)

V1 scatters `keydown` handlers in `App.tsx`; V2 adds another in `AppV2`. The rebuild has one registry
(`src/ui/shortcuts.ts`): `{ key, mod, scope, when, run }[]`, scopes `global | pat | arr | mix | roll`, a single focus guard,
and a generated cheat-sheet (`?`). The table in `01 §P` is its initial content.
