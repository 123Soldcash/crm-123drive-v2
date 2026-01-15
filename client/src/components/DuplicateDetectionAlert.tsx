import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ExternalLink, GitMerge } from "lucide-react";
import { Link } from "wouter";
import { MergeLeadsDialog } from "@/components/MergeLeadsDialog";

interface DuplicateDetectionAlertProps {
  address: string;
  ownerName?: string;
  lat?: number;
  lng?: number;
  onCreateAnyway?: () => void;
  currentLeadId?: number;
}

export function DuplicateDetectionAlert({
  address,
  ownerName,
  lat,
  lng,
  onCreateAnyway,
  currentLeadId,
}: DuplicateDetectionAlertProps) {
  const [debouncedAddress, setDebouncedAddress] = useState(address);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedDuplicate, setSelectedDuplicate] = useState<any>(null);

  // Debounce address input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAddress(address);
    }, 300);

    return () => clearTimeout(timer);
  }, [address]);

  // Search for duplicates
  const { data: duplicates, isLoading } = trpc.properties.searchDuplicates.useQuery(
    {
      address: debouncedAddress,
      ownerName,
      lat,
      lng,
      similarityThreshold: 85,
    },
    {
      enabled: debouncedAddress.length > 10 || (ownerName && ownerName.length > 3), // Only search if address is substantial
      refetchOnWindowFocus: false,
    }
  );

  // Don't show anything if no duplicates or still loading
  if (!duplicates || duplicates.length === 0 || isLoading) {
    return null;
  }

  return (
    <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription>
        <div className="space-y-3">
          <div className="font-semibold text-amber-900 dark:text-amber-100">
            ⚠️ Possible Duplicates Found ({duplicates.length})
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {duplicates.slice(0, 5).map((duplicate) => (
              <div
                key={duplicate.propertyId}
                className="bg-white dark:bg-gray-900 p-3 rounded-md border border-amber-200 dark:border-amber-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                      📍 {duplicate.address}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 space-x-2">
                      <span>Lead ID: #{duplicate.propertyId}</span>
                      {duplicate.ownerName && <span>• Owner: {duplicate.ownerName}</span>}
                      {duplicate.leadTemperature && (
                        <span>
                          • Status:{" "}
                          <Badge
                            variant="outline"
                            className={
                              duplicate.leadTemperature === "HOT"
                                ? "bg-red-100 text-red-800 border-red-300"
                                : duplicate.leadTemperature === "WARM"
                                ? "bg-orange-100 text-orange-800 border-orange-300"
                                : duplicate.leadTemperature === "COLD"
                                ? "bg-blue-100 text-blue-800 border-blue-300"
                                : "bg-gray-100 text-gray-800 border-gray-300"
                            }
                          >
                            {duplicate.leadTemperature}
                          </Badge>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Created: {new Date(duplicate.createdAt).toLocaleDateString()} •{" "}
                      <Badge
                        variant="outline"
                        className={
                          duplicate.matchType === "exact"
                            ? "bg-red-100 text-red-800 border-red-300"
                            : duplicate.matchType === "gps"
                            ? "bg-purple-100 text-purple-800 border-purple-300"
                            : "bg-yellow-100 text-yellow-800 border-yellow-300"
                        }
                      >
                        {duplicate.matchType === "exact"
                          ? "100% Match"
                          : duplicate.matchType === "gps"
                          ? "GPS Match"
                          : `${duplicate.similarity.toFixed(0)}% Similar`}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Link href={`/properties/${duplicate.propertyId}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs whitespace-nowrap"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Lead
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs whitespace-nowrap"
                      onClick={() => {
                        setSelectedDuplicate(duplicate);
                        setMergeDialogOpen(true);
                      }}
                      disabled={!currentLeadId}
                      title={!currentLeadId ? "Save lead first to enable merge" : "Merge with this lead"}
                    >
                      <GitMerge className="h-3 w-3 mr-1" />
                      Merge
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {duplicates.length > 5 && (
            <div className="text-xs text-amber-700 dark:text-amber-300">
              Showing 5 of {duplicates.length} potential duplicates
            </div>
          )}

          {onCreateAnyway && (
            <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
              <Button
                size="sm"
                variant="outline"
                onClick={onCreateAnyway}
                className="w-full text-amber-900 dark:text-amber-100 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
              >
                Create Anyway (Ignore Duplicates)
              </Button>
            </div>
          )}
        </div>
      </AlertDescription>

      {/* Merge Dialog */}
      {selectedDuplicate && currentLeadId && (
        <MergeLeadsDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          primaryLeadId={currentLeadId}
          secondaryLeadId={selectedDuplicate.propertyId}
          primaryLeadAddress={address}
          secondaryLeadAddress={selectedDuplicate.address}
          primaryLeadOwner={ownerName || null}
          secondaryLeadOwner={selectedDuplicate.ownerName}
          onMergeComplete={() => {
            setMergeDialogOpen(false);
            setSelectedDuplicate(null);
          }}
        />
      )}
    </Alert>
  );
}
