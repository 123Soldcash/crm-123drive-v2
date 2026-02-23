import { useState } from "react";
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
  CheckCheck,
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
  contactCount: number;
  totalPhones: number;
  totalEmails: number;
  contactNames: string[];
  rawData: any;
};

type ContactPreviewRow = {
  rowIndex: number;
  contactName: string;
  firstName: string | null;
  lastName: string | null;
  middleInitial: string | null;
  generationalSuffix: string | null;
  dealMachineContactId: string | null;
  relationship: string;
  flags: string | null;
  phones: {
    number: string;
    type: string;
    dnc: boolean;
    carrier: string | null;
    prepaid: boolean;
    activity: string | null;
    usage2m: string | null;
    usage12m: string | null;
  }[];
  emails: string[];
  phoneCount: number;
  emailCount: number;
  demographics: {
    gender: string | null;
    maritalStatus: string | null;
    netAssetValue: string | null;
    homeBusiness: string | null;
    occupationGroup: string | null;
    businessOwner: string | null;
  };
  mailingAddress: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;
  propertyAddress: string;
  propertyCity: string;
  apn: string | null;
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
    hasEmbeddedContacts: boolean;
    totalContactsDetected: number;
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
      const validExt = f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv");
      if (validExt || f.type === "text/csv" || f.type.includes("spreadsheet") || f.type.includes("excel")) {
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

      const noChangeCount = result.duplicateCount - result.updatableCount;
      toast.success(`Preview ready: ${result.newCount} new, ${result.updatableCount} with updates, ${noChangeCount} already up-to-date`);
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
        importContacts: true,
      });

      utils.properties.list.invalidate();
      const contactInfo = result.contactsImported > 0 ? ` | ${result.contactsImported} contacts, ${result.phonesImported} phones, ${result.emailsImported} emails` : "";
      toast.success(
        `Import complete! ${result.insertedCount} inserted, ${result.updatedCount} updated.${contactInfo}${result.errorCount > 0 ? ` ${result.errorCount} errors.` : ""}`,
        { duration: 8000 }
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
            <div className="space-y-6">
              {/* Embedded Contacts Banner */}
              {propPreview.hasEmbeddedContacts && (
                <Card className="border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-purple-800 dark:text-purple-200">
                          {propPreview.totalContactsDetected} embedded contacts detected in this file
                        </p>
                        <p className="text-purple-700 dark:text-purple-300 mt-1">
                          Contacts (with phones, emails, and Facebook profiles) will be automatically imported along with each property. No separate contacts file needed.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

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
                <Card className="border-blue-500/50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-500">
                        {propPreview.duplicateCount - propPreview.updatableCount}
                      </div>
                      <p className="text-sm text-muted-foreground">Already Up-to-Date</p>
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
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      New Properties ({selectedNewRows.size} / {propPreview.newCount} selected)
                    </CardTitle>
                    <CardDescription>These properties do not exist in the system and will be inserted</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={selectedNewRows.size === propPreview.rows.filter((r) => !r.isDuplicate).length && propPreview.newCount > 0}
                                onCheckedChange={toggleAllNew}
                              />
                            </TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead>State</TableHead>
                            <TableHead>Zip</TableHead>
                            <TableHead>Owner</TableHead>
                            {propPreview.hasEmbeddedContacts && <TableHead>Contacts</TableHead>}
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
                                {propPreview.hasEmbeddedContacts && (
                                  <TableCell>
                                    {row.contactCount > 0 ? (
                                      <div className="flex flex-col gap-0.5">
                                        <Badge variant="secondary" className="text-xs w-fit">
                                          {row.contactCount} contacts
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {row.totalPhones} phones, {row.totalEmails} emails
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Duplicates with Updates Table */}
              {propPreview.updatableCount > 0 && (
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-5 w-5" />
                      Duplicates with Updates ({selectedUpdateRows.size} / {propPreview.updatableCount} selected)
                    </CardTitle>
                    <CardDescription>
                      These properties already exist but have updated data. Only the changed fields are shown.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={selectedUpdateRows.size === propPreview.rows.filter((r) => r.isDuplicate && r.hasChanges).length && propPreview.updatableCount > 0}
                                onCheckedChange={toggleAllUpdates}
                              />
                            </TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead>Match</TableHead>
                            <TableHead>Fields to Update</TableHead>
                            <TableHead className="w-[100px]">Details</TableHead>
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
                                  <div className="flex flex-wrap gap-1">
                                    {row.changes.slice(0, 3).map((c, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">
                                        {c.field}
                                      </Badge>
                                    ))}
                                    {row.changes.length > 3 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{row.changes.length - 3} more
                                      </Badge>
                                    )}
                                  </div>
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
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Duplicates without changes — Already Imported */}
              {propPreview.duplicateCount - propPreview.updatableCount > 0 && (
                <Card className="overflow-hidden border-blue-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <CheckCheck className="h-5 w-5" />
                      Already Up-to-Date ({propPreview.duplicateCount - propPreview.updatableCount})
                    </CardTitle>
                    <CardDescription>
                      These properties already exist with identical data. No import needed.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[250px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <CheckCheck className="h-4 w-4 text-blue-500" />
                            </TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead>Match</TableHead>
                            <TableHead>Lead ID</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {propPreview.rows
                            .filter((r) => r.isDuplicate && !r.hasChanges)
                            .map((row) => (
                              <TableRow key={row.rowIndex} className="opacity-70">
                                <TableCell>
                                  <CheckCheck className="h-4 w-4 text-blue-500" />
                                </TableCell>
                                <TableCell>{row.address}</TableCell>
                                <TableCell>{row.city}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">{row.matchType}</Badge>
                                </TableCell>
                                <TableCell>{row.existingLeadId || "—"}</TableCell>
                                <TableCell>
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">
                                    Already Imported
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Execute Button — always visible at bottom with sticky positioning */}
              <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm py-4 border-t z-20">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    {selectedNewRows.size > 0 && <span className="text-green-600 font-medium">{selectedNewRows.size} new</span>}
                    {selectedNewRows.size > 0 && selectedUpdateRows.size > 0 && " + "}
                    {selectedUpdateRows.size > 0 && <span className="text-amber-600 font-medium">{selectedUpdateRows.size} updates</span>}
                    {selectedNewRows.size === 0 && selectedUpdateRows.size === 0 && "No rows selected"}
                  </div>
                  <div className="flex gap-3">
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
                        <><Upload className="mr-2 h-4 w-4" /> Import {selectedNewRows.size + selectedUpdateRows.size} Properties</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
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
                    <strong>3. Review changes:</strong> For duplicates with updated data, you can view only the fields that will be updated (side-by-side comparison).
                  </p>
                  <p>
                    <strong>4. Select &amp; import:</strong> Choose which new properties to insert and which duplicates to update. Properties with identical data are marked as "Already Imported".
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
                    Your file must include property identifiers (<strong>associated_property_apn_parcel_id</strong>, address, or Lead ID) so the system can match each contact to the correct property. Unmatched contacts will be skipped.
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
            <div className="space-y-6">
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

              {/* Detected Columns Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Detected Columns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {contactPreview.detectedColumns.map((col) => (
                      <Badge key={col} variant="secondary" className="text-xs">
                        {col}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Matched Contacts Table */}
              {contactPreview.matchedCount > 0 && (
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      Matched Contacts ({selectedContactRows.size} / {contactPreview.matchedCount} selected)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={selectedContactRows.size === contactPreview.rows.filter((r) => r.matched).length && contactPreview.matchedCount > 0}
                                onCheckedChange={toggleAllContacts}
                              />
                            </TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Phones</TableHead>
                            <TableHead>Emails</TableHead>
                            <TableHead>Demographics</TableHead>
                            <TableHead>Matched Property</TableHead>
                            <TableHead>Match</TableHead>
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
                                <TableCell className="font-medium">
                                  <div className="flex flex-col gap-0.5">
                                    <span>{row.contactName}</span>
                                    {row.flags && (
                                      <div className="flex flex-wrap gap-1">
                                        {row.flags.split(",").map((f: string, i: number) => (
                                          <Badge key={i} variant="outline" className="text-[10px] px-1">{f.trim()}</Badge>
                                        ))}
                                      </div>
                                    )}
                                    {row.mailingAddress && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {row.mailingAddress}, {row.mailingCity} {row.mailingState} {row.mailingZip}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {row.phones && row.phones.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                      {row.phones.map((p, i: number) => (
                                        <div key={i} className="flex flex-col">
                                          <div className="flex items-center gap-1">
                                            <span className="font-mono text-xs">{p.number}</span>
                                            <Badge variant="secondary" className="text-[10px] px-1">{p.type}</Badge>
                                            {p.dnc && <Badge variant="destructive" className="text-[10px] px-1">DNC</Badge>}
                                            {p.prepaid && <Badge className="text-[10px] px-1 bg-yellow-500">Prepaid</Badge>}
                                          </div>
                                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                            {p.carrier && <span>{p.carrier}</span>}
                                            {p.activity && <span>\u00B7 {p.activity}</span>}
                                          </div>
                                          {(p.usage2m || p.usage12m) && (
                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                              {p.usage2m && <span>2mo: {p.usage2m}</span>}
                                              {p.usage12m && <span>12mo: {p.usage12m}</span>}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : "\u2014"}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {row.emails && row.emails.length > 0 ? (
                                    <div className="flex flex-col gap-0.5">
                                      {row.emails.map((e: string, i: number) => (
                                        <span key={i} className="text-xs">{e}</span>
                                      ))}
                                    </div>
                                  ) : "\u2014"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.demographics ? (
                                    <div className="flex flex-col gap-0.5">
                                      {row.demographics.gender && <span>Gender: {row.demographics.gender}</span>}
                                      {row.demographics.maritalStatus && <span>Status: {row.demographics.maritalStatus}</span>}
                                      {row.demographics.netAssetValue && <span>Net Asset: {row.demographics.netAssetValue}</span>}
                                      {row.demographics.occupationGroup && <span>Occ: {row.demographics.occupationGroup}</span>}
                                      {row.demographics.businessOwner && <span>Biz Owner: {row.demographics.businessOwner}</span>}
                                    </div>
                                  ) : "\u2014"}
                                </TableCell>
                                <TableCell className="text-sm">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-muted-foreground text-xs">{row.matchedPropertyAddress}</span>
                                    {row.matchedLeadId && (
                                      <Badge variant="outline" className="text-[10px] w-fit">#{row.matchedLeadId}</Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-[10px]">{row.matchMethod}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Unmatched Contacts */}
              {contactPreview.unmatchedCount > 0 && (
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-5 w-5" />
                      Unmatched Contacts ({contactPreview.unmatchedCount})
                    </CardTitle>
                    <CardDescription>These contacts could not be matched to any existing property and will be skipped.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[250px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Contact Name</TableHead>
                            <TableHead>Property Address</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead>APN</TableHead>
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
                                <TableCell>{row.rawData?.apn || "—"}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Execute Button */}
              <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm py-4 border-t z-20">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    {selectedContactRows.size > 0 ? (
                      <span className="text-green-600 font-medium">{selectedContactRows.size} contacts selected</span>
                    ) : (
                      "No contacts selected"
                    )}
                  </div>
                  <div className="flex gap-3">
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
                </div>
              </div>
            </div>
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
                    <strong>2. Include property identifiers:</strong> Your contacts file must include <strong>associated_property_apn_parcel_id</strong> (APN), address + city, or Lead ID to match contacts to properties.
                  </p>
                  <p>
                    <strong>3. Upload &amp; preview:</strong> The system matches each contact row to an existing property using the APN field and shows the results.
                  </p>
                  <p>
                    <strong>4. Select &amp; import:</strong> Choose which matched contacts to import. Unmatched contacts are automatically skipped.
                  </p>
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                    <p className="text-blue-900 dark:text-blue-100">
                      <strong>Supported columns:</strong> contact name, first/last name, relationship, phone_1 to phone_3 (with DNC, carrier, prepaid, activity, usage indicators), email_address_1 to email_address_3, mailing address (current + previous), demographics (gender, marital status, net asset value, occupation, business owner), flags, plus property identifiers (<strong>associated_property_apn_parcel_id</strong>, address, city, state, APN, lead ID).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════
          CHANGES COMPARISON DIALOG — Shows only fields that will be updated
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!changesDialogRow} onOpenChange={(open) => !open && setChangesDialogRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fields to Update</DialogTitle>
            <DialogDescription>
              {changesDialogRow?.address}, {changesDialogRow?.city} {changesDialogRow?.state}
              <br />
              <span className="text-xs">Only fields with different values are shown below.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Current Value</TableHead>
                  <TableHead className="w-[30px]"></TableHead>
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
          </div>
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
