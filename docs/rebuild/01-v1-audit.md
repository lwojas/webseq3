# 01 · V1 audit and feature checklist

Source of truth: this repository at `b41173f` (the original `lwojas/webseq`). Audited from code (`src/model/types.ts`,
`reducer.ts` Action union, `App.tsx` handlers and key handler, `sequencerContract.ts`, `layout.ts`, `docs/*.md`), **not**
from the rendered UI.

## 1. Architecture as it stands

```
src/model/        pure, no React, no webdsp. Project / Track / Pattern / Note / Composer / FX / instruments / history
src/audio/        the only place the model meets webdsp: compile (Note → ScheduledEvent), transport (lookahead
                  scheduler, pattern-queue mode + song mode), fxChain, busSync, mixer, playback (manual triggers),
                  hostSync, nativeSequence, midiRoute
src/persistence/  IndexedDB project store, session recovery, .webseq.json export/import, host session state
src/midi/         midi-core control contract (Launchpad/Push), DAW/keyboard note input
src/viz/          spectrum + level meter canvases
src/app + src/components + src/App.tsx (1878 lines) + src/index.css (5024 lines)   ← the UI we are replacing
```

Facts that shape the rebuild:

| Fact | Consequence |
|---|---|
| The model, audio, persistence, midi and viz layers have no dependency on the UI layer. | The rebuild is a UI-layer replacement. `model/ audio/ persistence/ midi/ viz/` are kept and called, not forked. |
| `App.tsx` owns ~60 `useState`s, ~110 `handle*` callbacks, the key handler, MIDI wiring, host wiring, recovery and the transport. | The new UI needs a controller split into domain hooks (V2 moved all of it into one 1813-line `useWebseq`; we split it further, §02). |
| 64 tracks = 4 banks × 16; `Pattern` holds notes for **all** tracks. | A *pattern* is the whole groovebox grid. This is the groovebox identity and is kept. |
| `Note` = `{start, duration, velocity, pitch?, chord?, lfo?, ratchet?, tie?}`. | One record per event. Everything richer (§03) is built from these records. |
| V1 grid enforces **one note at a time per track** (`fitsWithoutOverlap`). Chords are one `Note` with a scale-relative `chord` that `expandChordNotes` fans out at compile time, one engine instance per tone (`chordVoicesNeeded`, max 5). | Piano-roll polyphony needs a voice allocator at the same seam (§03.6). This is the **one** required change outside the UI layer. |
| Song = `Project.composer.lanes[].sequences[]`; a sequence places a **whole pattern** (all tracks) at a bar; lane = parallel stream with transpose/velocity/gate modifiers. Shared patterns: editing one changes every placement. | This already *is* "pattern → clip". The arrangement is a view over it (§03.7). |
| Transport has two sources: Pattern (queue = `patternChain`) and Song. | Kept. Source toggle moves into transport (§04). |
| New `Project` fields are always optional with a read-through default (`effectiveX`). | Same rule for anything we add. No migration step for V1 files. |

## 2. Feature checklist

**How to read it.** Every row has a destination. Destinations use the workspace/area codes defined in
[`03`](03-composition-model.md) §1 and [`04`](04-ui-rules.md) §1:

`APP` app bar · `XPORT` transport · `LIB` library drawer · `PAT` pattern workspace (`STEP` step lane, `GRAPH` step graph,
`ROLL` piano roll) · `ARR` arrangement · `MIX` mixer · `DEV` device area (`INST` instrument, `FX`, `MOD`, `ROUTE`) ·
`CTX` context menu / contextual action · `SYS` no UI (engine/persistence behaviour that must keep working).

Status column (final walk, see "Walkthrough result" at the end): **☑ B** exercised in a real browser (scripted, this build), **☑ R** reused V1 component or handler, wired and visible in the new UI but not exercised individually, **☑ S** no UI: engine/persistence/MIDI code unchanged and covered by V1's unit tests (not exercised in a plugin host or with hardware where noted), **◐** works but differs from V1 (see Deviations), **—** not part of V1's UI.
Row IDs are referenced by the parity test (§3).

