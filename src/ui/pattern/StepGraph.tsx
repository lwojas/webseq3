// The step graph (docs/rebuild/03-composition-model.md §4, §9): one step property as a bar per occupied step, on the same
// columns as the lane above it. Painting previews by writing bar heights straight into the DOM and dispatches ONE batch on
// release, so a drag is a single undo step and never re-renders the lane. A hatched bar means the step's notes disagree.
import { memo, useId, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Action } from "../../model/reducer";
import type { Note, PatternId } from "../../model/types";
import { stepCells } from "./stepView";
import { useAnnounce } from "../kit/a11y";
import { pitchLabel } from "../../components/TrackEditor";
import { pitchOptions } from "../../model/pitchOptions";
import { isChromatic, isOffsetInScale, type ProjectScale } from "../../model/scale";
import { stepPropById, writeStep, type StepPropId } from "./stepProps";

/** What the Pitch tab needs to speak in notes and keep to the key (V1's Pitch dropdown did the same). */
export interface PitchContext {
  root: number | null;
  /** Slices of a chop track's sample; null for a chromatic track. */
  slices: number | null;
  scale: ProjectScale;
}

interface Props {
  pitch: PitchContext;
  propId: StepPropId;
  patternId: PatternId;
  notes: Note[];
  pxPerBeat: number;
  beats: number;
  height: number;
  dispatch: (action: Action) => void;
  selectedColumn: number | null;
  onSelectColumn: (column: number) => void;
}

