// The rebuilt application shell (docs/rebuild/04-ui-rules.md §1): app bar, context bar, one of three workspaces (Pattern, Arrange,
// Mixer), a library drawer, and the selected track's device area. It owns layout and navigation only; state and behaviour are the
// V1 controller's (state/useController.tsx). Enabled with ?ui=2 until the parity checklist is complete.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComposerTimeline } from "../components/ComposerTimeline";
import { FxPanel } from "../components/FxPanel";
import { InstrumentPanel } from "../components/InstrumentPanel";
import { MixerPanel } from "../components/MixerPanel";
import { MusicalGuide } from "../components/MusicalGuide";
import { TrackEditor } from "../components/TrackEditor";
import { BANK_SIZE, tracksInBank } from "../model/project";
import { maxPatternBars, sequenceName } from "../model/composer";
import { trackById, type FxId, type NoteId } from "../model/types";
import { timeAgo } from "../persistence/recovery";
import { useController } from "../state/useController";
import { EditMenu } from "./EditMenu";
import { Icon } from "./kit/Icon";
import { Popover } from "./kit/Popover";
import { MainMenu, type MenuSection } from "./MainMenu";
import { Sidebar, type SidebarSection } from "./Sidebar";
import { Transport } from "./Transport";
import { PanelHeader } from "./kit/PanelHeader";
import { Splitter } from "./kit/Splitter";
import { DEFAULT_DRAWER, PatternWorkspace, type DrawerState } from "./pattern/PatternWorkspace";
import type { StepSelection } from "./pattern/StepLane";
import { CheatSheet, key, useShortcuts, type Shortcut } from "./shortcuts";
import "./ui.css";

type Workspace = "pattern" | "arrange" | "mixer";
type DeviceTab = "instrument" | "fx" | "notes";

const STORE = "webseq.ui2";
interface Persisted {
  /** The sidebar panel showing, or null when only the rail is. */
  sidebar: SidebarSection | null;
  libraryWidth: number;
  deviceOpen: boolean;
  deviceHeight: number;
  drawer: DrawerState;
}
const DEFAULTS: Persisted = { sidebar: "samples", libraryWidth: 280, deviceOpen: true, deviceHeight: 260, drawer: DEFAULT_DRAWER };
function load(): Persisted {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORE) ?? "{}") as Partial<Persisted>), };
  } catch {
    return DEFAULTS;
  }
}

