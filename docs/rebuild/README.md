# Webseq composition-focused UI rebuild — planning set

Written before any UI code, per the brief. Read in order.

| Doc | Phase | Contents |
|---|---|---|
| [01-v1-audit.md](01-v1-audit.md) | 1 | V1 architecture, **feature checklist with a destination for every item (133 rows)**, how completeness is guarded mechanically |
| [02-webseq2-study.md](02-webseq2-study.md) | 2 | patterns to reuse (R1–R16) vs decisions abandoned (A1–A10), gaps V2 left |
| [03-composition-model.md](03-composition-model.md) | 3 | Project → Track → Pattern → Steps/Notes → Step properties → Clips; chords, multi-note steps, step view of piano-roll material, voice allocation |
| [04-ui-rules.md](04-ui-rules.md) | 4 | the reusable UI rules/patterns (principles, with a rule for breaking them) |
| [05-wireframes.md](05-wireframes.md) | 4 | six wireframes on one shared skeleton |
| [06-implementation-plan.md](06-implementation-plan.md) | 5 | architecture, order of work, verification, risks |

## The core ideas in six lines

1. **V1's project format is the dataset.** No new storage for chords/poly material; a *step is a derived view* of a track's notes, so nothing is flattened by visiting the step lane.
2. **Step → Graph → Roll are three depths of one expansion drawer** under the selected track, sharing the step columns. The step lane is always visible; the Roll is the last graph tab.
3. **Pattern → clip is V1's composer**, kept intact (lanes of whole-pattern placements). Double-click a clip opens its pattern in the step lane, with a return link. Clips show a mini track overview and lanes can expand into track rows.
4. **Three workspaces** (Pattern default, Arrange, Mixer) + a Library drawer + a device area for the selected track. Everything else is a depth, a tab or a menu.
5. **One track header, one panel header, one ruler/snap/zoom cluster, one selection model, one context bar** — reused everywhere.
6. **Parity is machine-checked** (every reducer action and handler must name its new home) and V1's tests, including the MIDI contract V2 deleted, stay.

## Decisions I need from you before implementation starts

1. **Arrangement rows = lanes (V1), not tracks (V2).** Recommended (03 §7): keeps V1 songs lossless and the pattern as the
   unit; track identity comes from clip overviews and expandable lanes. The alternative is V2's per-track clips, which splits
   existing songs on load. *Confirm lane-based, or tell me you want per-track clips.*
2. **Probability ("chance") is new, not V1.** It needs a small deterministic scheduling change in `compile.ts`. Include in
   this rebuild (after parity) or leave the graph tab out for now? *Default: defer, but the graph registry is ready for it.*
3. **MIDI recording (V2's recorder)** is also not V1. *Default: out of scope for the rebuild, easy to add afterwards.*
4. **Where to build:** new code goes in this clone (`webseq3/webseq`) under `src/ui`, `src/state`, behind `?ui=2` until parity,
   then V1's UI is removed. *Confirm, or say if you'd rather have a fresh branch/repo.*
