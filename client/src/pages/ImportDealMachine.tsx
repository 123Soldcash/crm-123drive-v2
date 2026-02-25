import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Upload, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface PreviewRow {
  propertyId: string;
  address: string;
  city: string;
  state: string;
  owner: string;
  contacts: number;
}

export default function ImportDealMachine() {
  // Using sonner toast
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [listName, setListName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const agentsQuery = trpc.agents.list.useQuery();
  const importMutation = trpc.dashboard.importDealMachine.useMutation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      setLoading(true);
      setFile(selectedFile);
      setPreview([]);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet);

          const previewRows: PreviewRow[] = rows.slice(0, 5).map((row: any) => ({
            propertyId: row.property_id || "",
            address: row.property_address_line_1 || "",
            city: row.property_address_city || "",
            state: row.property_address_state || "",
            owner: row.owner_1_name || "",
            contacts: Object.keys(row).filter((k) => k.includes("contact_") && k.includes("_name")).length,
          }));

          setPreview(previewRows);
          toast.success(`File loaded: Found ${rows.length} properties in the file`);
        } catch (error) {
          toast.error(`Error reading file: ${String(error)}`);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    try {
      setLoading(true);

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet);

          const result = await importMutation.mutateAsync({
            rows: rows as any[],
            assignedAgentId: selectedAgent ? parseInt(selectedAgent) : null,
            listName: listName || null,
          });

          setImportResult(result);

          toast.success(`Import completed: Imported ${result.propertiesImported} properties with ${result.contactsImported} contacts`);
        } catch (error) {
          toast.error(`Import failed: ${String(error)}`);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      toast.error(String(error));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import DealMachine Properties</h1>
        <p className="text-muted-foreground mt-2">
          Upload an Excel file from DealMachine to import properties and contacts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Select File</CardTitle>
          <CardDescription>Upload your DealMachine Excel export</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              disabled={loading}
              className="hidden"
              id="file-input"
            />
            <Label htmlFor="file-input" className="cursor-pointer">
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="font-medium">Click to select file or drag and drop</span>
                <span className="text-sm text-muted-foreground">
                  {file ? file.name : "No file selected"}
                </span>
              </div>
            </Label>
          </div>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Preview</CardTitle>
            <CardDescription>First {preview.length} properties from the file</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Property ID</th>
                    <th className="text-left py-2 px-2">Address</th>
                    <th className="text-left py-2 px-2">City, State</th>
                    <th className="text-left py-2 px-2">Owner</th>
                    <th className="text-left py-2 px-2">Contacts</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-mono text-xs">{row.propertyId}</td>
                      <td className="py-2 px-2">{row.address}</td>
                      <td className="py-2 px-2">
                        {row.city}, {row.state}
                      </td>
                      <td className="py-2 px-2">{row.owner}</td>
                      <td className="py-2 px-2">{row.contacts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {preview.length > 0 && !importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Configure Import</CardTitle>
            <CardDescription>Set import options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="agent">Assign to Agent (Optional)</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger id="agent">
                  <SelectValue placeholder="Select an agent or leave empty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Agent (Assign Later)</SelectItem>
                  {agentsQuery.data?.map((agent) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="list-name">List Name (Optional)</Label>
              <Input
                id="list-name"
                placeholder="e.g., 'Probate List January 2026'"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
              />
            </div>

            <Button
              onClick={handleImport}
              disabled={loading || !file}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Properties"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {importResult && (
        <Card className={importResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Import Completed Successfully
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Import Completed with Errors
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Properties Imported</p>
                <p className="text-2xl font-bold">{importResult.propertiesImported}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contacts Imported</p>
                <p className="text-2xl font-bold">{importResult.contactsImported}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phones Imported</p>
                <p className="text-2xl font-bold">{importResult.phonesImported}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Emails Imported</p>
                <p className="text-2xl font-bold">{importResult.emailsImported}</p>
              </div>
            </div>

            {importResult.duplicates && importResult.duplicates.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">Duplicates Skipped: {importResult.duplicates.length}</p>
                  <ul className="text-sm mt-2 space-y-1">
                    {importResult.duplicates.slice(0, 5).map((dup: string, idx: number) => (
                      <li key={idx}>• {dup}</li>
                    ))}
                    {importResult.duplicates.length > 5 && (
                      <li>... and {importResult.duplicates.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {importResult.errors && importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">Errors: {importResult.errors.length}</p>
                  <ul className="text-sm mt-2 space-y-1">
                    {importResult.errors.slice(0, 5).map((error: string, idx: number) => (
                      <li key={idx}>• {error}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>... and {importResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={() => window.location.href = "/properties"} className="w-full">
              View Imported Properties
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