### A · Project & persistence
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| A1 | Project name (rename) | `SET_PROJECT_NAME`, ProjectBar | APP project menu | ☑ B |
| A2 | New project | `handleNewProject` | APP project menu | ☑ B |
| A3 | Save to browser (IndexedDB) / Load / Delete saved | `handleSaveProject/LoadProject/DeleteProject`, `projectStore` | LIB › Projects; APP project menu (Save) | ☑ B |
| A4 | Export / Import `.webseq.json` (self-contained, versioned, newer-format refused) | `projectFile`, `projectIO` | APP project menu | ☑ B |
| A5 | Save status / error chips | `saveStatus`, `fileError` | APP status area | ☑ R |
| A6 | Session recovery prompt (Restore / Discard), autosave | `recovery*`, `handleRestoreRecovery/DismissRecovery` | APP banner | ☑ B |
| A7 | Host session state (plugin saves project in DAW session) | `hostState`, `getHostState` | SYS | ☑ S code unchanged; not exercised in a plugin host |
| A8 | Host file dialogs (plugin) | `getHostFiles` in `projectIO` | SYS | ☑ S code unchanged; not exercised in a plugin host |
| A9 | Load remaps asset ids to the live runtime; missing asset bytes skipped | `installProject`, `remapAssetIds` | SYS | ☑ S |
| A10 | V1 projects load unchanged; composer migration on load | `migrateComposer`, `withMissingTracks` | SYS | ☑ S |
| A11 | Undo / redo (history 100, coalescing) | `history.ts`, `handleUndo/Redo` | APP (⟲ ⟳) + shortcuts | ☑ B |
| A12 | Sample memory budget indicator (fine/coarse pointer) | `sampleBudgetBytes`, AssetsPanel | LIB › Assets | ☑ R |

### B · Transport & playback
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| B1 | Play / Pause / Resume / Stop | `handlePlay/Pause/Stop` | XPORT | ☑ B |
| B2 | Audio start gesture veil (engine needs a click) | `runtime` gate | APP overlay | ☑ B |
| B3 | BPM 40–240 (disabled during resample); swing 50–75 % | `SET_BPM`, `SET_SWING` | XPORT | ☑ B |
| B4 | Source toggle Pattern ⇄ Song | `handleSetSource` | XPORT | ☑ B |
| B5 | Position readout (pattern/bar/beat or SONG bar/beat) driven by rAF, not state | `getPositionText`, `RafText` | XPORT | ☑ B |
| B6 | Song play-from-here | `handlePlaySongFrom` | ARR (ruler click / ctx) | ☑ R |
| B7 | Playhead in pattern grid only for the sounding pattern; follows chain/song | `usePlayheadAnimation` | STEP / GRAPH / ROLL / ARR | ☑ B |
| B8 | Resample one iteration → new asset (capture armed on next occurrence) | `handleResample`, `armResample` | XPORT | ☑ B |
| B9 | Follow host transport + tempo (plugin) | `hostSync`, `followedBpm` | XPORT (BPM shows "host") | ☑ S code unchanged; not exercised in a plugin host |
| B10 | Native sequence hand-off to host | `nativeSequence`, `sentSequenceRef` | SYS | ☑ S code unchanged; not exercised in a plugin host |
| B11 | Gapless chain playback, chain edits only affect the future | `Transport.tick` | SYS | ☑ S |
| B12 | Manual trigger of a track (pad), loop-track start/stop, hold | `handleTriggerTrack`, `Playback` | PAT track header (▶), MIX | ☑ R ▶ per track in the step lane |
| B13 | Asset / slice audition | `handleAuditionAsset/Slice` | LIB › Assets, INST (chop) | ☑ R |
| B14 | Per-track one-shot ⇄ loop; poly ⇄ mono voice mode | `SET_TRACK_PLAYBACK_MODE/VOICE_MODE` | INST | ☑ R |
| B15 | Choke groups | `SET_TRACK_CHOKE_GROUP` | INST | ☑ R |
| B16 | Global grid resolution (1, ½, ¼, ⅛ step) + Alt free placement (1/64) | `gridResolution`, `FREE_PLACEMENT_RESOLUTION` | PAT toolbar (Snap) | ☑ R |
| B17 | Grid zoom (px per beat) | `GridZoomControls`, `timelineConstants` | PAT toolbar, ARR toolbar | ☑ R |
| B18 | Perf overlay (debug) | `debug/perfOverlay` | SYS (dev flag) | ☑ S |

