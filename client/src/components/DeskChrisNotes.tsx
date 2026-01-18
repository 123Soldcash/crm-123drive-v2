import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, StickyNote, Search, Download, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface DeskChrisNotesProps {
  propertyId: number;
}

export function DeskChrisNotes({ propertyId }: DeskChrisNotesProps) {
  const [newNote, setNewNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<number[]>([]);
  // localStorage persistence for ADHD-friendly collapsed state
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('showDeskChrisNotes');
    return saved ? JSON.parse(saved) : false;
  });
  
  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('showDeskChrisNotes', JSON.stringify(isExpanded));
  }, [isExpanded]);
  const utils = trpc.useUtils();

  // Fetch only desk-chris notes
  const { data: allNotes, isLoading } = trpc.notes.byProperty.useQuery({
    propertyId,
  });

  const deskChrisNotes = allNotes?.filter((note) => note.noteType === "desk-chris") || [];
  
  // Filter notes based on search query
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
    <Card className="p-6 bg-green-50 border-green-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold">Desk-Chris Notes</h3>
          <span className="text-sm text-gray-500">
            (Exclusive notes with auto-timestamp)
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs"
        >
          {isExpanded ? "Hide" : "Show"}
        </Button>
      </div>

      {isExpanded && (
        <>
          {/* Add New Note */}
          <div className="mb-6 space-y-3">
            <Textarea
              placeholder="Add a new Desk-Chris note... (timestamp will be added automatically)"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              className="resize-none bg-white"
            />
            <Button
              onClick={handleAddNote}
              disabled={createNoteMutation.isPending || !newNote.trim()}
              className="w-full"
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

          {/* Search and Bulk Operations */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search notes by text, agent, or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={deskChrisNotes.length === 0}
              className="whitespace-nowrap"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
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

          {/* Notes List - Table Format (ADHD-Friendly) */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-700">
              Notes History ({filteredNotes.length} of {deskChrisNotes.length})
            </h4>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : deskChrisNotes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <StickyNote className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No Desk-Chris notes yet</p>
                <p className="text-sm">Add your first note above</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full border-collapse bg-white">
                  <thead className="sticky top-0 bg-green-100">
                    <tr>
                      <th className="border border-green-300 px-2 py-2 text-center w-12">
                        <Checkbox
                          checked={selectedNotes.length === filteredNotes.length && filteredNotes.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="border border-green-300 px-4 py-2 text-left text-sm font-semibold text-gray-700 w-48">
                        Date
                      </th>
                      <th className="border border-green-300 px-4 py-2 text-left text-sm font-semibold text-gray-700 w-32">
                        Agent
                      </th>
                      <th className="border border-green-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNotes.map((note) => (
                      <tr key={note.id} className="hover:bg-green-50">
                        <td className="border border-green-200 px-2 py-2 text-center">
                          <Checkbox
                            checked={selectedNotes.includes(note.id)}
                            onCheckedChange={() => toggleSelectNote(note.id)}
                          />
                        </td>
                        <td className="border border-green-200 px-4 py-2 text-sm text-gray-700">
                          {formatTimestamp(note.createdAt)}
                        </td>
                        <td className="border border-green-200 px-4 py-2 text-sm text-gray-700">
                          {note.userName || "Unknown"}
                        </td>
                        <td className="border border-green-200 px-4 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                          {note.content}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
