// The step lane: every track of the bank side by side, one row each (docs/rebuild/04-ui-rules.md, wireframe 1). Cells are a
// derived view of the notes (stepView.ts): only occupied steps and note tails are DOM; the grid itself is a CSS background and
// empty steps are hit-tested by arithmetic, so a 64-bar pattern costs the same as a 1-bar one. Rows are memoised on the
// track's notes (useStableTrackNotes), so editing one track re-renders one row. The playhead is a transform-only element.
import { memo, useCallback, useId, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { usePlayheadAnimation } from "../../hooks/usePlayheadAnimation";
import { useStableTrackNotes } from "../../hooks/useStableTrackNotes";
import { effectiveSampleMode } from "../../model/chop";
import { isTrackOffInPattern } from "../../model/patternSettings";
import { totalBeats, type Note, type NoteId, type Pattern, type Track, type TrackId } from "../../model/types";
import { TrackHeader, trackColor } from "../kit/TrackHeader";
import { useAnnounce } from "../kit/a11y";
import { columnOf, notesAtColumn, stepCells } from "./stepView";

/** Width of the sticky track-header column: a CSS variable (--wx-head-w) so a phone can narrow it without JS. */
const HEAD = "var(--wx-head-w)";
const HANDLE_PX = 7;

export interface StepSelection {
  trackId: TrackId;
  column: number;
}

export interface StepLaneHandlers {
  onSelectTrack: (id: TrackId) => void;
  onSelectStep: (sel: StepSelection | null) => void;
  onAddNote: (trackId: TrackId, start: number) => void;
  onRemoveNotes: (noteIds: NoteId[]) => void;
  onResizeNote: (noteId: NoteId, duration: number, free: boolean) => void;
  onMoveNote: (noteId: NoteId, start: number, free: boolean) => void;
  onMute: (id: TrackId, muted: boolean) => void;
  onSolo: (id: TrackId, soloed: boolean) => void;
  onNotesOff: (id: TrackId, off: boolean) => void;
  onTrigger: (id: TrackId) => void;
}

interface RowProps extends StepLaneHandlers {
  track: Track;
  index: number;
  notes: Note[];
  pattern: Pattern;
  selected: boolean;
  /** The selected step's column when it is on this row, else null (so other rows' props do not change). */
  selectedColumn: number | null;
  looping: boolean;
  triggerDisabled: boolean;
  pxPerBeat: number;
  beats: number;
  beatsPerBar: number;
}

type RowDrag =
  | { kind: "resize"; noteId: NoteId; start: number; x0: number; el: HTMLElement; duration: number }
  | { kind: "move"; noteId: NoteId; start: number; x0: number; el: HTMLElement; startNew: number; moved: boolean }
  | { kind: "press"; column: number; x0: number; moved: boolean };

const StepRow = memo(function StepRow(p: RowProps) {
  const { track, notes, pxPerBeat: px } = p;
  const cells = useMemo(() => stepCells(notes), [notes]);
  const drag = useRef<RowDrag | null>(null);
  const source = track.instrument ? "synth" : track.assetId != null ? (effectiveSampleMode(track) === "chop" ? "chop" : "sample") : "empty";

  const columnAt = (e: ReactPointerEvent) => Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / px);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    p.onSelectTrack(track.id);
    const target = e.target as HTMLElement;
    const noteId = target.dataset.note;
    const mode = target.dataset.hit;
    const col = columnAt(e);
    if (noteId && mode === "resize") {
      const n = notes.find((x) => x.id === noteId);
      if (!n) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { kind: "resize", noteId, start: n.start, x0: e.clientX, el: target.parentElement as HTMLElement, duration: n.duration };
      return;
    }
    const cell = cells.get(col);
    if (cell?.kind === "single" && noteId) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { kind: "move", noteId, start: cell.notes[0].start, x0: e.clientX, el: target.closest<HTMLElement>(".wx-pad") ?? target, startNew: cell.notes[0].start, moved: false };
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind: "press", column: col, x0: e.clientX, moved: false };
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (d.kind === "resize") {
      const duration = Math.max(1, Math.round(d.duration + dx / px));
      d.el.style.setProperty("--len", String(duration));
    } else if (d.kind === "move") {
      if (!d.moved && Math.abs(dx) < 4) return;
      d.moved = true;
      const delta = Math.round(dx / px);
      d.startNew = Math.max(0, d.start + delta);
      d.el.style.transform = `translateX(${(d.startNew - d.start) * px}px)`;
    } else if (Math.abs(dx) > 4) d.moved = true;
  };

  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const free = e.altKey;
    if (d.kind === "resize") {
      const duration = Math.max(1, Math.round(d.duration + (e.clientX - d.x0) / px));
      d.el.style.removeProperty("--len");
      if (duration !== d.duration) p.onResizeNote(d.noteId, duration, free);
    } else if (d.kind === "move") {
      d.el.style.transform = "";
      if (d.moved) {
        if (d.startNew !== d.start) p.onMoveNote(d.noteId, d.startNew, free);
      } else toggleAt(columnOfNote(d.start));
    } else if (!d.moved) toggleAt(d.column);
  };

  const columnOfNote = (start: number) => Math.floor(start + 1 / 128);

  // Click semantics (03 §3): empty adds; single removes (V1's one-click toggle); multi selects and never deletes; tail selects its owner.
  const toggleAt = (col: number) => {
    if (col < 0 || col >= p.beats) return;
    const cell = cells.get(col);
    if (!cell) {
      p.onAddNote(track.id, col);
      p.onSelectStep({ trackId: track.id, column: col });
    } else if (cell.kind === "single") {
      p.onRemoveNotes([cell.notes[0].id]);
      p.onSelectStep(null);
    } else if (cell.kind === "multi") p.onSelectStep({ trackId: track.id, column: col });
    else if (cell.tailOf) p.onSelectStep({ trackId: track.id, column: columnOf(cell.tailOf.start) });
  };

  const pads: ReactNode[] = [];
  for (const cell of cells.values()) {
    if (cell.kind === "tail") continue;
    const note = cell.notes[0];
    const len = Math.max(1, ...cell.notes.map((n) => n.duration));
    const selectedPad = p.selectedColumn === cell.column;
    const vel = Math.max(...cell.notes.map((n) => n.velocity));
    pads.push(
      <div
        key={cell.column}
        className={`wx-pad ${cell.kind} ${selectedPad ? "selected" : ""}`}
        style={{ left: cell.column * px, ["--len" as string]: len, ["--vel" as string]: vel, width: `calc(var(--len) * ${px}px - 1px)` }}
        data-count={cell.notes.length > 1 ? cell.notes.length : undefined}
        title={cell.kind === "multi" ? `${cell.notes.length} notes: select, then open the piano roll` : undefined}
      >
        <span className="wx-pad-body" data-note={note.id} data-hit="body" style={{ width: px - 1 }} />
        {cell.pips.length > 0 && (
          <span className="wx-pips" aria-hidden>
            {cell.pips.slice(0, 2).map((pip) => (
              <i key={pip} className={`wx-pip ${pip}`}>{pip === "ratchet" ? `÷${Math.max(...cell.notes.map((n) => n.ratchet ?? 1))}` : pip === "tie" ? "⌒" : pip === "lfo" ? "~" : pip === "pitch" ? "↕" : "·"}</i>
            ))}
          </span>
        )}
        {cell.kind === "single" && <span className="wx-resize" data-note={note.id} data-hit="resize" style={{ width: HANDLE_PX }} />}
      </div>,
    );
  }

  // Keyboard cursor on a step with no note (an occupied step is outlined by its pad). Visible only while the lane has keyboard focus.
  if (p.selectedColumn !== null && !cells.has(p.selectedColumn)) pads.push(<span key="cursor" className="wx-cursor" style={{ left: p.selectedColumn * px, width: px - 1 }} aria-hidden />);

  const label = trackHasSourceLabel(track);
  return (
    <div className={`wx-row ${p.selected ? "selected" : ""} ${isTrackOffInPattern(p.pattern, track.id) ? "notes-off" : ""}`} style={{ ["--identity" as string]: trackColor(p.index) }}>
      <div className="wx-row-head" style={{ width: HEAD }}>
        <TrackHeader
          id={track.id}
          index={p.index}
          name={label}
          source={source}
          selected={p.selected}
          muted={track.muted}
          soloed={track.soloed}
          notesOff={isTrackOffInPattern(p.pattern, track.id)}
          looping={p.looping}
          triggerDisabled={p.triggerDisabled}
          onSelect={p.onSelectTrack}
          onMute={p.onMute}
          onSolo={p.onSolo}
          onNotesOff={p.onNotesOff}
          onTrigger={p.onTrigger}
        />
      </div>
      <div
        className="wx-cells"
        style={{ width: p.beats * px, ["--px" as string]: `${px}px`, ["--bar" as string]: `${p.beatsPerBar * px}px`, ["--group" as string]: `${4 * px}px` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { drag.current = null; }}
      >
        {p.selected && source === "empty" && notes.length === 0 && <span className="wx-empty-hint">No sound: pick an instrument or assign a sample in the device area</span>}
        {pads}
      </div>
    </div>
  );
});

