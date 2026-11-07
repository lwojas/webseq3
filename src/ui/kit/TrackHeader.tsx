// The one track header (docs/rebuild/04-ui-rules.md §3): identity bar, number, name, source glyph, M / S, per-pattern notes
// toggle, audition. `dense` is the step-lane row; `strip` is a mixer channel's head.
import { memo } from "react";
import type { TrackId } from "../../model/types";
import { Icon, type IconName } from "./Icon";

export const trackColor = (index: number): string => `hsl(${(index * 47) % 360} 52% 56%)`;

export interface TrackHeaderProps {
  id: TrackId;
  index: number;
  name: string;
  source: "sample" | "synth" | "chop" | "empty";
  selected: boolean;
  muted: boolean;
  soloed: boolean;
  /** This track's notes are switched off in the pattern being edited. */
  notesOff: boolean;
  looping: boolean;
  density?: "dense" | "strip";
  triggerDisabled?: boolean;
  onSelect: (id: TrackId) => void;
  onMute: (id: TrackId, muted: boolean) => void;
  onSolo: (id: TrackId, soloed: boolean) => void;
  onNotesOff?: (id: TrackId, off: boolean) => void;
  onTrigger?: (id: TrackId) => void;
}

const GLYPH: Record<string, IconName> = { sample: "sample", synth: "keys", chop: "sample", empty: "minus" };
const SOURCE_LABEL = { sample: "sample", synth: "synth", chop: "chop sample", empty: "no sound" } as const;

export const TrackHeader = memo(function TrackHeader(p: TrackHeaderProps) {
  const number = String(p.index + 1).padStart(2, "0");
  return (
    <div
      className={`wx-track-header ${p.density ?? "dense"} ${p.selected ? "selected" : ""}`}
      style={{ ["--identity" as string]: trackColor(p.index) }}
      onPointerDown={() => p.onSelect(p.id)}
      role="group"
      aria-current={p.selected ? "true" : undefined}
      aria-label={`Track ${number} ${p.name}`}
    >
      <span className="wx-identity" aria-hidden />
      <span className="wx-track-num">{number}</span>
      <span className="wx-track-name" title={p.name}>{p.name}</span>
      <span className="wx-track-src" role="img" title={SOURCE_LABEL[p.source]} aria-label={SOURCE_LABEL[p.source]}><Icon name={GLYPH[p.source]} size={12} /></span>
      <button className={`wx-ms ${p.muted ? "on mute" : ""}`} aria-pressed={p.muted} title="Mute" aria-label={`Mute ${p.name}`} onClick={(e) => { e.stopPropagation(); p.onMute(p.id, !p.muted); }}>M</button>
      <button className={`wx-ms ${p.soloed ? "on solo" : ""}`} aria-pressed={p.soloed} title="Solo" aria-label={`Solo ${p.name}`} onClick={(e) => { e.stopPropagation(); p.onSolo(p.id, !p.soloed); }}>S</button>
      {p.onNotesOff && (
        <button className={`wx-ms ${p.notesOff ? "on off" : ""}`} aria-pressed={p.notesOff} title={p.notesOff ? "Notes off in this pattern: click to play them" : "Switch this track's notes off in this pattern"} aria-label={`${p.name} notes in this pattern`} onClick={(e) => { e.stopPropagation(); p.onNotesOff?.(p.id, !p.notesOff); }}><Icon name="note" size={12} /></button>
      )}
      {p.onTrigger && (
        <button className={`wx-ms ${p.looping ? "on" : ""}`} title={p.looping ? "Stop loop" : "Play"} aria-label={`${p.looping ? "Stop" : "Play"} ${p.name}`} disabled={p.triggerDisabled} onClick={(e) => { e.stopPropagation(); p.onTrigger?.(p.id); }}><Icon name="play" size={11} fill /></button>
      )}
    </div>
  );
});