### C · Tracks & banks
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| C1 | 64 tracks, 4 banks of 16; bank switch | `BankBar`, `activeBank`, `summarizeBanks` | PAT bank tabs | ☑ B |
| C2 | Bank tab activity summary (has notes / looping) | `summarizeBanks` | PAT bank tabs | ☑ B |
| C3 | Track name/number/identity, select, master selectable | `TrackRow`, `handleSelectTarget` | PAT track header (see 04 §3) | ☑ B |
| C4 | Mute, solo (multi-solo, downstream-of-solo stays audible) | `SET_TRACK_MUTED/SOLOED`, `mainGate` | PAT header, MIX | ☑ B |
| C5 | Per-pattern "notes off" (MIDI-mute for this pattern only) | `SET_PATTERN_TRACK_OFF` | PAT header (secondary toggle) | ☑ R |
| C6 | Step to prev/next track | `handleStepTrack` | PAT (◀ ▶ in context bar), shortcut | ☑ B |
| C7 | Clear track (this pattern) | `CLEAR_TRACK_NOTES` | CTX track, Delete with track selected | ◐ via Edit ▾ › Clear track; plain Delete no longer clears a whole track (see Deviations) |
| C8 | Volume 0–1.5, pan −1..1 (dbl-click centres) | `SET_TRACK_VOLUME/PAN` | MIX; DEV ROUTE | ☑ B |
| C9 | Track clip indicator, level meter, master meter | `useMixerMeters`, `levelMeterView` | MIX, PAT header (meter) | ☑ meters in Mixer (V1 track rows had none) |
| C10 | MASTER strip: FX chain, automation, meter, spectrum | `MasterRow`, `MasterBus` | MIX (master strip); DEV when master selected | ☑ R |

### D · Patterns & the pattern queue
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| D1 | Add / duplicate / rename / remove pattern | `ADD_PATTERN`, `DUPLICATE_PATTERN`, `RENAME_PATTERN`, `REMOVE_PATTERN` | PAT context bar; LIB › Patterns | ☑ B |
| D2 | Pattern length 1–64 bars (bars stepper) | `SET_PATTERN_BARS` | PAT context bar | ☑ R |
| D3 | Prev/next pattern (`[` `]`) | `handleStepPattern` | PAT context bar | ☑ B |
| D4 | Pattern picker (phone) / Patterns page (library + queue) | `PatternPicker`, `PatternList`, `PatternsView` | LIB › Patterns | ☑ R |
| D5 | Queue (patternChain): queue next, remove entry, reorder (▲▼) with `shiftChainSteps` | `QUEUE_PATTERN_NEXT`, `MOVE_CHAIN_ENTRY`, `REMOVE_CHAIN_ENTRY`, `chainShiftForReorder` | LIB › Patterns (queue section) | ☑ B |
| D6 | Queue invariants (never empty, ensure-queued) | `ENSURE_PATTERN_QUEUED`, `REMOVE_FROM_QUEUE` | SYS | ☑ S |
| D7 | "Edit the playing pattern" jump | `handleEditPattern`, PatternStrip | PAT context bar | ☑ B new icon button in the context bar, shown while a different pattern plays |
| D8 | Polymetric: patterns of different bar counts chain seamlessly; per-pattern length | `resolveChainStep` | SYS + D2 | ☑ S |
| D9 | Pattern launcher on MIDI controller | `pattern.<n>.*` controls | SYS (midi) | ☑ S |
| D10 | Duplicate sequence / duplicate bar / extend track (repeat last bar, 1 bar or to end) | `DUPLICATE_SEQUENCE`, `DUPLICATE_BAR`, `EXTEND_TRACK` | PAT › Edit menu (bar tools) | ☑ B |

