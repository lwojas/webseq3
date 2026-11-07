// The Patterns section of the sidebar, in one column: the pattern list (select, rename, length, and the actions of the selected
// row) and under it the queue that Pattern mode plays. Replaces V1's two-column Patterns page, which could not fit a sidebar.
import { useEffect, useRef, useState } from "react";
import { MAX_PATTERN_BARS } from "../model/notes";
import type { ChainEntry, ChainEntryId, Pattern, PatternId } from "../model/types";
import { RafText } from "../components/RafText";
import { Icon } from "./kit/Icon";

interface Props {
  patterns: Pattern[];
  selectedPatternId: PatternId;
  playingPatternId: PatternId | null;
  onSelect: (id: PatternId) => void;
  /** Select and show it in the step lane. */
  onEdit: (id: PatternId) => void;
  onAdd: () => void;
  onDuplicate: (id: PatternId) => void;
  onRemove: (id: PatternId) => void;
  onRename: (id: PatternId, name: string) => void;
  onSetBars: (id: PatternId, bars: number) => void;
  onQueueNext: (id: PatternId) => void;
  onAddToArrange: (id: PatternId) => void;
  queue: ChainEntry[];
  playingEntryId: ChainEntryId | null;
  onRemoveEntry: (id: ChainEntryId) => void;
  onMoveEntry: (id: ChainEntryId, toIndex: number) => void;
  getPlayingBarText: () => string;
}

const tracksUsed = (p: Pattern) => new Set(Object.values(p.notes).map((n) => n.trackId)).size;

function NameField({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) input.current?.select(); }, [editing]);
  if (!editing) return <span className="wx-pat-name" onDoubleClick={() => { setDraft(name); setEditing(true); }} title="Double-click to rename">{name}</span>;
  const done = () => { setEditing(false); if (draft.trim() && draft !== name) onCommit(draft.trim()); };
  return <input ref={input} className="wx-pat-input" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={done} onKeyDown={(e) => { if (e.key === "Enter") done(); else if (e.key === "Escape") setEditing(false); }} aria-label="Pattern name" />;
}

export function PatternsPanel(p: Props) {
  const nameOf = (id: PatternId) => p.patterns.find((x) => x.id === id)?.name ?? "?";
  const playingIndex = p.queue.findIndex((e) => e.id === p.playingEntryId);
  return (
    <div className="wx-pats">
      <div className="wx-pats-head">
        <span>{p.patterns.length} pattern{p.patterns.length === 1 ? "" : "s"}</span>
        <button className="wx-icon-btn" onClick={p.onAdd} aria-label="New pattern" title="New pattern"><Icon name="plus" /></button>
      </div>
      <ul className="wx-pat-list">
        {p.patterns.map((pat) => {
          const selected = pat.id === p.selectedPatternId;
          const playing = pat.id === p.playingPatternId;
          return (
            <li key={pat.id} className={`wx-pat ${selected ? "selected" : ""}`}>
              <div className="wx-pat-row" onClick={() => p.onSelect(pat.id)} onDoubleClick={() => p.onEdit(pat.id)}>
                <span className="wx-pat-state" title={playing ? "Playing" : undefined}>{playing && <Icon name="play" size={10} fill />}</span>
                <NameField name={pat.name} onCommit={(n) => p.onRename(pat.id, n)} />
                <span className="wx-pat-meta" title={`${pat.bars} bar${pat.bars === 1 ? "" : "s"}, ${tracksUsed(pat)} track${tracksUsed(pat) === 1 ? "" : "s"} used`}>{pat.bars} bar{pat.bars === 1 ? "" : "s"} · {tracksUsed(pat)}</span>
              </div>
              {selected && (
                <div className="wx-pat-actions" role="toolbar" aria-label={`${pat.name} actions`}>
                  <button className="wx-icon-btn" onClick={() => p.onSetBars(pat.id, pat.bars - 1)} disabled={pat.bars <= 1} aria-label="Fewer bars" title="Fewer bars"><Icon name="minus" size={14} /></button>
                  <button className="wx-icon-btn" onClick={() => p.onSetBars(pat.id, pat.bars + 1)} disabled={pat.bars >= MAX_PATTERN_BARS} aria-label="More bars" title="More bars"><Icon name="plus" size={14} /></button>
                  <span className="wx-pat-sep" />
                  <button className="wx-icon-btn" onClick={() => p.onEdit(pat.id)} aria-label="Edit steps" title="Edit in the step lane"><Icon name="steps" /></button>
                  <button className="wx-icon-btn" onClick={() => p.onQueueNext(pat.id)} aria-label="Queue next" title="Queue it to play after the current pattern"><Icon name="queueAdd" /></button>
                  <button className="wx-icon-btn" onClick={() => p.onAddToArrange(pat.id)} aria-label="Add to Arrange" title="Place it on the Arrange timeline"><Icon name="arrangeAdd" /></button>
                  <button className="wx-icon-btn" onClick={() => p.onDuplicate(pat.id)} aria-label="Duplicate" title="Duplicate"><Icon name="copy" /></button>
                  <button className="wx-icon-btn" onClick={() => p.onRemove(pat.id)} disabled={p.patterns.length <= 1} aria-label="Delete" title="Delete pattern"><Icon name="trash" /></button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="wx-pats-head"><span title="Pattern mode plays these top to bottom, then loops">Queue</span></div>
      <ol className="wx-queue">
        {p.queue.map((entry, i) => {
          const now = i === playingIndex;
          return (
            <li key={entry.id} className={`wx-queue-item ${now ? "now" : i === playingIndex + 1 ? "next" : ""}`}>
              <span className="wx-queue-num">{i + 1}</span>
              <span className="wx-pat-name">{nameOf(entry.patternId)}</span>
              {now ? <RafText getText={p.getPlayingBarText} className="wx-pat-meta" /> : i === playingIndex + 1 ? <span className="wx-pat-meta">next</span> : null}
              <span className="wx-queue-actions">
                <button className="wx-icon-btn" onClick={() => p.onMoveEntry(entry.id, i - 1)} disabled={i === 0} aria-label="Move up" title="Move up"><Icon name="chevronUp" size={12} /></button>
                <button className="wx-icon-btn" onClick={() => p.onMoveEntry(entry.id, i + 1)} disabled={i === p.queue.length - 1} aria-label="Move down" title="Move down"><Icon name="chevronDown" size={12} /></button>
                <button className="wx-icon-btn" onClick={() => p.onRemoveEntry(entry.id)} disabled={p.queue.length <= 1} aria-label="Remove from queue" title="Remove from queue"><Icon name="close" size={12} /></button>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
