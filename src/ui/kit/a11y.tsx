// Accessibility primitives shared by the shell (docs/rebuild/04-ui-rules.md §18). Nothing here draws anything: they add focus
// behaviour, keyboard behaviour and screen-reader announcements to the existing controls.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/** A modal's focus behaviour: focus moves in when it opens (to `initial` or the first control), Tab and Shift+Tab stay inside, and
 * focus returns to whatever opened it when it closes. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, initial?: () => HTMLElement | null) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const opener = document.activeElement as HTMLElement | null;
    (initial?.() ?? focusableIn(root)[0] ?? root).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusableIn(root);
      if (items.length === 0) { e.preventDefault(); root.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === root || !root.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !root.contains(active))) { e.preventDefault(); first.focus(); }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Arrow-key behaviour for a tab strip (WAI-ARIA tabs, automatic activation): Left/Right (or Up/Down) move to the neighbouring tab,
 * Home/End to the ends. Focus follows the selection, so with roving tabindex Tab leaves the strip. */
export function tabKeyDown<T extends string>(e: ReactKeyboardEvent, ids: T[], current: T, select: (id: T) => void, vertical = false) {
  const prev = vertical ? "ArrowUp" : "ArrowLeft";
  const next = vertical ? "ArrowDown" : "ArrowRight";
  const i = ids.indexOf(current);
  let to = -1;
  if (e.key === next) to = (i + 1) % ids.length;
  else if (e.key === prev) to = (i - 1 + ids.length) % ids.length;
  else if (e.key === "Home") to = 0;
  else if (e.key === "End") to = ids.length - 1;
  if (to < 0) return;
  e.preventDefault();
  const id = ids[to];
  select(id);
  const strip = e.currentTarget as HTMLElement;
  requestAnimationFrame(() => strip.querySelector<HTMLElement>(`[data-tab="${id}"]`)?.focus());
}

// --- announcements (a polite live region owned by the shell) ---

const AnnounceContext = createContext<(message: string) => void>(() => {});
export const useAnnounce = () => useContext(AnnounceContext);

/** Provides `useAnnounce()` and renders the visually hidden live region. Repeating the same message still re-announces. */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState("");
  const flip = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const say = useCallback((message: string) => {
    flip.current = !flip.current;
    setText(flip.current ? message : `${message} `);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(""), 4000);
  }, []);
  return (
    <AnnounceContext.Provider value={say}>
      {children}
      <div className="wx-sr-only" role="status" aria-live="polite" aria-atomic="true">{text}</div>
    </AnnounceContext.Provider>
  );
}
