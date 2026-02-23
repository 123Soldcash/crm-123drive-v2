import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Eye,
  Building2,
  UserPlus,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

type PreviewRow = {
  rowIndex: number;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  owner: string;
  isDuplicate: boolean;
  matchType: string | null;
  existingId: number | null;
  existingLeadId: number | null;
  changes: { field: string; oldValue: any; newValue: any }[];
  hasChanges: boolean;
  rawData: any;
};

type ContactPreviewRow = {
  rowIndex: number;
  contactName: string;
  relationship: string;
  phone1: string | null;
  email1: string | null;
  propertyAddress: string;
  propertyCity: string;
  matched: boolean;
  matchMethod: string | null;
  matchedPropertyId: number | null;
  matchedPropertyAddress: string | null;
  matchedLeadId: number | null;
  rawData: any;
};

export default function ImportProperties() {
  const [activeTab, setActiveTab] = useState<"properties" | "contacts">("properties");

  // ─── Properties State ───────────────────────────────────────────────────
  const [propFile, setPropFile] = useState<File | null>(null);
  const [propFileData, setPropFileData] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [propPreview, setPropPreview] = useState<{
    totalRows: number;
    newCount: number;
    duplicateCount: number;
    updatableCount: number;
    detectedColumns: string[];
    mappedColumns: Record<string, string>;
    rows: PreviewRow[];
  } | null>(null);
  const [selectedNewRows, setSelectedNewRows] = useState<Set<number>>(new Set());
  const [selectedUpdateRows, setSelectedUpdateRows] = useState<Set<number>>(new Set());
  const [changesDialogRow, setChangesDialogRow] = useState<PreviewRow | null>(null);

  // ─── Contacts State ─────────────────────────────────────────────────────
  const [contactFile, setContactFile] = useState<File | null>(null);
  const [contactFileData, setContactFileData] = useState<string | null>(null);
  const [contactPreview, setContactPreview] = useState<{
    totalRows: number;
    matchedCount: number;
    unmatchedCount: number;
    detectedColumns: string[];
    rows: ContactPreviewRow[];
  } | null>(null);
  const [selectedContactRows, setSelectedContactRows] = useState<Set<number>>(new Set());

  // ─── Shared State ───────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: agents, isLoading: loadingAgents } = trpc.users.listAgents.useQuery();
  const utils = trpc.useUtils();

  const previewPropertiesMut = trpc.importProperties.previewProperties.useMutation();
  const executeImportMut = trpc.importProperties.executeImport.useMutation();
  const previewContactsMut = trpc.importProperties.previewContacts.useMutation();
  const executeContactsMut = trpc.importProperties.executeContactsImport.useMutation();

  // ─── File Handlers ──────────────────────────────────────────────────────

  const handlePropFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
      ];
      const validExt = f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv");
      if (validTypes.includes(f.type) || validExt) {
        setPropFile(f);
        setPropPreview(null);
        setPropFileData(null);
      } else {
        toast.error("Please select a valid file (.xlsx, .xls, or .csv)");
      }
    }
  };

  const handleContactFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      const validExt = f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv");
      if (validExt || f.type === "text/csv" || f.type.includes("spreadsheet") || f.type.includes("excel")) {
        setContactFile(f);
        setContactPreview(null);
        setContactFileData(null);
      } else {
        toast.error("Please select a valid file (.xlsx, .xls, or .csv)");
      }
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ─── Properties Preview ─────────────────────────────────────────────────

  const handlePreviewProperties = async () => {
    if (!propFile) return;
    setIsProcessing(true);
    try {
      const base64 = await readFileAsBase64(propFile);
      setPropFileData(base64);
      const result = await previewPropertiesMut.mutateAsync({ fileData: base64 });
      setPropPreview(result);

      // Auto-select all new rows
      const newSet = new Set<number>();
      result.rows.filter((r: PreviewRow) => !r.isDuplicate).forEach((r: PreviewRow) => newSet.add(r.rowIndex));
      setSelectedNewRows(newSet);

      // Auto-select all updatable rows
      const updateSet = new Set<number>();
      result.rows.filter((r: PreviewRow) => r.isDuplicate && r.hasChanges).forEach((r: PreviewRow) => updateSet.add(r.rowIndex));
      setSelectedUpdateRows(updateSet);

      toast.success(`Preview ready: ${result.newCount} new, ${result.duplicateCount} duplicates (${result.updatableCount} with updates)`);
    } catch (error: any) {
      toast.error(`Preview failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!propFileData || !propPreview) return;
    setIsProcessing(true);
    try {
      const newRows = Array.from(selectedNewRows);
      const updateRows = Array.from(selectedUpdateRows).map((rowIndex) => {
        const row = propPreview.rows.find((r) => r.rowIndex === rowIndex);
        return { rowIndex, existingId: row?.existingId || 0 };
      }).filter((r) => r.existingId > 0);

      const result = await executeImportMut.mutateAsync({
        fileData: propFileData,
        assignedAgentId: selectedAgentId && selectedAgentId !== "unassigned" ? Number(selectedAgentId) : null,
        newRows,
        updateRows,
      });

      utils.properties.list.invalidate();
      toast.success(
        `Import complete! ${result.insertedCount} inserted, ${result.updatedCount} updated.${result.errorCount > 0 ? ` ${result.errorCount} errors.` : ""}`,
        { duration: 6000 }
      );

      if (result.errorCount > 0) {
        console.log("[Import Errors]:", result.errors);
      }

      // Reset
      setPropFile(null);
      setPropFileData(null);
      setPropPreview(null);
      setSelectedNewRows(new Set());
      setSelectedUpdateRows(new Set());
      setSelectedAgentId("");
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Contacts Preview ───────────────────────────────────────────────────

  const handlePreviewContacts = async () => {
    if (!contactFile) return;
    setIsProcessing(true);
    try {
      const base64 = await readFileAsBase64(contactFile);
      setContactFileData(base64);
      const result = await previewContactsMut.mutateAsync({ fileData: base64 });
      setContactPreview(result);

      // Auto-select all matched rows
      const matchedSet = new Set<number>();
      result.rows.filter((r: ContactPreviewRow) => r.matched).forEach((r: ContactPreviewRow) => matchedSet.add(r.rowIndex));
      setSelectedContactRows(matchedSet);

      toast.success(`Preview ready: ${result.matchedCount} matched, ${result.unmatchedCount} unmatched`);
    } catch (error: any) {
      toast.error(`Preview failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteContacts = async () => {
    if (!contactFileData || !contactPreview) return;
    setIsProcessing(true);
    try {
      const contactRows = Array.from(selectedContactRows).map((rowIndex) => {
        const row = contactPreview.rows.find((r) => r.rowIndex === rowIndex);
        return { rowIndex, propertyId: row?.matchedPropertyId || 0 };
      }).filter((r) => r.propertyId > 0);

      const result = await executeContactsMut.mutateAsync({
        fileData: contactFileData,
        contactRows,
      });

      toast.success(
        `Contacts imported! ${result.contactsImported} contacts, ${result.phonesImported} phones, ${result.emailsImported} emails.${result.errorCount > 0 ? ` ${result.errorCount} errors.` : ""}`,
        { duration: 6000 }
      );

      // Reset
      setContactFile(null);
      setContactFileData(null);
      setContactPreview(null);
      setSelectedContactRows(new Set());
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Toggle Helpers ─────────────────────────────────────────────────────

  const toggleNewRow = (rowIndex: number) => {
    setSelectedNewRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleUpdateRow = (rowIndex: number) => {
    setSelectedUpdateRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleContactRow = (rowIndex: number) => {
    setSelectedContactRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleAllNew = () => {
    if (!propPreview) return;
    const newRows = propPreview.rows.filter((r) => !r.isDuplicate);
    if (selectedNewRows.size === newRows.length) {
      setSelectedNewRows(new Set());
    } else {
      setSelectedNewRows(new Set(newRows.map((r) => r.rowIndex)));
    }
  };

  const toggleAllUpdates = () => {
    if (!propPreview) return;
    const updateRows = propPreview.rows.filter((r) => r.isDuplicate && r.hasChanges);
    if (selectedUpdateRows.size === updateRows.length) {
      setSelectedUpdateRows(new Set());
    } else {
      setSelectedUpdateRows(new Set(updateRows.map((r) => r.rowIndex)));
    }
  };

  const toggleAllContacts = () => {
    if (!contactPreview) return;
    const matchedRows = contactPreview.rows.filter((r) => r.matched);
    if (selectedContactRows.size === matchedRows.length) {
      setSelectedContactRows(new Set());
    } else {
      setSelectedContactRows(new Set(matchedRows.map((r) => r.rowIndex)));
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Data</h1>
        <p className="text-muted-foreground mt-2">
          Upload properties or contacts from Excel (.xlsx, .xls) or CSV files. The system detects duplicates and shows changes before importing.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="properties" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Properties
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Contacts
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            PROPERTIES TAB
            ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="properties" className="space-y-6 mt-6">
          {/* Upload Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Property File
                </CardTitle>
                <CardDescription>
                  Select an Excel or CSV file containing property data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prop-file-input">File (.xlsx, .xls, .csv)</Label>
                  <Input
                    id="prop-file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handlePropFileChange}
                    disabled={isProcessing}
                  />
                  {propFile && (
                    <div className="text-sm text-muted-foreground">
                      Selected: {propFile.name} ({(propFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
                <Button
                  onClick={handlePreviewProperties}
                  disabled={!propFile || isProcessing}
                  className="w-full"
                >
                  {isProcessing && previewPropertiesMut.isPending ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Eye className="mr-2 h-4 w-4" /> Preview &amp; Detect Duplicates</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Assign to Agent
                </CardTitle>
                <CardDescription>
                  Optionally assign imported properties to a birddog agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Birddog Agent (Optional)</Label>
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId} disabled={isProcessing || loadingAgents}>
                    <SelectTrigger>
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
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Results */}
          {propPreview && (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{propPreview.totalRows}</div>
                      <p className="text-sm text-muted-foreground">Total Rows</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-green-500/50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{propPreview.newCount}</div>
                      <p className="text-sm text-muted-foreground">New Properties</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-amber-500/50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-amber-600">{propPreview.updatableCount}</div>
                      <p className="text-sm text-muted-foreground">With Updates</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-gray-500/50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-500">{propPreview.duplicateCount - propPreview.updatableCount}</div>
                      <p className="text-sm text-muted-foreground">No Changes</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detected Columns */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Detected Column Mappings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(propPreview.mappedColumns).map(([raw, mapped]) => (
                      <Badge key={raw} variant="secondary" className="text-xs">
                        {raw} <ArrowRight className="h-3 w-3 mx-1 inline" /> {mapped}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* New Properties Table */}
              {propPreview.newCount > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      New Properties ({selectedNewRows.size} / {propPreview.newCount} selected)
                    </CardTitle>
                    <CardDescription>These properties do not exist in the system and will be inserted</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={selectedNewRows.size === propPreview.rows.filter((r) => !r.isDuplicate).length}
                                onCheckedChange={toggleAllNew}
                              />
                            </TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead>State</TableHead>
                            <TableHead>Zip</TableHead>
                            <TableHead>Owner</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {propPreview.rows
                            .filter((r) => !r.isDuplicate)
                            .map((row) => (
                              <TableRow key={row.rowIndex}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedNewRows.has(row.rowIndex)}
                                    onCheckedChange={() => toggleNewRow(row.rowIndex)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{row.address}</TableCell>
                                <TableCell>{row.city}</TableCell>
                                <TableCell>{row.state}</TableCell>
                                <TableCell>{row.zipcode}</TableCell>
                                <TableCell>{row.owner}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Duplicates with Updates Table */}
              {propPreview.updatableCount > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-5 w-5" />
                      Duplicates with Updates ({selectedUpdateRows.size} / {propPreview.updatableCount} selected)
                    </CardTitle>
                    <CardDescription>These properties already exist but have updated data. Click "View Changes" to see what will be updated.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={selectedUpdateRows.size === propPreview.rows.filter((r) => r.isDuplicate && r.hasChanges).length}
                                onCheckedChange={toggleAllUpdates}
                              />
                            </TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead>Match</TableHead>
                            <TableHead>Changes</TableHead>
                            <TableHead className="w-[120px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {propPreview.rows
                            .filter((r) => r.isDuplicate && r.hasChanges)
                            .map((row) => (
                              <TableRow key={row.rowIndex}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedUpdateRows.has(row.rowIndex)}
                                    onCheckedChange={() => toggleUpdateRow(row.rowIndex)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{row.address}</TableCell>
                                <TableCell>{row.city}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {row.matchType}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{row.changes.length} field(s)</Badge>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setChangesDialogRow(row)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" /> View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Duplicates without changes */}
              {propPreview.duplicateCount - propPreview.updatableCount > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-500">
                      <XCircle className="h-5 w-5" />
                      Duplicates — No Changes ({propPreview.duplicateCount - propPreview.updatableCount})
                    </CardTitle>
                    <CardDescription>These properties already exist with identical data. They will be skipped.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Address</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead>Match</TableHead>
                            <TableHead>Lead ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {propPreview.rows
                            .filter((r) => r.isDuplicate && !r.hasChanges)
                            .map((row) => (
                              <TableRow key={row.rowIndex} className="opacity-60">
                                <TableCell>{row.address}</TableCell>
                                <TableCell>{row.city}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">{row.matchType}</Badge>
                                </TableCell>
                                <TableCell>{row.existingLeadId || "—"}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Execute Button */}
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPropPreview(null);
                    setPropFileData(null);
                    setPropFile(null);
                    setSelectedNewRows(new Set());
                    setSelectedUpdateRows(new Set());
                  }}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExecuteImport}
                  disabled={isProcessing || (selectedNewRows.size === 0 && selectedUpdateRows.size === 0)}
                  size="lg"
                  className="min-w-[200px]"
                >
                  {isProcessing && executeImportMut.isPending ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" /> Import {selectedNewRows.size} New + {selectedUpdateRows.size} Updates</>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Instructions (shown when no preview) */}
          {!propPreview && (
            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <strong>1. Upload your file:</strong> Select an Excel (.xlsx, .xls) or CSV file containing property data. The system auto-detects column mappings.
                  </p>
                  <p>
                    <strong>2. Preview &amp; detect duplicates:</strong> The system checks each row against existing properties by address, APN, or property ID.
                  </p>
                  <p>
                    <strong>3. Review changes:</strong> For duplicates with updated data, you can view a side-by-side comparison of old vs new values.
                  </p>
                  <p>
                    <strong>4. Select &amp; import:</strong> Choose which new properties to insert and which duplicates to update, then execute the import.
                  </p>
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                    <p className="text-blue-900 dark:text-blue-100">
                      <strong>Supported columns:</strong> address, city, state, zipcode, owner name, estimated value, equity, mortgage, tax amount, property type, year built, bedrooms, baths, sqft, APN, and more. Column names are matched automatically.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            CONTACTS TAB
            ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="contacts" className="space-y-6 mt-6">
          <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Contacts can only be imported for properties that already exist in the system.
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    Your file must include property identifiers (address, APN, or Lead ID) so the system can match each contact to the correct property. Unmatched contacts will be skipped.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Contacts File
              </CardTitle>
              <CardDescription>
                Select an Excel or CSV file containing contact data with property identifiers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact-file-input">File (.xlsx, .xls, .csv)</Label>
                <Input
                  id="contact-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleContactFileChange}
                  disabled={isProcessing}
                />
                {contactFile && (
                  <div className="text-sm text-muted-foreground">
                    Selected: {contactFile.name} ({(contactFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
              <Button
                onClick={handlePreviewContacts}
                disabled={!contactFile || isProcessing}
                className="w-full"
              >
                {isProcessing && previewContactsMut.isPending ? (
                  <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                ) : (
                  <><Eye className="mr-2 h-4 w-4" /> Preview &amp; Match Properties</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Contact Preview Results */}
          {contactPreview && (
            <>
              {/* Summary */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{contactPreview.totalRows}</div>
                      <p className="text-sm text-muted-foreground">Total Contacts</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-green-500/50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{contactPreview.matchedCount}</div>
                      <p className="text-sm text-muted-foreground">Matched to Property</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-red-500/50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{contactPreview.unmatchedCount}</div>
                      <p className="text-sm text-muted-foreground">No Match (Skipped)</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Matched Contacts Table */}
              {contactPreview.matchedCount > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      Matched Contacts ({selectedContactRows.size} / {contactPreview.matchedCount} selected)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={selectedContactRows.size === contactPreview.rows.filter((r) => r.matched).length}
                                onCheckedChange={toggleAllContacts}
                              />
                            </TableHead>
                            <TableHead>Contact Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Matched Property</TableHead>
                            <TableHead>Match By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contactPreview.rows
                            .filter((r) => r.matched)
                            .map((row) => (
                              <TableRow key={row.rowIndex}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedContactRows.has(row.rowIndex)}
                                    onCheckedChange={() => toggleContactRow(row.rowIndex)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{row.contactName}</TableCell>
                                <TableCell className="text-sm">{row.phone1 || "—"}</TableCell>
                                <TableCell className="text-sm">{row.email1 || "—"}</TableCell>
                                <TableCell className="text-sm">
                                  <span className="text-muted-foreground">{row.matchedPropertyAddress}</span>
                                  {row.matchedLeadId && (
                                    <Badge variant="outline" className="ml-2 text-xs">#{row.matchedLeadId}</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-xs">{row.matchMethod}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Unmatched Contacts */}
              {contactPreview.unmatchedCount > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-5 w-5" />
                      Unmatched Contacts ({contactPreview.unmatchedCount})
                    </CardTitle>
                    <CardDescription>These contacts could not be matched to any existing property and will be skipped.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Contact Name</TableHead>
                            <TableHead>Property Address</TableHead>
                            <TableHead>City</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contactPreview.rows
                            .filter((r) => !r.matched)
                            .map((row) => (
                              <TableRow key={row.rowIndex} className="opacity-60">
                                <TableCell>{row.contactName}</TableCell>
                                <TableCell>{row.propertyAddress}</TableCell>
                                <TableCell>{row.propertyCity}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Execute Button */}
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setContactPreview(null);
                    setContactFileData(null);
                    setContactFile(null);
                    setSelectedContactRows(new Set());
                  }}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExecuteContacts}
                  disabled={isProcessing || selectedContactRows.size === 0}
                  size="lg"
                  className="min-w-[200px]"
                >
                  {isProcessing && executeContactsMut.isPending ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" /> Import {selectedContactRows.size} Contacts</>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Instructions (shown when no preview) */}
          {!contactPreview && (
            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <strong>1. Import properties first:</strong> Contacts can only be linked to properties that already exist in the system.
                  </p>
                  <p>
                    <strong>2. Include property identifiers:</strong> Your contacts file must include columns that identify the property (address + city, APN, or Lead ID).
                  </p>
                  <p>
                    <strong>3. Upload &amp; preview:</strong> The system matches each contact row to an existing property and shows the results.
                  </p>
                  <p>
                    <strong>4. Select &amp; import:</strong> Choose which matched contacts to import. Unmatched contacts are automatically skipped.
                  </p>
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                    <p className="text-blue-900 dark:text-blue-100">
                      <strong>Supported columns:</strong> contact name, first name, last name, relationship, phone (1-3), email (1-3), mailing address, flags, plus property identifiers (address, city, state, APN, lead ID).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════
          CHANGES COMPARISON DIALOG
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!changesDialogRow} onOpenChange={(open) => !open && setChangesDialogRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Data Changes</DialogTitle>
            <DialogDescription>
              {changesDialogRow?.address}, {changesDialogRow?.city} {changesDialogRow?.state}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Current Value</TableHead>
                  <TableHead></TableHead>
                  <TableHead>New Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changesDialogRow?.changes.map((change, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium text-sm">{change.field}</TableCell>
                    <TableCell className="text-sm text-red-600 dark:text-red-400">
                      {change.oldValue ?? "—"}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="text-sm text-green-600 dark:text-green-400 font-medium">
                      {change.newValue ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesDialogRow(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
