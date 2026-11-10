import { useEffect, useRef, useState } from "react";
import { COMPRESSOR_PRESETS, DEFAULT_DRUM_PEAK_DB, GainReductionHistory, LoudnessChange, compressorMeter, peakToDb, reductionCharacter, staticGainReductionDb, type AudioRuntime, type BusId, type CompressorSettings } from "webdsp";
import { CanvasSurface } from "../viz/canvasSurface";
import { CURVE_SIZE, METER_SIZE, paintCurve, paintMeters, type CompressorPalette } from "../viz/compressorView";
import { cssColor } from "../viz/theme";
import { fmtDb, presetPatch, sameSettings, settingsFromParams } from "../model/compressorView";

/** What the display needs from the engine for one compressor: the runtime (for its meter feed), the bus the compressor sits on, and the
 * level-matched A/B switch (see FxChainSync.setDry). */
export interface CompressorTap {
  runtime: AudioRuntime;
  bus: BusId;
  setDry: (trimDb: number | null) => void;
}

interface Props {
  params: Record<string, number>;
  onSetParam: (paramId: string, value: number) => void;
  /** The engine side, polled until it exists; omit (or null) for a static curve with no meters. */
  tap?: () => CompressorTap | null;
}

const DB_FLOOR = -120;
const FALL_DB_PER_S = 30;
const GR_RECOVER_DB_PER_S = 40;
const TRACE_FRAMES = 180; // about 3 s of frames
const PEAK_FLOOR_DB = -40; // quieter than this is not "something playing" when fitting a preset's threshold

/** The compressor's display, above its parameters: the transfer curve with the live level on it, input / gain-reduction / output meters
 * with a 3 s reduction trace, the drum-bus presets, a level-matched dry A/B and a sentence on what threshold and ratio are doing to the
 * signal now. The numbers are the engine's own meter (MeterSnapshot.dynamics, per bus), the curve and presets are webdsp's. All drawing
 * runs on one animation frame loop outside React; React state is only the ~10 Hz readout under the graphs. */
