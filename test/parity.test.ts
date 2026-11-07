import reducerSrc from "../src/model/reducer.ts?raw";
import controllerSrc from "../src/state/useController.tsx?raw";
import { describe, expect, it } from "vitest";
import { ACTION_SURFACES, HANDLER_SURFACES } from "../src/ui/parity";

describe("V1 feature parity map (docs/rebuild/01-v1-audit.md)", () => {
  const actionTypes = [...reducerSrc.matchAll(/^  \| \{ type: "([A-Z_]+)"/gm)].map((m) => m[1]);
  const controller = controllerSrc;
  const handlers = [...new Set([...controller.matchAll(/const (handle[A-Z]\w*)\b/g)].map((m) => m[1]))];

  it("parses the reducer's Action union", () => expect(actionTypes.length).toBeGreaterThan(90));
  it("gives every reducer action a surface", () => {
    expect(actionTypes.filter((a) => !ACTION_SURFACES[a]?.length)).toEqual([]);
  });
  it("lists no action the reducer does not have", () => {
    expect(Object.keys(ACTION_SURFACES).filter((a) => !actionTypes.includes(a))).toEqual([]);
  });
  it("gives every controller handler a surface", () => {
    expect(handlers.filter((h) => !HANDLER_SURFACES[h]?.length)).toEqual([]);
  });
  it("lists no handler the controller does not have", () => {
    expect(Object.keys(HANDLER_SURFACES).filter((h) => !handlers.includes(h))).toEqual([]);
  });
});
