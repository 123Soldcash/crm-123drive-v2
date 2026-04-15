/**
 * CHRIS NOTES SECTION - Simple quick-note list
 * - Plain text input → adds a note instantly
 * - Each note shown as a chip/tag with an X to delete
 * - No history, no file uploads, no screenshots
 */

import { useState, useRef, KeyboardEvent } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { CollapsibleSection } from "./CollapsibleSection";
import { Badge } from "@/components/ui/badge";

interface ChrisNotesSectionProps {
  propertyId: number;
}

export function ChrisNotesSection({ propertyId }: ChrisNotesSectionProps) {
  const [noteText, setNoteText] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: allNotes, isLoading } = trpc.notes.byProperty.useQuery({ propertyId });

  // Only desk-chris notes
  const chrisNotes = (allNotes || []).filter((n) => n.noteType === "desk-chris");

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.byProperty.invalidate({ propertyId });
      setNoteText("");
      inputRef.current?.focus();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add note");
    },
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.byProperty.invalidate({ propertyId });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete note");
    },
  });

  const handleAdd = () => {
    const text = noteText.trim();
    if (!text) return;
    createNote.mutate({ propertyId, content: text, noteType: "desk-chris" });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleDelete = (noteId: number) => {
    deleteNote.mutate({ id: noteId });
  };

  return (
    <CollapsibleSection
      title="Chris Notes"
      icon={MessageSquareText}
      isOpen={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      accentColor="purple"
      badge={
        chrisNotes.length > 0 ? (
          <Badge
            variant="secondary"
            className="ml-1 bg-purple-100 text-purple-700 border-purple-200"
          >
            {chrisNotes.length}
          </Badge>
        ) : null
      }
    >
      {/* Input row */}
      <div className="flex gap-2 mb-3">
        <Input
          ref={inputRef}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a quick note and press Enter…"
          className="flex-1 h-9 text-sm bg-white border-gray-300 text-gray-900 placeholder-gray-400"
          disabled={createNote.isPending}
        />
        <Button
          size="sm"
          className="h-9 px-3 bg-purple-600 hover:bg-purple-700 text-white"
          onClick={handleAdd}
          disabled={!noteText.trim() || createNote.isPending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Notes list */}
      {isLoading ? (
        <p className="text-xs text-slate-400 animate-pulse">Loading…</p>
      ) : chrisNotes.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No notes yet. Type above and press Enter.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {chrisNotes.map((note) => (
            <span
              key={note.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-xs font-medium max-w-full"
            >
              <span className="truncate max-w-[280px]" title={note.content}>
                {note.content}
              </span>
              <button
                onClick={() => handleDelete(note.id)}
                className="flex-shrink-0 text-purple-400 hover:text-red-500 transition-colors"
                title="Remove note"
                disabled={deleteNote.isPending}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