### E · Step sequencing & note editing
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| E1 | Toggle step (add/remove note), drag-resize length, drag-move | `ADD_NOTE/REMOVE_NOTE/RESIZE_NOTE/MOVE_NOTE` | STEP | ☑ B |
| E2 | Overlap rule: notes on one track don't overlap (step grid) | `fitsWithoutOverlap` | STEP (kept) / ROLL (pitch-slot rule, 03 §5) | ☑ B |
| E3 | Virtualised step cells; memoised rows | `useVisibleColumnWindow`, `TrackRow` memo | STEP (kept as a perf rule, 04 §14) | ☑ S |
| E4 | Select a note (step) | `selectedNoteId` | selection store | ☑ B |
| E5 | Velocity per step | `SET_NOTE_VELOCITY` | GRAPH › Velocity | ☑ B |
| E6 | Pitch per step (±48 st; scale-aware dropdown; out-of-scale flag; chop slice index) | `SET_NOTE_PITCH`, `pitchOptions`, `scaleEntry` | GRAPH › Pitch | ☑ B |
| E7 | Length / gate per step | `handleSetNoteDuration` | GRAPH › Length (+ drag on STEP) | ☑ B |
| E8 | Ratchet (1,2,3,4,6,8) | `SET_NOTE_RATCHET` | GRAPH › Ratchet | ☑ R |
| E9 | Tie / slide (synths with legato) — per note and whole track | `SET_NOTE_TIE`, `SET_TRACK_NOTES_TIE` | GRAPH › Tie (toggle row); STEP glyph | ☑ R |
| E10 | Event-LFO amount per step; whole-track amount | `SET_NOTE_LFO`, `SET_TRACK_NOTES_LFO` | GRAPH › LFO | ☑ R |
| E11 | Note ⇄ Chord mode per step; chord root, type (20 types + 3 shapes), inversion, voicing | `SET_NOTE_MODE`, `SET_NOTE_CHORD`, `chord.ts` | GRAPH › Chord (+ ROLL) | ☑ B |
| E12 | Chop sets: fill/randomise steps from slices | `SET_CHOP_STEPS`, EditPanel › Chop Tools | PAT › Edit menu; INST (chop) | ☑ R Edit ▾ › Chop group appears on chop tracks; not run end to end |
| E13 | Scale-snapped note entry | `snapAddedNoteToScale` | SYS (applies in STEP/ROLL entry) | ☑ S |
| E14 | Track Editor (V1 separate list editor: per-note rows) | `TrackEditor.tsx` | **superseded by GRAPH + ROLL**; every control in it has an E-row above | ☑ superseded by GRAPH + ROLL + Mod tab; every control mapped to an E-row |
| E15 | Per-pattern track arp & event-LFO override ("this pattern" vs "track") | `trackSettings`, `SET_TRACK_ARP/EVENT_LFO` with `patternId`, `RESET_PATTERN_TRACK_SETTINGS` | DEV MOD with scope switch | ☑ R |
| E16 | Copy / paste a track's notes within and across patterns | `handleCopyTrack/PastNotes`, `PASTE_NOTES` | CTX, ⌘C/⌘V | ☑ B |

### F · Sound sources: samples, chop, assets
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| F1 | Asset bin: import (multi-file batch + status), rename, remove, audition, assign | `AssetsPanel`, `ADD/ASSIGN/RENAME/REMOVE_ASSET`, `docs/multi-sample-import` | LIB › Assets | ☑ B |
| F2 | Origin badge import/resample; one asset on many tracks | `Asset.origin` | LIB › Assets | ☑ R |
| F3 | Asset gain (−24..+12 dB), asset ADSR, per-track ADSR override | `SET_ASSET_GAIN/ENVELOPE`, `SET_TRACK_ENVELOPE` | INST | ☑ R |
| F4 | Sample mode chromatic ⇄ chop; cue points, chop start marker, chop editor with waveform | `SET_TRACK_SAMPLE_MODE`, `SET_ASSET_CUES/CHOP_START`, `ChopEditor` | INST (chop section) | ☑ B |
| F5 | Sample ⇄ synth source switch (mutually exclusive) | `SET_TRACK_INSTRUMENT`, `ASSIGN_ASSET` | INST header | ☑ R |
| F6 | Peaks/waveform cache | `audio/peaks` | SYS | ☑ S |
| F7 | WAV encode for resample persistence | `audio/wav` | SYS | ☑ S |

### G · Instruments (synths)
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| G1 | 21 kinds: kick, snare, clap, tom, hihat, bass, pulse, pad, fm, hypersaw, pwmbeast, dm_thump/metal/tone/crack/chaos, percsynth, edge, matrix, noise, wobble (availability depends on engine build: `unavailableKinds`) | `INSTRUMENT_DEFS` | INST | ☑ B |
| G2 | Instrument params (incl. source gain), generic control rendering, automation entry ("Automate this parameter") | `SET_INSTRUMENT_PARAM`, `InstrumentPanel` | INST | ☑ R |
| G3 | Instrument LFO slots (add/set/remove), sync/free, targets | `ADD/SET/REMOVE_INSTRUMENT_LFO`, `ModulationSlot` | MOD | ☑ R |
| G4 | Patch-matrix editor (matrix kind) | `PatchMatrixEditor`, `patchMatrixView` | INST (matrix) | ☑ R |
| G5 | Instrument-specific layouts (EQ-less synths, TB-style tie support, etc.) | `instruments.ts` defs | INST | ☑ R |
| G6 | Musical Guide (recipes that build instrument/pattern/FX presets, demo audition) | `MusicalGuide`, `APPLY_RECIPE`, `guide/*` | LIB › Guide (opens as a modal) + APP menu | ☑ R |
| G7 | Copy/paste instrument config | `PASTE_INSTRUMENT` | CTX on DEV INST | ☑ R |

