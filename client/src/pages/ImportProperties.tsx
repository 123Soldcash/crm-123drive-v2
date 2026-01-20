import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function ImportProperties() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [importMode, setImportMode] = useState<"standard" | "dealmachine">("dealmachine");
  const [importProgress, setImportProgress] = useState<{
    phase: string;
    current: number;
    total: number;
    message: string;
  } | null>(null);

  const { data: agents, isLoading: loadingAgents } = trpc.users.listAgents.useQuery();
  const utils = trpc.useUtils();

  const uploadDealMachine = trpc.importDealMachine.uploadDealMachine.useMutation({
    onSuccess: (result) => {
      utils.properties.list.invalidate();
      setFile(null);
      setSelectedAgentId("");
      setIsUploading(false);
      setImportProgress(null);
      
      // Show success message
      toast.success(
        `Successfully imported ${result.propertiesCount} properties, ${result.contactsCount} contacts, ${result.phonesCount} phones, ${result.emailsCount} emails!`,
        { duration: 6000 }
      );
      
      // Show errors if any (for debugging)
      if (result.errors && result.errors.length > 0) {
        console.log('[DealMachine Import Errors]:', result.errors);
        toast.error(
          `Import had ${result.errors.length} error(s): ${result.errors[0]}`,
          { duration: 10000 }
        );
      }
      
      // Show debug info (for troubleshooting)
      if ((result as any).debug && (result as any).debug.length > 0) {
        console.log('[DealMachine Import Debug]:', (result as any).debug);
        // Show debug info in a toast if no properties were imported
        if (result.propertiesCount === 0) {
          const debugInfo = (result as any).debug.slice(0, 5).join(' | ');
          toast.info(`Debug: ${debugInfo}`, { duration: 15000 });
        }
      }
    },
    onError: (error) => {
      setIsUploading(false);
      setImportProgress(null);
      toast.error(`DealMachine import failed: ${error.message}`);
    },
  });

  const uploadProperties = trpc.import.uploadProperties.useMutation({
    onSuccess: (result) => {
      utils.properties.list.invalidate();
      setFile(null);
      setSelectedAgentId("");
      setIsUploading(false);
      
      if (result.errorCount > 0) {
        toast.warning(
          `Imported ${result.successCount} properties. ${result.errorCount} rows had errors.`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Successfully imported ${result.successCount} properties!`);
      }
    },
    onError: (error) => {
      setIsUploading(false);
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (
        selectedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        selectedFile.type === "application/vnd.ms-excel" ||
        selectedFile.name.endsWith(".xlsx") ||
        selectedFile.name.endsWith(".xls")
      ) {
        setFile(selectedFile);
      } else {
        toast.error("Please select a valid Excel file (.xlsx or .xls)");
      }
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file to import");
      return;
    }

    setIsUploading(true);
    setImportProgress({ phase: "Preparing", current: 0, total: 100, message: "Reading file..." });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        try {
          if (importMode === "dealmachine") {
            // DealMachine 2-phase import
            setImportProgress({ phase: "Phase 1", current: 0, total: 100, message: "Importing properties and contacts..." });
            await uploadDealMachine.mutateAsync({
              fileData: base64.split(",")[1],
              assignedAgentId: selectedAgentId === "unassigned" ? null : Number(selectedAgentId),
            });
          } else {
            // Standard import
            setImportProgress({ phase: "Importing", current: 0, total: 100, message: "Processing properties..." });
            await uploadProperties.mutateAsync({
              fileData: base64.split(",")[1],
              assignedAgentId: selectedAgentId === "unassigned" ? null : Number(selectedAgentId),
            });
          }
          
          setSelectedAgentId("");
          const fileInput = document.getElementById("file-input") as HTMLInputElement;
          if (fileInput) fileInput.value = "";
        } catch (error) {
          console.error("Import error:", error);
          toast.error("Failed to import properties. Please check the file format.");
        } finally {
          setIsUploading(false);
          setImportProgress(null);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("File read error:", error);
      toast.error("Failed to read file");
      setIsUploading(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Properties</h1>
        <p className="text-muted-foreground mt-2">
          Upload a DealMachine Excel file to automatically import properties with all contacts, phones, and emails
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Import Mode</CardTitle>
          <CardDescription>
            Choose the import mode based on your file source
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={importMode === "dealmachine" ? "default" : "outline"}
              onClick={() => setImportMode("dealmachine")}
              disabled={isUploading}
              className="flex-1"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              DealMachine Import
            </Button>
            <Button
              variant={importMode === "standard" ? "default" : "outline"}
              onClick={() => setImportMode("standard")}
              disabled={isUploading}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Standard Import
            </Button>
          </div>
          {importMode === "dealmachine" && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-md">
              <p className="text-sm text-green-900 dark:text-green-100">
                <strong>DealMachine Mode:</strong> Automatically imports all 20 contacts per property with phones, emails, property flags, and enriches addresses via Google Maps.
              </p>
            </div>
          )}
          {importMode === "standard" && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Standard Mode:</strong> Basic property import for custom Excel formats.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {importProgress && (
        <Card className="mb-6 border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 animate-pulse" />
              Import in Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">{importProgress.phase}</span>
                  <span className="text-muted-foreground">{importProgress.current}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress.current}%` }}
                  ></div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{importProgress.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Excel File Upload
            </CardTitle>
            <CardDescription>
              Select an Excel file (.xlsx or .xls) containing property data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-input">Excel File</Label>
              <Input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {file && (
                <div className="text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Assign to Agent
            </CardTitle>
            <CardDescription>
              Select which birddog agent will manage these properties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agent-select">Birddog Agent (Optional)</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId} disabled={isUploading || loadingAgents}>
                <SelectTrigger id="agent-select">
                  <SelectValue placeholder="Select an agent (optional)..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No Agent (Assign Later)</SelectItem>
                  {agents?.map((agent: { id: number; name: string | null; openId: string }) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name || agent.openId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAgentId && selectedAgentId !== "unassigned" && (
                <div className="text-sm text-muted-foreground">
                  Properties will be assigned to: {agents?.find((a: { id: number; name: string | null }) => a.id.toString() === selectedAgentId)?.name}
                </div>
              )}
              {selectedAgentId === "unassigned" && (
                <div className="text-sm text-muted-foreground">
                  Properties will be imported without agent assignment. You can assign them later using Bulk Assign Agents.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            {importMode === "dealmachine" ? (
              <>
                <p>
                  <strong>1. Export from DealMachine:</strong> Download your properties Excel file from DealMachine.
                </p>
                <p>
                  <strong>2. Select the file:</strong> Click "Choose File" and select your DealMachine Excel file.
                </p>
                <p>
                  <strong>3. Assign to agent (optional):</strong> Choose which birddog agent will manage these properties.
                </p>
                <p>
                  <strong>4. Import:</strong> Click "Import Properties" to start the 2-phase import process:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Phase 1:</strong> Import all properties, contacts (up to 20 per property), phones, and emails</li>
                  <li><strong>Phase 2:</strong> Enrich missing addresses using GPS coordinates via Google Maps</li>
                </ul>
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-md">
                  <p className="text-amber-900 dark:text-amber-100">
                    <strong>What gets imported:</strong> Properties, property flags (High Equity, Off Market, etc.), up to 20 contacts per property, up to 3 phones per contact, up to 3 emails per contact, GPS coordinates, and enriched addresses.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p>
                  <strong>1. Prepare your Excel file:</strong> Ensure your file contains columns for address, city, state, zipcode, owner information, and contact details.
                </p>
                <p>
                  <strong>2. Select the file:</strong> Click "Choose File" and select your Excel file from your computer.
                </p>
                <p>
                  <strong>3. Assign to agent (optional):</strong> Choose which birddog agent will manage these properties.
                </p>
                <p>
                  <strong>4. Import:</strong> Click "Import Properties" to upload and process the file.
                </p>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                  <p className="text-blue-900 dark:text-blue-100">
                    <strong>Note:</strong> Agent assignment is optional. Properties imported without an agent can be assigned later using the Bulk Assign Agents feature.
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleImport}
          disabled={!file || isUploading}
          size="lg"
          className="min-w-[200px]"
        >
          {isUploading ? (
            <>
              <Upload className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Import Properties
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
