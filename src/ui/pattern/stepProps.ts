// Step properties as the graph edits them (docs/rebuild/03-composition-model.md §4, §9): read one value for a step from
// its notes, and turn an edited value into per-note reducer actions that are applied as ONE undo step (BATCH).
// A step with several notes is edited relatively (velocity scales, pitch transposes) so chord balance is preserved.
import type { Action } from "../../model/reducer";
import { MAX_NOTE_PITCH, MIN_NOTE_PITCH } from "../../model/notes";
import { RATCHET_VALUES, ratchetOf, type Note, type PatternId, type Track } from "../../model/types";
import { supportsTie } from "../../model/instruments";

export type StepPropId = "velocity" | "pitch" | "length" | "ratchet" | "tie" | "lfo";

export interface StepValue {
  value: number;
  /** The notes of the step do not all agree: the graph hatches the bar. */
  mixed: boolean;
}

export interface StepProp {
  id: StepPropId;
  label: string;
  min: number;
  max: number;
  /** Quantisation of the value while painting. */
  step: number;
  format(v: number): string;
  applies(track: Track): boolean;
  read(notes: readonly Note[]): StepValue;
  write(patternId: PatternId, notes: readonly Note[], value: number): Action[];
}

const agree = (vals: number[]) => vals.every((v) => Math.abs(v - vals[0]) < 1e-9);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pitchOf = (n: Note) => n.pitch ?? 0;

export const STEP_PROPS: StepProp[] = [
  {
    id: "velocity", label: "Velocity", min: 0, max: 1, step: 1 / 127,
    format: (v) => String(Math.round(v * 127)),
    applies: () => true,
    read: (notes) => ({ value: Math.max(...notes.map((n) => n.velocity)), mixed: !agree(notes.map((n) => n.velocity)) }),
    write: (patternId, notes, value) => {
      const top = Math.max(...notes.map((n) => n.velocity));
      return notes.map((n) => ({
        type: "SET_NOTE_VELOCITY" as const, patternId, noteId: n.id,
        velocity: notes.length === 1 || top <= 0 ? value : clamp((n.velocity / top) * value, 0, 1),
      }));
    },
  },
  {
    id: "pitch", label: "Pitch", min: MIN_NOTE_PITCH, max: MAX_NOTE_PITCH, step: 1,
    format: (v) => (v > 0 ? `+${v}` : String(v)),
    applies: () => true,
    read: (notes) => {
      const plain = notes.filter((n) => !n.chord);
      const pitches = plain.map(pitchOf);
      return { value: pitches.length ? Math.min(...pitches) : 0, mixed: pitches.length > 1 && !agree(pitches) };
    },
    write: (patternId, notes, value) => {
      const plain = notes.filter((n) => !n.chord);
      if (plain.length === 0) return [];
      const delta = Math.round(value) - Math.min(...plain.map(pitchOf));
      return plain.map((n) => ({ type: "SET_NOTE_PITCH" as const, patternId, noteId: n.id, pitch: clamp(pitchOf(n) + delta, MIN_NOTE_PITCH, MAX_NOTE_PITCH) }));
    },
  },
  {
    id: "length", label: "Length", min: 1 / 4, max: 16, step: 1 / 4,
    format: (v) => `${v.toFixed(2).replace(/\.?0+$/, "")} st`,
    applies: () => true,
    read: (notes) => ({ value: Math.max(...notes.map((n) => n.duration)), mixed: !agree(notes.map((n) => n.duration)) }),
    write: (patternId, notes, value) => notes.map((n) => ({ type: "RESIZE_NOTE" as const, patternId, noteId: n.id, duration: value })),
  },
  {
    id: "ratchet", label: "Ratchet", min: 1, max: RATCHET_VALUES[RATCHET_VALUES.length - 1], step: 1,
    format: (v) => `×${v}`,
    applies: () => true,
    read: (notes) => ({ value: Math.max(...notes.map(ratchetOf)), mixed: !agree(notes.map(ratchetOf)) }),
    write: (patternId, notes, value) => {
      const nearest = RATCHET_VALUES.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
      return notes.map((n) => ({ type: "SET_NOTE_RATCHET" as const, patternId, noteId: n.id, ratchet: nearest }));
    },
  },
  {
    id: "tie", label: "Tie", min: 0, max: 1, step: 1,
    format: (v) => (v ? "tied" : "off"),
    applies: (track) => supportsTie(track),
    read: (notes) => ({ value: notes.some((n) => n.tie) ? 1 : 0, mixed: !agree(notes.map((n) => (n.tie ? 1 : 0))) }),
    write: (patternId, notes, value) => notes.map((n) => ({ type: "SET_NOTE_TIE" as const, patternId, noteId: n.id, tie: value >= 0.5 })),
  },
  {
    id: "lfo", label: "LFO", min: 0, max: 1, step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
    applies: (track) => !!track.eventLfo?.enabled,
    read: (notes) => {
      const vals = notes.map((n) => n.lfo ?? 0);
      return { value: vals.reduce((a, b) => a + b, 0) / vals.length, mixed: !agree(vals) };
    },
    write: (patternId, notes, value) => notes.map((n) => ({ type: "SET_NOTE_LFO" as const, patternId, noteId: n.id, amount: value })),
  },
];

export const stepPropById = (id: StepPropId): StepProp => STEP_PROPS.find((p) => p.id === id) ?? STEP_PROPS[0];

/** One undo step for editing a whole step. */
export function writeStep(prop: StepProp, patternId: PatternId, notes: readonly Note[], value: number): Action | null {
  const actions = prop.write(patternId, notes, value);
  return actions.length === 0 ? null : actions.length === 1 ? actions[0] : { type: "BATCH", actions };
}
