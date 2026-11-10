// The Pattern workspace (default): the step lane, with an optional drawer under the selected track that goes
// Steps -> Graph (one property per step) -> Roll (individual notes) as depths of the same track (03 §1).
import { memo, useCallback, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BankBar } from "../../components/BankBar";
import { GRID_RESOLUTIONS, type GridResolution } from "../../model/notes";
import type { Action } from "../../model/reducer";
import { BANK_SIZE, type BankSummary } from "../../model/project";
import type { ProjectScale } from "../../model/scale";
import { totalBeats, notesForTrack, type Asset, type NoteId, type Pattern, type Track, type TrackId } from "../../model/types";
import { Icon } from "../kit/Icon";
import { Popover } from "../kit/Popover";
import { PanelHeader, tabPanelProps, type TabDef } from "../kit/PanelHeader";
import { Splitter } from "../kit/Splitter";
import { trackColor } from "../kit/TrackHeader";
import { PianoRoll, SNAPS, type ScrollSource } from "./PianoRoll";
import { StepChord } from "./StepChord";
import { AutomationLane, AUTOMATION_LANE_HEIGHT } from "../../components/AutomationLane";
import type { AutomationRowProps } from "../../components/AutomationRow";
import { rootMidiNote } from "../../model/instruments";
import { effectiveSampleMode, sliceCount } from "../../model/chop";
import type { NoteChord } from "../../model/chord";
import { StepGraph } from "./StepGraph";
import { STEP_PROPS, type StepPropId } from "./stepProps";
import { StepLane, type StepLaneHandlers, type StepSelection } from "./StepLane";
import type { CopiedRollNote } from "../../model/roll";
import { notesAtColumn } from "./stepView";

export type DrawerTab = StepPropId | "chord" | "auto" | "roll";
export interface DrawerState {
  open: boolean;
  tab: DrawerTab;
  height: number;
  maximised: boolean;
}
export const DEFAULT_DRAWER: DrawerState = { open: false, tab: "velocity", height: 170, maximised: false };

interface Props extends StepLaneHandlers {
  /** Width of the track-header column in px: the roll's left gutter matches it so beats line up with the lane. */
  headWidth: number;
  pattern: Pattern;
  tracks: Track[];
  bank: number;
  bankSummaries: BankSummary[];
  onSelectBank: (bank: number) => void;
  selectedTrack: Track | null;
  beatsPerBar: number;
  pxPerBeat: number;
  zoomPercent: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  gridResolution: GridResolution;
  onGridResolutionChange: (r: GridResolution) => void;
  loopingTrackIds: TrackId[];
  triggerDisabled: boolean;
  getPlayheadBeat: () => number | null;
  active: boolean;
  dispatch: (action: Action) => void;
  scale: ProjectScale;
  asset: Asset | null;
  onAudition: (midi: number, on: boolean) => void;
  drawer: DrawerState;
  onDrawer: (patch: Partial<DrawerState>) => void;
  step: StepSelection | null;
  onSelectStep: (sel: StepSelection | null) => void;
  onSelectNote: (id: NoteId | null) => void;
  /** The focused automation lane (set by clicking a parameter label in the device area), or null. */
  automationRow: AutomationRowProps | null;
  onSetNoteMode: (noteId: NoteId, mode: "note" | "chord") => void;
  onSetNoteChord: (noteId: NoteId, patch: Partial<NoteChord>) => void;
  /** The marker (a step of this pattern) or null, set from the ruler; "play from marker" starts the pattern there (or at step 1). */
  marker: number | null;
  onSetMarker: (beat: number | null) => void;
  onPlayFromMarker: () => void;
  /** Looping a number of steps from the playhead: the looped steps (null = off), how many, and the controls. */
  loop: { region: { start: number; end: number } | null; steps: number; onToggle: () => void; onSteps: (steps: number) => void };
}

