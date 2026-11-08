# 03 · Composition model

Goal: **step sequencer → step properties → piano roll → arrangement are four views of one dataset**, with no conversion
between them and no destructive flattening. The V1 project format is the dataset. The only additions are optional fields.

```
Project
 ├─ tracks[64]          (identity, source, FX, mixer state — unchanged)
 ├─ patterns[]          Pattern { bars, notes: Record<id, Note>, per-pattern overrides }     ← the unit of composition
 │    └─ notes          Note { trackId, start, duration, velocity, pitch?, chord?, ratchet?, tie?, lfo? }
 ├─ patternChain[]      the queue (Pattern mode)
 └─ composer.lanes[]    the song (Song mode)
      └─ sequences[]    ComposerSequence { patternId, start(bar), color }                   ← a "clip"
```

## 1. Vocabulary and the three levels of one workflow

| Term | Meaning | Stored as |
|---|---|---|
| **Pattern** | A loop of N bars containing the events of *all* tracks. The groovebox's unit. | `Project.patterns[i]` |
| **Event / Note** | One sounding event on one track. The only musical record. | `Pattern.notes[id]` |
| **Step** | A *view* of a track's events at one grid column. Not stored. | derived, §3 |
| **Step property** | A property of the events at a step (velocity, pitch, length, ratchet, tie, LFO, chord, chance*, …). | fields on `Note` |
| **Clip** | A placement of a pattern on the arrangement. | `ComposerSequence` |
| **Lane** | A row of non-overlapping clips; lanes play together. | `ComposerLane` |

\* chance is new, §8.

**Workspace/area codes** used in the checklist: `PAT` Pattern workspace (contains `STEP` lane, `GRAPH` drawer, `ROLL`
drawer), `ARR` Arrangement, `MIX` Mixer, `DEV` device area (INST/FX/MOD/ROUTE), `LIB` Library drawer.

The three **depths** of editing a track inside `PAT` are one expansion mechanism, not three editors:

```
depth 0  STEP    the track's lane in the step grid (default; always visible; all tracks side by side)
depth 1  GRAPH   drawer under the track: one property at a time as a bar graph over the same step columns
depth 2  ROLL    the same drawer, last tab: individual notes by pitch/time
```
The drawer is attached to the selected track, shares the lane's horizontal scale and scroll, and is shown or hidden with the graph toggle beside the zoom control (`G`); when hidden there is no extra row at all.

## 2. Resolution: why we keep `Note` as it is

Requirements pull in two directions: the step view needs "one occupied step"; the roll needs "four notes at once". V1 already
stores a chord as one `Note` with a scale-relative `chord`; V2 stores roll polyphony as several ordinary `Note`s on one track.
Both are valid in the existing shape and both already play. So:

- **A step is a view; the notes are the truth.** Nothing is ever converted when moving between depths.
- **No new storage for polyphony.** Several `Note`s with overlapping time on one track are legal. No `Step` entity, no
  `Note.group`/`Note.steps` array, no parallel "roll data" that could drift from the step data.
- **Two kinds of chord, both kept**, each honest about what it is:
  - *scale-relative chord note* (`Note.chord`): one record, follows the project scale (V1 behaviour, chord library, inversion,
    voicing). Edited in `GRAPH › Chord` and shown in the roll as one stacked bracket.
  - *explicit notes*: several plain `Note`s (absolute `pitch`). Created in the roll. Not tied to the scale.
  An action **Explode chord → notes** (ctx on a chord in the roll) turns the first into the second (one undo step). The reverse
  is *not* offered automatically — recognising a chord from notes is lossy; we only offer "Group as chord" later if the
  selected notes exactly match a chord type from the library.

## 3. The step view of a track (derived)

For track *t* in pattern *p* with project `beatsPerBar` (= steps per bar, 16) the **step cell** at column *c* is:

```
cell(t, c) = { notes: Note[t] where floor(start + ε) == c,  tail: Note[t] with start < c and end > c }
```
(ε = 1/128 so grid-snapped notes at 3.0 are not "late"; free-placed notes at 2.9999 round into the right column.)

Cell kinds, in decreasing priority, drive **one glyph each** (and are specified so they are distinguishable without colour):

