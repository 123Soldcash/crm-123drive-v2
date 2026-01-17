import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Camera, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface NotesSectionProps {
  propertyId: number;
}

export function NotesSection({ propertyId }: NotesSectionProps) {
  const [noteText, setNoteText] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Screenshot paste functionality (Lightshot-style)
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
            toast.success("Screenshot pasted! Add a caption if needed.");
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
  
  // Filter to show only general notes (not desk-chris notes)
  const notes = allNotes?.filter((note) => note.noteType !== "desk-chris") || [];

  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: async (note) => {
      // If there are photos, upload them with the note ID
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
          console.error("Photo upload error:", error);
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
    onSuccess: (data) => {
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

    const fileArray = Array.from(files);

    fileArray.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImages((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setPhotoCaptions((prev) => {
      const newCaptions = { ...prev };
      delete newCaptions[index];
      return newCaptions;
    });
  };

  const handleSubmit = () => {
    if (!noteText.trim()) {
      toast.error("Please enter a note");
      return;
    }

    createNoteMutation.mutate({
      propertyId,
      content: noteText,
      noteType: "general", // Explicitly set as general note
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading notes...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Note Form */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <Textarea
            ref={textareaRef}
            placeholder="Add a note about this property... (Ctrl+V to paste screenshots)"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
          />

          {/* Photo Upload Section */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={img}
                      alt={`Selected ${idx + 1}`}
                      className="w-full h-24 object-cover rounded-md"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5"
                      onClick={() => removeImage(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Input
                      placeholder="Caption"
                      value={photoCaptions[idx] || ""}
                      onChange={(e) =>
                        setPhotoCaptions((prev) => ({ ...prev, [idx]: e.target.value }))
                      }
                      className="mt-1 text-xs h-7"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute("capture", "environment");
                    fileInputRef.current.click();
                  }
                }}
                variant="outline"
                size="sm"
              >
                <Camera className="mr-2 h-3 w-3" />
                Take Photo
              </Button>
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute("capture");
                    fileInputRef.current.click();
                  }
                }}
                variant="outline"
                size="sm"
              >
                <Upload className="mr-2 h-3 w-3" />
                Upload
              </Button>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={createNoteMutation.isPending || uploadPhotosMutation.isPending}
            className="w-full"
          >
            {createNoteMutation.isPending || uploadPhotosMutation.isPending
              ? "Saving..."
              : selectedImages.length > 0
              ? `Add Note with ${selectedImages.length} Photo(s)`
              : "Add Note"}
          </Button>
        </div>

        {/* Notes List - Table Format (ADHD-Friendly) */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-700">
            Notes History ({notes.length})
          </h4>
          {notes && notes.length > 0 ? (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full border-collapse bg-white">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700 w-48">
                      Date
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700 w-32">
                      Agent
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Notes
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700 w-16">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((note) => (
                    <tr key={note.id} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-700">
                        {new Date(note.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-700">
                        {note.userName || "Unknown"}
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                        {note.content}
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteNoteMutation.mutate({ id: note.id })}
                          disabled={deleteNoteMutation.isPending}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No notes yet. Add your first note above.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
