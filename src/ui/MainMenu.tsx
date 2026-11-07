// The main menu (☰): the things that belong to the application and the project file rather than to the music: project
// management (name, new / open / save / export / import), MIDI devices, help. A modal with a section list, opened from the app bar.
// docs/rebuild/04-ui-rules.md §11: a modal for work that is not part of the composition.
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { MidiPanel } from "../components/MidiPanel";
import { Icon, type IconName } from "./kit/Icon";
import { tabKeyDown, useFocusTrap } from "./kit/a11y";

export type MenuSection = "project" | "midi" | "help";

interface Props {
  section: MenuSection;
  onSection: (s: MenuSection) => void;
  onClose: () => void;
  projectName: string;
  onRename: (name: string) => void;
  isDirty: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
  fileError: string | null;
  currentId: string;
  savedProjects: { id: string; name: string }[];
  loadTargetId: string;
  onSelectSaved: (id: string) => void;
  onNew: () => void;
  onSave: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: () => void;
  midi: ComponentProps<typeof MidiPanel>;
  onShortcuts: () => void;
  onGuide: () => void;
}

const NAV: { id: MenuSection; label: string; icon: IconName }[] = [
  { id: "project", label: "Project", icon: "folder" },
  { id: "midi", label: "MIDI", icon: "midi" },
  { id: "help", label: "Help", icon: "help" },
];

