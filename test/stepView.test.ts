import { describe, expect, it } from "vitest";
import { stepCells } from "../src/ui/pattern/stepView";
import { STEP_PROPS, stepPropById, writeStep } from "../src/ui/pattern/stepProps";
import { projectReducer } from "../src/model/reducer";
import { createInitialProject } from "../src/model/project";
import type { Note } from "../src/model/types";

const n = (id: string, start: number, duration = 1, extra: Partial<Note> = {}): Note => ({ id, trackId: "t", start, duration, velocity: 1, ...extra });

describe("step cells (derived view)", () => {
  it("marks single, multi and tail cells", () => {
    const cells = stepCells([n("a", 0, 3), n("b", 4), n("c", 4, 1, { pitch: 7 }), n("d", 8, 1, { chord: { root: 0, degrees: [0, 2, 4] } })]);
    expect(cells.get(0)?.kind).toBe("single");
    expect(cells.get(1)?.kind).toBe("tail");
    expect(cells.get(2)?.kind).toBe("tail");
    expect(cells.get(3)).toBeUndefined();
    expect(cells.get(4)?.kind).toBe("multi");
    expect(cells.get(8)?.kind).toBe("multi");
  });
  it("puts rounding-fuzz onsets in the nearest column and flags real off-grid ones", () => {
    const cells = stepCells([n("a", 2.9999), n("b", 5.5)]);
    expect(cells.get(3)?.pips).toEqual([]);
    expect(cells.get(2)).toBeUndefined();
    expect(cells.get(5)?.pips).toContain("offgrid");
  });
  it("shows ratchet, tie and pitch pips on a single", () => {
    const cell = stepCells([n("a", 0, 1, { ratchet: 4, tie: true, pitch: 3 })]).get(0)!;
    expect(cell.pips).toEqual(["ratchet", "tie", "pitch"]);
  });
});

describe("step property edits", () => {
  const withNotes = () => {
    let p = createInitialProject();
    const pat = p.patterns[0];
    const notes: Record<string, Note> = { a: n("a", 0, 1, { pitch: 0, velocity: 1 }), b: n("b", 0, 1, { pitch: 7, velocity: 0.5 }) };
    notes.a.trackId = notes.b.trackId = p.tracks[0].id;
    p = { ...p, patterns: [{ ...pat, notes }, ...p.patterns.slice(1)] };
    return { p, pat: pat.id, list: Object.values(notes) };
  };
  it("scales velocity relatively across a multi-note step and is one undo-able action", () => {
    const { p, pat, list } = withNotes();
    const act = writeStep(stepPropById("velocity"), pat, list, 0.6)!;
    expect(act.type).toBe("BATCH");
    const next = projectReducer(p, act);
    const notes = next.patterns[0].notes;
    expect(notes.a.velocity).toBeCloseTo(0.6);
    expect(notes.b.velocity).toBeCloseTo(0.3);
  });
  it("transposes a multi-note step keeping its intervals", () => {
    const { p, pat, list } = withNotes();
    const next = projectReducer(p, writeStep(stepPropById("pitch"), pat, list, 2)!);
    expect(next.patterns[0].notes.a.pitch).toBe(2);
    expect(next.patterns[0].notes.b.pitch).toBe(9);
  });
  it("reports mixed values", () => {
    const { list } = withNotes();
    expect(stepPropById("velocity").read(list)).toEqual({ value: 1, mixed: true });
    expect(STEP_PROPS.length).toBeGreaterThan(4);
  });
});
