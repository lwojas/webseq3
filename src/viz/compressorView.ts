// Canvas painters for the compressor display: the transfer curve (input level across, output level up) and
// the level / gain-reduction meters with their trace. Pure drawing in the surface's units; the owner runs the
// frame loop (components/CompressorDisplay.tsx). Curve maths and meter values come from webdsp.
import { compressorCurveDb, type CompressorSettings } from "webdsp";
import { withAlpha } from "./theme";

export interface CompressorPalette {
  fg: string;
  muted: string;
  grid: string;
  accent: string;
  gr: string;
}

export const CURVE_SIZE = { width: 260, height: 260 };
export const METER_SIZE = { width: 380, height: 260 };

export const DB_MIN = -48;
const GR_SCALE = 18; // the meter shows 0 .. -18 dB of reduction
const FONT = "11px system-ui, sans-serif";

/** The dim diagonal is 1:1, the bright curve is what the compressor does, the shaded wedge between them is the reduction, the
 * dashed vertical is the threshold. The dot is the live input peak, with its reduction drawn down from the diagonal. */
export function paintCurve(ctx: CanvasRenderingContext2D, W: number, H: number, c: CompressorPalette, s: CompressorSettings, dry: boolean, inDb: number, grDb: number): void {
  const pad = 22;
  const x = (db: number) => pad + ((db - DB_MIN) / -DB_MIN) * (W - pad - 6);
  const y = (db: number) => H - pad - ((db - DB_MIN) / -DB_MIN) * (H - pad - 6);
  ctx.font = FONT;
  ctx.lineWidth = 1;
  ctx.strokeStyle = c.grid;
  ctx.fillStyle = c.muted;
  for (let db = DB_MIN; db <= 0; db += 12) {
    ctx.beginPath(); ctx.moveTo(x(db), y(DB_MIN)); ctx.lineTo(x(db), y(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x(DB_MIN), y(db)); ctx.lineTo(x(0), y(db)); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillText(String(db), x(db), H - 6);
    ctx.textAlign = "right"; ctx.fillText(String(db), pad - 4, y(db) + 4);
  }
  const eff = { threshold: s.threshold, ratio: dry ? 1 : s.ratio, knee: s.knee };
  ctx.beginPath();
  for (let db = DB_MIN; db <= 0; db += 0.5) (db === DB_MIN ? ctx.moveTo : ctx.lineTo).call(ctx, x(db), y(db));
  for (let db = 0; db >= DB_MIN; db -= 0.5) ctx.lineTo(x(db), y(compressorCurveDb(db, eff)));
  ctx.closePath();
  ctx.fillStyle = withAlpha(c.gr, 0.22);
  ctx.fill();
  ctx.strokeStyle = c.muted; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x(DB_MIN), y(DB_MIN)); ctx.lineTo(x(0), y(0)); ctx.stroke();
  ctx.setLineDash([5, 4]); ctx.strokeStyle = c.gr;
  ctx.beginPath(); ctx.moveTo(x(s.threshold), y(DB_MIN)); ctx.lineTo(x(s.threshold), y(0)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let db = DB_MIN; db <= 0; db += 0.5) (db === DB_MIN ? ctx.moveTo : ctx.lineTo).call(ctx, x(db), y(compressorCurveDb(db, eff)));
  ctx.stroke();
  if (inDb > DB_MIN) {
    const out = Math.max(DB_MIN, inDb + grDb);
    ctx.strokeStyle = c.gr; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x(inDb), y(inDb)); ctx.lineTo(x(inDb), y(out)); ctx.stroke();
    ctx.fillStyle = c.fg;
    ctx.beginPath(); ctx.arc(x(inDb), y(out), 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = c.muted; ctx.textAlign = "left";
  ctx.fillText("out dB", pad + 4, 12);
  ctx.textAlign = "right"; ctx.fillText("in dB", W - 4, H - 22);
}

/** Three bars (input peak, gain reduction hanging from the top, output peak) and the gain-reduction history to their right, newest at the right edge. */
export function paintMeters(ctx: CanvasRenderingContext2D, W: number, H: number, c: CompressorPalette, s: CompressorSettings, dry: boolean, inDb: number, outDb: number, grDb: number, hist: Float32Array): void {
  const top = 20;
  const bot = H - 20;
  ctx.font = FONT;
  const levelY = (db: number) => bot - ((Math.max(DB_MIN, Math.min(0, db)) - DB_MIN) / -DB_MIN) * (bot - top);
  const bw = 30;
  const bars = [{ x: 4, label: "in" }, { x: 46, label: "GR" }, { x: 88, label: "out" }];
  ctx.textAlign = "center";
  for (const b of bars) {
    ctx.fillStyle = c.grid;
    ctx.fillRect(b.x, top, bw, bot - top);
    ctx.fillStyle = c.muted;
    ctx.fillText(b.label, b.x + bw / 2, H - 5);
  }
  ctx.fillStyle = c.accent;
  ctx.fillRect(bars[0].x, levelY(inDb), bw, bot - levelY(inDb));
  ctx.fillRect(bars[2].x, levelY(outDb), bw, bot - levelY(outDb));
  ctx.strokeStyle = c.gr; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bars[0].x - 3, levelY(s.threshold)); ctx.lineTo(bars[0].x + bw + 3, levelY(s.threshold)); ctx.stroke();
  const grY = (g: number) => top + (Math.min(GR_SCALE, -g) / GR_SCALE) * (bot - top);
  ctx.fillStyle = c.gr;
  ctx.fillRect(bars[1].x, top, bw, grY(grDb) - top);
  ctx.fillStyle = c.muted; ctx.textAlign = "left";
  for (const g of [0, -3, -6, -12]) ctx.fillText(String(g), bars[2].x + bw + 4, grY(g) + 4);

  const hx = 146;
  const hw = W - hx - 4;
  ctx.fillStyle = withAlpha(c.grid, 0.5);
  ctx.fillRect(hx, top, hw, bot - top);
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
  for (const g of [-3, -6, -12]) { ctx.beginPath(); ctx.moveTo(hx, grY(g)); ctx.lineTo(hx + hw, grY(g)); ctx.stroke(); }
  const gr = (i: number) => (dry ? 0 : hist[i]);
  const px = (i: number) => hx + (i / (hist.length - 1)) * hw;
  ctx.fillStyle = withAlpha(c.gr, 0.35);
  ctx.beginPath();
  ctx.moveTo(hx, top);
  for (let i = 0; i < hist.length; i++) ctx.lineTo(px(i), grY(gr(i)));
  ctx.lineTo(hx + hw, top);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = c.gr; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < hist.length; i++) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, px(i), grY(gr(i)));
  ctx.stroke();
  ctx.fillStyle = c.muted; ctx.textAlign = "left";
  ctx.fillText("gain reduction, last 3 s", hx, 12);
  ctx.textAlign = "right";
  ctx.fillText(`${(-grDb).toFixed(1)} dB`, W - 4, H - 5);
}