| Kind | Condition | Glyph (shape, not just colour) |
|---|---|---|
| empty | no onset, no tail | dim square / hollow pad |
| **single** | exactly 1 onset, no chord | solid pad; height or fill reflects velocity |
| **multi** | ≥ 2 onsets in the cell, **or** the onset is a chord note | solid pad with a **stack mark** (⋮ — three short bars) and a count badge on hover/selection |
| **extended** (overlay on any occupied kind) | ratchet > 1, tie, LFO amount > 0, pitch ≠ 0 on a single, off-grid onset, chance < 1 | corner pips: `÷n` ratchet ticks, `⌒` tie arc, `~` LFO, `↕` pitch offset, `?` chance. At most 2 pips; the rest in a tooltip and the graph |
| **tail** | covered by a longer note that began earlier | a thin bar continuing from the onset pad (the note's length) |

Rules that make this safe for rich material:

1. **Compression is display-only.** The step lane never rewrites, quantises, merges, or truncates notes.
2. **Click on empty** adds a note — pitch 0 by default, or the track's *last used step pitch* when the track has an in-scale
   melodic role (setting; default off to match V1) — through the V1 add rule.
3. **Click on single** removes it (V1 behaviour, one-click toggle).
4. **Click on multi** *selects* the step; it never deletes. Removing a multi step needs `Delete` and always reports
   "Removed 4 notes · Undo" in the status area. (This is the safety rule that protects piano-roll work, §4 below.)
5. **Drag the tail handle** resizes the *whole step* (all its onset notes) — in the roll each note resizes alone.
6. **Notes that start off-grid** (e.g. 1/64 offsets from Alt-placement or the roll) appear in the nearest column with the
   off-grid pip; nothing moves them unless the user quantises.
7. **Muting is non-destructive**: per-pattern "notes off" (`offTracks`, C5) silences a track's notes in a pattern without
   touching them. This is also what the step lane offers instead of "clear" for a poly track.

## 4. Step properties vs note properties

A step property edit is defined as a **batch edit on the step's notes**. The graph (GRAPH) shows one value per step column.

| Property | Stored on | Graph value for a multi-note step | Edit on a multi-note step |
|---|---|---|---|
| Velocity | each `Note.velocity` | **max** of notes; bar shows a thin "range" whisker if notes differ | multiplies all notes by `new/old(max)`: relative shape (chord balance) is preserved; clamped 0–1 |
| Pitch | `Note.pitch` (st above track pitch, ±48) or chord root | **lowest** note's pitch (chord: root) | transposes all notes by the delta (chord: moves the root); intervals preserved |
| Length | `Note.duration` | longest | sets all to the new length (clamped by next same-pitch note) |
| Ratchet | `Note.ratchet` | value if uniform, else "mixed" bar hatched | sets all |
| Tie | `Note.tie` | on if any | sets all |
| LFO amount | `Note.lfo` | mean | sets all |
| Chord (type/inversion/voicing/root) | `Note.chord` | the chord note's | applies to chord notes only; plain multi-notes show "n notes" (use the roll) |
| Chance* | `Note.chance` | mean | sets all |

If the user wants per-note values inside a step, that *is* the piano roll — the graph's only job is the step-level
view, the second tab row (Roll) is one click away. The graph indicates a mixed step with a hatched bar so it never
silently lies.

Existing V1 per-note controls (the old Track Editor rows E5–E11) map one-to-one onto graph tabs for single-note steps, so
nothing is lost for V1 users.

## 5. Edit policies over the same storage

| Surface | Overlap rule | Why |
|---|---|---|
| `STEP` | V1 `fitsWithoutOverlap` for *adds and resizes of single steps* (a step note can't grow into the next onset). Polyphonic cells are never "fixed" by this rule — it only constrains what the step lane itself creates. | Keeps the groovebox feel; never mutates poly material. |
| `ROLL` | V2 `rollSlot` rule: overlap allowed unless same pitch; chord note in slot `chord`. | Needed for polyphony. |
| `GRAPH` | edits properties only; no add/remove/move. | |
| Paste/duplicate | all-or-nothing per operation (roll) / skip-colliding (V1 `pasteNotes`) — keep each op's existing semantics. | Tested behaviour. |

The policy is chosen by the **surface**, not stored per track. A track needs no "poly mode" flag; it is poly if it has
overlapping notes.

## 6. Playback: the one non-UI change

`audio/compile.ts` schedules each plain note independently, so **samples and drums already play any number of simultaneous
notes**. Synths are monophonic per engine instance; V1 gives chords extra instances (`voice`, `chordVoicesNeeded`, max
`MAX_CHORD_VOICES = 5`). Roll polyphony needs the same:

1. In `expandChordNotes`' seam (`model/chord.ts`), after expanding chord notes, run a **voice allocator** over the track's
   `PlayedNote[]`: sweep by start time; a note takes the lowest `voice` index that is free (its previous note ended); a note
   gets `voice: 0` when the track never overlaps — so V1 projects are bit-identical (the allocator is a no-op for them).
2. `chordVoicesNeeded` → `voicesNeeded` = max over patterns of the simultaneous count the allocator would use (cap 5; excess
   notes steal the oldest voice, as the engine already does at its voice limit).
3. Ties (`compile.ts` `byVoice`) already group by `voice`, so tied roll notes work per voice.

This is the only change in `model/` or `audio/` for composition. It is testable in isolation (pure, `test/` style). Sample
tracks are unaffected.

## 7. Patterns → clips → arrangement

V1's song model already is "pattern → clip": a `ComposerSequence` places a pattern (all tracks) on a lane at a bar.
**We keep that model and its tested behaviour** (shared patterns, "Duplicate" makes an independent copy, lane modifiers,
no-overlap within a lane, automation replay). What changes is how the arrangement shows and opens it.

```
Pattern (all tracks) ── placed as ──▶ Clip on a Lane          clip length = pattern.bars (one source of truth)
        ▲                                    │
        └──── double-click clip: open this pattern in PAT, step lane first ────┘
```

- **Opening a clip** (`Edit` ↔ double-click) switches to `PAT` with the clip's pattern selected, sets a *return context*
  ("◂ Arrangement · Lane 2 · Verse") in the context bar so one click goes back to the same scroll position. It never opens
  the roll by itself; if the user was previously in the roll for the selected track, the drawer reopens there (persisted
  per track as UI state, not in the project).
- **Shared vs independent**: a clip whose pattern is placed more than once shows a **link badge ⛓ ×N**. Editing it edits
  all placements (V1 behaviour, now visible). `Make unique` = V1 duplicate-sequence.
- **Track identity in the arrangement.** A clip carries *all* the pattern's tracks, so rows are *lanes*, not tracks. To keep
  per-track readability without per-track clips (V2's mistake A2), each clip draws a **mini track overview** (one hair-line
  row per track that has notes in it, tinted by the track's colour; drum rows grouped at the top, a note-range sparkline for
  melodic tracks) and a lane can be **expanded** to show those track rows full-height with mute/solo/notes-off (V1's
  `ComposerTrackList`, L7). Expanded track rows are the same track-identity header as in `PAT` (04 §3).
- **Pattern-level vs clip-level**: lane modifiers (transpose/velocity/gate) stay lane-level (V1). Not adding per-clip
  modifiers now; the data allows it later (`ComposerSequence.modifiers?`, V2's optional field) if wanted.
- **Not adopting** `ComposerLane.trackId` / `Pattern.clipOf`. If we later want true per-track clips, they would be optional
  *additions* alongside this model, never a migration of V1 songs.

## 8. Model additions (all optional, all read through defaults)

| Field | Purpose | Notes |
|---|---|---|
| *(none for rich notes)* | Piano-roll material uses existing `Note` fields. | |
| `Note.chance?: number` (0–1; absent = 1) | The graph's "probability" tab. | **New behaviour, not V1.** Needs a deterministic per-playthrough decision in `compile.ts` (seeded by note id + loop count so a bounce equals playback). Scheduled as a post-parity item; the graph is built to accept it (a tab registry, §9). Not required for any V1 feature. |
| UI-only state | per-track drawer tab/height/open, roll scroll/zoom, return context | `localStorage`/session UI store, never in the project. |

p-lock-style automation uses what exists: **automation lanes** (`AutomationLane`, per-pattern overrides). The graph's
`Auto` tab edits the same lanes (I1–I4) on the same step-column scale; per-step parameter locks as a *concept* (a value
attached to a step) are a future model addition and are explicitly not part of this rebuild.

## 9. Graph tab registry (extension point)

```ts
interface StepProp {
  id: "velocity" | "pitch" | "length" | "ratchet" | "tie" | "lfo" | "chord" | "auto" | string;
  label: string;
  /** when this tab applies to the selected track (chop → pitch means slice; sample vs synth; tie only if supportsTie) */
  applies(track: Track): boolean;
  read(notes: Note[]): { value: number; mixed: boolean };       // step-level value
  write(notes: Note[], v: number): Partial<Note>[];             // batch result (§4 rules)
  domain: { min: number; max: number; step?: number; format(v): string };
  kind: "bars" | "points" | "toggle";                           // bars: velocity/length; toggle: tie; points: auto
}
```
A new step property = one registry entry; the drawer, tab strip, hover read-out, selection behaviour and undo come for free.

## 10. Compatibility and migration

- Reading V1 files: no migration. `composer`, `trackSettings`, `automation`, `offTracks` are read as today.
- Reading **V2** files (if any exist in the wild): `Pattern.clipOf` / `ComposerLane.trackId` / `ComposerSequence.modifiers`
  are plain optional fields, ignored by us and **preserved on save** (we spread, never strip). V2 per-track lanes then
  appear as lanes that happen to hold single-track patterns.
- Writing: only fields V1 already defines (plus `chance` once it exists). A file saved by the new build opens in V1 unless it
  contains `chance`.
- Test: a corpus of fixture projects (V1 minimal, V1 song with modifiers, a hand-made poly-roll project, a V2 project) is
  load→save→load round-tripped and deep-equal compared; poly notes survive visiting the step lane and the graph (no write
  happens on view).
