// An expanded arrangement lane (docs/rebuild/03-composition-model.md §7): the lane keeps its whole-pattern clips, and under it
// each track that plays in any of them gets a row with its identity (number, name, M / S) and, across every clip, that track's
// notes as a mini roll. Read-only: it answers "what is this clip made of" without opening it. Rows are the lane's tracks in track
// order, so a drum track sits in the same row from clip to clip.
import { memo, useEffect, useMemo, useRef } from "react";
import { sequenceBars } from "../../model/composer";
import { trackLabel } from "../../model/types";
import type { ComposerLane, FxTarget, Note, Pattern, Project, TrackId } from "../../model/types";
import { startsOnButton, trackColor } from "../kit/TrackHeader";

const ROW_H = 22;

interface StripProps {
  notes: Note[];
  pattern: Pattern;
  beatsPerBar: number;
  widthPx: number;
  color: string;
}

/** One track's notes in one pattern. A single-pitch track (drums) draws full-height ticks; a melodic one is placed by pitch. */
const TrackStrip = memo(function TrackStrip({ notes, pattern, beatsPerBar, widthPx, color }: StripProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(widthPx * ratio));
    canvas.height = ROW_H * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, widthPx, ROW_H);
    const px = widthPx / (pattern.bars * beatsPerBar);
    const pitches = notes.map((n) => n.pitch ?? 0);
    const lo = Math.min(...pitches);
    const hi = Math.max(...pitches);
    ctx.fillStyle = color;
    for (const n of notes) {
      const h = hi === lo ? ROW_H - 6 : 4;
      const y = hi === lo ? 3 : 2 + (1 - ((n.pitch ?? 0) - lo) / (hi - lo)) * (ROW_H - 8);
      ctx.globalAlpha = 0.45 + 0.55 * n.velocity;
      ctx.fillRect(n.start * px, y, Math.max(1.5, n.duration * px - 0.5), h);
    }
  }, [notes, pattern.bars, beatsPerBar, widthPx, color]);
  return <canvas ref={ref} className="wx-lane-strip" style={{ width: widthPx, height: ROW_H }} aria-hidden />;
});

interface Props {
  project: Project;
  lane: ComposerLane;
  barPx: number;
  trackWidth: number;
  insetPx: number;
  selectedTarget: FxTarget;
  onSelectTarget: (target: FxTarget) => void;
  onSetMuted: (trackId: TrackId, muted: boolean) => void;
  onSetSoloed: (trackId: TrackId, soloed: boolean) => void;
}

export const LaneTracks = memo(function LaneTracks({ project, lane, barPx, trackWidth, insetPx, selectedTarget, onSelectTarget, onSetMuted, onSetSoloed }: Props) {
  const rows = useMemo(() => {
    const used = new Set<TrackId>();
    const clips = lane.sequences.map((seq) => {
      const pattern = project.patterns.find((p) => p.id === seq.patternId);
      const byTrack = new Map<TrackId, Note[]>();
      for (const n of Object.values(pattern?.notes ?? {})) {
        used.add(n.trackId);
        const list = byTrack.get(n.trackId);
        if (list) list.push(n);
        else byTrack.set(n.trackId, [n]);
      }
      return { seq, pattern, byTrack };
    });
    const tracks = project.tracks.map((t, index) => ({ t, index })).filter(({ t }) => used.has(t.id));
    return { clips, tracks };
  }, [project.patterns, project.tracks, lane.sequences]);

  if (rows.tracks.length === 0) return <div className="wx-lane-tracks empty"><div className="wx-lane-tracks-head" /><span className="wx-note" style={{ padding: "4px 8px" }}>No notes in this lane's clips yet.</span></div>;
  return (
    <div className="wx-lane-tracks">
      {rows.tracks.map(({ t, index }) => (
        <div key={t.id} className={`wx-lane-trackrow ${selectedTarget === t.id ? "selected" : ""}`} style={{ ["--identity" as string]: trackColor(index) }}>
          <div className="wx-lane-tracks-head" onPointerDown={(e) => { if (!startsOnButton(e.target)) onSelectTarget(t.id); }}>
            <span className="wx-identity" aria-hidden />
            <span className="wx-track-num">{String(index + 1).padStart(2, "0")}</span>
            <span className="wx-track-name" title={t.name}>{trackLabel(t)}</span>{t.fxTrack && <span className="fx-track-tag">FX</span>}
            <button className={`wx-ms ${t.muted ? "on mute" : ""}`} aria-pressed={t.muted} aria-label={`Mute ${t.name}`} title="Mute" onClick={(e) => { e.stopPropagation(); onSetMuted(t.id, !t.muted); }}>M</button>
            <button className={`wx-ms ${t.soloed ? "on solo" : ""}`} aria-pressed={t.soloed} aria-label={`Solo ${t.name}`} title="Solo" onClick={(e) => { e.stopPropagation(); onSetSoloed(t.id, !t.soloed); }}>S</button>
          </div>
          <div className="wx-lane-trackcells" style={{ width: trackWidth }}>
            {rows.clips.map(({ seq, pattern, byTrack }) => {
              const notes = byTrack.get(t.id);
              if (!pattern || !notes) return null;
              const width = Math.max(1, sequenceBars(project, seq) * barPx - 2);
              return (
                <div key={seq.id} className="wx-lane-strip-wrap" style={{ left: insetPx + seq.start * barPx, width }}>
                  <TrackStrip notes={notes} pattern={pattern} beatsPerBar={project.beatsPerBar} widthPx={width} color={seq.color} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
