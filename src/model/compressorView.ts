// Pure side of the compressor display (components/CompressorDisplay.tsx): the model's parameters as webdsp's
// CompressorSettings, the presets as parameter patches, and the number formats. The curve, presets and
// reduction maths themselves are webdsp's (compressorCurveDb, presetSettings, ...).
import { COMPRESSOR_PRESETS, presetSettings, type CompressorSettings } from "webdsp";
import { FX_DEFS } from "./fx";

const KEYS = ["threshold", "ratio", "attack", "release", "knee", "makeup"] as const;

/** The compressor's six parameters (model values, defaults filled in) as webdsp settings. */
export function settingsFromParams(params: Record<string, number>): CompressorSettings {
  const out = {} as CompressorSettings;
  for (const key of KEYS) out[key] = params[key] ?? FX_DEFS.compressor.params.find((p) => p.id === key)!.default;
  return out;
}

/** What loading preset `index` sets, for a signal whose loudest hits peak at `peakDb` (webdsp's default drum level if omitted). */
export function presetPatch(index: number, peakDb?: number): CompressorSettings {
  return presetSettings(COMPRESSOR_PRESETS[index], peakDb);
}

/** True while `params` still hold exactly what a preset loaded (touching any control makes it a custom setting). */
export function sameSettings(params: Record<string, number>, loaded: CompressorSettings): boolean {
  const s = settingsFromParams(params);
  return KEYS.every((k) => Math.abs(s[k] - loaded[k]) < 1e-9);
}

export const fmtDb = (db: number) => `${db > 0 ? "+" : db < 0 ? "−" : ""}${Math.abs(db).toFixed(1)} dB`;
