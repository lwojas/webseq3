// The Pattern workspace (default): the step lane, with an optional drawer under the selected track that goes
// Steps -> Graph (one property per step) -> Roll (individual notes) as depths of the same track (03 §1).
import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BankBar } from "../../components/BankBar";
import { GRID_RESOLUTIONS, type GridResolution } from "../../model/notes";
import type { Action } from "../../model/reducer";
import { BANK_SIZE, type BankSummary } from "../../model/project";
import type { ProjectScale } from "../../model/scale";
import { totalBeats, notesForTrack, type Asset, type NoteId, type Pattern, type Track, type TrackId } from "../../model/types";
import { Icon } from "../kit/Icon";
import { PanelHeader, type TabDef } from "../kit/PanelHeader";
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
}

const GRAPH_TABS: TabDef<DrawerTab>[] = [...STEP_PROPS.map((p) => ({ id: p.id as DrawerTab, label: p.label })), { id: "auto" as DrawerTab, label: "Auto", title: "Automation lane of the parameter you picked in the device area" }, { id: "chord" as DrawerTab, label: "Chord", title: "Note or chord for the selected step" }, { id: "roll", label: "Roll", title: "Piano roll: individual notes" }];

export const PatternWorkspace = memo(function PatternWorkspace(p: Props) {
  const { drawer, onDrawer, selectedTrack, pattern, dispatch } = p;
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
        title="GRAPH"
        subject={`${String(trackIndex + 1).padStart(2, "0")} ${selectedTrack.name}`}
        tabs={tabs}
        tab={tab}
        onTab={(t) => onDrawer({ tab: t })}
        maximised={drawer.maximised}
        onToggleMaximised={() => onDrawer({ maximised: !drawer.maximised })}
        onToggleCollapsed={() => onDrawer({ open: false })}
        collapsed={false}
      />
      {tab === "roll" ? (
        <div className="wx-drawer-body roll" style={{ height: drawer.maximised ? undefined : drawer.height + 150 }}>
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
        <div className="wx-drawer-body auto">
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
        <div className="wx-drawer-body chord">
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
        <div className="wx-drawer-body">
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
  ) : selectedTrack ? (
    // Collapsed: the same header as the expanded drawer, in the same place, with the chevron turned. Nothing jumps when it opens.
    <div className="wx-drawer wx-drawer-closed" style={{ ["--identity" as string]: trackColor(trackIndex) } as CSSProperties}>
      <div className="wx-panel-header">
        <button className="wx-panel-toggle collapsed" onClick={() => onDrawer({ open: true })} aria-expanded={false} aria-label="Expand GRAPH" title="Expand the step graph under this track (G)"><Icon name="chevronDown" size={12} /></button>
        <span className="wx-panel-title">GRAPH</span>
        <span className="wx-panel-subject">· {String(trackIndex + 1).padStart(2, "0")} {selectedTrack.name}</span>
        <button className="wx-drawer-open" onClick={() => onDrawer({ open: true, tab: "roll" })} title="Open the piano roll for this track"><Icon name="roll" size={13} /> Roll</button>
      </div>
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
        <span className="wx-spacer" />
        <span className="wx-note hint">click adds / removes · drag moves · edge resizes · alt = free · ⋮ = several notes (select, then Roll)</span>
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
