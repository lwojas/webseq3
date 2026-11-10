import { describe, expect, it, vi } from "vitest";
import type { AudioRuntime, ScheduledEvent, VoiceHandle } from "webdsp";
import { Transport, type LoopRegion } from "../src/audio/transport";
import { Playback } from "../src/audio/playback";
import { addLane, addPatternToComposer, composerLanes, moveSequence, type PlaybackSource } from "../src/model/composer";
import { addAsset, addNote, addPattern, assignAsset, createInitialProject, setBpm } from "../src/model/project";
import type { Project } from "../src/model/types";

// Same approach as song.test.ts: the engine is faked, the Transport's own scheduling is real. 120 bpm, 16 steps per bar: a step is
// 0.125 s and a bar 2 s.
function fakeRuntime() {
  let time = 0;
  let handle = 1;
  const scheduled: ScheduledEvent[] = [];
  const runtime = {
    getCurrentTime: () => time,
    trigger: vi.fn(() => handle++),
    onVoiceEnded: vi.fn(() => () => {}),
    schedule: vi.fn((events: ScheduledEvent[]) => {
      scheduled.push(...events);
      return events.map(() => handle++);
    }),
    cancelScheduled: vi.fn(),
    setTempo: vi.fn(),
    release: vi.fn((_h: VoiceHandle) => {}),
    getCapabilities: vi.fn(() => ({ maxCaptureSeconds: 30 })),
  };
  return { runtime: runtime as unknown as AudioRuntime, scheduled, advance: (dt: number) => (time += dt) };
}
const noBus = () => undefined;
const asset = (id: number) => ({ id, name: `s${id}.wav`, type: "audio" as const, duration: 1, sampleRate: 48000, channels: 2, origin: "import" as const });

/** Pattern A: sample 1 on steps 0, 8 and 12. Pattern B: sample 2 on step 0. A sits on the lane at bars 0 and 2, B at bar 1. */
function songProject(): Project {
  let p = setBpm(createInitialProject("t", 4), 120);
  p = assignAsset(assignAsset(addAsset(addAsset(p, asset(1)), asset(2)), "track-1", 1), "track-2", 2);
  for (const step of [0, 8, 12]) p = addNote(p, p.patterns[0].id, "track-1", step);
  p = addPattern(p, "Pattern B");
  p = addNote(p, p.patterns[1].id, "track-2", 0);
  const [a, b] = [p.patterns[0].id, p.patterns[1].id];
  p = addLane(addPatternToComposer(p, a), "Bass");
  p = addPatternToComposer(p, a, composerLanes(p)[0].id);
  p = addPatternToComposer(p, b, composerLanes(p)[1].id);
  p = moveSequence(p, composerLanes(p)[0].sequences[1].id, 2);
  return moveSequence(p, composerLanes(p)[1].sequences[0].id, 1);
}

function setup(project: () => Project, source: PlaybackSource, loop: () => LoopRegion | null) {
  vi.useFakeTimers();
  const fake = fakeRuntime();
  const transport = new Transport(fake.runtime, project, noBus, new Playback(fake.runtime, noBus, () => false), undefined, () => source, loop);
  return { ...fake, transport, done: () => { transport.stop(); vi.useRealTimers(); } };
}
const times = (s: ScheduledEvent[], sampleId: number) => s.filter((e) => e.sampleId === sampleId).map((e) => Math.round(e.time * 100) / 100).sort((a, b) => a - b);
function run(t: ReturnType<typeof setup>, seconds: number) {
  for (let i = 0; i < seconds * 10; i++) {
    t.advance(0.1);
    vi.advanceTimersByTime(25);
  }
}