const GRAPH_TABS: TabDef<DrawerTab>[] = [...STEP_PROPS.map((p) => ({ id: p.id as DrawerTab, label: p.label })), { id: "auto" as DrawerTab, label: "Auto", title: "Automation lane of the parameter you picked in the device area" }, { id: "chord" as DrawerTab, label: "Chord", title: "Note or chord for the selected step" }, { id: "roll", label: "Roll", title: "Piano roll: individual notes" }];

export const PatternWorkspace = memo(function PatternWorkspace(p: Props) {
  const { drawer, onDrawer, selectedTrack, pattern, dispatch } = p;
  const drawerId = useId();
  const beats = totalBeats(pattern, p.beatsPerBar);
  // The lane's horizontal scroll, shared with the roll (a tiny external store: no React state, so scrolling never re-renders).
  const scroll = useRef({ left: 0, subs: new Set<() => void>() });
  const scrollSource = useMemo<ScrollSource>(() => ({ get: () => scroll.current.left, subscribe: (cb) => { scroll.current.subs.add(cb); return () => { scroll.current.subs.delete(cb); }; } }), []);
  const onScrollLeft = useCallback((left: number) => { scroll.current.left = left; scroll.current.subs.forEach((cb) => cb()); }, []);
  // Maximised: the drawer leaves the lane and fills the workspace (a portal into this host).
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [rollSel, setRollSel] = useState<ReadonlySet<NoteId>>(new Set());
  const [rollSnap, setRollSnap] = useState(1);
  const [rollClip, setRollClip] = useState<CopiedRollNote[] | undefined>();
  const onRollSelection = useCallback((ids: NoteId[]) => setRollSel(new Set(ids)), []);
  const trackNotes = useMemo(() => (selectedTrack ? notesForTrack(pattern, selectedTrack.id) : []), [pattern, selectedTrack]);
  const index = selectedTrack ? p.tracks.findIndex((t) => t.id === selectedTrack.id) : -1;
  const trackIndex = index < 0 ? 0 : p.bank * BANK_SIZE + index;

  const tabs = useMemo(() => GRAPH_TABS.filter((t) => t.id === "roll" || t.id === "auto" || (t.id === "chord" ? !!selectedTrack && effectiveSampleMode(selectedTrack) !== "chop" : false) || !selectedTrack || STEP_PROPS.find((s) => s.id === t.id)?.applies(selectedTrack)), [selectedTrack]);
  const tab = tabs.some((t) => t.id === drawer.tab) ? drawer.tab : "velocity";

  const selectedColumn = p.step && selectedTrack && p.step.trackId === selectedTrack.id ? p.step.column : null;
  const selectColumn = useCallback((column: number) => {
    if (!selectedTrack) return;
    p.onSelectStep({ trackId: selectedTrack.id, column });
    const here = notesAtColumn(trackNotes, column);
    p.onSelectNote(here.length === 1 ? here[0].id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrack, trackNotes, p.onSelectStep, p.onSelectNote]);

  const drawerNode = drawer.open && selectedTrack ? (
    <div className={`wx-drawer ${drawer.maximised ? "maximised" : ""}`} style={{ ["--wx-drawer-h" as string]: `${drawer.height}px`, ["--identity" as string]: trackColor(trackIndex) } as CSSProperties}>
      <PanelHeader
        idBase={drawerId}
        title="GRAPH"
        subject={`${String(trackIndex + 1).padStart(2, "0")} ${selectedTrack.name}`}
        tabs={tabs}
        tab={tab}
        onTab={(t) => onDrawer({ tab: t })}
        maximised={drawer.maximised}
        onToggleMaximised={() => onDrawer({ maximised: !drawer.maximised })}
      />
      {tab === "roll" ? (
        <div className="wx-drawer-body roll" {...tabPanelProps(drawerId, tab)} style={{ height: drawer.maximised ? undefined : drawer.height + 150 }}>
          <PianoRoll
            linked={drawer.maximised ? undefined : { scroll: scrollSource, ppb: p.pxPerBeat, gutter: p.headWidth }}
            dispatch={dispatch}
            beatsPerBar={p.beatsPerBar}
            scale={p.scale}
            asset={p.asset}
            getPlayheadBeat={p.getPlayheadBeat}
            onAudition={p.onAudition}
            clip={{ id: `${pattern.id}:${selectedTrack.id}`, color: trackColor(trackIndex), start: 0 }}
            track={selectedTrack}
            pattern={pattern}
            selection={rollSel}
            onSelection={onRollSelection}
            snap={rollSnap}
            setSnap={setRollSnap}
            clipboard={rollClip}
            onCopy={setRollClip}
          />
        </div>
      ) : tab === "auto" ? (
        <div className="wx-drawer-body auto" {...tabPanelProps(drawerId, tab)}>
          {p.automationRow ? (
            <div className="wx-auto" style={{ paddingLeft: "var(--wx-head-w)" }}>
              <div className="wx-auto-label"><span>{p.automationRow.label}</span><button className="wx-btn" onClick={p.automationRow.onClose} title="Hide the lane (the automation keeps playing)">Close</button></div>
              <div style={{ width: beats * p.pxPerBeat }}>
                <AutomationLane lane={p.automationRow.lane} paramDef={p.automationRow.paramDef} totalBeats={beats} beatsPerBar={p.beatsPerBar} pxPerBeat={p.pxPerBeat} height={AUTOMATION_LANE_HEIGHT} visibleStart={0} visibleEnd={beats} onSetPoint={p.automationRow.onSetPoint} onRemovePoint={p.automationRow.onRemovePoint} />
              </div>
            </div>
          ) : (
            <div className="wx-drawer-hint">Click a parameter's name in the Instrument or FX panel below to draw its automation here.</div>
          )}
        </div>
      ) : tab === "chord" ? (
        <div className="wx-drawer-body chord" {...tabPanelProps(drawerId, tab)}>
          <StepChord
            notes={selectedColumn === null ? [] : notesAtColumn(trackNotes, selectedColumn)}
            root={rootMidiNote(selectedTrack)}
            scale={p.scale}
            onSetNoteMode={p.onSetNoteMode}
            onSetNoteChord={p.onSetNoteChord}
            onRemoveNote={(id) => p.onRemoveNotes([id])}
            onExplode={(noteId) => dispatch({ type: "EXPLODE_CHORD", patternId: pattern.id, noteId })}
            onOpenRoll={() => onDrawer({ tab: "roll" })}
          />
        </div>
      ) : (
        <div className="wx-drawer-body" {...tabPanelProps(drawerId, tab)}>
          <StepGraph
            pitch={{ root: rootMidiNote(selectedTrack), slices: effectiveSampleMode(selectedTrack) === "chop" ? Math.max(1, sliceCount(p.asset)) : null, scale: p.scale }}
            propId={tab as StepPropId}
            patternId={pattern.id}
            notes={trackNotes}
            pxPerBeat={p.pxPerBeat}
            beats={beats}
            height={drawer.maximised ? Math.round(window.innerHeight * 0.5) : drawer.height}
            dispatch={dispatch}
            selectedColumn={selectedColumn}
            onSelectColumn={selectColumn}
          />
        </div>
      )}
      {tab !== "roll" && tab !== "chord" && tab !== "auto" && !drawer.maximised && <Splitter axis="row" shellRef={{ current: null }} cssVar="--wx-drawer-h" value={drawer.height} min={80} max={360} direction={1} onCommit={(height) => onDrawer({ height })} label="Resize graph" />}
    </div>
  ) : null;

  return (
    <div className="wx-pattern">
      <div className="wx-toolbar">
        <BankBar activeBank={p.bank} summaries={p.bankSummaries} onSelect={p.onSelectBank} variant="corner" />
        <label className="wx-field">
          <span>Snap</span>
          <select value={p.gridResolution} onChange={(e) => p.onGridResolutionChange(Number(e.target.value) as GridResolution)} aria-label="Grid snap">
            {GRID_RESOLUTIONS.map((r) => (
              <option key={r} value={r}>{r === 1 ? "1 step" : `1/${1 / r} step`}</option>
            ))}
          </select>
        </label>
        <div className="wx-segment" role="group" aria-label="Zoom">
          <button onClick={p.onZoomOut} disabled={!p.canZoomOut} aria-label="Zoom out" title="Zoom out">−</button>
          <span className="wx-zoom">{p.zoomPercent}%</span>
          <button onClick={p.onZoomIn} disabled={!p.canZoomIn} aria-label="Zoom in" title="Zoom in">+</button>
        </div>
        <div className="wx-toolbar-group" role="group" aria-label="Play and loop">
          <button className="wx-icon-btn" onClick={p.onPlayFromMarker} aria-label="Play from marker" title={p.marker === null ? "Play this pattern from its start (click the ruler to set a marker and start anywhere)" : `Play from the marker (step ${p.marker + 1})`}><Icon name="playFrom" /></button>
          <button className="wx-icon-btn" onClick={p.loop.onToggle} aria-pressed={p.loop.region !== null} aria-label="Loop steps" title={p.loop.region ? "Looping: click to play on through the pattern" : `Loop ${p.loop.steps} steps from the playhead (or the marker, when stopped)`}><Icon name="loop" /></button>
          <Popover label="Loop length" title={`Loop length: ${p.loop.steps} steps`} className="wx-icon-btn wx-loop-len" trigger={<span>{p.loop.steps}</span>}>
            {(close) => (
              <div className="wx-loop-len-panel">
                <label className="wx-popover-field">
                  <span>Steps</span>
                  <input type="number" min={1} max={beats} value={p.loop.steps} onChange={(e) => p.loop.onSteps(Number(e.target.value))} aria-label="Loop length in steps" />
                </label>
                <div className="wx-loop-presets" role="group" aria-label="Loop length presets">
                  {[...new Set([1, 2, 4, 8, p.beatsPerBar, p.beatsPerBar * 2])].filter((n) => n <= beats).sort((a, b) => a - b).map((n) => (
                    <button key={n} className={`wx-btn ${p.loop.steps === n ? "active" : ""}`} onClick={() => { p.loop.onSteps(n); close(); }} title={n === p.beatsPerBar ? "One bar" : `${n} steps`}>{n}</button>
                  ))}
                </div>
              </div>
            )}
          </Popover>
        </div>
        <button className="wx-icon-btn" onClick={() => onDrawer({ open: !drawer.open })} aria-pressed={drawer.open} aria-label="Graph editor" title="Graph editor under the selected track: show or hide (G)"><Icon name="graph" /></button>
        <span className="wx-spacer" />
        <span className="wx-note hint">click adds / removes · drag moves · edge resizes · alt = free · ⋮ = several notes (select, then Roll) · ruler = marker</span>
      </div>
      <StepLane
        tracks={p.tracks}
        trackOffset={p.bank * BANK_SIZE}
        pattern={pattern}
        beatsPerBar={p.beatsPerBar}
        pxPerBeat={p.pxPerBeat}
        selectedTrackId={selectedTrack?.id ?? null}
        step={p.step}
        loopingTrackIds={p.loopingTrackIds}
        triggerDisabled={p.triggerDisabled}
        getPlayheadBeat={p.getPlayheadBeat}
        active={p.active}
        drawerFor={drawer.maximised ? null : (selectedTrack?.id ?? null)}
        drawer={drawerNode}
        onScrollLeft={onScrollLeft}
        marker={p.marker}
        onSetMarker={p.onSetMarker}
        loopRegion={p.loop.region}
        onClearSelection={() => p.onSelectStep(null)}
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
      <div className={`wx-maximise-host ${drawer.open && drawer.maximised ? "on" : ""}`} ref={setHost} />
      {drawer.open && drawer.maximised && host && drawerNode && createPortal(drawerNode, host)}
    </div>
  );
});

export { SNAPS };
