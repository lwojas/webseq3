// One keyboard registry (docs/rebuild/02-webseq2-study.md "Shortcut registry"). Every shortcut the rebuilt shell owns is an
// entry here, guarded once against typing in a field and against the Musical Guide, and the cheat-sheet (?) is generated from
// the same list. Keys the V1 controller still handles itself (Space, [ ], undo/redo, copy/paste, Delete on a track) are listed
// as `external` so the cheat-sheet is complete.
import { useEffect, useRef } from "react";
import { useFocusTrap } from "./kit/a11y";

export interface Shortcut {
  /** Display text, e.g. "1", "⌘Z". */
  keys: string;
  label: string;
  scope: "Global" | "Pattern" | "Arrange" | "Roll";
  /** Matches a keydown (not used for external entries). */
  match?: (e: KeyboardEvent) => boolean;
  run?: () => void;
}

export const key = (k: string) => (e: KeyboardEvent) => !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === k;

export const EXTERNAL_SHORTCUTS: Shortcut[] = [
  { keys: "Space", label: "Play / stop", scope: "Global" },
  { keys: "⌘Z · ⇧⌘Z", label: "Undo · redo", scope: "Global" },
  { keys: "[  ]", label: "Previous · next pattern", scope: "Pattern" },
  { keys: "⌘C · ⌘V", label: "Copy · paste the track's notes", scope: "Pattern" },
  { keys: "← → ↑ ↓", label: "Move the step cursor (in the step lane)", scope: "Pattern" },
  { keys: "Enter", label: "Add / remove the cursor's step", scope: "Pattern" },
  { keys: "Delete", label: "Remove the selected step's notes", scope: "Pattern" },
  { keys: "Alt-drag", label: "Free placement (ignores the grid)", scope: "Pattern" },
  { keys: "Double-click", label: "Open a clip's pattern", scope: "Arrange" },
  { keys: "Click · drag · ⇧-drag", label: "Draw · move · select notes", scope: "Roll" },
  { keys: "⌘D", label: "Duplicate the selected notes", scope: "Roll" },
];

/** Runs the first matching shortcut. `blocked` is true while something owns the keyboard (the Musical Guide). */
export function useShortcuts(list: Shortcut[], blocked: boolean) {
  const ref = useRef(list);
  ref.current = list;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (blocked) return;
      const el = e.target as HTMLElement | null;
      // Plain keys belong to a focused field; ⌘/Ctrl chords (save, open) work from anywhere.
      if (!(e.metaKey || e.ctrlKey) && el && (el.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName))) return;
      const hit = ref.current.find((s) => s.match?.(e));
      if (!hit) return;
      e.preventDefault();
      hit.run?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked]);
}

export function CheatSheet({ list, onClose }: { list: Shortcut[]; onClose: () => void }) {
  const all = [...list, ...EXTERNAL_SHORTCUTS];
  const scopes = ["Global", "Pattern", "Arrange", "Roll"] as const;
  const card = useRef<HTMLDivElement>(null);
  useFocusTrap(card);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="wx-veil" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wx-veil-card wx-cheat" ref={card} role="dialog" aria-modal="true" aria-labelledby="wx-cheat-title" tabIndex={-1}>
        <h2 className="wx-panel-title" id="wx-cheat-title" style={{ margin: 0, fontWeight: "normal" }}>KEYBOARD SHORTCUTS</h2>
        {scopes.map((scope) => (
          <section key={scope}>
            <h3>{scope}</h3>
            {all.filter((s) => s.scope === scope).map((s) => (
              <div key={s.keys + s.label} className="wx-cheat-row"><kbd>{s.keys}</kbd><span>{s.label}</span></div>
            ))}
          </section>
        ))}
        <button className="wx-btn" onClick={onClose}>Close (Esc)</button>
      </div>
    </div>
  );
}
