import { FX_DEFS } from "../model/fx";
import type { FxId, FxTarget, FxType, Track, TrackId, TrackLfo } from "../model/types";
import { resolvedOutput, resolvedSend, trackLabel } from "../model/types";
import { canRouteTo } from "../model/project";
import { FxChainStrip } from "./FxChainStrip";
import { ModulePanel } from "./ModulePanel";
import type { CompressorTap } from "./CompressorDisplay";
import type { SpectrumTap } from "../viz/useSpectrumCanvas";
import { ModulationSlot, modulationBadges, type AutomationUi, type ModulationUi } from "./ModulationSlot";

interface Props {
  target: FxTarget;
  track: Track | null; // the selected Track, or null when target === "master"
  /** Every track in the project, in order — the routing destinations on offer. */
  tracks: Track[];
  onSetOutput: (trackId: TrackId, dest: TrackId | null) => void;
  /** FX send: `dest` null removes it; with a destination and an `amount` (0..1) only the level
   * changes, with a destination alone the send is created/re-pointed. */
  onSetSend: (trackId: TrackId, dest: TrackId | null, amount?: number) => void;
  fx: import("../model/types").FxInstance[];
  selectedFxId: FxId | null;
  onSelectFx: (id: FxId) => void;
  onAddFx: (type: FxType) => void;
  onRemoveFx: (id: FxId) => void;
  onMoveFx: (id: FxId, index: number) => void;
  onSetFxParam: (fxId: FxId, paramId: string, value: number) => void;
  onSetFxEnabled: (fxId: FxId, enabled: boolean) => void;
  /** Automation for one FX of the chain (App binds the selected owner), or undefined. */
  automationFor: (fxId: FxId) => AutomationUi | undefined;
  /** The engine's LFO options for an FX type (null before the engine exists). */
  lfoUiFor: (type: FxType) => ModulationUi | null;
  onAddFxLfo: (fxId: FxId, param: string) => void;
  onSetFxLfo: (fxId: FxId, index: number, patch: Partial<TrackLfo>) => void;
  onRemoveFxLfo: (fxId: FxId, index: number) => void;
  /** Live-spectrum source for an FX (its engine effect input), or null without an engine. */
  spectrumTapFor?: (fxId: FxId) => SpectrumTap | null;
  /** Engine side of a compressor FX (meter feed, level-matched A/B), or null without an engine. */
  compressorTapFor?: (fxId: FxId) => CompressorTap | null;
}

/** The bottom module panel, contextual to whatever is currently selected in the timeline — a
 * track or MASTER (see project brief section 12). Replaces the original prototype's single
 * hand-wired master-filter strip: FX chain, per-FX parameters, and that FX's modulation
 * (automation + LFOs, the same card the synth editor uses) are all rendered generically from the
 * model (model/fx.ts's FX_DEFS), so a new FX type needs no new component here. */
export function FxPanel({
  target,
  track,
  tracks,
  onSetOutput,
  onSetSend,
  fx,
  selectedFxId,
  onSelectFx,
  onAddFx,
  onRemoveFx,
  onMoveFx,
  onSetFxParam,
  onSetFxEnabled,
  automationFor,
  lfoUiFor,
  onAddFxLfo,
  onSetFxLfo,
  onRemoveFxLfo,
  spectrumTapFor,
  compressorTapFor,
}: Props) {
  const selectedFx = fx.find((f) => f.id === selectedFxId) ?? null;
  const title = target === "master" ? "MASTER" : `${track?.name ?? target}`;
  const automation = selectedFx ? automationFor(selectedFx.id) : undefined;
  const def = selectedFx ? FX_DEFS[selectedFx.type] : null;

  return (
    <div className="fx-panel">
      <div className="fx-panel-head">
        <div className="fx-panel-title">{title} — FX CHAIN</div>
        {track && <RoutingRow track={track} tracks={tracks} onSetOutput={onSetOutput} onSetSend={onSetSend} />}
      </div>
      <FxChainStrip fx={fx} selectedFxId={selectedFxId} onSelectFx={onSelectFx} onAddFx={onAddFx} onRemoveFx={onRemoveFx} onMoveFx={onMoveFx} />

      {selectedFx && def && (
        <div className="fx-panel-detail">
          <ModulePanel
            fx={selectedFx}
            tracks={tracks}
            ownerTrackId={track?.id ?? null}
            onSetParam={(paramId, value) => onSetFxParam(selectedFx.id, paramId, value)}
            onSetEnabled={(enabled) => onSetFxEnabled(selectedFx.id, enabled)}
            badges={modulationBadges(automation?.lanes ?? [], selectedFx.lfos ?? [])}
            onAutomateParam={(paramId) => automation?.onAdd(paramId)}
            spectrumTap={spectrumTapFor ? () => spectrumTapFor(selectedFx.id) : undefined}
            compressorTap={compressorTapFor ? () => compressorTapFor(selectedFx.id) : undefined}
          >
            <ModulationSlot
              lfos={selectedFx.lfos ?? []}
              ui={lfoUiFor(selectedFx.type)}
              labelFor={(id) => def.params.find((p) => p.id === id)?.label ?? id}
              onAdd={(param) => onAddFxLfo(selectedFx.id, param)}
              onChange={(index, patch) => onSetFxLfo(selectedFx.id, index, patch)}
              onRemove={(index) => onRemoveFxLfo(selectedFx.id, index)}
              automation={automation}
            />
          </ModulePanel>
        </div>
      )}
      {fx.length === 0 && (
        <div className="fx-panel-empty">No FX yet — use + Add FX above. Effects run left to right; add the same one twice to stack it.</div>
      )}
    </div>
  );
}

