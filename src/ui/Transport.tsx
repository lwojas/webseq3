// The transport cluster of the app bar (docs/rebuild/04-ui-rules.md §4): icon buttons for play / stop, the position readout, tempo,
// key, playback source and resample. The same behaviour as V1's TransportBar (it reads the same props), arranged the way a desktop
// DAW does it: glyphs with tooltips, and the occasional settings (swing, the scale) in popovers instead of permanent sliders.
import { useCallback } from "react";
import { RafText } from "../components/RafText";
import { ScaleControl } from "../components/ScaleControl";
import type { PlaybackSource } from "../model/composer";
import { MAX_BPM, MAX_SWING, MIN_BPM, MIN_SWING } from "../model/project";
import { formatScale, type ProjectScale } from "../model/scale";
import type { PlaybackStatus, ResampleStatus } from "../audio/transport";
import type { ResamplePhase } from "../components/TransportBar";
import { Icon } from "./kit/Icon";
import { Popover } from "./kit/Popover";
import { useRafText } from "../hooks/useRafText";

export interface TransportProps {
  status: PlaybackStatus;
  bpm: number;
  followedBpm: number | null;
  swing: number;
  scale: ProjectScale;
  onScaleChange: (patch: Partial<ProjectScale>) => void;
  onOpenGuide: () => void;
  onPlay: () => void | Promise<void>;
  onPause: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onSwingChange: (swing: number) => void;
  getPositionText: () => string;
  source: PlaybackSource;
  onSourceChange: (source: PlaybackSource) => void;
  canResample: boolean;
  onResample: () => void;
  resamplePhase: ResamplePhase;
  resampleError: string | null;
  getResampleLabel: () => ResampleStatus;
}

export function Transport(p: TransportProps) {
  const positionRef = useRafText(p.getPositionText);
  const getResampleText = useCallback(() => p.getResampleLabel().toUpperCase(), [p.getResampleLabel]);
  const bpm = p.followedBpm ?? p.bpm;
  const bpmLocked = p.resamplePhase === "pending" || p.resamplePhase === "processing" || p.followedBpm !== null;
  const playing = p.status === "playing";
  const resampling = p.resamplePhase !== "idle";
  return (
    <div className="wx-transport" role="group" aria-label="Transport">
      <button className={`wx-icon-btn wx-play ${playing ? "active" : ""}`} onClick={playing ? p.onPause : () => void p.onPlay()} aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause (Space stops)" : p.status === "paused" ? "Resume (Space)" : "Play (Space)"}>
        <Icon name={playing ? "pause" : "play"} fill={!playing} />
      </button>
      <button className="wx-icon-btn" onClick={p.onStop} disabled={p.status === "stopped"} aria-label="Stop" title="Stop and return to the start">
        <Icon name="stop" fill />
      </button>
      <span className="wx-position" ref={positionRef} aria-live="off" title="Position" />
      <div className="wx-segment wx-source wx-adv" role="group" aria-label="Playback source">
        <button className={p.source === "pattern" ? "active" : ""} aria-pressed={p.source === "pattern"} aria-label="Play the pattern queue" title="Pattern: play the pattern queue (loops)" onClick={() => p.source !== "pattern" && p.onSourceChange("pattern")}><Icon name="loop" /></button>
        <button className={p.source === "song" ? "active" : ""} aria-pressed={p.source === "song"} aria-label="Play the song" title="Song: play the Arrange timeline, left to right" onClick={() => p.source !== "song" && p.onSourceChange("song")}><Icon name="song" /></button>
      </div>
      <label className="wx-bpm wx-adv" title={p.followedBpm !== null ? "Tempo (following the host)" : "Tempo in beats per minute"}>
        <input type="number" min={MIN_BPM} max={MAX_BPM} value={bpm} disabled={bpmLocked} onChange={(e) => p.onBpmChange(Number(e.target.value))} aria-label="Tempo in BPM" />
        <span>{p.followedBpm !== null ? "HOST" : "BPM"}</span>
      </label>
      <Popover label="Swing" title={`Swing ${Math.round(p.swing * 100)}%`} trigger={<Icon name="shuffle" />} disabled={bpmLocked}>
        {() => (
          <label className="wx-popover-field">
            <span>Swing</span>
            <input type="range" min={MIN_SWING * 100} max={MAX_SWING * 100} value={Math.round(p.swing * 100)} onChange={(e) => p.onSwingChange(Number(e.target.value) / 100)} aria-label="Swing" />
            <span className="wx-popover-value">{Math.round(p.swing * 100)}%</span>
          </label>
        )}
      </Popover>
      <Popover label={`${formatScale(p.scale)}, key and scale`} title={`Key: ${formatScale(p.scale)}`} className="wx-chip" trigger={<><Icon name="key" /><span>{formatScale(p.scale)}</span></>}>
        {(close) => <ScaleControl scale={p.scale} onChange={p.onScaleChange} onOpenGuide={() => { close(); p.onOpenGuide(); }} />}
      </Popover>
      <button className={`wx-icon-btn wx-rec wx-adv ${resampling ? "active" : ""}`} onClick={p.onResample} disabled={!p.canResample} aria-label="Resample" title={p.canResample ? "Resample one iteration of the playing pattern into a new sample" : "Resample (play a pattern first)"}>
        <Icon name="record" fill />
      </button>
      {p.resamplePhase === "pending" && <RafText getText={getResampleText} className="wx-resample-status" />}
      {p.resamplePhase === "processing" && <span className="wx-resample-status">PROCESSING</span>}
      {p.resamplePhase === "complete" && <span className="wx-resample-status complete">DONE</span>}
      {p.resamplePhase === "error" && <span className="wx-resample-status error" title={p.resampleError ?? undefined}>ERROR</span>}
    </div>
  );
}
