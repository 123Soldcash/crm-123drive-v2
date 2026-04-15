/**
 * CHRIS NOTES SECTION - Simple notes list
 * - Text input → adds a note with timestamp
 * - Each note shown as a row with date, text, and delete button
 * - Preserves all existing notes (previously stored as tags)
 */

import { useState, useRef, KeyboardEvent } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, MessageSquareText } from "lucide-react";
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

  // Only desk-chris notes, sorted newest first
  const chrisNotes = (allNotes || [])
    .filter((n) => n.noteType === "desk-chris")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
      toast.success("Note removed");
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

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
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
      <div className="flex gap-2 mb-4">
        <Input
          ref={inputRef}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a note and press Enter…"
          className="flex-1 h-9 text-sm bg-white border-gray-300 text-gray-900 placeholder-gray-400"
          disabled={createNote.isPending}
        />
        <Button
          size="sm"
          className="h-9 px-3 bg-purple-600 hover:bg-purple-700 text-white"
          onClick={handleAdd}
          disabled={!noteText.trim() || createNote.isPending}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Notes list */}
      {isLoading ? (
        <p className="text-xs text-slate-400 animate-pulse">Loading…</p>
      ) : chrisNotes.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No notes yet. Type above and press Enter.</p>
      ) : (
        <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
          {chrisNotes.map((note, index) => (
            <div
              key={note.id}
              className={`flex items-start gap-3 px-3 py-2.5 bg-white hover:bg-purple-50/50 transition-colors group ${
                index !== chrisNotes.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              {/* Date column */}
              <div className="flex-shrink-0 w-[100px] pt-0.5">
                <p className="text-xs font-medium text-gray-500">
                  {formatDate(note.createdAt)}
                </p>
                <p className="text-[10px] text-gray-400">
                  {formatTime(note.createdAt)}
                </p>
              </div>

              {/* Note content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm text-gray-800 break-words leading-relaxed">
                  {note.content}
                </p>
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleDelete(note.id)}
                className="flex-shrink-0 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove note"
                disabled={deleteNote.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
