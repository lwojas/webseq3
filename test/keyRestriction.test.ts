import { describe, expect, it } from "vitest";
import { chordFitsScale } from "../src/model/chord";
import { pitchOptions } from "../src/model/pitchOptions";
import { createScale, isOffsetInScale } from "../src/model/scale";
import { buildRollRows, inKey, pitchAfterRows, rollKey, snapToKey, stepPitch } from "../src/ui/pattern/rollRows";

const cMajor = { ...createScale(), root: 0, scale: "major" }; // snap deliberately off
const chromatic = createScale();

describe("pitch graph options", () => {
  it("strict mode offers only the key's notes even with Snap off", () => {
    const opts = pitchOptions(null, 0, null, cMajor, true);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((p) => isOffsetInScale(cMajor, null, p))).toBe(true);
    expect(pitchOptions(null, 0, null, cMajor).length).toBeGreaterThan(opts.length); // the dropdown still shows all
  });
  it("keeps the current value, and everything in a chromatic project", () => {
    expect(pitchOptions(null, 1, null, cMajor, true)).toContain(1);
    expect(pitchOptions(null, 0, null, chromatic, true)).toEqual(pitchOptions(null, 0, null, chromatic));
  });
});

describe("chords in the key", () => {
  it("a major triad on C fits C major, a Dominant 7 on C does not (Bb)", () => {
    expect(chordFitsScale(cMajor, null, { root: 0, degrees: [0, 2, 4], type: "maj" })).toBe(true);
    expect(chordFitsScale(cMajor, null, { root: 0, degrees: [0, 2, 4, 6], type: "7" })).toBe(false);
  });
  it("always fits a chromatic project", () => {
    expect(chordFitsScale(chromatic, null, { root: 0, degrees: [0, 2, 4, 6], type: "7" })).toBe(true);
  });
});

describe("piano roll rows", () => {
  const key = rollKey(cMajor, null, false);
  it("drops out-of-key rows but keeps rows existing notes sit on", () => {
    const rows = buildRollRows(key, -12, 12, [1]);
    expect(rows.pitches.every((p) => inKey(key, p) || p === 1)).toBe(true);
    expect(rows.pitches).toContain(1);
    expect(rows.pitches).not.toContain(3);
    expect(rows.pitches).toEqual([...rows.pitches].sort((a, b) => b - a));
  });
  it("shows every row for a chromatic project or a chop track", () => {
    expect(buildRollRows(rollKey(chromatic, null, false), -12, 12).pitches).toHaveLength(25);
    expect(buildRollRows(rollKey(cMajor, null, true), 0, 7).pitches).toHaveLength(8);
  });
  it("moves land on key pitches", () => {
    const rows = buildRollRows(key, -24, 24);
    expect(pitchAfterRows(key, rows, 0, 1)).toBe(2); // C -> D
    expect(pitchAfterRows(key, rows, 0, -1)).toBe(-1); // C -> B below
    expect(snapToKey(key, 1)).toBe(0); // tie goes down
  });
  it("keyboard steps skip off-key notes; Shift is an octave", () => {
    expect(stepPitch(key, 4, 1, false)).toBe(5); // E -> F
    expect(stepPitch(key, 5, 1, false)).toBe(7); // F -> G
    expect(stepPitch(key, 0, -1, false)).toBe(-1);
    expect(stepPitch(key, 2, 1, true)).toBe(14);
  });
});
