# 05 · Wireframes

Six representative screens. They share one skeleton so the patterns in [`04`](04-ui-rules.md) are visibly reused:
**app bar → context bar → workspace → device area**, the same **track header**, the same **panel header**, the same **timeline
ruler**, the same **selection treatment**. Glyph legend: `█` solid pad · `▓` accent/selected · `░` empty pad · `▌` track identity
bar · `┃` playhead.

---

## 1 · Pattern — step sequencer (default screen)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ☰ │ [PATTERN] ARRANGE MIXER │ Untitled ▾ ⟲ ⟳ │ ⏮ ▶ ⏹ │ PATTERN|song │ 01.3.02 │ BPM 124 │ sw 54% │ ♪ C min │ ⏺ │ ● saved│ APP BAR
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PATTERN ▸ Pattern 03 · 4 bars [− +] ▸ KICK 01                  ◂ ▸     [Edit ▾] [⧉ Duplicate] [Add to Arrange]       │ CONTEXT BAR
├────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│    │ BANK [1] 2 3 4    Snap ¼ ▾   [− 100% +]                                                           WORKSPACE      │
│ L  │         1               2               3               4                                          ← ruler        │
│ I  │ ▌01 KICK   ◉ M S ◐ ▶ ▐ │█░░░█░░░░░█░░░█░░░│█░░░░░░░█░░░█░░░│█░░░█░░░░░█░░░█░░░│█░░░░░░░█░░░█░░░│                  │
│ B  │ ▌02 SNARE  ◉ M S ◐ ▶ ▐ │░░░░█░░░░░░░█░░░░░│░░░░█░░░░░░░█░░░░░│░░░░█░░░░░░░█░░░░░│░░░░█░░░░░░░░░░░░░│                  │
│ R  │ ▌03 HAT    ∿ M S ◐ ▶ ▐ │█░█░█░█░█░█░█░█░█░│█░█░█░█░█░█░█░█░█░│█░█░█░█░█░█░█░█░█░│█░█░█░█░█░█░█░█░█░│                  │
│ A  │ ▌04 BASS   ∿ M S ◐ ▶ ▐ │█░░░░░░░█░░░░░░░█░│░░░░░░░░█░░░░░░░░░│█░░░░░░░█░░░░░░░█░│░░░░░░░░░░░░█░░░░░░│  ⌒ tie, ↕ pip    │
│ R  │ ▌05 CHORD  ∿ M S ◐ ▶ ▐ │▓⋮░░░░░░░█⋮░░░░░░░│░░░░░░░░░░░░░░░░░░│▓⋮░░░░░░░░░░░░░░░│░░░░░░░░░░░░░░░░░░│  ⋮ = multi-note   │
│ Y  │ ▌06 LEAD   ◉ M S ◐ ▶ ▐ │░░░░░░░░░░░░░░░░░░│░░░░░░░░░░░░░░░░░░│░░░░░░░░░░░░░░░░░░│░░░░░░░░░░░░░░░░░░│  ◦ empty: hint    │
│    │  ⋮ (64 tracks, virtualised rows)                                                                      ┃ playhead │
│    │ ▌MASTER      ▮▮▮▮▯▯  (meter)                                                                                       │
├────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▾ DEVICE · 05 CHORD     [Instrument | FX | Mod | Route]                                              [copy ▾]  [—]   │ DEVICE AREA
│  SYNTH ∿ pad   Tune ─●──   Cutoff ──●─   Reso ●───   Attack ─●──   Release ──●─   …generic control renderer…          │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
Reuse points: app bar & transport (all screens) · context bar breadcrumb · **track header** (`▌NN NAME src M S ◐ ▶ meter`) ·
selection on track 05 (accent wash + `▓` pad) · device area titled by the track · empty track shows hint text.
Click on `⋮` pad = select (never deletes); the graph does not exist until a track is expanded.

---

## 2 · Pattern — step graph expanded on the selected track

Selecting the track and pressing `G` (or the `▾ Graph` affordance in its header) expands a drawer **directly under that lane**.
Other lanes stay visible above and below; columns line up with the steps because they share the same scroll container.

