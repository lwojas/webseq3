// Where every V1 capability lives in the rebuilt UI (docs/rebuild/01-v1-audit.md). Two tests read this file
// (test/parity.test.ts): every reducer Action type and every controller `handle*` function must be listed, with at least
// one surface. Adding an action or handler without deciding where it lives fails the build.
//
// Surface codes: APP app bar · XPORT transport · LIB library drawer · STEP step lane · GRAPH step graph · ROLL piano roll ·
// ARR arrangement · MIX mixer · INST/FX/MOD/ROUTE device-area tabs · CTX context menu / context bar · SYS no UI.

export type Surface = "APP" | "XPORT" | "LIB" | "PAT" | "STEP" | "GRAPH" | "ROLL" | "ARR" | "MIX" | "INST" | "FX" | "MOD" | "ROUTE" | "CTX" | "SYS";

export const ACTION_SURFACES: Record<string, Surface[]> = {
  SET_BPM: ["XPORT"], SET_SWING: ["XPORT"], SET_PROJECT_NAME: ["APP"], SET_PROJECT_SCALE: ["XPORT"],
  SET_PATTERN_TRACK_OFF: ["STEP", "ARR"], RESET_PATTERN_TRACK_SETTINGS: ["MOD"],
  SET_TRACK_ARP: ["MOD"], APPLY_RECIPE: ["LIB"],
  ADD_ASSET: ["LIB"], ASSIGN_ASSET: ["LIB", "INST"], RENAME_ASSET: ["LIB"], REMOVE_ASSET: ["LIB"],
  SET_TRACK_VOLUME: ["MIX", "ROUTE"], SET_TRACK_MUTED: ["STEP", "MIX", "ARR"], SET_TRACK_SOLOED: ["STEP", "MIX", "ARR"],
  SET_TRACK_PLAYBACK_MODE: ["INST"], SET_TRACK_VOICE_MODE: ["INST"], SET_TRACK_ENVELOPE: ["INST"], SET_TRACK_CHOKE_GROUP: ["INST"],
  SET_TRACK_PAN: ["MIX", "ROUTE"], SET_TRACK_OUTPUT: ["ROUTE", "MIX"], SET_TRACK_SEND: ["ROUTE", "MIX"], SET_TRACK_SEND_AMOUNT: ["ROUTE", "MIX"],
  SET_TRACK_INSTRUMENT: ["INST"], SET_INSTRUMENT_PARAM: ["INST"], SET_TRACK_EVENT_LFO: ["MOD"],
  SET_NOTE_LFO: ["GRAPH"], SET_TRACK_NOTES_LFO: ["GRAPH"],
  ADD_INSTRUMENT_LFO: ["MOD"], SET_INSTRUMENT_LFO: ["MOD"], REMOVE_INSTRUMENT_LFO: ["MOD"],
  SET_TRACK_SAMPLE_MODE: ["INST"], SET_ASSET_CUES: ["INST"], SET_ASSET_CHOP_START: ["INST"], SET_ASSET_ENVELOPE: ["INST"], SET_ASSET_GAIN: ["INST"],
  SET_NOTE_PITCH: ["GRAPH", "ROLL"], SET_NOTE_MODE: ["GRAPH"], SET_NOTE_CHORD: ["GRAPH"], SET_NOTE_TIE: ["GRAPH"], SET_TRACK_NOTES_TIE: ["GRAPH"],
  SET_NOTE_RATCHET: ["GRAPH"], SET_NOTE_VELOCITY: ["GRAPH", "ROLL"],
  ADD_NOTE: ["STEP"], REMOVE_NOTE: ["STEP", "ROLL"], CLEAR_TRACK_NOTES: ["CTX"], PASTE_NOTES: ["CTX"],
  PASTE_TRACK_CONFIG: ["CTX"], PASTE_TRACK: ["CTX"], PASTE_INSTRUMENT: ["CTX", "INST"], PASTE_FX: ["CTX", "FX"], PASTE_MODULATION: ["CTX", "MOD"], PASTE_BANK: ["CTX"],
  DUPLICATE_SEQUENCE: ["CTX"], DUPLICATE_BAR: ["CTX"], SET_CHOP_STEPS: ["CTX", "INST"], EXTEND_TRACK: ["CTX"],
  RESIZE_NOTE: ["STEP", "GRAPH", "ROLL"], MOVE_NOTE: ["STEP", "ROLL"], SET_PATTERN_BARS: ["PAT"], ADD_PATTERN: ["PAT", "LIB"],
  COMPOSER_ADD_PATTERN: ["ARR", "LIB"], COMPOSER_ADD_BLANK: ["ARR"], COMPOSER_DUPLICATE: ["ARR"], COMPOSER_PASTE: ["ARR"],
  COMPOSER_MOVE: ["ARR"], COMPOSER_RESIZE: ["ARR"], COMPOSER_SET_COLOR: ["ARR"], COMPOSER_REMOVE: ["ARR"],
  COMPOSER_ADD_LANE: ["ARR"], COMPOSER_REMOVE_LANE: ["ARR"], COMPOSER_RENAME_LANE: ["ARR"], COMPOSER_MOVE_LANE: ["ARR"], COMPOSER_SET_LANE_MODIFIERS: ["ARR"],
  DUPLICATE_PATTERN: ["PAT", "LIB"], REMOVE_PATTERN: ["LIB"], RENAME_PATTERN: ["PAT", "LIB"],
  QUEUE_PATTERN_NEXT: ["LIB"], ENSURE_PATTERN_QUEUED: ["SYS"], REMOVE_FROM_QUEUE: ["LIB"], REMOVE_CHAIN_ENTRY: ["LIB"], MOVE_CHAIN_ENTRY: ["LIB"],
  ADD_FX_LFO: ["MOD"], SET_FX_LFO: ["MOD"], REMOVE_FX_LFO: ["MOD"],
  ADD_FX: ["FX"], REMOVE_FX: ["FX"], MOVE_FX: ["FX"], SET_FX_PARAM: ["FX"], SET_FX_ENABLED: ["FX"],
  SET_AUTOMATION_POINT: ["GRAPH", "ARR"], REMOVE_AUTOMATION_POINT: ["GRAPH"], CLEAR_AUTOMATION_LANE: ["GRAPH"], RESET_PATTERN_AUTOMATION: ["GRAPH"], REPLACE_AUTOMATION_RANGE: ["GRAPH"],
  EXPLODE_CHORD: ["GRAPH", "ROLL"], ROLL_ADD_NOTE: ["ROLL"], ROLL_MOVE_NOTES: ["ROLL"], ROLL_RESIZE_NOTE: ["ROLL"], ROLL_REMOVE_NOTES: ["ROLL"], ROLL_SET_VELOCITY: ["ROLL", "GRAPH"],
  ROLL_DUPLICATE_NOTES: ["ROLL"], ROLL_PASTE_NOTES: ["ROLL"], BATCH: ["SYS"],
  LOAD_PROJECT: ["APP"],
};