export function Shell() {
  const c = useController({ newUi: true });
  const { project, dispatch, selectedPattern, selectedPatternId, selectedTarget, selectedTrack, mainView, layout } = c;
  const [ui, setUi] = useState<Persisted>(load);
  const patchUi = useCallback((patch: Partial<Persisted>) => setUi((u) => ({ ...u, ...patch, drawer: { ...u.drawer, ...(patch.drawer ?? {}) } })), []);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ ...ui, drawer: { ...ui.drawer, maximised: false } }));
    } catch {
      /* layout is simply not remembered */
    }
  }, [ui]);
  const shellRef = useRef<HTMLDivElement>(null);
  const [mixer, setMixer] = useState(false);
  const [menu, setMenu] = useState<MenuSection | null>(null);
  const [deviceTab, setDeviceTab] = useState<DeviceTab>("instrument");
  const [step, setStep] = useState<StepSelection | null>(null);
  const narrow = layout.isPhone;
  /** Phone only: which non-workspace section replaces the workspace ("track" = the device area, "library"). */
  const [more, setMore] = useState(false);
  const [phoneTab, setPhoneTab] = useState<"track" | "library" | null>(null);
  // A new session starts on the first track: the lane, graph and device area all need a track to talk about.
  const firstTrackId = project.tracks[0]?.id;
  useEffect(() => {
    if (firstTrackId) c.handleSelectTarget(firstTrackId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstTrackId]);

  const workspace: Workspace = mixer ? "mixer" : mainView === "composer" ? "arrange" : "pattern";
  const goto = (w: Workspace) => {
    setPhoneTab(null);
    setMixer(w === "mixer");
    if (w === "pattern") c.handleSelectMainView("sequencer");
    if (w === "arrange") c.handleSelectMainView("composer");
  };
  // A pattern opened from the library or a clip (double-click) changes the main view: that leaves the mixer.
  useEffect(() => setMixer(false), [mainView]);

  const [cheat, setCheat] = useState(false);
  const shortcuts: Shortcut[] = [
    { keys: "1", label: "Pattern workspace", scope: "Global", match: key("1"), run: () => goto("pattern") },
    { keys: "2", label: "Arrange workspace", scope: "Global", match: key("2"), run: () => goto("arrange") },
    { keys: "3", label: "Mixer workspace", scope: "Global", match: key("3"), run: () => goto("mixer") },
    { keys: "B", label: "Show / hide the sidebar", scope: "Global", match: key("b"), run: () => patchUi({ sidebar: ui.sidebar ? null : "samples" }) },
    { keys: "⌘S", label: "Save the project", scope: "Global", match: (e) => (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "s", run: () => void c.handleSaveProject() },
    { keys: "⌘O", label: "Open a project", scope: "Global", match: (e) => (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "o", run: () => setMenu("project") },
    { keys: "⌘,", label: "Main menu", scope: "Global", match: (e) => (e.metaKey || e.ctrlKey) && e.key === ",", run: () => setMenu((m) => (m ? null : "project")) },
    { keys: "D", label: "Toggle the device area", scope: "Global", match: key("d"), run: () => patchUi({ deviceOpen: !ui.deviceOpen }) },
    { keys: "G", label: "Toggle the graph drawer under the selected track", scope: "Pattern", match: key("g"), run: () => patchUi({ drawer: { ...ui.drawer, open: !ui.drawer.open } }) },
    { keys: "?", label: "This cheat-sheet", scope: "Global", match: (e) => e.key === "?", run: () => setCheat((v) => !v) },
    { keys: "Esc", label: "Restore a maximised drawer", scope: "Pattern", match: (e) => e.key === "Escape" && ui.drawer.maximised, run: () => patchUi({ drawer: { ...ui.drawer, maximised: false } }) },
  ];
  useShortcuts(shortcuts, c.guideOpen);

  // --- step-lane handlers (stable) ---
  const { handleSelectTarget, handleAddNote, handleResizeNote, handleMoveNote, handleSetTrackMuted, handleSetTrackSoloed, handleSetTrackNotesOff, handleTriggerTrack, setSelectedNoteId } = c;
  const onRemoveNotes = useCallback(
    (ids: NoteId[]) => {
      if (ids.length === 0) return;
      const action = ids.length === 1 ? ({ type: "REMOVE_NOTE", patternId: selectedPatternId, noteId: ids[0] } as const) : ({ type: "BATCH", actions: ids.map((noteId) => ({ type: "REMOVE_NOTE" as const, patternId: selectedPatternId, noteId })) } as const);
      dispatch(action);
      setSelectedNoteId(null);
      if (ids.length > 1) c.setClipboardStatus(`Removed ${ids.length} notes · ⌘Z to undo`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, selectedPatternId, setSelectedNoteId],
  );
  const onAudition = useCallback(
    (midi: number, on: boolean) => {
      const track = selectedTrack;
      if (!c.runtime || !track) return;
      const pb = c.ensurePlayback(c.runtime);
      if (on) pb.noteOn(track, midi, 0.8);
      else pb.noteOff(track, midi);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.runtime, selectedTrack],
  );

  // Picking a parameter to automate opens its lane in the graph drawer.
  const hasLane = !!c.automationRow;
  useEffect(() => {
    if (hasLane) patchUi({ drawer: { ...ui.drawer, open: true, tab: "auto" } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLane]);

  const bankTracks = useMemo(() => tracksInBank(project, c.activeBank), [project, c.activeBank]);
  const index = selectedTrack ? project.tracks.findIndex((t) => t.id === selectedTrack.id) : -1;

  const headW = narrow ? 156 : 232;
  const deviceOpen = narrow || ui.deviceOpen;
  const sidebarSection: SidebarSection | null = narrow ? (ui.sidebar ?? "samples") : ui.sidebar;
  const style = { ["--wx-head-w" as string]: `${headW}px`, ["--wx-library-w" as string]: `${sidebarSection && !narrow ? ui.libraryWidth : 0}px`, ["--wx-device-h" as string]: `${deviceOpen ? ui.deviceHeight : 0}px` } as React.CSSProperties;

  const device = (
    <div className={`wx-device ${deviceOpen ? "open" : "closed"}`}>
      <PanelHeader
        title="DEVICE"
        subject={selectedTarget === "master" ? "MASTER" : selectedTrack ? `${String(index + 1).padStart(2, "0")} ${selectedTrack.name}` : undefined}
        tabs={selectedTarget === "master" ? [{ id: "fx" as DeviceTab, label: "FX" }] : [{ id: "instrument" as DeviceTab, label: "Instrument" }, { id: "fx" as DeviceTab, label: "FX & Route" }, { id: "notes" as DeviceTab, label: "Mod", title: "Arp, Track LFO and ties for this track" }]}
        tab={selectedTarget === "master" ? "fx" : deviceTab}
        onTab={setDeviceTab}
        collapsed={!deviceOpen}
        onToggleCollapsed={() => patchUi({ deviceOpen: !ui.deviceOpen })}
        actions={<button className={`wx-btn ${selectedTarget === "master" ? "active" : ""}`} onClick={() => handleSelectTarget(selectedTarget === "master" ? (selectedTrack?.id ?? project.tracks[0].id) : "master")} title="Edit the master bus">Master</button>}
      />
      {deviceOpen && (
        <div className="wx-device-body">
          {(selectedTarget === "master" || deviceTab === "fx") && (
            <FxPanel
              target={selectedTarget}
              track={selectedTarget === "master" ? null : (trackById(project, selectedTarget) ?? null)}
              tracks={project.tracks}
              onSetOutput={c.handleSetTrackOutput}
              onSetSend={c.handleSetTrackSend}
              fx={c.fxOwner?.fx ?? []}
              selectedFxId={c.selectedFxId}
              onSelectFx={c.setSelectedFxId}
              onAddFx={c.handleAddFx}
              onRemoveFx={c.handleRemoveFx}
              onMoveFx={c.handleMoveFx}
              onSetFxParam={c.handleSetFxParam}
              onSetFxEnabled={c.handleSetFxEnabled}
              automationFor={(fxId: FxId) => c.automationFor(fxId)}
              lfoUiFor={c.fxLfoUi}
              onAddFxLfo={c.handleAddFxLfo}
              onSetFxLfo={c.handleSetFxLfo}
              onRemoveFxLfo={c.handleRemoveFxLfo}
              spectrumTapFor={c.spectrumTapFor}
            />
          )}
          {selectedTarget !== "master" && deviceTab === "instrument" && <InstrumentPanel {...c.instrumentProps} />}
          {selectedTarget !== "master" && deviceTab === "notes" && (
            <TrackEditor
              modOnly
              track={selectedTrack ?? null}
              pattern={selectedPattern}
              beatsPerBar={project.beatsPerBar}
              selectedNoteId={c.selectedNoteId}
              onSelectNote={c.setSelectedNoteId}
              onAddNote={handleAddNote}
              onResizeNote={handleResizeNote}
              onMoveNote={handleMoveNote}
              onRemoveNote={c.handleRemoveNote}
              onSetNotePitch={c.handleSetNotePitch}
              onSetNoteVelocity={c.handleSetNoteVelocity}
              onSetNoteRatchet={c.handleSetNoteRatchet}
              onSetNoteTie={c.handleSetNoteTie}
              onSetTrackNotesTie={c.handleSetTrackNotesTie}
              onSetNoteDuration={c.handleSetNoteDuration}
              onSetNoteMode={c.handleSetNoteMode}
              onSetNoteChord={c.handleSetNoteChord}
              chopAsset={c.selectedTrackAsset}
              scale={c.projectScale}
              onSetTrackArp={c.handleSetTrackArp}
              onResetPatternSettings={c.handleResetPatternSettings}
              onSetTrackEventLfo={c.handleSetTrackEventLfo}
              onSetNoteLfo={c.handleSetNoteLfo}
              onSetTrackNotesLfo={c.handleSetTrackNotesLfo}
            />
          )}
        </div>
      )}
    </div>
  );

  const sidebar = (
    <Sidebar
      section={sidebarSection}
      onSection={(sec) => patchUi({ sidebar: sec })}
      onGuide={c.handleOpenGuide}
      samples={{
        assets: project.assets,
        selectedTarget,
        onImport: c.importAssets,
        importStatus: c.importBatchResult,
        onAssign: c.handleAssignAsset,
        onRename: c.handleRenameAsset,
        onRemove: c.handleRemoveAsset,
        auditioningAssetId: c.manual.auditionAssetId,
        onAudition: c.handleAuditionAsset,
        auditionDisabled: c.resamplePhase === "pending",
      }}
      patterns={{
        patterns: c.launcher,
        selectedPatternId,
        playingPatternId: c.playingPatternId,
        onSelect: c.setSelectedPatternId,
        onEdit: c.handleEditPattern,
        onAdd: c.addPattern,
        onDuplicate: c.duplicatePattern,
        onRemove: c.removePattern,
        onRename: c.renamePattern,
        onSetBars: c.setPatternBars,
        onQueueNext: c.handleQueueNext,
        onAddToArrange: c.handleAddToComposer,
        queue: project.patternChain,
        playingEntryId: c.playingChainEntryId,
        onRemoveEntry: c.handleRemoveChainEntry,
        onMoveEntry: c.handleMoveChainEntry,
        getPlayingBarText: c.getPlayingBarText,
      }}
      instruments={{ track: selectedTrack ?? null, unavailable: c.unavailableKinds, onSet: c.handleSetInstrument }}
    />
  );

  const composer = c.composer;
  return (
    <div className="wx" ref={shellRef} style={style} data-workspace={workspace} data-phone={narrow ? (phoneTab ?? "") : undefined}>
      {c.recoveryPrompt && (
        <div className="wx-banner" role="alert">
          <span>Previous session{c.recoveryPrompt.projectName ? ` “${c.recoveryPrompt.projectName}”` : ""} was not saved ({timeAgo(c.recoveryPrompt.savedAt)}).</span>
          <button className="wx-btn" onClick={() => void c.handleRestoreRecovery()}>Restore</button>
          <button className="wx-btn" onClick={c.handleDismissRecovery}>Discard</button>
        </div>
      )}

      <header className="wx-appbar" data-more={more ? "" : undefined}>
        <button className="wx-icon-btn wx-menu-btn" onClick={() => setMenu("project")} aria-label="Main menu" title="Main menu: project, MIDI, help (⌘,)"><Icon name="menu" size={18} /></button>
        <div className="wx-project">
          <input className="wx-project-name" value={project.name} onChange={(e) => dispatch({ type: "SET_PROJECT_NAME", name: e.target.value })} onFocus={(e) => e.currentTarget.select()} aria-label="Project name" title="Rename the project" spellCheck={false} />
          <button className={`wx-save-dot ${c.isDirty ? "dirty" : ""}`} onClick={() => void c.handleSaveProject()} aria-label={c.isDirty ? "Save (unsaved changes)" : "Saved"} title={c.saveStatus === "error" ? `Save failed: ${c.saveError}` : c.saveStatus === "saving" ? "Saving…" : c.isDirty ? "Unsaved changes: click to save (⌘S)" : "All changes saved"}>
            <Icon name={c.saveStatus === "error" ? "close" : c.isDirty ? "save" : "check"} size={14} />
          </button>
        </div>
        <nav className="wx-tabs primary" role="tablist" aria-label="Workspace">
          {([["pattern", "Pattern", "steps", "1"], ["arrange", "Arrange", "arrange", "2"], ["mixer", "Mixer", "mixer", "3"]] as const).map(([id, label, icon, key]) => (
            <button key={id} role="tab" aria-selected={workspace === id} className={`wx-tab ${workspace === id ? "active" : ""}`} onClick={() => goto(id)} title={`${label} (${key})`}>
              <Icon name={icon} /> <span className="wx-tab-text">{label}</span>
            </button>
          ))}
        </nav>
        <Transport {...c.transportProps} />
        <button className="wx-icon-btn" onClick={() => setMenu("midi")} aria-label="MIDI" title={c.midi.status === "connected" ? "MIDI controller connected" : "MIDI devices"}>
          <Icon name="midi" />{c.midi.status === "connected" && <i className="wx-dot on" />}
        </button>
        <button className="wx-icon-btn" onClick={() => setCheat(true)} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts"><Icon name="help" /></button>
        <button className="wx-icon-btn wx-more" onClick={() => setMore((m) => !m)} aria-pressed={more} aria-label="More" title="Tempo, key and more"><Icon name="more" /></button>
      </header>

      <div className="wx-contextbar">
        {workspace === "pattern" && (
          <>
            {composer.editingSequence && <button className="wx-btn" onClick={composer.returnToComposer} title="Back to the Arrangement"><Icon name="back" /> {sequenceName(project, composer.editingSequence)}</button>}
            <button className="wx-icon-btn" onClick={() => c.handleStepPattern(-1)} aria-label="Previous pattern" title="Previous pattern  ["><Icon name="chevronLeft" /></button>
            <input className="wx-name" value={selectedPattern.name} onChange={(e) => c.renamePattern(selectedPatternId, e.target.value)} aria-label="Pattern name" title="Rename the pattern you are editing" />
            <button className="wx-icon-btn" onClick={() => c.handleStepPattern(1)} aria-label="Next pattern" title="Next pattern  ]"><Icon name="chevronRight" /></button>
            <div className="wx-stepper" role="group" aria-label="Pattern length in bars">
              <button className="wx-icon-btn" onClick={() => c.setPatternBars(selectedPatternId, selectedPattern.bars - 1)} disabled={selectedPattern.bars <= 1} aria-label="Fewer bars" title="Fewer bars"><Icon name="minus" size={14} /></button>
              <span title="Pattern length in bars">{selectedPattern.bars} {selectedPattern.bars === 1 ? "bar" : "bars"}</span>
              <button className="wx-icon-btn" onClick={() => c.setPatternBars(selectedPatternId, selectedPattern.bars + 1)} disabled={selectedPattern.bars >= maxPatternBars(project, selectedPatternId)} aria-label="More bars" title="More bars"><Icon name="plus" size={14} /></button>
            </div>
            <span className="wx-crumb">{selectedTarget === "master" ? "MASTER" : selectedTrack ? `${String(index + 1).padStart(2, "0")} ${selectedTrack.name}` : "no track"}</span>
            <button className="wx-icon-btn" onClick={() => c.handleStepTrack(-1)} aria-label="Previous track" title="Previous track"><Icon name="chevronLeft" size={14} /></button>
            <button className="wx-icon-btn" onClick={() => c.handleStepTrack(1)} aria-label="Next track" title="Next track"><Icon name="chevronRight" size={14} /></button>
            <span className="wx-spacer" />
            {c.clipboardStatus && <span className="wx-status" role="status">{c.clipboardStatus}</span>}
            <button className="wx-icon-btn" onClick={() => c.addPattern()} aria-label="New pattern" title="New pattern"><Icon name="plus" /></button>
            <button className="wx-icon-btn" onClick={() => c.duplicatePattern(selectedPatternId)} aria-label="Duplicate pattern" title="Duplicate this pattern and open the copy"><Icon name="copy" /></button>
            <button className="wx-icon-btn" onClick={() => c.handleAddToComposer(selectedPatternId)} aria-label="Add to Arrange" title="Place this pattern on the Arrangement"><Icon name="arrangeAdd" /></button>
            <Popover label="Edit" title="Edit: copy and paste tracks, instruments, FX; bar tools" className="wx-btn" align="right" trigger={<><Icon name="pencil" /> Edit <Icon name="chevronDown" size={12} /></>}>
              {() => <EditMenu {...c.editProps} />}
            </Popover>
          </>
        )}
        {workspace === "arrange" && (
          <>
            <span className="wx-crumb">{composer.sequence ? `${composer.lane?.name ?? ""} · ${sequenceName(project, composer.sequence)}` : "Select a clip; double-click to open its pattern"}</span>
            <span className="wx-spacer" />
            <Popover label="Edit" title="Edit: the selected clip and lane, history" className="wx-btn" align="right" trigger={<><Icon name="pencil" /> Edit <Icon name="chevronDown" size={12} /></>}>
              {() => <EditMenu {...c.editProps} />}
            </Popover>
          </>
        )}
        {workspace === "mixer" && (
          <>
            <span className="wx-crumb">Bank {String.fromCharCode(65 + c.activeBank)} · tracks {c.activeBank * BANK_SIZE + 1}–{(c.activeBank + 1) * BANK_SIZE}</span>
            <button className="wx-icon-btn" disabled={c.activeBank === 0} onClick={() => c.setActiveBank(c.activeBank - 1)} aria-label="Previous bank" title="Previous bank"><Icon name="chevronLeft" size={14} /></button>
            <button className="wx-icon-btn" disabled={c.activeBank >= 3} onClick={() => c.setActiveBank(c.activeBank + 1)} aria-label="Next bank" title="Next bank"><Icon name="chevronRight" size={14} /></button>
          </>
        )}
      </div>

      <div className="wx-body">
        {sidebar}
        {sidebarSection && !narrow && <Splitter axis="col" shellRef={shellRef} cssVar="--wx-library-w" value={ui.libraryWidth} min={200} max={480} direction={1} onCommit={(libraryWidth) => patchUi({ libraryWidth })} label="Resize library" />}
        <main className="wx-main">
          <div className="wx-workspace">
            {workspace === "pattern" && (
              <PatternWorkspace
                headWidth={headW}
                pattern={selectedPattern}
                tracks={bankTracks}
                bank={c.activeBank}
                bankSummaries={c.bankSummaries}
                onSelectBank={c.setActiveBank}
                selectedTrack={selectedTrack ?? null}
                beatsPerBar={project.beatsPerBar}
                pxPerBeat={c.pxPerBeat}
                zoomPercent={c.zoomPercent}
                canZoomIn={c.canZoomIn}
                canZoomOut={c.canZoomOut}
                onZoomIn={c.onZoomIn}
                onZoomOut={c.onZoomOut}
                gridResolution={c.gridResolution}
                onGridResolutionChange={c.setGridResolution}
                loopingTrackIds={c.manual.loopingTrackIds}
                triggerDisabled={c.resamplePhase === "pending"}
                getPlayheadBeat={c.getPlayheadBeat}
                active
                dispatch={dispatch}
                scale={c.projectScale}
                asset={c.selectedTrackAsset}
                onAudition={onAudition}
                drawer={ui.drawer}
                onDrawer={(patch) => patchUi({ drawer: { ...ui.drawer, ...patch } })}
                step={step}
                onSelectStep={setStep}
                onSelectNote={setSelectedNoteId}
                automationRow={c.automationRow}
                onSetNoteMode={c.handleSetNoteMode}
                onSetNoteChord={c.handleSetNoteChord}
                onSelectTrack={handleSelectTarget}
                onAddNote={handleAddNote}
                onRemoveNotes={onRemoveNotes}
                onResizeNote={handleResizeNote}
                onMoveNote={handleMoveNote}
                onMute={handleSetTrackMuted}
                onSolo={handleSetTrackSoloed}
                onNotesOff={handleSetTrackNotesOff}
                onTrigger={handleTriggerTrack}
              />
            )}
            {workspace === "arrange" && (
              <ComposerTimeline
                expandableLanes
                project={project}
                scrollMemory={composer.scrollMemory}
                marker={composer.marker}
                onSetMarker={composer.setMarker}
                getSongBeat={c.getSongBeat}
                playingSequenceIds={c.playingSequenceIds}
                getSongText={c.getSongText}
                selectedSequenceId={composer.sequence?.id ?? null}
                selectedLaneId={composer.lane?.id ?? null}
                onSelectSequence={composer.selectSequence}
                onSelectLane={composer.selectLane}
                onMove={composer.onMove}
                onResize={composer.onResize}
                {...composer.laneHandlers}
                automation={{ row: c.automationRow, spans: c.composerAutomationSpans, ...c.composerAutomationEdit }}
                toolbar={composer.toolbar}
                trackList={{
                  tracks: project.tracks,
                  masterFxCount: project.master.fx.length,
                  pattern: composer.sequence ? selectedPattern : undefined,
                  patternLabel: composer.sequence ? sequenceName(project, composer.sequence) : "",
                  selectedTarget,
                  onSelectTarget: handleSelectTarget,
                  onSetMuted: handleSetTrackMuted,
                  onSetSoloed: handleSetTrackSoloed,
                  onSetNotesOff: handleSetTrackNotesOff,
                }}
              />
            )}
            {workspace === "mixer" && (
              <MixerPanel
                tracks={tracksInBank(project, c.activeBank)}
                trackNumberOffset={c.activeBank * BANK_SIZE}
                onSetVolume={c.handleSetTrackVolume}
                onSetMuted={handleSetTrackMuted}
                onSetSoloed={handleSetTrackSoloed}
                onSetPan={c.handleSetTrackPan}
                runtime={c.runtime}
                getBusId={c.getBusId}
              />
            )}
          </div>
          {deviceOpen && !narrow && <Splitter axis="row" shellRef={shellRef} cssVar="--wx-device-h" value={ui.deviceHeight} min={120} max={640} direction={-1} onCommit={(deviceHeight) => patchUi({ deviceHeight })} label="Resize device area" />}
          {device}
        </main>
      </div>

      {narrow && (
        <nav className="wx-phonebar" role="tablist" aria-label="Sections">
          {([["pattern", "Pattern"], ["arrange", "Arrange"], ["mixer", "Mixer"], ["track", "Track"], ["library", "Library"]] as const).map(([id, label]) => {
            const active = id === "track" || id === "library" ? phoneTab === id : phoneTab === null && workspace === id;
            return (
              <button key={id} role="tab" aria-selected={active} className={`wx-tab ${active ? "active" : ""}`} onClick={() => (id === "track" || id === "library" ? setPhoneTab(id) : goto(id))}>{label}</button>
            );
          })}
        </nav>
      )}
      {c.error && <div className="wx-veil">Audio engine failed to start: {c.error}</div>}
      {!c.runtime && !c.error && (
        <div className="wx-veil">
          <div className="wx-veil-card">
            <p>Click Start to turn the audio engine on (browsers need a click first).</p>
            <button className="wx-btn primary" onClick={c.handlePlay}>▶ Start</button>
          </div>
        </div>
      )}
      {menu && (
        <MainMenu
          section={menu}
          onSection={setMenu}
          onClose={() => setMenu(null)}
          projectName={project.name}
          onRename={(name) => dispatch({ type: "SET_PROJECT_NAME", name })}
          isDirty={c.isDirty}
          saveStatus={c.saveStatus}
          saveError={c.saveError}
          fileError={c.fileError}
          currentId={project.id}
          savedProjects={c.savedProjects}
          loadTargetId={c.loadTargetId}
          onSelectSaved={c.setLoadTargetId}
          onNew={() => { c.handleNewProject(); setMenu(null); }}
          onSave={() => void c.handleSaveProject()}
          onOpen={() => { void c.handleLoadProject(); setMenu(null); }}
          onDelete={() => void c.handleDeleteProject()}
          onExport={() => void c.handleExportProject()}
          onImport={() => { void c.handleImportProject(); setMenu(null); }}
          midi={{ status: c.midi.status, hasAccess: c.midi.hasAccess, error: c.midi.error, inputs: c.midi.inputs, outputs: c.midi.outputs, log: c.midi.log, onRequestAccess: c.midi.requestAccess, onConnect: c.midi.connect, onDisconnect: c.midi.disconnect }}
          onShortcuts={() => setCheat(true)}
          onGuide={c.handleOpenGuide}
        />
      )}
      {cheat && <CheatSheet list={shortcuts} onClose={() => setCheat(false)} />}
      {c.guideOpen && (
        <MusicalGuide project={project} selectedPatternId={selectedPatternId} selectedTrackId={selectedTarget === "master" ? null : selectedTarget} getRuntime={c.getGuideRuntime} unavailableKinds={c.unavailableKinds} onApplyRecipe={c.handleApplyRecipe} onClose={c.handleCloseGuide} />
      )}
    </div>
  );
}