```
├────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▌03 HAT      ∿ M S ◐ ▶ ▐ │█░█░█░█░█░█░█░█░█░│█░█░█░█░█░█░█░█░█░│█░█░█░█░█░█░█░█░█░│█░█░█░█░█░█░█░█░█░│               │
│ ▓▌04 BASS    ∿ M S ◐ ▶ ▐ │▓░░░░░░░▓░░░░░░░▓░│░░░░░░░░▓░░░░░░░░░│▓░░░░░░░▓░░░░░░░▓░│░░░░░░░░░░░░▓░░░░░░│  ← selected   │
│  ▾ GRAPH · 04 BASS   [Velocity|Pitch|Length|Ratchet|Tie|LFO|Auto|Roll]       ·········  [Scope: Track▾]  [⤢] [—]       │
│     1.0 ┤ █       █       █              █       █       █                   █                                        │
│         │ █       █   ▒   █              █   ▒   █       █                   █       ← bar per occupied step          │
│     0.5 ┤ █   ·   █   █   █          ·   █   █   █   ·   █       ░ = hatched = "mixed" (multi-note step)            │
│         │ █       █   █   █              █   █   █       █                   █                                        │
│     0.0 ┴─┴───────┴───┴───┴──────────────┴───┴───┴───────┴───────────────────┴──────────── drag to paint / click to set│
│          hover: step 9 · vel 0.82 · 1 note          ┃ playhead continues through the drawer                         │
│ ▌05 CHORD    ∿ M S ◐ ▶ ▐ │█⋮░░░░░░░█⋮░░░░░░░│…                                                                       │
```
Reuse points: **panel header** (title · subject · tabs · scope · maximise · collapse) · same ruler/columns · tabs recipe
(`Roll` is simply the last tab) · hover read-out in the status of the header · collapsed state = the header only, then
nothing. Tabs hide when they don't apply (`Tie` only on a legato synth; `Pitch` on a chop track reads "Slice").
Automation (`Auto`) uses the same drawer: a parameter picker replaces the scope controls and points are drawn on the same columns.

---

## 3 · Pattern — piano roll (last tab of the same drawer)

```
│ ▓▌05 CHORD   ∿ M S ◐ ▶ ▐ │▓⋮░░░░░░░█⋮░░░░░░░│░░░░░░░░░░░░░░░░░░│▓⋮░░░░░░░░░░░░░░░│░░░░░░░░░░░░░░░░░░│  ← still shown│
│  ▾ GRAPH · 05 CHORD   [Velocity|Pitch|Length|Ratchet|Tie|LFO|Auto|•Roll]   Snap ¼▾ [− 100% +]  [Explode chord] [⤢][—]  │
│  ┌──┬───────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │C5│                                                                                                              │ │
│  │B4│                                                                                                              │ │
│  │Bb│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│  │G4│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                       │ │
│  │Eb│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                       │ │
│  │C3│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← the 3 notes of the "⋮" step in lane above                         │ │
│  ├──┴─────── scale rows shaded, root marked ───────────────────────────────────────────────────────────────────┤ │
│  │ vel │ ┃     ┃     ┃          ┃     ┃     ┃                        ┃     ┃     ┃     ← velocity stems (shared graph) │ │
│  └─────┴────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
```
Reuse points: same drawer, header, snap/zoom cluster, ruler/columns · note selection = accent outline + handles (04 §6) ·
velocity stems are the **Velocity graph** embedded, not a separate editor · `[⤢]` maximises the drawer over the workspace
(phone default) and `Esc` returns · `Explode chord` appears when a scale-relative chord note is selected. A chop track shows
slices as rows instead of pitches.

---

## 4 · Arrangement

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ☰ │ PATTERN [ARRANGE] MIXER │ Untitled ▾ ⟲ ⟳ │ ⏮ ▶ ⏹ │ pattern|SONG │ SONG 05.1.01 │ BPM 124 │ …                  │ APP BAR
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ARRANGE ▸ Lane 2 · Verse (bars 5–8) ⛓×2                       [Open ⏎] [⧉ Duplicate] [Make unique] [Delete]          │ CONTEXT BAR
├────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│    │ + lane   Snap bar   [− 100% +]   [Place Pattern 04 ▾]                                                           │
│ L  │ ▾ LANES              1       5       9       13      17      21      25      29     ← bar ruler / marker ▼       │
│ I  │ ▌ Lane 1  ⋯ M S      ┌Intro──────┐┌Verse────────────┐┌Chorus──────────┐          ┌Chorus ⛓──────┐              │
│ B  │  (modifiers: —)      │▁▂▁ mini   ││▁▃▂▁▂▃▂ tracks   ││▂▅▃▇▅▃▇ overview ││          │▂▅▃▇▅▃▇        │              │
│ R  │                      └───────────┘└─────────────────┘└────────────────┘          └───────────────┘              │
│ A  │ ▌ Lane 2  ⋯ M S      │           ┌Verse ⛓ (selected)┐         ┌Fill──┐                                           │
│ R  │  (+3 st · ×0.8 gate) │           │▁▃▂▁▂▃▂▁▃▂▁▂      │         │▁▃▂▇  │                                           │
│ Y  │                      │           └──────────────────┘         └──────┘                                           │
│    │ ▾ Lane 2 expanded: tracks of the selected clip                                                                    │
│    │    ▌01 KICK    ◉ M S ◐ │        ·█···█···█···█···   (read-only mini rows for this clip, same track header)      │
│    │    ▌04 BASS    ∿ M S ◐ │        ·█·······█·······                                                                │
│    │ ▌ MASTER automation ▸ (collapsed)                                    ┃ song playhead                              │
├────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▾ DEVICE · 04 BASS   [Instrument | FX | Mod | Route]                                                       [copy ▾] [—] │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
Reuse points: app bar/transport (song source) · context bar with open/duplicate/delete · **lane header uses the track-header
layout** (identity bar, name, M S, `⋯`) · expanded lane reuses `TrackHeader` rows · clip selection outline · panel header for
the device area · same ruler recipe with bar numbers · same Snap/zoom cluster · `⛓×2` marks shared patterns. Double-click a
clip → `PATTERN` with the return link `◂ Arrange · Lane 2 · Verse`.

