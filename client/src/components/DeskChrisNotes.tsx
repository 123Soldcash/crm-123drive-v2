import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, StickyNote, Search, Download, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CollapsibleSection } from "./CollapsibleSection";
import { Badge } from "@/components/ui/badge";

interface DeskChrisNotesProps {
  propertyId: number;
}

export function DeskChrisNotes({ propertyId }: DeskChrisNotesProps) {
  const [newNote, setNewNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<number[]>([]);
  
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('showDeskChrisNotes');
    return saved ? JSON.parse(saved) : false;
  });
  
  useEffect(() => {
    localStorage.setItem('showDeskChrisNotes', JSON.stringify(isExpanded));
  }, [isExpanded]);

  const utils = trpc.useUtils();

  const { data: allNotes, isLoading } = trpc.notes.byProperty.useQuery({
    propertyId,
  });

  const deskChrisNotes = allNotes?.filter((note) => note.noteType === "desk-chris") || [];
  
  const filteredNotes = deskChrisNotes.filter((note) => {
    const query = searchQuery.toLowerCase();
    return (
      note.content.toLowerCase().includes(query) ||
      (note.userName && note.userName.toLowerCase().includes(query)) ||
      formatTimestamp(note.createdAt).toLowerCase().includes(query)
    );
  });

  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: () => {
      toast.success("Desk-Chris note added successfully!");
      setNewNote("");
      utils.notes.byProperty.invalidate({ propertyId });
    },
    onError: (error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });

  const deleteNoteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      toast.success("Note(s) deleted successfully!");
      setSelectedNotes([]);
      utils.notes.byProperty.invalidate({ propertyId });
    },
    onError: (error) => {
      toast.error(`Failed to delete note: ${error.message}`);
    },
  });

  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast.error("Please enter a note");
      return;
    }

    createNoteMutation.mutate({
      propertyId,
      content: newNote.trim(),
      noteType: "desk-chris",
    });
  };
  
  const handleExportCSV = () => {
    const csvContent = [
      ["Date", "Agent", "Notes"],
      ...deskChrisNotes.map((note) => [
        formatTimestamp(note.createdAt),
        note.userName || "Unknown",
        `"${note.content.replace(/"/g, '""')}"`,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `desk-chris-notes-${propertyId}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully!");
  };
  
  const handleBulkDelete = () => {
    if (selectedNotes.length === 0) {
      toast.error("Please select notes to delete");
      return;
    }
    
    if (confirm(`Delete ${selectedNotes.length} selected note(s)?`)) {
      selectedNotes.forEach((noteId) => {
        deleteNoteMutation.mutate({ id: noteId });
      });
    }
  };
  
  const toggleSelectAll = () => {
    if (selectedNotes.length === filteredNotes.length) {
      setSelectedNotes([]);
    } else {
      setSelectedNotes(filteredNotes.map((note) => note.id));
    }
  };
  
  const toggleSelectNote = (noteId: number) => {
    setSelectedNotes((prev) =>
      prev.includes(noteId)
        ? prev.filter((id) => id !== noteId)
        : [...prev, noteId]
    );
  };

  const formatTimestamp = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <CollapsibleSection
      title="Desk-Chris Notes"
      icon={StickyNote}
      isOpen={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      accentColor="green"
      badge={deskChrisNotes.length > 0 ? (
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 ml-1">
          {deskChrisNotes.length}
        </Badge>
      ) : null}
    >
      <div className="mb-6 space-y-3">
        <Textarea
          placeholder="Add a new Desk-Chris note... (timestamp will be added automatically)"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          className="resize-none bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
        />
        <Button
          onClick={handleAddNote}
          disabled={createNoteMutation.isPending || !newNote.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {createNoteMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Note...
            </>
          ) : (
            "Add Desk-Chris Note"
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-slate-200"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={deskChrisNotes.length === 0}
          className="whitespace-nowrap border-slate-200"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleBulkDelete}
          disabled={selectedNotes.length === 0}
          className="whitespace-nowrap"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete ({selectedNotes.length})
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : deskChrisNotes.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <StickyNote className="h-8 w-8 mx-auto mb-2 text-slate-200" />
            <p className="text-sm">No Desk-Chris notes yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-2 py-2 text-center w-12">
                    <Checkbox
                      checked={selectedNotes.length === filteredNotes.length && filteredNotes.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-500 w-48">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-500 w-32">
                    Agent
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNotes.map((note) => (
                  <tr key={note.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-2 py-2 text-center">
                      <Checkbox
                        checked={selectedNotes.includes(note.id)}
                        onCheckedChange={() => toggleSelectNote(note.id)}
                      />
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600">
                      {formatTimestamp(note.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-slate-900">
                      {note.userName || "Unknown"}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600 whitespace-pre-wrap">
                      {note.content}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
