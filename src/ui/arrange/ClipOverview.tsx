// A clip's mini track overview (docs/rebuild/03-composition-model.md §7): one hair-line row per track that has notes in the
// pattern, in track order, so a clip shows what it contains (kick/snare/hat pattern, bass line...) without opening it. Drawn once
// on a canvas and redrawn only when the pattern's notes, its width or the track list change.
import { memo, useEffect, useRef } from "react";
import type { Pattern, Track } from "../../model/types";
import { totalBeats } from "../../model/types";

const HEIGHT = 20;

interface Props {
  pattern: Pattern;
  tracks: Track[];
  beatsPerBar: number;
  widthPx: number;
}

export const ClipOverview = memo(function ClipOverview({ pattern, tracks, beatsPerBar, widthPx }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(widthPx * ratio));
    canvas.height = HEIGHT * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, widthPx, HEIGHT);
    const order = new Map(tracks.map((t, i) => [t.id, i]));
    const used = [...new Set(Object.values(pattern.notes).map((n) => n.trackId))].filter((id) => order.has(id)).sort((a, b) => order.get(a)! - order.get(b)!);
    if (used.length === 0) return;
    const rowH = Math.min(4, HEIGHT / used.length);
    const rowOf = new Map(used.map((id, i) => [id, i]));
    const beats = totalBeats(pattern, beatsPerBar);
    const px = widthPx / beats;
    ctx.fillStyle = "rgba(10, 13, 18, 0.62)";
    for (const n of Object.values(pattern.notes)) {
      const row = rowOf.get(n.trackId);
      if (row === undefined) continue;
      ctx.fillRect(n.start * px, row * rowH, Math.max(1, n.duration * px - 0.5), Math.max(1, rowH - 1));
    }
  }, [pattern.notes, pattern.bars, tracks, beatsPerBar, widthPx]);
  return <canvas ref={ref} className="clip-overview" style={{ width: widthPx, height: HEIGHT }} aria-hidden />;
});
