// The Composer's view state and behaviour: what is selected on the timeline, the copy buffer, and every handler the
// Composer toolbar, the lane headers and the Edit panel's Composer group call. The song itself (lanes, sequences) is the
// project (model/composer.ts); this holds only UI state, and every edit is a project action. App.tsx passes in the few
// things it owns that the Composer has to drive: pattern selection, the view, the FX target and the transport.
import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import type { Action } from "../model/reducer";
import { allSequences, canInsertAt, composerLanes, copySequence, laneById, laneEnd, laneOfSequence, sequenceBars, sequenceById, sequenceForPattern, type SequenceClip } from "../model/composer";
import type { PlaybackSource } from "../model/composer";
import { totalBeats, type LaneId, type LaneModifiers, type Pattern, type PatternId, type Project, type SequenceId } from "../model/types";
import type { LoopRegion } from "../audio/transport";
import type { ComposerToolbarProps } from "../components/ComposerTimeline";
import type { ComposerDetailsProps } from "../components/ComposerDetails";
import type { MainView } from "./layout";

interface Deps {
  project: Project;
  dispatch: Dispatch<Action>;
  launcher: Pattern[];
  selectedPatternId: PatternId;
  setSelectedPatternId: (id: PatternId) => void;
  setMainView: (view: MainView) => void;
  /** Called when a sequence is opened in the Sequencer, so Play there plays its pattern. */
  makePlayable: (patternId: PatternId) => void;
  /** Starts the song from `beat` (switching the transport to Song mode). */
  playSongFrom: (beat: number) => void;
  /** The loop Play is set to (or null), and the way to set it: a region switches Play to `source` first. */
  loop: LoopRegion | null;
  setLoop: (source: PlaybackSource, region: LoopRegion | null) => void;
}