### H · FX
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| H1 | Ordered FX chain per track and master; add/remove/reorder/bypass | `ADD/REMOVE/MOVE_FX`, `SET_FX_ENABLED`, `FxChainStrip` | FX | ☑ B |
| H2 | 13 FX types: filter, chorus/flanger, delay, reverb, compressor, saturation, phaser, bitcrusher, utility, dub delay, 4-band EQ, glitch, dub space | `FX_DEFS` | FX | ☑ R |
| H3 | FX params (generic render from `FX_DEFS`), automation entry | `SET_FX_PARAM`, `ModulePanel` | FX | ☑ R |
| H4 | EQ curve editor + live spectrum | `EqCurveEditor`, `useSpectrumCanvas` | FX (EQ module) | ☑ R |
| H5 | Compressor sidechain from another track | `sidechain` param | FX | ☑ R |
| H6 | FX LFO stack | `ADD/SET/REMOVE_FX_LFO` | MOD (scope = FX) | ☑ R |
| H7 | FX MIDI controls (device knobs) | `docs/fx-midi-controls` | SYS (midi) | ☑ S |
| H8 | Copy/paste FX chain | `PASTE_FX` | CTX on FX | ☑ R |

### I · Automation & modulation
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| I1 | Automation lane for one param (FX or source), linear points, hold-before/after | `SET/REMOVE_AUTOMATION_POINT`, `CLEAR_AUTOMATION_LANE`, `REPLACE_AUTOMATION_RANGE` | GRAPH › Auto (STEP context); ARR (per-clip lane row) | ☑ B |
| I2 | Per-pattern automation override vs track's own, reset | `Pattern.automation`, `RESET_PATTERN_AUTOMATION` | GRAPH › Auto scope switch | ◐ per-pattern lanes work (edit while a pattern is selected); V1 had no UI for `RESET_PATTERN_AUTOMATION` either |
| I3 | Automation templates (shapes) | `automationTemplates.ts` | GRAPH › Auto toolbar | ☑ R |
| I4 | Master automation, track automation without notes plays | `fxOwner`, commit `6420ad2` | GRAPH › Auto (master selectable); ARR | ☑ R |
| I5 | Song replay of automation per sequence | `automationAppliesTo`, `automationSpans` | SYS + ARR lane row | ☑ R |
| I6 | Track LFO (event LFO: velocity or pitch target, waveform, sync/rate, depth) | `SET_TRACK_EVENT_LFO`, `docs/track-lfo` | MOD | ☑ R |
| I7 | Copy/paste modulation | `PASTE_MODULATION` | CTX on MOD | ☑ R |

### J · Mixer & routing
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| J1 | Mixer: all tracks of bank (or all), fader, pan, mute, solo, meter, clip | `MixerPanel`, `MasterRow` | MIX | ☑ R |
| J2 | Track output → another track (loop-safe, dangling → master) | `SET_TRACK_OUTPUT`, `resolvedOutput`, `canRouteTo` | DEV ROUTE; MIX (output select) | ☑ R |
| J3 | FX send to a track, amount | `SET_TRACK_SEND`, `SET_TRACK_SEND_AMOUNT` | DEV ROUTE; MIX (send knob) | ☑ R |
| J4 | Bus sync to engine (BusGain/Pan/Output/Send/MainGate) | `busSync`, `mixer.ts` | SYS | ☑ S |
| J5 | Copy/paste track config (leaves routing out) | `PASTE_TRACK_CONFIG` | CTX | — V1 never exposed `PASTE_TRACK_CONFIG` in its UI (tests only); not carried over |