const trackHasSourceLabel = (t: Track) => (t.instrument || t.assetId != null ? t.name : "— empty —");

interface LaneProps extends StepLaneHandlers {
  tracks: Track[];
  trackOffset: number;
  pattern: Pattern;
  beatsPerBar: number;
  pxPerBeat: number;
  selectedTrackId: TrackId | null;
  step: StepSelection | null;
  loopingTrackIds: TrackId[];
  triggerDisabled: boolean;
  getPlayheadBeat: () => number | null;
  active: boolean;
  /** Rendered directly under the selected track's row (the step graph / piano roll drawer). */
  drawerFor: TrackId | null;
  drawer: ReactNode;
  onClearSelection: () => void;
  /** Receives the lane's horizontal scroll so the roll can share its time axis. */
  onScrollLeft?: (left: number) => void;
}

export const StepLane = memo(function StepLane(p: LaneProps) {
  const beats = totalBeats(p.pattern, p.beatsPerBar);
  const notesByTrack = useStableTrackNotes(p.pattern, p.tracks);
  const playhead = usePlayheadAnimation(p.getPlayheadBeat, p.pxPerBeat, p.active);
  const say = useAnnounce();
  const hintId = useId();
  /** "Track 03, Snare, step 5, 2 notes": what the keyboard cursor is on. */
  const describe = (trackId: TrackId, column: number) => {
    const i = p.tracks.findIndex((t) => t.id === trackId);
    const t = p.tracks[i];
    if (!t) return "";
    const here = notesAtColumn(notesByTrack.get(trackId) ?? [], column);
    const what = here.length === 0 ? "empty" : here.length === 1 ? (here[0].chord ? "chord" : here[0].duration > 1 ? `note, length ${here[0].duration} steps` : "note") : `${here.length} notes`;
    return `Track ${String(p.trackOffset + i + 1).padStart(2, "0")}, ${t.instrument || t.assetId != null ? t.name : "empty track"}, step ${column + 1}, ${what}`;
  };
  const bars = Math.ceil(beats / p.beatsPerBar);
  const { onRemoveNotes, step, pattern, onSelectStep } = p;

  const keys = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Only keys pressed on the lane itself: the graph, the roll and the track buttons are inside it and handle their own keys.
    if (e.target !== e.currentTarget) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const idx = Math.max(0, p.tracks.findIndex((t) => t.id === (step?.trackId ?? p.selectedTrackId)));
    const trackId = p.tracks[idx]?.id;
    if (!trackId) return;
    const col = step?.column ?? 0;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const column = Math.max(0, Math.min(beats - 1, col + (e.key === "ArrowRight" ? 1 : -1)));
      onSelectStep({ trackId, column });
      say(describe(trackId, column));
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = p.tracks[Math.max(0, Math.min(p.tracks.length - 1, idx + (e.key === "ArrowDown" ? 1 : -1)))];
      p.onSelectTrack(next.id);
      onSelectStep({ trackId: next.id, column: col });
      say(describe(next.id, col));
    } else if (e.key === "Enter" && step) {
      e.preventDefault();
      const here = notesAtColumn(notesByTrack.get(step.trackId) ?? [], step.column);
      if (here.length === 0) { p.onAddNote(step.trackId, step.column); say(`Step ${step.column + 1} on`); }
      else if (here.length === 1) { onRemoveNotes([here[0].id]); say(`Step ${step.column + 1} off`); }
      else say(`${here.length} notes at step ${step.column + 1}. Press Delete to remove them, or open the piano roll.`);
    } else if ((e.key === "Delete" || e.key === "Backspace") && step) {
      // The controller's own Delete would clear the whole track when no single note is selected; a step delete never escalates.
      e.preventDefault();
      e.stopPropagation();
      const gone = notesAtColumn(notesByTrack.get(step.trackId) ?? [], step.column).map((n) => n.id);
      onRemoveNotes(gone);
      say(gone.length === 0 ? `Step ${step.column + 1} is empty` : `Removed ${gone.length} note${gone.length === 1 ? "" : "s"} at step ${step.column + 1}`);
    } else if (e.key === "Escape") {
      p.onClearSelection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.tracks, p.selectedTrackId, step, beats, notesByTrack, onRemoveNotes, onSelectStep, pattern, p.onAddNote, p.onSelectTrack, p.onClearSelection, say]);

  const ruler = useMemo(() => {
    const marks: ReactNode[] = [];
    for (let b = 0; b < bars; b++) marks.push(<span key={b} className="wx-ruler-bar" style={{ left: b * p.beatsPerBar * p.pxPerBeat, width: p.beatsPerBar * p.pxPerBeat }}>{b + 1}</span>);
    return marks;
  }, [bars, p.beatsPerBar, p.pxPerBeat]);

  return (
    <div className="wx-lane" tabIndex={0} onKeyDown={keys} onScroll={(e) => p.onScrollLeft?.(e.currentTarget.scrollLeft)} aria-label="Step sequencer" role="group" aria-roledescription="step sequencer" aria-describedby={hintId}>
      <span id={hintId} className="wx-sr-only">Arrow keys move the step cursor between steps and tracks. Enter adds or removes a note. Delete removes the notes at the cursor. Press G to open the graph for the selected track.</span>
      <div className="wx-lane-inner" style={{ width: `calc(${HEAD} + ${beats * p.pxPerBeat}px)` }}>
        <div className="wx-ruler">
          <div className="wx-ruler-corner" style={{ width: HEAD }} />
          <div className="wx-ruler-track" style={{ width: beats * p.pxPerBeat }}>{ruler}</div>
        </div>
        {p.tracks.map((track, i) => (
          <div key={track.id} className="wx-row-group">
            <StepRow
              track={track}
              index={p.trackOffset + i}
              notes={notesByTrack.get(track.id) ?? []}
              pattern={p.pattern}
              selected={track.id === p.selectedTrackId}
              selectedColumn={step?.trackId === track.id ? step.column : null}
              looping={p.loopingTrackIds.includes(track.id)}
              triggerDisabled={p.triggerDisabled}
              pxPerBeat={p.pxPerBeat}
              beats={beats}
              beatsPerBar={p.beatsPerBar}
              onSelectTrack={p.onSelectTrack}
              onSelectStep={p.onSelectStep}
              onAddNote={p.onAddNote}
              onRemoveNotes={p.onRemoveNotes}
              onResizeNote={p.onResizeNote}
              onMoveNote={p.onMoveNote}
              onMute={p.onMute}
              onSolo={p.onSolo}
              onNotesOff={p.onNotesOff}
              onTrigger={p.onTrigger}
            />
            {p.drawerFor === track.id && p.drawer}
          </div>
        ))}
        <div className="wx-playhead-layer" style={{ left: HEAD }}>
          <div className="wx-playhead" ref={playhead} style={{ display: "none" }} />
        </div>
      </div>
    </div>
  );
});
