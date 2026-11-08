// The graph's Chord tab: Note / Chord mode and the chord fields for the notes of the selected step (V1 Track Editor's chord
// controls, now beside the step they edit). A step with several plain notes is piano-roll material: it says so and points at the Roll.
import { memo } from "react";
import { ChordFields } from "../../components/TrackEditor";
import type { NoteChord } from "../../model/chord";
import type { ProjectScale } from "../../model/scale";
import type { Note, NoteId } from "../../model/types";

interface Props {
  notes: Note[];
  root: number | null;
  scale: ProjectScale;
  onSetNoteMode: (noteId: NoteId, mode: "note" | "chord") => void;
  onSetNoteChord: (noteId: NoteId, patch: Partial<NoteChord>) => void;
  onRemoveNote: (noteId: NoteId) => void;
  onExplode: (noteId: NoteId) => void;
  onOpenRoll: () => void;
}

export const StepChord = memo(function StepChord({ notes, root, scale, onSetNoteMode, onSetNoteChord, onRemoveNote, onExplode, onOpenRoll }: Props) {
  if (notes.length === 0) return <div className="wx-drawer-hint">Select a step to edit it as a chord.</div>;
  const plainMany = notes.filter((n) => !n.chord).length > 1;
  return (
    <div className="wx-chord">
      {notes.map((note) => (
        <div key={note.id} className="te-card wx-chord-card">
          <div className="te-mode" role="group" aria-label="Note or chord">
            <button className={`te-mode-btn ${note.chord ? "" : "active"}`} aria-pressed={!note.chord} onClick={() => onSetNoteMode(note.id, "note")}>Note</button>
            <button className={`te-mode-btn ${note.chord ? "active" : ""}`} aria-pressed={!!note.chord} onClick={() => onSetNoteMode(note.id, "chord")}>Chord</button>
          </div>
          {note.chord ? (
            <>
              <ChordFields note={note} chord={note.chord} root={root} scale={scale} keyOnly onSetNoteChord={onSetNoteChord} onRemoveNote={onRemoveNote} />
              <button className="wx-btn" onClick={() => onExplode(note.id)} title="Replace this chord by its individual notes, which you can then edit in the piano roll">Explode to notes</button>
            </>
          ) : (
            <span className="wx-note">{note.pitch ? `pitch ${note.pitch > 0 ? "+" : ""}${note.pitch}` : "root pitch"}</span>
          )}
        </div>
      ))}
      {plainMany && (
        <div className="wx-drawer-hint">
          {notes.length} separate notes at this step. <button className="wx-btn" onClick={onOpenRoll}>Edit in the Roll</button>
        </div>
      )}
    </div>
  );
});