### K · Scale, chords, arp
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| K1 | Project scale/key (tonic, scale, chromatic default) — context for entry, not stored on notes | `SET_PROJECT_SCALE`, `ScaleControl` | XPORT (key chip + popover) | ☑ B |
| K2 | Per-track arpeggiator (pattern, rate, octaves, velocity shaping, gate) | `SET_TRACK_ARP`, `ArpPanel`, `arp.ts` | MOD (scope switch) | ☑ R |
| K3 | Chop-track guard (chords refused on chop) | `setNoteMode` | SYS | ☑ S |

### L · Arrangement (Composer / Song)
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| L1 | Lanes: add, rename, remove, reorder | `COMPOSER_ADD/RENAME/REMOVE/MOVE_LANE` | ARR lane header | ☑ B |
| L2 | Lane modifiers: transpose ±24, velocity ×, gate × | `COMPOSER_SET_LANE_MODIFIERS` | ARR lane header → popover | ☑ B |
| L3 | Place pattern (shared) / add blank / duplicate (independent copy) / paste / move / resize (= pattern bars) / colour / remove | `COMPOSER_*` actions | ARR clips | ☑ B |
| L4 | No-overlap-within-lane rule enforced by model | `canPlace` | SYS | ☑ S |
| L5 | Bar-snapped marker for insert point | ComposerTimeline marker | ARR ruler | ☑ R |
| L6 | Timeline zoom 25–150 %, remembered, centre-anchored | `useTimelineZoom` | ARR toolbar | ☑ B |
| L7 | Track list under timeline: select, mute, solo, notes-off | `ComposerTrackList` | ARR (track-identity strip, 03 §7) | ☑ R |
| L8 | Automation lane drawn under focused lane | `automationSpans` | ARR lane expansion | ☑ R |
| L9 | "Add to Composer" from pattern; "Edit Sequence" makes the pattern playable | `handleAddToComposer`, commit `a964f7f` | PAT context bar; ARR double-click | ☑ R |
| L10 | Song playback = cycle of `songBeats`, loops | `songInstances`, `tickSong` | SYS | ☑ S |

### M · Edit/clipboard (EditPanel)
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| M1 | Clipboard rows: Track, Sequence, Instrument, FX, Modulation, Bank (copy → paste, "copied from" label) | `editModel.ts`, `PASTE_TRACK/BANK/…` | CTX menus on the owning object + ⌘C/⌘V; **no separate Edit panel** | ☑ B |
| M2 | Bar tools: Clear Sequence, Duplicate Sequence, Duplicate Bar, Extend Track | `editModel.ts` | PAT › Edit menu | ☑ B |
| M3 | Transient clipboard status text | `clipboardStatus` | APP status area | ☑ R |

### N · MIDI
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| N1 | Controller contract (Launchpad/Push): `step.<r>.<c>`, `mute.<n>`, `steps.length`, `bank.*`, `fx.*`, `patterns.*`, `queue.length`, `selection.index`, `track.selected.*`, `transport.*`, faders/pages | `sequencerContract.ts` (1620 lines, tested) | SYS — **kept untouched**; adapted to new selection/bank state via the same deps interface | ☑ S contract + tests unchanged; not exercised with a controller |
| N2 | MIDI status/device panel | `MidiPanel` | LIB › MIDI | ☑ B |
| N3 | Keyboard/DAW MIDI plays the selected track (+ native routing in plugin) | `dawNoteInput`, `midiRoute` | SYS | ☑ S unchanged; not exercised with a keyboard/host |
| N4 | MIDI record into pattern | **not in V1** (V2 added `useRecorder`) | candidate extension, §02 | — |

### O · Layout, responsive, misc
| ID | Feature | V1 source | Destination | |
|---|---|---|---|---|
| O1 | Desktop layout; breakpoint 768 shared by CSS and `layout.ts` (test-guarded) | `layout.ts`, `layout.test.ts` | APP shell (keep the guard test) | ☑ R |
| O2 | Phone layout: single-section tabs (Timeline / Track / Mixer / Library) | `MobileTabBar`, `MobileTopBar` | APP shell, compact mode (04 §15) | ☑ B |
| O3 | Coarse-pointer sizing | `@media (pointer: coarse)` | CSS tokens | ☑ R |
| O4 | Playhead/readout via rAF only | hooks | perf rule | ☑ S |
| O5 | Musical Guide state | `guide/session` | LIB | ☑ R |
| O6 | Saved selection (last track) | `persistence/savedSelection` | APP | ☑ S |

