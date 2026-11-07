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

function NameField({ name, editing, onStart, onDone, onCommit }: { name: string; editing: boolean; onStart: () => void; onDone: () => void; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { setDraft(name); input.current?.select(); } }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!editing) return <span className="wx-pat-name" onDoubleClick={onStart} title="Double-click or press F2 to rename">{name}</span>;
  const done = () => { onDone(); if (draft.trim() && draft !== name) onCommit(draft.trim()); };
  return <input ref={input} className="wx-pat-input" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={done} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") done(); else if (e.key === "Escape") onDone(); }} aria-label="Pattern name" />;
}

export function PatternsPanel(p: Props) {
  const nameOf = (id: PatternId) => p.patterns.find((x) => x.id === id)?.name ?? "?";
  const [renamingId, setRenamingId] = useState<PatternId | null>(null);
  const playingIndex = p.queue.findIndex((e) => e.id === p.playingEntryId);
  return (
    <div className="wx-pats">
      <div className="wx-pats-head">
        <span>{p.patterns.length} pattern{p.patterns.length === 1 ? "" : "s"}</span>
        <button className="wx-icon-btn" onClick={p.onAdd} aria-label="New pattern" title="New pattern"><Icon name="plus" /></button>
      </div>
      <ul className="wx-pat-list" aria-label="Patterns">
        {p.patterns.map((pat) => {
          const selected = pat.id === p.selectedPatternId;
          const playing = pat.id === p.playingPatternId;
          return (
            <li key={pat.id} className={`wx-pat ${selected ? "selected" : ""}`}>
              <div
                className="wx-pat-row"
                role={renamingId === pat.id ? "group" : "button"}
                tabIndex={0}
                aria-pressed={renamingId === pat.id ? undefined : selected}
                onClick={() => p.onSelect(pat.id)}
                onDoubleClick={() => p.onEdit(pat.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onSelect(pat.id); }
                  else if (e.key === "F2") { e.preventDefault(); setRenamingId(pat.id); }
                  else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const rows = [...(e.currentTarget.closest("ul")?.querySelectorAll<HTMLElement>(".wx-pat-row") ?? [])];
                    rows[rows.indexOf(e.currentTarget) + (e.key === "ArrowDown" ? 1 : -1)]?.focus();
                  }
                }}
              >
                <span className="wx-pat-state" title={playing ? "Playing" : undefined}>{playing && <><Icon name="play" size={10} fill /><span className="wx-sr-only">Playing</span></>}</span>
                <NameField name={pat.name} editing={renamingId === pat.id} onStart={() => setRenamingId(pat.id)} onDone={() => setRenamingId(null)} onCommit={(n) => p.onRename(pat.id, n)} />
                <span className="wx-pat-meta" title={`${pat.bars} bar${pat.bars === 1 ? "" : "s"}, ${tracksUsed(pat)} track${tracksUsed(pat) === 1 ? "" : "s"} used`}>
                  <span aria-hidden="true">{pat.bars} bar{pat.bars === 1 ? "" : "s"} · {tracksUsed(pat)}</span>
                  <span className="wx-sr-only">{pat.bars} bar{pat.bars === 1 ? "" : "s"}, {tracksUsed(pat)} track{tracksUsed(pat) === 1 ? "" : "s"} used</span>
                </span>
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
      <ol className="wx-queue" aria-label="Play queue">
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
