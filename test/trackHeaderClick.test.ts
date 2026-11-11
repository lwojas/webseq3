import { describe, expect, it } from "vitest";
import { startsOnButton } from "../src/ui/kit/TrackHeader";

// Clicking M / S (or notes / play) in a track header must not also select the track: selecting expands the graph editor
// and makes the UI jump. The header selects on pointerdown, so it has to ignore pointerdowns that start on a button.
const target = (insideButton: boolean) => ({ closest: (sel: string) => (sel === "button" && insideButton ? {} : null) }) as unknown as EventTarget;

describe("startsOnButton", () => {
  it("is true for a pointerdown on (or inside) a button", () => {
    expect(startsOnButton(target(true))).toBe(true);
  });

  it("is false for a pointerdown on the rest of the header", () => {
    expect(startsOnButton(target(false))).toBe(false);
  });

  it("is false when there is no target", () => {
    expect(startsOnButton(null)).toBe(false);
  });
});
