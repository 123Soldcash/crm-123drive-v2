import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Upload, X, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PropertyImageProps {
  propertyId: number;
  propertyImage: string | null;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  compact?: boolean;
}

export function PropertyImage({
  propertyId,
  propertyImage,
  address,
  city,
  state,
  zipcode,
  compact = false,
}: PropertyImageProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Fetch Street View image from server (uses backend API key)
  const { data: streetViewData } = trpc.properties.getStreetViewImage.useQuery(
    { address, city, state, zipcode },
    {
      enabled: !propertyImage, // Only fetch if no custom image
      staleTime: 1000 * 60 * 60, // Cache for 1 hour
      gcTime: 1000 * 60 * 60 * 2,
      retry: false,
    }
  );

  const uploadMutation = trpc.properties.updatePropertyImage.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      toast.success("Property image updated!");
      setIsUploading(false);
    },
    onError: (err) => {
      toast.error("Failed to upload image: " + err.message);
      setIsUploading(false);
    },
  });

  const removeMutation = trpc.properties.removePropertyImage.useMutation({
    onSuccess: () => {
      utils.properties.getById.invalidate({ id: propertyId });
      toast.success("Image removed, showing Street View");
    },
  });

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }

      setIsUploading(true);

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        uploadMutation.mutate({
          propertyId,
          imageBase64: base64,
          mimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [propertyId, uploadMutation]
  );

  const streetViewBase64 = streetViewData?.imageBase64 ?? null;
  const displayUrl = propertyImage || streetViewBase64;

  const imageSize = compact
    ? "w-16 h-16 sm:w-20 sm:h-20"
    : "w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32";

  return (
    <>
      <div className={cn("relative group shrink-0", imageSize)}>
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={`${address}, ${city}`}
            className={cn(
              "w-full h-full object-cover rounded-lg border-2 border-slate-200 shadow-sm cursor-pointer transition-all hover:border-blue-400 hover:shadow-md",
              compact && "rounded-md"
            )}
            onClick={() => setShowFullImage(true)}
          />
        ) : (
          <div
            className={cn(
              "w-full h-full rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all",
              compact && "rounded-md"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <MapPin
              className={cn("text-slate-400", compact ? "h-4 w-4" : "h-6 w-6")}
            />
            {!compact && (
              <span className="text-[9px] text-slate-400 mt-1 font-medium">
                No image
              </span>
            )}
          </div>
        )}

        {/* Upload overlay on hover */}
        {!isUploading && (
          <div
            className={cn(
              "absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1",
              compact && "rounded-md"
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "text-white hover:bg-white/20",
                compact ? "h-6 w-6" : "h-8 w-8"
              )}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              title="Upload image"
            >
              <Upload className={compact ? "h-3 w-3" : "h-4 w-4"} />
            </Button>
            {propertyImage && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-white hover:bg-red-500/50",
                  compact ? "h-6 w-6" : "h-8 w-8"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  removeMutation.mutate({ propertyId });
                }}
                title="Remove custom image (show Street View)"
              >
                <X className={compact ? "h-3 w-3" : "h-4 w-4"} />
              </Button>
            )}
          </div>
        )}

        {/* Upload spinner */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
        )}

        {/* Source badge */}
        {!compact && displayUrl && (
          <div className="absolute bottom-0.5 left-0.5">
            <span
              className={cn(
                "text-[7px] font-bold px-1 py-0.5 rounded",
                propertyImage
                  ? "bg-blue-600 text-white"
                  : "bg-black/60 text-white"
              )}
            >
              {propertyImage ? "CUSTOM" : "STREET VIEW"}
            </span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Full image modal */}
      {showFullImage && displayUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-w-3xl max-h-[80vh]">
            <img
              src={displayUrl}
              alt={`${address}, ${city}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70 h-8 w-8"
              onClick={() => setShowFullImage(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="absolute bottom-2 left-2 flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-3 w-3 mr-1" /> Replace
              </Button>
              {propertyImage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white/90 hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMutation.mutate({ propertyId });
                    setShowFullImage(false);
                  }}
                >
                  <X className="h-3 w-3 mr-1" /> Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
