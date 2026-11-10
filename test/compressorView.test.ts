import { describe, expect, it, vi } from "vitest";
import { COMPRESSOR_PRESETS, DEFAULT_DRUM_PEAK_DB } from "webdsp";
import { presetPatch, sameSettings, settingsFromParams } from "../src/model/compressorView";
import { FxChainSync } from "../src/audio/fxChain";
import { addFx } from "../src/model/fx";
import { createInitialProject } from "../src/model/project";
import { NodeParam, type AudioRuntime } from "webdsp";

describe("compressor display model", () => {
  it("fills defaults into settings", () => {
    expect(settingsFromParams({ threshold: -30 })).toMatchObject({ threshold: -30, ratio: 4, knee: 6, makeup: 0 });
  });

  it("places a preset's threshold relative to the peak and recognises it until a control moves", () => {
    const quiet = presetPatch(1, -20);
    const normal = presetPatch(1);
    expect(normal.threshold).toBeCloseTo(DEFAULT_DRUM_PEAK_DB - COMPRESSOR_PRESETS[1].thresholdBelowPeakDb, 0);
    expect(quiet.threshold).toBeLessThan(normal.threshold);
    expect(sameSettings({ ...normal }, normal)).toBe(true);
    expect(sameSettings({ ...normal, ratio: normal.ratio + 1 }, normal)).toBe(false);
  });
});

describe("compressor level-matched dry", () => {
  it("runs the compressor at 1:1 with the trim as makeup, and restores the project values", () => {
    const set = vi.fn();
    const runtime = { addEffect: () => 7, setEffectParameter: set, setEffectEnabled: vi.fn() } as unknown as AudioRuntime;
    const chains = new FxChainSync(runtime);
    const project = addFx(createInitialProject(), "track-1", "compressor");
    const fx = project.tracks.find((t) => t.id === "track-1")!.fx;
    chains.sync(1, fx);
    set.mockClear();
    chains.setDry(1, fx[0].id, 3.5);
    expect(set).toHaveBeenCalledWith(1, 7, NodeParam.CompRatio, 1);
    expect(set).toHaveBeenCalledWith(1, 7, NodeParam.CompMakeup, 3.5);
    set.mockClear();
    chains.setDry(1, fx[0].id, null);
    expect(set).toHaveBeenCalledWith(1, 7, NodeParam.CompRatio, 4);
    expect(set).toHaveBeenCalledWith(1, 7, NodeParam.CompMakeup, 0);
  });
});
