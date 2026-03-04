import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Upload, X, MapPin, Loader2, Expand } from "lucide-react";
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
  hero?: boolean;
}

/* ── Lightbox rendered via Portal into document.body ── */
function ImageLightbox({
  displayUrl,
  address,
  city,
  propertyImage,
  onClose,
  onReplace,
  onRemove,
}: {
  displayUrl: string;
  address: string;
  city: string;
  propertyImage: string | null;
  onClose: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    // Prevent body scroll while lightbox is open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        cursor: "pointer",
      }}
      onClick={onClose}
    >
      {/* Close button — always top-right */}
      <button
        style={{
          position: "fixed",
          top: 12,
          right: 16,
          zIndex: 100000,
          backgroundColor: "rgba(0,0,0,0.6)",
          border: "none",
          borderRadius: "50%",
          width: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "white",
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.85)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.6)")}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Close"
      >
        <X style={{ width: 22, height: 22 }} />
      </button>

      {/* Image container */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: "90vw",
          maxHeight: "85vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={displayUrl}
          alt={`${address}, ${city}`}
          style={{
            maxWidth: "90vw",
            maxHeight: "85vh",
            objectFit: "contain",
            borderRadius: 8,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
        />
        <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 8 }}>
          <Button
            size="sm"
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={(e) => {
              e.stopPropagation();
              onReplace();
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
                onRemove();
              }}
            >
              <X className="h-3 w-3 mr-1" /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Main PropertyImage component ── */
export function PropertyImage({
  propertyId,
  propertyImage,
  address,
  city,
  state,
  zipcode,
  compact = false,
  hero = false,
}: PropertyImageProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: streetViewData } = trpc.properties.getStreetViewImage.useQuery(
    { address, city, state, zipcode },
    {
      enabled: !propertyImage,
      staleTime: 1000 * 60 * 60,
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

  const imageSize = hero
    ? "w-full h-full"
    : compact
    ? "w-16 h-16 sm:w-20 sm:h-20"
    : "w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32";

  return (
    <>
      <div className={cn(
        "relative group",
        hero ? "w-full h-full" : "shrink-0",
        imageSize
      )}>
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={`${address}, ${city}`}
            className={cn(
              "w-full h-full object-cover cursor-pointer transition-all",
              hero ? "rounded-none" : "rounded-lg border-2 border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md",
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

        {/* Hover overlay: compact = expand icon only; full = upload + remove */}
        {!isUploading && (
          <div
            className={cn(
              "absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1",
              compact && "rounded-md"
            )}
          >
            {compact ? (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  if (displayUrl) setShowFullImage(true);
                }}
                title="View full image"
              >
                <Expand className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  title="Upload image"
                >
                  <Upload className="h-4 w-4" />
                </Button>
                {propertyImage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-red-500/50 h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMutation.mutate({ propertyId });
                    }}
                    title="Remove custom image (show Street View)"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </>
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

      {/* Lightbox — rendered via Portal into document.body to escape all stacking contexts */}
      {showFullImage && displayUrl && (
        <ImageLightbox
          displayUrl={displayUrl}
          address={address}
          city={city}
          propertyImage={propertyImage}
          onClose={() => setShowFullImage(false)}
          onReplace={() => fileInputRef.current?.click()}
          onRemove={() => {
            removeMutation.mutate({ propertyId });
            setShowFullImage(false);
          }}
        />
      )}
    </>
  );
}