describe("looping a sequence (Song mode)", () => {
  it("plays only the looped bars, over and over, starting at the loop", () => {
    const project = songProject();
    const t = setup(() => project, "song", () => ({ start: 32, end: 48 })); // bar 2: the second drums sequence
    t.transport.play(); // from the start of the song: the loop pulls it in
    run(t, 4.3);
    // a whole pass is handed over when it comes into view, so the pass starting at 4.05 is already in
    expect(times(t.scheduled, 1)).toEqual([0.05, 1.05, 1.55, 2.05, 3.05, 3.55, 4.05, 5.05, 5.55]);
    expect(times(t.scheduled, 2)).toEqual([]); // the bass sits outside the loop
    t.advance(0.1);
    const beat = t.transport.getSongPosition()!.songBeat;
    expect(beat).toBeGreaterThanOrEqual(32);
    expect(beat).toBeLessThan(48);
    t.done();
  });

  it("cuts to the looped steps: notes before and after them are not played", () => {
    const project = songProject();
    const t = setup(() => project, "song", () => ({ start: 40, end: 44 })); // steps 8..12 of that sequence: its note on 8, not 12
    t.transport.play();
    run(t, 1.3);
    expect(times(t.scheduled, 1)).toEqual([0.05, 0.55, 1.05]);
    t.done();
  });

  it("plays from a position inside the loop, and from the loop's start when the position is outside it", () => {
    const project = songProject();
    const t = setup(() => project, "song", () => ({ start: 32, end: 48 }));
    t.transport.playFromBeat(40); // half way into the loop: the note on step 0 is behind it
    run(t, 1.2);
    expect(times(t.scheduled, 1)).toEqual([0.05, 0.55, 1.05, 2.05, 2.55]); // steps 8 and 12 now, then the whole loop from 1.05
    t.done();
  });
});

describe("looping steps of a pattern (Pattern mode)", () => {
  const patternLoop = (project: Project, start: number, end: number): LoopRegion => ({ patternId: project.patterns[0].id, start, end });

  it("repeats the looped steps from the loop's start", () => {
    const project = songProject();
    const t = setup(() => project, "pattern", () => patternLoop(project, 8, 12));
    t.transport.play();
    run(t, 1.3);
    expect(times(t.scheduled, 1)).toEqual([0.05, 0.55, 1.05]); // step 8 only: 0 is before the loop and 12 is its end
    t.done();
  });

  it("reports the playhead inside the looped steps", () => {
    const project = songProject();
    const t = setup(() => project, "pattern", () => patternLoop(project, 8, 12));
    t.transport.play();
    t.advance(0.3); // 0.25 s past the start = 2 steps
    expect(t.transport.getPlayheadInfo()).toEqual({ patternId: project.patterns[0].id, beat: expect.closeTo(10, 3) });
    t.advance(0.2); // 0.45 s = 3.6 steps in
    expect(t.transport.getPlayheadInfo().beat).toBeCloseTo(11.6, 3);
    t.advance(0.1); // 4.4 steps: round the loop
    expect(t.transport.getPlayheadInfo().beat).toBeCloseTo(8.4, 3);
    t.done();
  });

  it("carries on from where it was when a loop is switched on or off while playing", () => {
    const project = songProject();
    let loop: LoopRegion | null = null;
    const t = setup(() => project, "pattern", () => loop);
    t.transport.play();
    run(t, 0.3);
    loop = patternLoop(project, 8, 12);
    t.transport.reloop(); // the playhead is outside the new loop: it goes to the loop's start
    t.advance(0.2);
    const inside = t.transport.getPlayheadInfo().beat;
    expect(inside).toBeGreaterThanOrEqual(8);
    expect(inside).toBeLessThan(12);
    loop = null;
    t.transport.reloop();
    t.advance(0.2);
    expect(t.transport.getPlayheadInfo().patternId).toBe(project.patterns[0].id);
    expect(t.transport.getPlayheadInfo().beat).toBeGreaterThanOrEqual(inside); // on through the pattern, not back to its start
    t.done();
  });

  it("plays a stopped transport from the loop's start", () => {
    const project = songProject();
    const t = setup(() => project, "pattern", () => patternLoop(project, 8, 12));
    t.transport.play();
    run(t, 0.3);
    t.transport.stop();
    t.transport.play();
    t.advance(0.1);
    expect(t.transport.getPlayheadInfo().beat).toBeGreaterThanOrEqual(8);
    t.done();
  });
});

describe("play from a step of a pattern", () => {
  it("starts the queue at that step: earlier notes are not played", () => {
    const project = songProject();
    const t = setup(() => project, "pattern", () => null);
    t.transport.playPatternFrom(project.patterns[0].id, 8);
    run(t, 0.5);
    expect(times(t.scheduled, 1)).toEqual([0.05, 0.55]); // steps 8 and 12; step 0 is behind the start
    t.done();
  });

  it("starts the queue from its beginning when the pattern is not in it", () => {
    const project = songProject();
    const t = setup(() => project, "pattern", () => null);
    t.transport.playPatternFrom("no-such-pattern", 8);
    expect(t.transport.getStatus()).toBe("playing");
    expect(t.transport.getPlayheadInfo().patternId).toBe(project.patterns[0].id);
    t.done();
  });
});