export function useComposer({ project, dispatch, launcher, selectedPatternId, setSelectedPatternId, setMainView, makePlayable, playSongFrom, loop, setLoop }: Deps) {
  const [selectedSequenceId, setSelectedSequenceId] = useState<SequenceId | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<LaneId | null>(null);
  const [clip, setClip] = useState<SequenceClip | null>(null);
  /** The timeline's horizontal scroll, kept here because the view unmounts while the Sequencer shows. */
  const scrollMemory = useRef(0);
  const bpb = project.beatsPerBar;
  /** The marker: a position on the song (in beats), separate from the playhead. The Arrange ruler sets it on a bar line and the
   * Pattern workspace's ruler on a step, and both show it: the Pattern workspace sees it relative to the sequence it is editing.
   * Where "From here" starts and (rounded down to its bar) where New sequence, Paste and Add pattern insert; null = not set (inserts go
   * to the end of the lane, From here uses the selected sequence). */
  const [markerBeat, setMarkerBeat] = useState<number | null>(null);
  const marker = markerBeat === null ? null : markerBeat / bpb; // in bars: fractional when set mid-bar from the Pattern workspace
  const markerBar = markerBeat === null ? null : Math.floor(markerBeat / bpb);
  const setMarker = useCallback((bar: number | null) => setMarkerBeat(bar === null ? null : bar * bpb), [bpb]);
  /** A marker set on a pattern that is not on the Arrangement (so there is no song position for it). */
  const [looseMarker, setLooseMarker] = useState<{ patternId: PatternId; beat: number } | null>(null);

  const sequence = sequenceById(project, selectedSequenceId);
  const lane = laneById(project, sequence ? (laneOfSequence(project, sequence.id)?.id ?? null) : selectedLaneId);
  /** The sequence "Edit Sequence" opened in the Sequencer (while it is still on that pattern), else any sequence playing the edited
   * pattern: it is what "back to Composer" returns to. */
  const [openedSequenceId, setOpenedSequenceId] = useState<SequenceId | null>(null);
  const opened = sequenceById(project, openedSequenceId);
  const editingSequence = opened?.patternId === selectedPatternId ? opened : sequenceForPattern(project, selectedPatternId);

  const selectSequence = useCallback(
    (id: SequenceId) => {
      const seq = sequenceById(project, id);
      const owner = laneOfSequence(project, id);
      if (!seq || !owner) return;
      setSelectedSequenceId(id);
      setSelectedLaneId(owner.id);
      setSelectedPatternId(seq.patternId); // the grid, instrument and dock follow the sequence's pattern
    },
    [project, setSelectedPatternId],
  );

  const selectLane = useCallback(
    (id: LaneId | null) => {
      setSelectedLaneId(id);
      if (id === null) {
        setSelectedSequenceId(null);
        return;
      }
      // Clicking a lane that holds the selected sequence keeps it; any other lane clears the sequence.
      if (selectedSequenceId !== null && laneOfSequence(project, selectedSequenceId)?.id !== id) setSelectedSequenceId(null);
    },
    [project, selectedSequenceId],
  );

  // A sequence appeared on the timeline (added, placed from the Patterns page, duplicated, pasted): it becomes the selected one.
  // Several at once is a project being loaded, not an edit.
  const sequenceIds = allSequences(project).map((e) => e.seq.id);
  const prevSequenceIds = useRef(sequenceIds);
  useEffect(() => {
    const added = sequenceIds.filter((id) => !prevSequenceIds.current.includes(id));
    prevSequenceIds.current = sequenceIds;
    if (added.length === 1) selectSequence(added[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequenceIds.join(",")]);

  // A freshly added, empty lane becomes the selected one (a lane created along with its first sequence is left to
  // onPatternAdded, which selects that sequence and so its lane).
  const laneIds = composerLanes(project).map((l) => l.id);
  const prevLaneIds = useRef(laneIds);
  useEffect(() => {
    const added = laneIds.find((id) => !prevLaneIds.current.includes(id));
    prevLaneIds.current = laneIds;
    if (added && (laneById(project, added)?.sequences.length ?? 0) === 0) {
      setSelectedSequenceId(null);
      setSelectedLaneId(added);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laneIds.join(",")]);

  const edit = useCallback(() => {
    if (!sequence) return;
    setSelectedPatternId(sequence.patternId);
    setOpenedSequenceId(sequence.id);
    makePlayable(sequence.patternId);
    setMainView("sequencer");
  }, [sequence, setSelectedPatternId, setMainView, makePlayable]);

  const returnToComposer = useCallback(() => {
    if (editingSequence) selectSequence(editingSequence.id);
    setMainView("composer");
  }, [editingSequence, selectSequence, setMainView]);

  const removeSequence = useCallback(() => {
    if (!sequence) return;
    dispatch({ type: "COMPOSER_REMOVE", sequenceId: sequence.id });
    setSelectedSequenceId(null);
  }, [sequence, dispatch]);

  // Inserting at the marker is allowed only where the new sequence fits on the lane (the marker is in a gap, or at a sequence's end
  // with room after it). Where it does not, the action is off, not moved elsewhere. Afterwards the marker moves to the end of
  // what was inserted, so the next insert chains onto it.
  const fits = (bars: number) => markerBar === null || canInsertAt(project, lane?.id, markerBar, bars);
  const blockedReason = "The marker is on a sequence, or too close to the next one: move it to a free bar";
  const insertedAt = (bars: number) => {
    if (markerBar !== null) setMarkerBeat((markerBar + bars) * bpb);
  };

  // The Pattern workspace's marker: the song marker as a step of the edited pattern when it falls inside the sequence being edited.
  const editedPattern = project.patterns.find((p) => p.id === selectedPatternId);
  const patternBeats = editedPattern ? totalBeats(editedPattern, bpb) : 0;
  const origin = editingSequence ? editingSequence.start * bpb : null;
  const patternMarker =
    origin !== null
      ? markerBeat !== null && markerBeat >= origin && markerBeat < origin + patternBeats ? markerBeat - origin : null
      : looseMarker?.patternId === selectedPatternId ? looseMarker.beat : null;
  const setPatternMarker = useCallback(
    (beat: number | null) => {
      if (origin !== null) setMarkerBeat(beat === null ? null : origin + beat);
      else setLooseMarker(beat === null ? null : { patternId: selectedPatternId, beat });
    },
    [origin, selectedPatternId],
  );

  // Loop the selected sequence. The loop follows the selection (and a resize of it) while it is on.
  const songLoop = loop !== null && loop.patternId === undefined;
  const sequenceRegion: LoopRegion | null = sequence ? { start: sequence.start * bpb, end: (sequence.start + sequenceBars(project, sequence)) * bpb } : null;
  useEffect(() => {
    if (!songLoop || !sequenceRegion || (loop.start === sequenceRegion.start && loop.end === sequenceRegion.end)) return;
    setLoop("song", sequenceRegion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequenceRegion?.start, sequenceRegion?.end]);

  const toolbar: ComposerToolbarProps = {
    hasSelection: sequence !== undefined,
    hasMarker: markerBeat !== null,
    looping: songLoop,
    canLoop: songLoop || sequenceRegion !== null,
    onToggleLoop: () => {
      if (songLoop) setLoop("song", null);
      else if (sequenceRegion) setLoop("song", sequenceRegion);
    },
    canNewSequence: fits(1),
    canPaste: clip !== null && fits(clip.bars),
    blockedReason,
    onNewSequence: () => {
      dispatch({ type: "COMPOSER_ADD_BLANK", laneId: lane?.id, at: markerBar ?? undefined });
      insertedAt(1);
    },
    onAddLane: () => dispatch({ type: "COMPOSER_ADD_LANE" }),
    onDuplicate: () => sequence && dispatch({ type: "COMPOSER_DUPLICATE", sequenceId: sequence.id }),
    onCopy: () => sequence && setClip(copySequence(project, sequence.id)),
    onPaste: () => {
      if (!clip) return;
      if (markerBar !== null) dispatch({ type: "COMPOSER_PASTE", clip, laneId: lane?.id, at: markerBar, exact: true });
      else dispatch({ type: "COMPOSER_PASTE", clip, laneId: lane?.id, at: sequence ? sequence.start : laneEnd(project, lane) });
      insertedAt(clip.bars);
    },
    onDelete: removeSequence,
    onEdit: edit,
    onPlayFromHere: () => {
      if (markerBeat !== null) playSongFrom(markerBeat);
      else if (sequence) playSongFrom(sequence.start * bpb);
    },
  };

  const details: ComposerDetailsProps = {
    project,
    sequence,
    lane,
    launcher,
    onRename: (name: string) => sequence && dispatch({ type: "RENAME_PATTERN", patternId: sequence.patternId, name }),
    onResize: (bars: number) => sequence && dispatch({ type: "COMPOSER_RESIZE", sequenceId: sequence.id, bars }),
    onColor: (color: string) => sequence && dispatch({ type: "COMPOSER_SET_COLOR", sequenceId: sequence.id, color }),
    canInsertBars: fits,
    blockedReason,
    onAddPattern: (patternId: PatternId) => {
      dispatch({ type: "COMPOSER_ADD_PATTERN", patternId, laneId: lane?.id, at: markerBar ?? undefined });
      insertedAt(launcher.find((p) => p.id === patternId)?.bars ?? 1);
    },
    actions: toolbar,
    onSetLaneModifiers: (patch: Partial<LaneModifiers>) => lane && dispatch({ type: "COMPOSER_SET_LANE_MODIFIERS", laneId: lane.id, patch }),
  };

  const laneHandlers = {
    onRenameLane: (id: LaneId, name: string) => dispatch({ type: "COMPOSER_RENAME_LANE", laneId: id, name }),
    onMoveLane: (id: LaneId, index: number) => dispatch({ type: "COMPOSER_MOVE_LANE", laneId: id, index }),
    onRemoveLane: (id: LaneId) => {
      dispatch({ type: "COMPOSER_REMOVE_LANE", laneId: id });
      if (lane?.id === id) {
        setSelectedLaneId(null);
        setSelectedSequenceId(null);
      }
    },
  };

  return {
    sequence,
    lane,
    editingSequence,
    scrollMemory,
    marker,
    setMarker,
    patternMarker,
    setPatternMarker,
    /** The looped stretch of the Arrangement in bars, or null. */
    loopRegion: songLoop ? { start: loop.start / bpb, end: loop.end / bpb } : null,
    selectSequence,
    selectLane,
    returnToComposer,
    toolbar,
    details,
    laneHandlers,
    onMove: (id: SequenceId, start: number, laneId: LaneId) => dispatch({ type: "COMPOSER_MOVE", sequenceId: id, start, laneId }),
    onResize: (id: SequenceId, bars: number) => dispatch({ type: "COMPOSER_RESIZE", sequenceId: id, bars }),
  };
}