export const HANDLER_SURFACES: Record<string, Surface[]> = {
  handleAddFx: ["FX"], handleAddFxLfo: ["MOD"], handleAddLfo: ["MOD"], handleAddNote: ["STEP"], handleAddToComposer: ["PAT", "LIB"],
  handleApplyRecipe: ["LIB"], handleAssignAsset: ["LIB"], handleAuditionAsset: ["LIB"], handleAuditionSlice: ["INST"],
  handleBpmChange: ["XPORT"], handleClearTrack: ["CTX"], handleCloseGuide: ["LIB"], handleCopyTrack: ["CTX"],
  handleDeleteProject: ["LIB"], handleDismissRecovery: ["APP"], handleEditPattern: ["PAT"], handleExportProject: ["APP"],
  handleImportProject: ["APP"], handleLoadProject: ["LIB"], handleLoopIn: ["STEP", "ARR"], handleMoveChainEntry: ["LIB"], handleMoveFx: ["FX"], handleMoveNote: ["STEP", "ROLL"],
  handleNewProject: ["APP"], handleOpenGuide: ["LIB"], handlePasteNotes: ["CTX"], handlePause: ["XPORT"],
  handlePlay: ["XPORT"], handlePlayPatternFrom: ["STEP"], handlePlaySongFrom: ["ARR"], handleQueueNext: ["LIB"], handleRedo: ["APP"], handleRemoveAsset: ["LIB"],
  handleRemoveChainEntry: ["LIB"], handleRemoveFx: ["FX"], handleRemoveFxLfo: ["MOD"], handleRemoveLfo: ["MOD"], handleRemoveNote: ["STEP"],
  handleRenameAsset: ["LIB"], handleResample: ["XPORT"], handleResetPatternSettings: ["MOD"], handleResizeNote: ["STEP", "ROLL"],
  handleRestoreRecovery: ["APP"], handleSaveProject: ["APP", "LIB"], handleScaleChange: ["XPORT"], handleSelectMainView: ["APP"], handleSelectTarget: ["STEP", "MIX", "ARR"],
  handleSetAssetGain: ["INST"], handleSetChopStart: ["INST"], handleSetCues: ["INST"], handleSetEnvelope: ["INST"],
  handleSetFxEnabled: ["FX"], handleSetFxLfo: ["MOD"], handleSetFxParam: ["FX"], handleSetInstrument: ["INST"], handleSetInstrumentParam: ["INST"], handleSetLoop: ["STEP", "ARR"],
  handleSetLfo: ["MOD"], handleSetNoteChord: ["GRAPH"], handleSetNoteDuration: ["GRAPH", "STEP"], handleSetNoteLfo: ["GRAPH"],
  handleSetNoteMode: ["GRAPH"], handleSetNotePitch: ["GRAPH"], handleSetNoteRatchet: ["GRAPH"], handleSetNoteTie: ["GRAPH"],
  handleSetNoteVelocity: ["GRAPH"], handleSetSampleMode: ["INST"], handleSetSource: ["XPORT"], handleSetTrackArp: ["MOD"],
  handleSetTrackChokeGroup: ["INST"], handleSetTrackEnvelope: ["INST"], handleSetTrackEventLfo: ["MOD"], handleSetTrackMuted: ["STEP", "MIX"],
  handleSetTrackNotesLfo: ["GRAPH"], handleSetTrackNotesOff: ["STEP", "ARR"], handleSetTrackNotesTie: ["GRAPH"], handleSetTrackOutput: ["ROUTE"],
  handleSetTrackPan: ["MIX", "ROUTE"], handleSetTrackPlaybackMode: ["INST"], handleSetTrackSend: ["ROUTE"], handleSetTrackSoloed: ["STEP", "MIX"],
  handleSetTrackVoiceMode: ["INST"], handleSetTrackVolume: ["MIX"], handleStepPattern: ["PAT"], handleStepTrack: ["PAT"], handleStop: ["XPORT"],
  handleSwingChange: ["XPORT"], handleTriggerTrack: ["STEP", "MIX"], handleUndo: ["APP"],
};
