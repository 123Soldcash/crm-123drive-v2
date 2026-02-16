import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { X, Plus, Tag, Settings, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

interface PropertyTagsManagerProps {
  propertyId: number;
}

export function PropertyTagsManager({ propertyId }: PropertyTagsManagerProps) {
  const utils = trpc.useUtils();
  const [searchText, setSearchText] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: propertyTags = [] } = trpc.properties.getTags.useQuery({ propertyId });
  const { data: allTags = [] } = trpc.properties.getAllTags.useQuery();

  // Mutations
  const addTag = trpc.properties.addTag.useMutation({
    onSuccess: () => {
      utils.properties.getTags.invalidate({ propertyId });
      utils.properties.getAllTags.invalidate();
      setSearchText("");
      toast.success("Tag added");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeTag = trpc.properties.removeTag.useMutation({
    onSuccess: () => {
      utils.properties.getTags.invalidate({ propertyId });
      utils.properties.getAllTags.invalidate();
      toast.success("Tag removed from property");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteTagGlobally = trpc.properties.deleteTagGlobally.useMutation({
    onSuccess: () => {
      utils.properties.getTags.invalidate({ propertyId });
      utils.properties.getAllTags.invalidate();
      setDeleteConfirm(null);
      toast.success("Tag deleted from all properties");
    },
    onError: (err) => toast.error(err.message),
  });

  // Filter available tags (not already on this property)
  const propertyTagNames = propertyTags.map((t: any) => t.tag);
  const availableTags = allTags.filter(
    (t: any) => !propertyTagNames.includes(t.tag)
  );
  const filteredTags = searchText.trim()
    ? availableTags.filter((t: any) =>
        t.tag.toLowerCase().includes(searchText.toLowerCase())
      )
    : availableTags;

  // Check if the search text is a new tag (doesn't exist yet)
  const isNewTag =
    searchText.trim() &&
    !allTags.some(
      (t: any) => t.tag.toLowerCase() === searchText.trim().toLowerCase()
    );

  const handleAddTag = (tagName: string) => {
    if (!tagName.trim()) return;
    addTag.mutate({ propertyId, tag: tagName.trim() });
  };

  const handleRemoveTag = (tagId: number) => {
    removeTag.mutate({ tagId });
  };

  const handleDeleteGlobally = (tagName: string) => {
    deleteTagGlobally.mutate({ tagName });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchText.trim()) {
      e.preventDefault();
      handleAddTag(searchText.trim());
    }
    if (e.key === "Escape") {
      setIsAddOpen(false);
    }
  };

  // Focus input when popover opens
  useEffect(() => {
    if (isAddOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isAddOpen]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Tags</h3>
          <span className="text-xs text-slate-400">({propertyTags.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <Popover open={isAddOpen} onOpenChange={setIsAddOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="end">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    ref={inputRef}
                    placeholder="Search or create tag..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-9 pl-8 text-sm"
                  />
                </div>

                {/* Create new tag option */}
                {isNewTag && (
                  <button
                    onClick={() => handleAddTag(searchText.trim())}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create &quot;{searchText.trim()}&quot;
                  </button>
                )}

                {/* Available tags list */}
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {filteredTags.length === 0 && !isNewTag && (
                    <p className="text-xs text-slate-400 text-center py-3">
                      {searchText ? "No matching tags" : "No tags available"}
                    </p>
                  )}
                  {filteredTags.map((t: any) => (
                    <button
                      key={t.tag}
                      onClick={() => handleAddTag(t.tag)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-md hover:bg-slate-100 transition-colors group"
                    >
                      <span className="text-slate-700">{t.tag}</span>
                      <span className="text-xs text-slate-400 group-hover:text-slate-500">
                        {t.count} {t.count === 1 ? "property" : "properties"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setManageOpen(true)}
            title="Manage all tags"
          >
            <Settings className="h-3.5 w-3.5 text-slate-400" />
          </Button>
        </div>
      </div>

      {/* Tags display */}
      <div className="flex flex-wrap gap-1.5">
        {propertyTags.length === 0 && (
          <p className="text-xs text-slate-400 italic">No tags yet. Click &quot;Add&quot; to get started.</p>
        )}
        {propertyTags.map((tag: any) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="flex items-center gap-1 pr-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
          >
            <span className="text-xs">{tag.tag}</span>
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-0.5 hover:bg-red-100 rounded-full p-0.5 transition-colors"
              title="Remove from this property"
            >
              <X className="h-3 w-3 text-slate-400 hover:text-red-500" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Manage Tags Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Manage Tags
            </DialogTitle>
            <DialogDescription>
              View all tags across your properties. Delete a tag to remove it from all properties.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto py-2">
            {allTags.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">
                No tags created yet.
              </p>
            )}
            {allTags.map((t: any) => (
              <div
                key={t.tag}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">{t.tag}</span>
                  <span className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                    {t.count} {t.count === 1 ? "property" : "properties"}
                  </span>
                </div>
                {deleteConfirm === t.tag ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleDeleteGlobally(t.tag)}
                      disabled={deleteTagGlobally.isPending}
                    >
                      {deleteTagGlobally.isPending ? "..." : "Confirm"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                    onClick={() => setDeleteConfirm(t.tag)}
                    title="Delete from all properties"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
