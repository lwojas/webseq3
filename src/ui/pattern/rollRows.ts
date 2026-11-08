// Which pitch rows the piano roll shows and which it lets a note land on. In a non-chromatic key only the key's
// notes get a row (plus the rows existing notes already sit on, so nothing already written is hidden); a chromatic
// project or a chop track shows every row. Pure data + functions: the roll's canvas only reads the result.
import { MAX_NOTE_PITCH, MIN_NOTE_PITCH } from "../../model/notes";
import { isChromatic, isOffsetInScale, nearestScaleOffset, type ProjectScale } from "../../model/scale";

export interface RollKey {
  scale: ProjectScale;
  /** The track's root as a MIDI note; null for a sample. */
  root: number | null;
  /** False for a chop track (a pitch is a slice index) or a chromatic project: every pitch is allowed. */
  keyed: boolean;
}

export function rollKey(scale: ProjectScale, root: number | null, chop: boolean): RollKey {
  return { scale, root, keyed: !chop && !isChromatic(scale) };
}

export const inKey = (key: RollKey, pitch: number) => !key.keyed || isOffsetInScale(key.scale, key.root, pitch);

/** `pitch` moved to the nearest in-key pitch (unchanged when already in key or the roll is not keyed). */
export function snapToKey(key: RollKey, pitch: number): number {
  return key.keyed ? nearestScaleOffset(key.scale, key.root, pitch) : pitch;
}

export interface RollRows {
  /** Pitches top to bottom (highest first), one per row. */
  pitches: number[];
  index: Map<number, number>;
}

/** Rows for pitches in [pMin, pMax]: all of them, or in a keyed roll the in-key ones plus every pitch in `used`. */
export function buildRollRows(key: RollKey, pMin: number, pMax: number, used: Iterable<number> = []): RollRows {
  const keep = new Set(used);
  const pitches: number[] = [];
  for (let p = pMax; p >= pMin; p--) if (inKey(key, p) || keep.has(p)) pitches.push(p);
  return { pitches, index: new Map(pitches.map((p, i) => [p, i])) };
}

/** Row of `pitch`, or of the closest pitch that has one. */
export function rowOf(rows: RollRows, pitch: number): number {
  const hit = rows.index.get(pitch);
  if (hit !== undefined) return hit;
  let best = 0;
  rows.pitches.forEach((p, i) => { if (Math.abs(p - pitch) < Math.abs(rows.pitches[best] - pitch)) best = i; });
  return best;
}

export function pitchAtRow(rows: RollRows, row: number): number {
  return rows.pitches[Math.min(rows.pitches.length - 1, Math.max(0, row))];
}

/** `pitch` after dragging `dRows` rows up (negative = down), landing on a key pitch. */
export function pitchAfterRows(key: RollKey, rows: RollRows, pitch: number, dRows: number): number {
  return snapToKey(key, pitchAtRow(rows, rowOf(rows, pitch) - dRows));
}

const clampPitch = (p: number) => Math.min(MAX_NOTE_PITCH, Math.max(MIN_NOTE_PITCH, p));

/** Keyboard step: the next key pitch above (`dir` 1) or below (-1), or the same degree an octave away (`octave`). */
export function stepPitch(key: RollKey, pitch: number, dir: 1 | -1, octave: boolean): number {
  if (octave) return clampPitch(snapToKey(key, pitch + dir * 12));
  let p = pitch + dir;
  while (!inKey(key, p) && p >= MIN_NOTE_PITCH && p <= MAX_NOTE_PITCH) p += dir;
  return clampPitch(p);
}
