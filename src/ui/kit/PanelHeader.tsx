// The one panel header (docs/rebuild/04-ui-rules.md §8): ▾ TITLE · subject   [tabs]   ····   [actions] [maximise] [collapse].
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export interface TabDef<T extends string> {
  id: T;
  label: string;
  title?: string;
}

interface Props<T extends string> {
  title: string;
  /** The object the panel relates to ("05 CHORD"); omitted when the panel has no subject. */
  subject?: string;
  tabs?: TabDef<T>[];
  tab?: T;
  onTab?: (tab: T) => void;
  actions?: ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  maximised?: boolean;
  onToggleMaximised?: () => void;
}

export function PanelHeader<T extends string>({ title, subject, tabs, tab, onTab, actions, collapsed, onToggleCollapsed, maximised, onToggleMaximised }: Props<T>) {
  return (
    <div className="wx-panel-header">
      <button className="wx-panel-toggle" onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`} disabled={!onToggleCollapsed}>
        <Icon name={collapsed ? "chevronRight" : "chevronDown"} size={12} />
      </button>
      <span className="wx-panel-title">{title}</span>
      {subject && <span className="wx-panel-subject">· {subject}</span>}
      {tabs && !collapsed && (
        <div className="wx-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`wx-tab ${tab === t.id ? "active" : ""}`} title={t.title} onClick={() => onTab?.(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <span className="wx-spacer" />
      {!collapsed && actions}
      {onToggleMaximised && !collapsed && (
        <button className="wx-icon-btn" onClick={onToggleMaximised} aria-pressed={!!maximised} title={maximised ? "Restore (Esc)" : "Maximise"} aria-label="Maximise panel">
          <Icon name={maximised ? "restore" : "maximise"} size={13} />
        </button>
      )}
    </div>
  );
}
