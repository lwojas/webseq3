// The one panel header (docs/rebuild/04-ui-rules.md §8): ▾ TITLE · subject   [tabs]   ····   [actions] [maximise] [collapse].
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { tabKeyDown } from "./a11y";

export interface TabDef<T extends string> {
  id: T;
  label: string;
  title?: string;
}

interface Props<T extends string> {
  /** Ties the tabs to their panel: tab ids are `${idBase}-${tab}`, the panel is `${idBase}-panel` (see tabPanelProps). */
  idBase?: string;
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

/** Props for the element a PanelHeader's tabs control. */
export const tabPanelProps = (idBase: string, tab: string) => ({ id: `${idBase}-panel`, role: "tabpanel" as const, "aria-labelledby": `${idBase}-${tab}` });

export function PanelHeader<T extends string>({ idBase, title, subject, tabs, tab, onTab, actions, collapsed, onToggleCollapsed, maximised, onToggleMaximised }: Props<T>) {
  return (
    <div className="wx-panel-header">
      {onToggleCollapsed && (
        <button className={`wx-panel-toggle ${collapsed ? "collapsed" : ""}`} onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`}>
          <Icon name="chevronDown" size={12} />
        </button>
      )}
      <span className="wx-panel-title">{title}</span>
      {subject && <span className="wx-panel-subject">· {subject}</span>}
      {tabs && !collapsed && (
        <div className="wx-tabs" role="tablist" aria-label={`${title} sections`} onKeyDown={tab && onTab ? (e) => tabKeyDown(e, tabs.map((t) => t.id), tab, onTab) : undefined}>
          {tabs.map((t) => (
            <button key={t.id} role="tab" data-tab={t.id} id={idBase ? `${idBase}-${t.id}` : undefined} aria-controls={idBase ? `${idBase}-panel` : undefined} aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} className={`wx-tab ${tab === t.id ? "active" : ""}`} title={t.title} onClick={() => onTab?.(t.id)}>
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