### P · Keyboard shortcuts (all of them, from `App.tsx` and components)
| ID | Key | Action | New destination |
|---|---|---|---|
| P1 | `Space` | Play / stop (after engine started; not in inputs/buttons) | global | ☑ B |
| P2 | `Esc` | close takeover/settings | global (close topmost transient) | ☑ R |
| P3 | `[` `]` | previous / next pattern | PAT | ☑ B |
| P4 | `⌘/Ctrl+Z`, `⇧⌘Z`, `Ctrl+Y` | undo / redo | global | ☑ B |
| P5 | `Delete`/`Backspace` | selected step → remove; else selected track → clear its notes | STEP (with multi-note guard, 03 §4) | ◐ Delete removes the selected step's notes; it no longer escalates to clearing the track |
| P6 | `⌘/Ctrl+C`, `V` | copy track's notes / paste | PAT | ☑ B |
| P7 | MIDI keyboard notes | play selected track | SYS | ☑ R |

## 3. Guarding completeness mechanically

The prior iterations lost features because completeness was judged by eye. Three automated guards, built **before** the UI:

1. **Action parity** — `src/ui/parity.ts` exports `ACTION_SURFACES: Record<Action["type"], SurfaceCode[]>`. A vitest
   asserts that every member of the reducer's `Action` union has an entry and that no entry is empty. Adding a reducer
   action without deciding where it lives fails the test. (Handles reducer-level features: 96 action types today.)
2. **Handler parity** — a test greps the controller's exported `handle*` names against `parity.ts` the same way, so features that
   are not reducer actions (resample, import, audition, trigger) are covered too.
3. **Contract/test carry-over** — the existing ~50 test files (`sequencerContract`, `transport`, `composer`, `project`, …) keep
   running unchanged; the rebuild may not delete or loosen them. V2 deleted `sequencerContract.test.ts` and
   `useMidiControls.test.ts` along with the MIDI contract — exactly the failure to avoid.

The checklist above is the human-readable form; `parity.ts` is the machine-checked form. Each row's ☑ requires the
implemented surface and a note of how it was verified.


## Walkthrough result (final)

All 133 rows have an explicit destination in the shipped UI. Counts (133 rows): ☑ B browser-verified 50, ☑ R reused V1 component wired 54, ☑ S unchanged and tested 24, ◐ differs from V1 3, — not in V1's UI 2.

**Mechanical checks.** (1) Reachability of the controller's `handle*` functions from the new UI: 86 of 92 are reached, directly or through the grouped props the shell passes on (transport, instrument, edit, composer). The other six (`handlePickPattern`, `handleSelectDockView`, `handleSelectLibraryView`, `handleSelectMobileTab`, `handleTogglePicker`, `handleToggleSettings`) were V1-only layout navigation and were deleted with V1's UI. (An earlier version of this check matched against `parity.ts`, which names every handler, and so proved nothing.) (2) Every reducer action is dispatched by the new UI or a reused component; the only two that nothing dispatches, `PASTE_TRACK_CONFIG` and `RESET_PATTERN_AUTOMATION`, are not dispatched by V1's UI either (tests only). (3) `test/parity.test.ts` (105 reducer actions, all 92 handlers) and the 56 V1 + new test files pass.

**Browser run** (`rows.js`-style script, headless Chromium, 24 flows): rename, new, save / list / delete, export file and import it back (round trip), recovery prompt after reload, undo/redo (menu and ⌘Z), clear track, copy/paste notes between tracks, double length, BPM + swing, source toggle, key change, pattern add / duplicate / delete, queue next / reorder / remove, import a WAV, assign it + chop mode + chop editor, add an FX, mixer fader, Arrange lane + clip modifiers in Edit, zoom, From here, MIDI section, resample enabled while playing. 24/24 after correcting four test-script problems (not app bugs).

**Deviations from V1 (all intentional).**
1. Plain `Delete` with a track selected no longer clears the whole track (a step delete must never escalate); use Edit ▾ › Clear track.
2. Undo / redo live in the Edit menu (plus ⌘Z / ⇧⌘Z), not in the app bar.
3. V1's Edit panel became the Edit ▾ menu; MIDI and project management moved into the main menu; the Track Editor's per-note rows became the graph, chord tab and roll.

**Not verified.** Anything that needs a plugin host (B9, B10, A7, A8, N3 native routing) or a hardware controller (N1, H7, D9); those code paths are unchanged V1 code. No screen-reader session (see 07).
