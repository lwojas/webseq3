// The sidebar: a narrow icon rail and one panel beside it (docs/rebuild/04-ui-rules.md §1). Sections are *content you pull from while
// composing*: Samples, Instruments, Patterns. Clicking the active icon collapses the panel. What does not belong here lives
// elsewhere: MIDI and project management in the main menu, copy/paste and bar tools in the Edit menu, the Musical Guide as a tool button.
import type { ComponentProps } from "react";
import { AssetsPanel } from "../components/AssetsPanel";
import { PatternList } from "../components/PatternList";
import { PatternQueue } from "../components/PatternQueue";
import { INSTRUMENT_DEFS, INSTRUMENT_KINDS } from "../model/instruments";
import type { InstrumentKindId, Track, TrackId } from "../model/types";
import { Icon, type IconName } from "./kit/Icon";

export type SidebarSection = "samples" | "instruments" | "patterns";

const RAIL: { id: SidebarSection; label: string; icon: IconName }[] = [
  { id: "samples", label: "Samples", icon: "sample" },
  { id: "instruments", label: "Instruments", icon: "keys" },
  { id: "patterns", label: "Patterns", icon: "grid" },
];

interface Props {
  /** null = the panel is collapsed and only the rail shows. */
  section: SidebarSection | null;
  onSection: (s: SidebarSection | null) => void;
  onGuide: () => void;
  samples: ComponentProps<typeof AssetsPanel>;
  patterns: { list: ComponentProps<typeof PatternList>; queue: ComponentProps<typeof PatternQueue> };
  instruments: {
    track: Track | null;
    unavailable: InstrumentKindId[];
    onSet: (trackId: TrackId, kind: InstrumentKindId | null) => void;
  };
}

export function Sidebar({ section, onSection, onGuide, samples, patterns, instruments }: Props) {
  const title = RAIL.find((r) => r.id === section)?.label;
  return (
    <aside className={`wx-sidebar ${section ? "open" : ""}`}>
      <nav className="wx-rail" aria-label="Library">
        {RAIL.map((r) => (
          <button key={r.id} className={`wx-rail-btn ${section === r.id ? "active" : ""}`} aria-pressed={section === r.id} aria-label={r.label} title={`${r.label}${section === r.id ? " (click to hide)" : ""}`} onClick={() => onSection(section === r.id ? null : r.id)}>
            <Icon name={r.icon} size={18} />
          </button>
        ))}
        <span className="wx-spacer" />
        <button className="wx-rail-btn" aria-label="Musical Guide" title="Musical Guide: hear your scale and try starting points" onClick={onGuide}><Icon name="spark" size={18} /></button>
      </nav>
      {section && (
        <div className="wx-side-panel">
          <div className="wx-side-title">{title}</div>
          <div className="wx-side-body">
            {section === "samples" && <AssetsPanel {...samples} />}
            {section === "patterns" && (
              <div className="wx-patterns">
                <PatternList {...patterns.list} />
                <PatternQueue {...patterns.queue} />
              </div>
            )}
            {section === "instruments" && <InstrumentBrowser {...instruments} />}
          </div>
        </div>
      )}
    </aside>
  );
}

function InstrumentBrowser({ track, unavailable, onSet }: Props["instruments"]) {
  if (!track) return <p className="wx-note wx-side-hint">Select a track to give it an instrument.</p>;
  const current = track.instrument?.kind ?? null;
  const groups: { label: string; kinds: InstrumentKindId[] }[] = [
    { label: "Drums", kinds: INSTRUMENT_KINDS.filter((k) => INSTRUMENT_DEFS[k].category === "drum") },
    { label: "Bass", kinds: INSTRUMENT_KINDS.filter((k) => INSTRUMENT_DEFS[k].category === "bass") },
    { label: "Synths", kinds: INSTRUMENT_KINDS.filter((k) => INSTRUMENT_DEFS[k].category === "synth") },
  ];
  return (
    <div className="wx-instruments">
      <p className="wx-note wx-side-hint">Click to load on <b>{track.name}</b>.</p>
      <button className={`wx-list-item ${current === null && track.assetId != null ? "selected" : ""}`} onClick={() => onSet(track.id, null)} title="Play a loaded sample instead of a synth"><Icon name="sample" /> Sample</button>
      {groups.map((g) => (
        <section key={g.label}>
          <h4>{g.label}</h4>
          {g.kinds.map((k) => (
            <button key={k} className={`wx-list-item ${current === k ? "selected" : ""}`} disabled={unavailable.includes(k)} title={unavailable.includes(k) ? "Not available in this audio engine build" : undefined} onClick={() => onSet(track.id, k)}>
              <Icon name="keys" /> {INSTRUMENT_DEFS[k].label}
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
