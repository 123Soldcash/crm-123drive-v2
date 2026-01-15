import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GitMerge, ExternalLink, AlertTriangle, CheckCircle2, Filter } from "lucide-react";
import { Link } from "wouter";
import { MergeLeadsDialog } from "@/components/MergeLeadsDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DuplicatesDashboard() {
  const [similarityThreshold, setSimilarityThreshold] = useState(85);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [selectedDuplicate, setSelectedDuplicate] = useState<any>(null);

  const { data: duplicateGroups, isLoading, refetch } = trpc.properties.getAllDuplicateGroups.useQuery({
    similarityThreshold,
  });

  const handleMergeClick = (group: any, duplicate: any) => {
    setSelectedGroup(group);
    setSelectedDuplicate(duplicate);
    setMergeDialogOpen(true);
  };

  const handleMergeComplete = () => {
    setMergeDialogOpen(false);
    setSelectedGroup(null);
    setSelectedDuplicate(null);
    refetch();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Duplicate Leads Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage and merge duplicate property leads
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select
            value={similarityThreshold.toString()}
            onValueChange={(value) => setSimilarityThreshold(parseInt(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Similarity threshold" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="95">95% or higher</SelectItem>
              <SelectItem value="90">90% or higher</SelectItem>
              <SelectItem value="85">85% or higher</SelectItem>
              <SelectItem value="80">80% or higher</SelectItem>
              <SelectItem value="75">75% or higher</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && duplicateGroups && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Duplicate Groups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{duplicateGroups.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Duplicates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {duplicateGroups.reduce((sum, group) => sum + group.totalDuplicates, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Threshold
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{similarityThreshold}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && duplicateGroups && duplicateGroups.length === 0 && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-900 dark:text-green-100">
            <strong>No duplicates found!</strong> All your leads are unique at the current similarity threshold ({similarityThreshold}%).
          </AlertDescription>
        </Alert>
      )}

      {/* Duplicate Groups */}
      {!isLoading && duplicateGroups && duplicateGroups.length > 0 && (
        <div className="space-y-4">
          {duplicateGroups.map((group, index) => (
            <Card key={index} className="border-2 border-amber-200 dark:border-amber-800">
              <CardHeader className="bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-blue-600 dark:text-blue-400">
                        Primary Lead #{group.primaryProperty.id}
                      </span>
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                        Primary
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-2 space-y-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        📍 {group.primaryProperty.address}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {group.primaryProperty.ownerName && (
                          <span>Owner: {group.primaryProperty.ownerName} • </span>
                        )}
                        {group.primaryProperty.leadTemperature && (
                          <span>Status: {group.primaryProperty.leadTemperature} • </span>
                        )}
                        <span>Created: {new Date(group.primaryProperty.createdAt).toLocaleDateString()}</span>
                      </div>
                    </CardDescription>
                  </div>
                  <Link href={`/properties/${group.primaryProperty.id}`}>
                    <Button size="sm" variant="outline">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </Link>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="h-4 w-4" />
                    {group.totalDuplicates} Potential Duplicate{group.totalDuplicates > 1 ? "s" : ""} Found
                  </div>

                  <div className="space-y-2">
                    {group.duplicates.map((duplicate) => (
                      <div
                        key={duplicate.propertyId}
                        className="bg-white dark:bg-gray-900 p-3 rounded-md border border-gray-200 dark:border-gray-700"
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
                                View
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs whitespace-nowrap"
                              onClick={() => handleMergeClick(group, duplicate)}
                            >
                              <GitMerge className="h-3 w-3 mr-1" />
                              Merge
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Merge Dialog */}
      {selectedGroup && selectedDuplicate && (
        <MergeLeadsDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          primaryLeadId={selectedGroup.primaryProperty.id}
          secondaryLeadId={selectedDuplicate.propertyId}
          primaryLeadAddress={selectedGroup.primaryProperty.address}
          secondaryLeadAddress={selectedDuplicate.address}
          primaryLeadOwner={selectedGroup.primaryProperty.ownerName}
          secondaryLeadOwner={selectedDuplicate.ownerName}
          onMergeComplete={handleMergeComplete}
        />
      )}
    </div>
  );
}
