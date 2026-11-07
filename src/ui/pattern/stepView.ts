// The step lane's view of a track's notes (docs/rebuild/03-composition-model.md §3). A step is DERIVED: nothing here
// writes to the project, so showing piano-roll material as steps can never flatten it.
import { ratchetOf, type Note } from "../../model/types";

/** A note that starts at 2.9999 (free placement rounding) still belongs to column 3, not 2. */
const EPS = 1 / 128;

export type StepKind = "single" | "multi" | "tail";
export type StepPip = "ratchet" | "tie" | "lfo" | "pitch" | "offgrid";

export interface StepCell {
  column: number;
  kind: StepKind;
  /** Notes whose onset is in this column (empty for a tail). */
  notes: Note[];
  /** For a tail cell, the note it continues. */
  tailOf?: Note;
  pips: StepPip[];
}

export const columnOf = (start: number): number => Math.floor(start + EPS);

function pipsOf(notes: readonly Note[]): StepPip[] {
  const pips: StepPip[] = [];
  if (notes.some((n) => ratchetOf(n) > 1)) pips.push("ratchet");
  if (notes.some((n) => n.tie)) pips.push("tie");
  if (notes.some((n) => (n.lfo ?? 0) > 0)) pips.push("lfo");
  if (notes.length === 1 && !notes[0].chord && (notes[0].pitch ?? 0) !== 0) pips.push("pitch");
  if (notes.some((n) => Math.abs(n.start - Math.round(n.start)) > EPS)) pips.push("offgrid");
  return pips;
}

/** Occupied and tail cells of one track, keyed by column. Empty columns are absent. */
export function stepCells(trackNotes: readonly Note[]): Map<number, StepCell> {
  const byColumn = new Map<number, Note[]>();
  for (const n of trackNotes) {
    const c = columnOf(n.start);
    const list = byColumn.get(c);
    if (list) list.push(n);
    else byColumn.set(c, [n]);
  }
  const cells = new Map<number, StepCell>();
  for (const [column, notes] of byColumn) {
    const multi = notes.length > 1 || notes.some((n) => n.chord);
    cells.set(column, { column, kind: multi ? "multi" : "single", notes, pips: pipsOf(notes) });
  }
  // Tails: columns after the onset that a note still sounds in (the first column is the onset).
  for (const n of trackNotes) {
    const last = Math.ceil(n.start + n.duration - EPS) - 1;
    for (let c = columnOf(n.start) + 1; c <= last; c++) {
      if (!cells.has(c)) cells.set(c, { column: c, kind: "tail", notes: [], tailOf: n, pips: [] });
    }
  }
  return cells;
}

/** Notes starting in `column`. */
export function notesAtColumn(trackNotes: readonly Note[], column: number): Note[] {
  return trackNotes.filter((n) => columnOf(n.start) === column);
}