---

## 5 · Mixer

```
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ MIXER ▸ Bank 1 · 16 tracks   (Bank ◂ ▸ / All)                                                          [Edit ▾]          │ CONTEXT BAR
├────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ L  │  ▌01       ▌02       ▌03       ▌04       ▌05       ▌06    …      …      ▌16      ┃ MASTER                          │
│ I  │  KICK      SNARE     HAT       BASS      CHORD     LEAD                           ┃ ──────                        │
│ B  │  ◉         ◉         ∿         ∿         ∿         ◉                              ┃ FX ▸ comp, eq                 │
│ R  │  →master   →master   →DRUMS    →master   →master   →master                       ┃                               │
│ A  │  send 0.0  send 0.0   send .3   send 0.0  send 0.2  send 0.0                      ┃                               │
│ R  │  pan ─●─   pan ─●─    pan ─●─   pan ──●   pan ●──   pan ─●─                        ┃ spectrum ▂▃▅▇▅▃▂              │
│ Y  │   █▌ ▓      █▌          █▌        █▌        █▌        █▌     (meter + fader)      ┃  █▌                           │
│    │   ▓▌ 0.8    ▓▌ 1.0      ▓▌ 0.7    ▓▌ 0.9    ▓▌ 0.6    ▓▌ 0.8                      ┃  ▓▌                           │
│    │   M S ◐      M S ◐       M S ◐     M S ◐     M S ◐     M S ◐                        ┃  clip ●                       │
├────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▾ DEVICE · 05 CHORD   [Instrument | FX | Mod | Route]                                                  [copy ▾] [—] │
```
Reuse points: the strip is the **track header in `strip` density** (identity bar, name, source glyph, M S ◐) · same selection
(selected strip gets raised surface + accent edge; click selects the track for the device area) · Route values mirror the
device area's Route tab (one component) · master strip = track header with master glyph · context bar and device area
unchanged.

---

## 6 · Instrument / FX editing (device area, full height)

The device area is docked at the bottom of every workspace; dragging its splitter (or `D`, or `⤢`) gives it room.

```
├────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▾ DEVICE · 04 BASS     [ Instrument | FX | Mod | Route ]                                       [copy ▾] [⤢] [—]      │ PANEL HEADER
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  FX  ──[filter ▓]──[delay]──[comp]──[ + add ▾ ]──────────────────────── chain strip (reorder by drag, bypass dot)      │
│  ┌ FILTER · 04 BASS ───────────────────────────── Scope: [Track|This pattern]──────────────────────────────────┐     │
│  │  Mode [LP▾]   Cutoff ──────●──────  Reso ●─────────  Drive ●──────      ← generic controls from FX_DEFS      │     │
│  │  (click a label → Graph › Auto targets it)                                                                   │     │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘     │
│   EQ module shows: [curve editor with live spectrum]   Compressor shows: sidechain [track ▾]                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
Reuse points: the device area uses the **same panel header** as the graph drawer (title · subject · tabs · actions ·
collapse/maximise) · same scope switch component used in Graph and Mod · "Automate this parameter" feeds the Graph's `Auto`
tab · add ▾ is the FX extension point · the same area holds Instrument / Mod / Route, so a new device-level concept has a
single, predictable home.

---

## What the six wireframes prove

| Pattern | S1 | S2 | S3 | S4 | S5 | S6 |
|---|---|---|---|---|---|---|
| App bar + persistent transport | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Context bar (what am I editing) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Track header (one component, densities) | lane | lane | lane | lane rows | strip | title |
| Panel header (one component) | device | graph | graph/roll | device | device | device |
| Shared ruler + snap/zoom cluster | ✓ | ✓ | ✓ | ✓ | — | — |
| Selection treatment | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Depth, not new panel (step→graph→roll) | base | +graph | +roll | — | — | — |
