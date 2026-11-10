import { describe, expect, it } from "vitest";
import { createInitialProject } from "../src/model/project";
import { assignAsset, clearTrackSource, renameTrack, setTrackFxRole } from "../src/model/project";
import { setTrackInstrument } from "../src/model/instruments";
import { setTrackEnvelope, setTrackSampleMode } from "../src/model/project";
import { trackLabel } from "../src/model/types";
import type { Asset } from "../src/model/types";

const asset: Asset = { id: 7, name: "snare", type: "audio", duration: 1, sampleRate: 48000, channels: 1, origin: "import" };
const base = () => ({ ...createInitialProject(), assets: [asset] });
const id = (p: ReturnType<typeof base>) => p.tracks[0].id;
const first = (p: ReturnType<typeof base>) => p.tracks[0];

describe("track source clear / rename / FX role", () => {
  it("clearing a sample drops its envelope and chop mode too", () => {
    let p = assignAsset(base(), id(base()), 7);
    p = setTrackEnvelope(p, p.tracks[0].id, { attack: 1 });
    p = setTrackSampleMode(p, p.tracks[0].id, "chop");
    p = clearTrackSource(p, p.tracks[0].id);
    expect(first(p).assetId).toBeNull();
    expect(first(p).envelope).toBeUndefined();
    expect(first(p).sampleMode).toBeUndefined();
  });

  it("a renamed track keeps its name when a source is assigned; blank follows the source again", () => {
    let p = base();
    p = renameTrack(p, first(p).id, "  Lead  ");
    p = assignAsset(p, first(p).id, 7);
    expect(first(p).name).toBe("Lead");
    expect(trackLabel(first(renameTrack(base(), first(base()).id, "Bus")))).toBe("Bus");
    p = renameTrack(p, first(p).id, "");
    expect(first(p).name).toBe("snare");
    expect(first(p).customName).toBeUndefined();
  });

  it("an FX track is cleared, labelled, and locked against samples and synths", () => {
    let p = assignAsset(base(), first(base()).id, 7);
    p = setTrackFxRole(p, first(p).id, true);
    expect(first(p).fxTrack).toBe(true);
    expect(first(p).assetId).toBeNull();
    expect(trackLabel(first(p))).toBe("FX");
    expect(first(assignAsset(p, first(p).id, 7)).assetId).toBeNull();
    expect(first(setTrackInstrument(p, first(p).id, "kick")).instrument ?? null).toBeNull();
    p = setTrackFxRole(p, first(p).id, false);
    expect(first(assignAsset(p, first(p).id, 7)).assetId).toBe(7);
  });
});
