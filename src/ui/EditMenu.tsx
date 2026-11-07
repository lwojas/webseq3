// The Edit menu (context bar, ✎ Edit ▾): history, copy / paste of what the selected track holds, and one-shot pattern tools.
// Same operations as V1's Edit panel (they come from the same model: app/editModel.ts), but compact: icon buttons, short names,
// and the long explanations (what is copied, which bar a tool acts on, why something is unavailable) are tooltips, not text on
// every row. In the Arrange workspace the same menu carries the selected clip's and lane's details instead.
import type { ComponentProps } from "react";
import type { BarTool, ClipboardRow } from "../components/EditPanel";
import { ComposerDetails } from "../components/ComposerDetails";
import { Icon, type IconName } from "./kit/Icon";

interface Props {
  history: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void };
  clipboard: ClipboardRow[];
  barTools: BarTool[];
  chopTools: BarTool[];
  feedback: string | null;
  composer?: ComponentProps<typeof ComposerDetails>;
}

const CLIPBOARD_NAME: Record<string, string> = { track: "Track", sequence: "Notes", instrument: "Instrument", fx: "FX", modulation: "Modulation", bank: "Bank" };
const CLIPBOARD_HELP: Record<string, string> = {
  track: "the whole track: notes, instrument, FX and modulation",
  sequence: "this track's notes in this pattern",
  instrument: "the sample or synth with its settings",
  fx: "the FX chain",
  modulation: "LFOs and automation",
  bank: "all 16 tracks of the bank",
};

const TOOL_NAME: Record<string, { label: string; icon: IconName }> = {
  "clear-sequence": { label: "Clear track", icon: "trash" },
  "duplicate-sequence": { label: "Double length", icon: "copy" },
  "duplicate-bar": { label: "Append bar", icon: "plus" },
  "extend-track-1": { label: "Repeat bar", icon: "loop" },
  "extend-track-end": { label: "Repeat to end", icon: "loop" },
  "fill-bar-chops": { label: "Fill bar", icon: "steps" },
  "fill-sequence-chops": { label: "Fill all bars", icon: "steps" },
  "randomise-bar-chops": { label: "Shuffle bar", icon: "shuffle" },
  "randomise-sequence-chops": { label: "Shuffle all bars", icon: "shuffle" },
};

function Tools({ tools }: { tools: BarTool[] }) {
  return (
    <div className="wx-edit-tools">
      {tools.map((t) => {
        const name = TOOL_NAME[t.id] ?? { label: t.label, icon: "pencil" as IconName };
        return (
          <button key={t.id} className="wx-edit-tool" disabled={t.blocked !== null} title={t.blocked ?? `${t.label}${t.hint ? `: ${t.hint}` : ""}`} onClick={t.onRun}>
            <Icon name={name.icon} size={14} /> {name.label}
            {t.blocked === null && t.hint && <span className="wx-edit-hint">{t.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function EditMenu({ history, clipboard, barTools, chopTools, feedback, composer }: Props) {
  // Chop tools only matter on a sample chop track; elsewhere they would be four disabled buttons.
  const showChop = chopTools.some((t) => t.blocked === null);
  return (
    <div className="wx-edit-menu">
      <div className="wx-edit-history" role="group" aria-label="History">
        <button className="wx-btn" disabled={!history.canUndo} onClick={history.onUndo} title={history.canUndo ? "Undo (⌘Z)" : "Nothing to undo"}><Icon name="undo" /> Undo</button>
        <button className="wx-btn" disabled={!history.canRedo} onClick={history.onRedo} title={history.canRedo ? "Redo (⇧⌘Z)" : "Nothing to redo"}><Icon name="redo" /> Redo</button>
      </div>
      {composer ? (
        <ComposerDetails {...composer} />
      ) : (
        <>
          <h4>Copy / paste</h4>
          <div className="wx-edit-clip">
            {clipboard.map((row) => (
              <div key={row.id} className="wx-edit-clip-row">
                <span title={`Copy or paste ${CLIPBOARD_HELP[row.id] ?? row.label}`}>{CLIPBOARD_NAME[row.id] ?? row.label}</span>
                <button className="wx-icon-btn" disabled={row.copyBlocked !== null} title={row.copyBlocked ?? `Copy ${CLIPBOARD_HELP[row.id] ?? row.label}`} aria-label={`Copy ${row.label}`} onClick={row.onCopy}><Icon name="copy" size={14} /></button>
                <button className="wx-icon-btn" disabled={row.pasteBlocked !== null} title={row.pasteBlocked ?? `Paste ${row.label}${row.copied ? ` (copied from ${row.copied})` : ""}`} aria-label={`Paste ${row.label}`} onClick={row.onPaste}><Icon name="paste" size={14} /></button>
              </div>
            ))}
          </div>
          <h4>Pattern</h4>
          <Tools tools={barTools} />
          {showChop && (
            <>
              <h4>Chop</h4>
              <Tools tools={chopTools} />
            </>
          )}
        </>
      )}
      {feedback && <div className="wx-edit-feedback" role="status">{feedback}</div>}
    </div>
  );
}