export function MainMenu(p: Props) {
  const [openRequested, setOpenRequested] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") p.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Double-clicking a row selects it and opens it once that selection has reached the controller.
  useEffect(() => {
    if (openRequested && p.loadTargetId) { setOpenRequested(false); p.onOpen(); }
  }, [openRequested, p.loadTargetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Delete from the keyboard selects the row first; the controller's delete acts on that selection, so it runs once the selection has landed.
  useEffect(() => {
    if (deleteRequested && p.loadTargetId) { setDeleteRequested(false); p.onDelete(); }
  }, [deleteRequested, p.loadTargetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const discardOk = (what: string) => !p.isDirty || window.confirm(`This project has unsaved changes. ${what} anyway?`);
  const selected = p.savedProjects.find((s) => s.id === p.loadTargetId);

  return (
    <div className="wx-veil" onPointerDown={(e) => { if (e.target === e.currentTarget) p.onClose(); }}>
      <div className="wx-menu" role="dialog" aria-modal="true" aria-labelledby="wx-menu-title" ref={dialog} tabIndex={-1}>
        <h2 id="wx-menu-title" className="wx-sr-only">Main menu</h2>
        <nav className="wx-menu-nav" aria-label="Menu">
          <div className="wx-menu-tabs" role="tablist" aria-orientation="vertical" aria-label="Menu sections" onKeyDown={(e) => tabKeyDown(e, NAV.map((n) => n.id), p.section, p.onSection, true)}>
          {NAV.map((n) => (
            <button key={n.id} role="tab" data-tab={n.id} id={`wx-menu-tab-${n.id}`} aria-controls="wx-menu-panel" aria-selected={p.section === n.id} tabIndex={p.section === n.id ? 0 : -1} className={`wx-menu-nav-item ${p.section === n.id ? "active" : ""}`} onClick={() => p.onSection(n.id)}>
              <Icon name={n.icon} /> {n.label}
            </button>
          ))}
          </div>
          <span className="wx-spacer" />
          <button className="wx-menu-nav-item" onClick={p.onClose}><Icon name="close" /> Close</button>
        </nav>
        <div className="wx-menu-body" id="wx-menu-panel" role="tabpanel" aria-labelledby={`wx-menu-tab-${p.section}`}>
          {p.section === "project" && (
            <>
              <h2>Project</h2>
              <label className="wx-menu-field">
                <span>Name</span>
                <input className="wx-name wide" value={p.projectName} onChange={(e) => p.onRename(e.target.value)} aria-label="Project name" />
                <span className={`wx-save-state ${p.isDirty ? "dirty" : ""}`}>{p.saveStatus === "saving" ? "Saving…" : p.isDirty ? "Unsaved changes" : "All changes saved"}</span>
              </label>
              <div className="wx-menu-actions">
                <button className="wx-btn" onClick={() => discardOk("Start a new project") && p.onNew()}><Icon name="file" /> New</button>
                <button className="wx-btn primary" onClick={p.onSave} disabled={p.saveStatus === "saving"} title="Save in this browser (⌘S)"><Icon name="save" /> Save</button>
                <span className="wx-spacer" />
                <button className="wx-btn" onClick={p.onExport} title="Save the project, with its audio, as a file you can open in another browser or in the plugin"><Icon name="download" /> Export file</button>
                <button className="wx-btn" onClick={() => discardOk("Import a file") && p.onImport()} title="Open a project file"><Icon name="upload" /> Import file</button>
              </div>
              {p.saveError && <p className="wx-menu-error">Save failed: {p.saveError}</p>}
              {p.fileError && <p className="wx-menu-error">{p.fileError}</p>}
              <h3>Saved in this browser</h3>
              <span id="wx-saved-help" className="wx-sr-only">Arrow keys choose a project, Enter opens it, Delete removes it.</span>
              {p.savedProjects.length === 0 ? (
                <p className="wx-note">Nothing saved yet. Save keeps this project in your browser; Export file makes a copy you can keep or move.</p>
              ) : (
                <ul className="wx-saved" role="listbox" aria-label="Saved projects" aria-describedby="wx-saved-help">
                  {p.savedProjects.map((s, i) => {
                    const selectedHere = s.id === p.loadTargetId;
                    const tabbable = selectedHere || (!p.loadTargetId && i === 0);
                    return (
                      <li
                        key={s.id}
                        role="option"
                        aria-selected={selectedHere}
                        tabIndex={tabbable ? 0 : -1}
                        className={`${selectedHere ? "selected" : ""}`}
                        onClick={() => p.onSelectSaved(s.id)}
                        onDoubleClick={() => discardOk(`Open “${s.name}”`) && (p.onSelectSaved(s.id), setOpenRequested(true))}
                        onKeyDown={(e) => {
                          const list = p.savedProjects;
                          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                            e.preventDefault();
                            const next = list[Math.max(0, Math.min(list.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
                            p.onSelectSaved(next.id);
                            (e.currentTarget.parentElement?.children[list.indexOf(next)] as HTMLElement | undefined)?.focus();
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            if (discardOk(`Open “${s.name}”`)) { p.onSelectSaved(s.id); setOpenRequested(true); }
                          } else if (e.key === "Delete" || e.key === "Backspace") {
                            e.preventDefault();
                            p.onSelectSaved(s.id);
                            if (window.confirm(`Delete “${s.name}” from this browser? This cannot be undone.`)) setDeleteRequested(true);
                          }
                        }}
                      >
                        <Icon name="file" />
                        <span className="wx-saved-name">{s.name || "Untitled"}</span>
                        {s.id === p.currentId && <span className="wx-note">open now</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="wx-menu-actions">
                <button className="wx-btn" disabled={!selected} onClick={() => discardOk(`Open “${selected?.name}”`) && p.onOpen()}><Icon name="folder" /> Open</button>
                <button className="wx-btn" disabled={!selected} onClick={() => selected && window.confirm(`Delete “${selected.name}” from this browser? This cannot be undone.`) && p.onDelete()}><Icon name="trash" /> Delete</button>
              </div>
            </>
          )}
          {p.section === "midi" && (
            <>
              <h2>MIDI</h2>
              <p className="wx-note">Connect a controller (Launchpad, Push) for pad control. Plain MIDI keyboards play the selected track.</p>
              <MidiPanel {...p.midi} />
            </>
          )}
          {p.section === "help" && (
            <>
              <h2>Help</h2>
              <div className="wx-menu-actions col">
                <button className="wx-btn" onClick={() => { p.onClose(); p.onShortcuts(); }}><Icon name="help" /> Keyboard shortcuts</button>
                <button className="wx-btn" onClick={() => { p.onClose(); p.onGuide(); }}><Icon name="spark" /> Musical Guide</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
