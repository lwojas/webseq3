// An anchored popover: a trigger button and a floating panel that closes on outside press or Esc (docs/rebuild/04-ui-rules.md §10:
// a setting used occasionally lives in a popover, not another permanent control).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { focusableIn } from "./a11y";

interface Props {
  /** Rendered inside the trigger button. */
  trigger: ReactNode;
  label: string;
  title?: string;
  className?: string;
  align?: "left" | "right";
  children: (close: () => void) => ReactNode;
  disabled?: boolean;
}

export function Popover({ trigger, label, title, className = "wx-icon-btn", align = "left", children, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  // Fixed positioning from the trigger, so no overflow:hidden ancestor (the context bar) can clip the panel.
  const toggle = () => {
    if (!open && root.current) {
      const r = root.current.getBoundingClientRect();
      setPos(align === "right" ? { top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) } : { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 240)) });
    }
    setOpen((o) => !o);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); triggerRef.current?.focus(); } };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("pointerdown", onDown); window.removeEventListener("keydown", onKey, true); };
  }, [open]);
  // Opening moves focus into the panel (the first control); Esc returns it to the trigger.
  useEffect(() => {
    if (open) (focusableIn(panel.current)[0] ?? panel.current)?.focus();
  }, [open]);
  return (
    <div className="wx-popover-anchor" ref={root}>
      <button ref={triggerRef} className={`${className} ${open ? "open" : ""}`} onClick={toggle} aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={title ?? label} disabled={disabled}>
        {trigger}
      </button>
      {open && <div className="wx-popover" style={pos} role="dialog" aria-label={label} ref={panel} tabIndex={-1}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