export const StepGraph = memo(function StepGraph({ pitch, propId, patternId, notes, pxPerBeat: px, beats, height, dispatch, selectedColumn, onSelectColumn }: Props) {
  const prop = stepPropById(propId);
  const cells = useMemo(() => stepCells(notes), [notes]);
  const ref = useRef<HTMLDivElement>(null);
  const pending = useRef<Map<number, number> | null>(null);
  const hover = useRef<HTMLSpanElement>(null);
  const say = useAnnounce();
  const hintId = useId();

  const bars = [...cells.values()].filter((c) => c.kind !== "tail");
  const isPitch = propId === "pitch";
  // Painting a pitch lands on a note the track offers (only the key's notes, whatever Snap says), never on a value V1 would not show.
  const allowed = useMemo(() => (isPitch ? pitchOptions(pitch.root, 0, pitch.slices, pitch.scale, true) : []), [isPitch, pitch.root, pitch.slices, pitch.scale]);
  const nearest = (v: number) => (allowed.length ? allowed.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)) : v);
  const text = (v: number) => (isPitch ? pitchLabel(v, pitch.root, pitch.slices, pitch.scale).replace(/^● /, "") : prop.format(v));
  const outOfKey = (v: number) => isPitch && pitch.slices === null && !isChromatic(pitch.scale) && !isOffsetInScale(pitch.scale, pitch.root, v);
  const frac = (v: number) => (v - prop.min) / (prop.max - prop.min);

  const valueAt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const raw = prop.min + (1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))) * (prop.max - prop.min);
    const q = Math.min(prop.max, Math.max(prop.min, Math.round(raw / prop.step) * prop.step));
    return isPitch ? nearest(q) : q;
  };
  const columnAt = (e: ReactPointerEvent<HTMLDivElement>) => Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / px);

  // Keyboard: Left/Right choose the previous / next step that has a note, Up/Down change its value (Shift = bigger steps).
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const onsets = bars.map((c) => c.column).sort((a, b) => a - b);
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (onsets.length === 0) return;
      e.preventDefault();
      const cur = selectedColumn ?? -1;
      const to = e.key === "ArrowRight" ? (onsets.find((c) => c > cur) ?? onsets[onsets.length - 1]) : ([...onsets].reverse().find((c) => c < cur) ?? onsets[0]);
      const cell = cells.get(to);
      onSelectColumn(to);
      if (cell) say(`Step ${to + 1}, ${prop.label} ${text(prop.read(cell.notes).value)}${cell.notes.length > 1 ? `, ${cell.notes.length} notes` : ""}`);
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && selectedColumn !== null) {
      const cell = cells.get(selectedColumn);
      if (!cell || cell.kind === "tail") return;
      e.preventDefault();
      const cur = prop.read(cell.notes).value;
      const dir = e.key === "ArrowUp" ? 1 : -1;
      let next: number;
      if (isPitch && allowed.length) {
        const sorted = [...allowed].sort((a, b) => a - b);
        next = dir > 0 ? (sorted.find((v) => v > cur) ?? sorted[sorted.length - 1]) : ([...sorted].reverse().find((v) => v < cur) ?? sorted[0]);
      } else next = Math.min(prop.max, Math.max(prop.min, cur + dir * prop.step * (e.shiftKey ? 10 : 1)));
      const action = writeStep(prop, patternId, cell.notes, next);
      if (action) dispatch(action);
      say(`${prop.label} ${text(next)}`);
    }
  };

  const paint = (e: ReactPointerEvent<HTMLDivElement>) => {
    const col = columnAt(e);
    const cell = cells.get(col);
    if (!cell || cell.kind === "tail" || !pending.current) return;
    const value = valueAt(e);
    pending.current.set(col, value);
    const bar = ref.current?.querySelector<HTMLElement>(`[data-col="${col}"]`);
    if (bar) {
      bar.style.height = `${Math.max(2, frac(value) * 100)}%`;
      bar.classList.remove("mixed");
    }
    if (hover.current) hover.current.textContent = `step ${col + 1} · ${prop.label.toLowerCase()} ${text(value)}`;
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pending.current = new Map();
    const col = columnAt(e);
    if (cells.get(col)?.kind !== "tail") onSelectColumn(col);
    paint(e);
  };
  const up = () => {
    const edits = pending.current;
    pending.current = null;
    if (!edits || edits.size === 0) return;
    const actions: Action[] = [];
    for (const [col, value] of edits) {
      const cell = cells.get(col);
      if (!cell) continue;
      const a = writeStep(prop, patternId, cell.notes, value);
      if (a) actions.push(a);
    }
    if (actions.length) dispatch(actions.length === 1 ? actions[0] : { type: "BATCH", actions });
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pending.current) paint(e);
    else if (hover.current) {
      const cell = cells.get(columnAt(e));
      hover.current.textContent = cell && cell.kind !== "tail" ? `step ${cell.column + 1} · ${prop.label.toLowerCase()} ${text(prop.read(cell.notes).value)}${cell.notes.length > 1 ? ` · ${cell.notes.length} notes` : ""}` : "";
    }
  };

  return (
    <div className="wx-graph">
      <div className="wx-graph-gutter" style={{ height: height + 16 }} aria-hidden="true" />
      <div className="wx-graph-body" style={{ height }}>
        <div
          ref={ref}
          className="wx-graph-plot"
          style={{ width: beats * px, ["--px" as string]: `${px}px` }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => { pending.current = null; }}
          tabIndex={0}
          onKeyDown={onKey}
          role="group"
          aria-roledescription="step graph"
          aria-label={`${prop.label} per step`}
          aria-describedby={hintId}
        >
          <span id={hintId} className="wx-sr-only">Left and Right choose a step that has a note. Up and Down change its {prop.label.toLowerCase()}, Shift for bigger steps.</span>
          {prop.min < 0 && <span className="wx-graph-zero" style={{ bottom: `${frac(0) * 100}%` }} />}
          {bars.map((cell) => {
            const v = prop.read(cell.notes);
            return (
              <span
                key={cell.column}
                data-col={cell.column}
                className={`wx-graph-bar ${v.mixed ? "mixed" : ""} ${outOfKey(v.value) ? "out" : ""} ${cell.column === selectedColumn ? "selected" : ""}`}
                style={{ left: cell.column * px, width: px - 2, height: `${Math.max(2, frac(v.value) * 100)}%` }}
              />
            );
          })}
        </div>
      </div>
      <span className="wx-graph-read" ref={hover} />
    </div>
  );
});
