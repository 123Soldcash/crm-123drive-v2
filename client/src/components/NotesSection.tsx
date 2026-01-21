import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Camera, Trash2, Upload, X, Search, Download, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CollapsibleSection } from "./CollapsibleSection";
import { Badge } from "@/components/ui/badge";

interface NotesSectionProps {
  propertyId: number;
}

export function NotesSection({ propertyId }: NotesSectionProps) {
  const [noteText, setNoteText] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('showGeneralNotes');
    return saved ? JSON.parse(saved) : true; // Default to true for general notes
  });
  
  useEffect(() => {
    localStorage.setItem('showGeneralNotes', JSON.stringify(isExpanded));
  }, [isExpanded]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const imageData = event.target?.result as string;
            setSelectedImages((prev) => [...prev, imageData]);
            toast.success("Screenshot pasted!");
          };
          reader.readAsDataURL(blob);
        }
      }
    };

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener("paste", handlePaste);
      return () => textarea.removeEventListener("paste", handlePaste);
    }
  }, []);

  const utils = trpc.useUtils();
  const { data: allNotes, isLoading } = trpc.notes.byProperty.useQuery({ propertyId });
  const notes = allNotes?.filter((note) => note.noteType !== "desk-chris") || [];
  const { data: allPhotos } = trpc.photos.byProperty.useQuery({ propertyId });
  
  const filteredNotes = notes.filter((note) => {
    const query = searchQuery.toLowerCase();
    return (
      note.content.toLowerCase().includes(query) ||
      (note.userName && note.userName.toLowerCase().includes(query))
    );
  });

  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: async (note) => {
      if (selectedImages.length > 0) {
        const photos = selectedImages.map((img, idx) => ({
          fileData: img,
          caption: photoCaptions[idx] || undefined,
        }));

        try {
          await uploadPhotosMutation.mutateAsync({
            propertyId,
            noteId: note.id,
            photos,
          });
        } catch (error) {
          toast.error("Note created but photos failed to upload");
        }
      }

      utils.notes.byProperty.invalidate({ propertyId });
      setNoteText("");
      setSelectedImages([]);
      setPhotoCaptions({});
      toast.success("Note added successfully!");
    },
    onError: () => {
      toast.error("Failed to add note");
    },
  });

  const uploadPhotosMutation = trpc.photos.uploadBulk.useMutation({
    onSuccess: () => {
      utils.photos.byProperty.invalidate({ propertyId });
    },
  });

  const deleteNoteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.byProperty.invalidate({ propertyId });
      toast.success("Note deleted");
    },
    onError: () => {
      toast.error("Failed to delete note");
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImages((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!noteText.trim()) {
      toast.error("Please enter a note");
      return;
    }
    createNoteMutation.mutate({
      propertyId,
      content: noteText,
      noteType: "general",
    });
  };
  
  const handleExportCSV = () => {
    const csvContent = [
      ["Date", "Agent", "Notes"],
      ...notes.map((note) => [
        new Date(note.createdAt).toLocaleString(),
        note.userName || "Unknown",
        `"${note.content.replace(/"/g, '""')}"`,
      ]),
    ].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-${propertyId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV exported!");
  };

  if (isLoading) {
    return <div className="h-12 flex items-center justify-center text-xs text-muted-foreground animate-pulse bg-slate-50 rounded-lg border border-dashed">Loading notes...</div>;
  }

  return (
    <CollapsibleSection
      title="General Notes"
      icon={FileText}
      isOpen={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      accentColor="gray"
      badge={notes.length > 0 ? (
        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 ml-1">
          {notes.length}
        </Badge>
      ) : null}
    >
      <div className="space-y-4">
        <div className="space-y-3 p-4 border rounded-lg bg-slate-50/50">
          <Textarea
            ref={textareaRef}
            placeholder="Add a note... (Ctrl+V to paste screenshots)"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            className="bg-white border-slate-200"
          />

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img src={img} className="w-full h-20 object-cover rounded-md border border-slate-200" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5"
                      onClick={() => removeImage(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="border-slate-200">
                <Camera className="mr-2 h-3 w-3" />
                Add Photos
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createNoteMutation.isPending}
                className="ml-auto bg-slate-800 hover:bg-slate-900 text-white"
              >
                {createNoteMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-slate-200"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-slate-200">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        <div className="space-y-3">
          {filteredNotes.map((note) => (
            <div key={note.id} className="p-3 rounded-lg border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    {note.userName?.substring(0, 2).toUpperCase() || "UN"}
                  </div>
                  <span className="text-xs font-bold text-slate-900">{note.userName}</span>
                  <span className="text-[10px] text-slate-400">{new Date(note.createdAt).toLocaleString()}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-slate-300 hover:text-red-500"
                  onClick={() => deleteNoteMutation.mutate({ id: note.id })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{note.content}</p>
              {allPhotos?.filter(photo => photo.noteId === note.id).length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {allPhotos.filter(photo => photo.noteId === note.id).map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img 
                        src={photo.fileUrl} 
                        alt={photo.caption || "Note photo"}
                        className="w-full h-24 object-cover rounded-md border border-slate-200"
                      />
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 rounded-b-md">
                          {photo.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}