/** Where the selected track sends its audio once its own FX chain has run: the master (default)
 * or another track, which then runs it through that track's FX chain. Destinations that would
 * loop back (or the track itself) are left out of the list, so an invalid route can't be picked. */
function RoutingRow({ track, tracks, onSetOutput, onSetSend }: { track: Track; tracks: Track[]; onSetOutput: Props["onSetOutput"]; onSetSend: Props["onSetSend"] }) {
  const project = { tracks } as import("../model/types").Project;
  const current = resolvedOutput(project, track);
  const send = resolvedSend(project, track);
  /** Valid destinations, FX tracks first (they exist to be sent to). */
  const trackOptions = (valid: (t: Track) => boolean) => {
    const option = (t: Track) => (
      <option key={t.id} value={t.id}>
        {String(tracks.indexOf(t) + 1).padStart(2, "0")} · {trackLabel(t)}
      </option>
    );
    const fxTracks = tracks.filter((t) => t.fxTrack && valid(t));
    const others = tracks.filter((t) => !t.fxTrack && valid(t));
    if (fxTracks.length === 0) return others.map(option);
    return [<optgroup key="fx" label="FX tracks">{fxTracks.map(option)}</optgroup>, <optgroup key="other" label="Other tracks">{others.map(option)}</optgroup>];
  };
  const incoming = tracks.filter((t) => t.id !== track.id && (resolvedOutput(project, t) === track.id || resolvedSend(project, t)?.to === track.id)).length;
  return (
    <div className="fx-panel-head-controls">
      <label className="track-mode-group">
        <span className="track-mode-label">Output</span>
        <select
          className="fx-add-select"
          value={current}
          onChange={(e) => onSetOutput(track.id, e.target.value === "master" ? null : e.target.value)}
          aria-label="Send this track's audio to"
        >
          <option value="master">Master</option>
          {trackOptions((t) => t.id === current || canRouteTo(project, track.id, t.id))}
        </select>
      </label>
      <label className="track-mode-group">
        <span className="track-mode-label">FX send</span>
        <select
          className="fx-add-select"
          value={send?.to ?? ""}
          onChange={(e) => onSetSend(track.id, e.target.value === "" ? null : e.target.value)}
          aria-label="Send a copy of this track's audio (post-fader) to"
        >
          <option value="">None</option>
          {trackOptions((t) => t.id === send?.to || canRouteTo(project, track.id, t.id))}
        </select>
      </label>
      {send && (
        <label className="track-mode-group">
          <span className="track-mode-label">Send {Math.round(send.amount * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={send.amount}
            onChange={(e) => onSetSend(track.id, send.to, Number(e.target.value))}
            aria-label="FX send amount"
            title="FX send level, after the fader"
          />
        </label>
      )}
      {incoming > 0 && (
        <span className="track-mode-label" title="Tracks routed or sent into this one run through its FX chain">
          Receiving from {incoming} track{incoming === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
