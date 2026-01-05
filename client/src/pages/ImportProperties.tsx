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

  const { data: agents, isLoading: loadingAgents } = trpc.users.listAgents.useQuery();
  const utils = trpc.useUtils();

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
    if (!selectedAgentId) {
      toast.error("Please select an agent to assign properties");
      return;
    }

    setIsUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        try {
          // Call tRPC mutation
          await uploadProperties.mutateAsync({
            fileData: base64.split(",")[1], // Remove data:... prefix
            assignedAgentId: selectedAgentId === "unassigned" ? null : Number(selectedAgentId),
          });
          setSelectedAgentId("");
          const fileInput = document.getElementById("file-input") as HTMLInputElement;
          if (fileInput) fileInput.value = "";
        } catch (error) {
          console.error("Import error:", error);
          toast.error("Failed to import properties. Please check the file format.");
        } finally {
          setIsUploading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("File read error:", error);
      toast.error("Failed to read file");
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Properties</h1>
        <p className="text-muted-foreground mt-2">
          Upload an Excel file to import properties and assign them to a birddog agent
        </p>
      </div>

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
              <Label htmlFor="agent-select">Birddog Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId} disabled={isUploading || loadingAgents}>
                <SelectTrigger id="agent-select">
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent: { id: number; name: string | null; openId: string }) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name || agent.openId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAgentId && (
                <div className="text-sm text-muted-foreground">
                  Properties will be assigned to: {agents?.find((a: { id: number; name: string | null }) => a.id.toString() === selectedAgentId)?.name}
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
            <p>
              <strong>1. Prepare your Excel file:</strong> Ensure your file contains columns for address, city, state, zipcode, owner information, and contact details.
            </p>
            <p>
              <strong>2. Select the file:</strong> Click "Choose File" and select your Excel file from your computer.
            </p>
            <p>
              <strong>3. Assign to agent:</strong> Choose which birddog agent will manage these properties. The agent will only see properties assigned to them.
            </p>
            <p>
              <strong>4. Import:</strong> Click "Import Properties" to upload and process the file. This may take a few moments depending on the file size.
            </p>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
              <p className="text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> Each agent can only access their assigned properties. As an admin, you can view all properties from all agents.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleImport}
          disabled={!file || !selectedAgentId || isUploading}
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