export function CompressorDisplay({ params, onSetParam, tap }: Props) {
  const curveRef = useRef<HTMLCanvasElement>(null);
  const meterRef = useRef<HTMLCanvasElement>(null);
  const [dry, setDryState] = useState(false);
  const [loaded, setLoaded] = useState<{ index: number; settings: CompressorSettings } | null>(null);
  const [readout, setReadout] = useState({ inDb: DB_FLOOR, grDb: 0 });

  const paramsRef = useRef(params);
  paramsRef.current = params;
  const tapRef = useRef(tap);
  tapRef.current = tap;
  const dryRef = useRef(dry);
  dryRef.current = dry;
  const sourceRef = useRef<CompressorTap | null>(null);
  const loudness = useRef(new LoudnessChange());
  const peaks = useRef<number[]>([]); // recent input peaks (dB), one per frame, for fitting a preset's threshold

  useEffect(() => {
    const curveCanvas = curveRef.current;
    const meterCanvas = meterRef.current;
    if (!curveCanvas || !meterCanvas) return;
    const curve = new CanvasSurface(curveCanvas, CURVE_SIZE);
    const meters = new CanvasSurface(meterCanvas, METER_SIZE);
    const palette: CompressorPalette = {
      fg: cssColor(curveCanvas, "--text", "#c9d1de"),
      muted: cssColor(curveCanvas, "--text-dim", "#6b7686"),
      grid: cssColor(curveCanvas, "--border", "#232a35"),
      accent: cssColor(curveCanvas, "--accent", "#29e0e0"),
      gr: cssColor(curveCanvas, "--amber", "#f0a83c"),
    };
    // Meter intervals arrive from the engine ~47 times a second; they accumulate here and are drained once per frame.
    const acc = { inPk: 0, outPk: 0, gr: 0 };
    const live = { inDb: DB_FLOOR, outDb: DB_FLOOR, gr: 0 };
    const history = new GainReductionHistory(TRACE_FRAMES);
    let off: (() => void) | null = null;
    let source: CompressorTap | null = null;
    let raf = 0;
    let last = performance.now();
    let lastReadout = 0;
    let busyFrames = 0;
    let signature = "";

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!source) {
        source = tapRef.current?.() ?? null;
        sourceRef.current = source;
        if (source) {
          off = source.runtime.onMeters((m) => {
            const c = compressorMeter(m, source!.bus);
            acc.inPk = Math.max(acc.inPk, c.inPeak);
            acc.outPk = Math.max(acc.outPk, c.outPeak);
            acc.gr = Math.min(acc.gr, c.gainReductionDb);
            if (!dryRef.current) loudness.current.push(c.inPeak, c.gainReductionDb, settingsFromParams(paramsRef.current).makeup);
          });
        }
      }
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const inDb = acc.inPk > 1e-6 ? peakToDb(acc.inPk) : DB_FLOOR;
      const outDb = acc.outPk > 1e-6 ? peakToDb(acc.outPk) : DB_FLOOR;
      if (acc.inPk > 0 || acc.gr < 0) busyFrames = TRACE_FRAMES;
      else if (busyFrames > 0) busyFrames--;
      live.inDb = Math.max(inDb, live.inDb - FALL_DB_PER_S * dt);
      live.outDb = Math.max(outDb, live.outDb - FALL_DB_PER_S * dt);
      // Reduction is instant on the way down and eased on the way back, so a 5 ms dip is still visible.
      live.gr = Math.min(acc.gr, Math.min(0, live.gr + GR_RECOVER_DB_PER_S * dt));
      peaks.current.push(inDb);
      if (peaks.current.length > TRACE_FRAMES) peaks.current.shift();
      history.push(acc.gr);
      acc.inPk = acc.outPk = acc.gr = 0;

      const s = settingsFromParams(paramsRef.current);
      const sig = `${s.threshold}|${s.ratio}|${s.knee}|${dryRef.current}|${live.inDb.toFixed(1)}|${live.outDb.toFixed(1)}|${live.gr.toFixed(1)}`;
      if (curve.dirty || meters.dirty || busyFrames > 0 || sig !== signature) {
        signature = sig;
        const cctx = curve.begin();
        if (cctx) paintCurve(cctx, curve.width, curve.height, palette, s, dryRef.current, live.inDb, live.gr);
        const mctx = meters.begin();
        if (mctx) paintMeters(mctx, meters.width, meters.height, palette, s, dryRef.current, live.inDb, live.outDb, live.gr, history.values());
      }
      if (t - lastReadout > 100) {
        lastReadout = t;
        setReadout((r) => (Math.abs(r.inDb - live.inDb) < 0.1 && Math.abs(r.grDb - live.gr) < 0.1 ? r : { inDb: live.inDb, grDb: live.gr }));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      off?.();
      if (dryRef.current) source?.setDry(null); // never leave a compressor parked at 1:1
      sourceRef.current = null;
      curve.dispose();
      meters.dispose();
    };
  }, []);

  const s = settingsFromParams(params);
  const activePreset = loaded && sameSettings(params, loaded.settings) ? loaded.index : null;

  const loadPreset = (index: number) => {
    // Fit the threshold to what is playing, else to a normal drum level.
    const recent = Math.max(...peaks.current, DB_FLOOR);
    const next = presetPatch(index, recent > PEAK_FLOOR_DB ? recent : DEFAULT_DRUM_PEAK_DB);
    for (const [id, value] of Object.entries(next)) onSetParam(id, value);
    setLoaded({ index, settings: next });
  };

  const toggleDry = () => {
    const next = !dry;
    sourceRef.current?.setDry(next ? loudness.current.db() : null);
    setDryState(next);
  };

  const over = readout.inDb - s.threshold;
  const active = readout.inDb > -100;
  const expected = staticGainReductionDb(readout.inDb, s);

  return (
    <div className="comp-display">
      <div className="comp-top">
        <div className="comp-presets" role="group" aria-label="Compressor presets">
          {COMPRESSOR_PRESETS.map((p, i) => (
            <button key={p.name} className={activePreset === i ? "active" : ""} onClick={() => loadPreset(i)} title={`${p.purpose}. Threshold is set from what is playing, makeup is explicit.`}>
              {p.name}
            </button>
          ))}
        </div>
        <button
          className={`comp-ab ${dry ? "dry" : ""}`}
          onClick={toggleDry}
          disabled={!tap}
          title="A/B: the same signal without compression, raised or lowered by what the compressor was doing to the level, so it is not just a loudness comparison. Not saved."
        >
          {dry ? "Dry (level-matched)" : "Compressed"}
        </button>
      </div>
      <div className="comp-graphs">
        <canvas ref={curveRef} className="comp-curve" role="img" aria-label="Compressor transfer curve" />
        <canvas ref={meterRef} className="comp-meters" role="img" aria-label="Level and gain reduction" />
      </div>
      <p className="comp-story">
        {dry ? (
          <>Dry: compression is off and the level is matched to what it was doing.</>
        ) : !tap || !active ? (
          <>Play something to see what it does. Threshold {fmtDb(s.threshold)}, {s.ratio.toFixed(1)}:1.</>
        ) : over <= -s.knee / 2 ? (
          <>Peaks are {Math.abs(over).toFixed(1)} dB <b>below</b> the threshold: nothing to compress. Lower the threshold.</>
        ) : (
          <>
            Peaks are <b>{Math.max(0, over).toFixed(1)} dB over</b> the threshold. At {s.ratio.toFixed(1)}:1 that settles at <b>{fmtDb(expected)}</b>; the meter reads{" "}
            <b>{fmtDb(readout.grDb)}</b> ({reductionCharacter(readout.grDb)}) because attack lets the start of each hit through.
          </>
        )}
      </p>
    </div>
  );
}
