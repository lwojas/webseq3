// A panel edge (docs/rebuild/04-ui-rules.md §12). Dragging writes a CSS variable straight onto the shell element and commits
// once on release, so a drag never re-renders the application.
import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Props {
  /** "col": a vertical bar dragged left/right (a width). "row": a horizontal bar dragged up/down (a height). */
  axis: "col" | "row";
  shellRef: RefObject<HTMLElement | null>;
  cssVar: string;
  value: number;
  min: number;
  max: number;
  /** +1: dragging toward the end of the axis grows the panel; -1: it shrinks it (a bottom panel grows upward). */
  direction: 1 | -1;
  onCommit: (value: number) => void;
  label: string;
}

export function Splitter({ axis, shellRef, cssVar, value, min, max, direction, onCommit, label }: Props) {
  const start = useRef<{ pointer: number; value: number } | null>(null);
  const live = useRef(value);
  const down = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { pointer: axis === "col" ? e.clientX : e.clientY, value };
    live.current = value;
  };
  const move = (e: ReactPointerEvent) => {
    if (!start.current) return;
    const delta = ((axis === "col" ? e.clientX : e.clientY) - start.current.pointer) * direction;
    live.current = clamp(start.current.value + delta, min, max);
    shellRef.current?.style.setProperty(cssVar, `${live.current}px`);
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    onCommit(live.current);
  };
  const key = (e: ReactKeyboardEvent) => {
    const grow = axis === "col" ? "ArrowRight" : "ArrowUp";
    const shrink = axis === "col" ? "ArrowLeft" : "ArrowDown";
    if (e.key !== grow && e.key !== shrink) return;
    e.preventDefault();
    onCommit(clamp(value + (e.key === grow ? 16 : -16) * direction, min, max));
  };
  return (
    <div
      className={`wx-splitter ${axis}`}
      role="separator"
      aria-orientation={axis === "col" ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    />
  );
}
