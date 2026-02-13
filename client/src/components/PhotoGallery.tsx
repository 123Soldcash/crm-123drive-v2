import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Trash2, Image as ImageIcon, Plus, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { CollapsibleSection } from "./CollapsibleSection";
import { Badge } from "@/components/ui/badge";

interface PhotoGalleryProps {
  propertyId: number;
}

export function PhotoGallery({ propertyId }: PhotoGalleryProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('showPropertyPhotos');
    return saved ? JSON.parse(saved) : false;
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('showPropertyPhotos', JSON.stringify(isExpanded));
  }, [isExpanded]);

  const { data: photos, isLoading } = trpc.photos.byProperty.useQuery({ propertyId });
  const utils = trpc.useUtils();

  const uploadMutation = trpc.photos.upload.useMutation({
    onSuccess: () => {
      utils.photos.byProperty.invalidate({ propertyId });
      toast.success("Photo uploaded successfully");
      setIsUploading(false);
    },
    onError: (error) => {
      toast.error("Failed to upload photo: " + error.message);
      setIsUploading(false);
    },
  });

  const deletePhotoMutation = trpc.photos.delete.useMutation({
    onSuccess: () => {
      utils.photos.byProperty.invalidate({ propertyId });
      toast.success("Photo deleted");
    },
    onError: () => {
      toast.error("Failed to delete photo");
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" is not an image file`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 10MB limit`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        await uploadMutation.mutateAsync({
          propertyId,
          fileData: base64,
          caption: file.name,
        });
      } catch {
        // Error handled by mutation onError
      }
    }

    setIsUploading(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return (
      <div className="h-12 flex items-center justify-center text-xs text-muted-foreground animate-pulse bg-slate-50 rounded-lg border border-dashed">
        Loading photos...
      </div>
    );
  }

  return (
    <CollapsibleSection
      title="Property Photos"
      icon={ImageIcon}
      isOpen={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      accentColor="gray"
      badge={photos && photos.length > 0 ? (
        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 ml-1">
          {photos.length}
        </Badge>
      ) : null}
      action={
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Upload className="h-3 w-3 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                Add Photo
              </>
            )}
          </Button>
        </div>
      }
    >
      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.fileUrl}
                alt={photo.caption || "Property photo"}
                className="w-full h-48 object-cover rounded-lg border border-slate-100 cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => handleOpenInNewTab(photo.fileUrl)}
                title="Click to open in new tab"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col justify-between p-2 pointer-events-none">
                <div className="flex justify-between items-start pointer-events-auto">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-white/90 hover:bg-white text-slate-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenInNewTab(photo.fileUrl);
                    }}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this photo?")) {
                        deletePhotoMutation.mutate({ id: photo.id });
                      }
                    }}
                    title="Delete photo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-white text-[10px] space-y-0.5">
                  {photo.caption && <p className="font-medium truncate">{photo.caption}</p>}
                  <p className="text-white/80">
                    {new Date(photo.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-white/80">By: {photo.userName || "Unknown"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <ImageIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-3">No property photos yet.</p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4" />
            Upload Photos
          </Button>
        </div>
      )}
    </CollapsibleSection>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
