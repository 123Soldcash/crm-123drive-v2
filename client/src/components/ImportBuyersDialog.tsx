import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import * as XLSX from "xlsx";

// Column mapping from Excel header to internal key
const COLUMN_MAP: Record<string, string> = {
  "name": "name",
  "full name": "name",
  "buyer name": "name",
  "email": "email",
  "email address": "email",
  "phone": "phone",
  "phone number": "phone",
  "company": "company",
  "company name": "company",
  "status": "status",
  "notes": "notes",
  "preferred states": "preferredStates",
  "states": "preferredStates",
  "preferred cities": "preferredCities",
  "cities": "preferredCities",
  "preferred zipcodes": "preferredZipcodes",
  "zipcodes": "preferredZipcodes",
  "zip codes": "preferredZipcodes",
  "property types": "propertyTypes",
  "min beds": "minBeds",
  "minimum beds": "minBeds",
  "max beds": "maxBeds",
  "maximum beds": "maxBeds",
  "min baths": "minBaths",
  "minimum baths": "minBaths",
  "max baths": "maxBaths",
  "maximum baths": "maxBaths",
  "min price": "minPrice",
  "minimum price": "minPrice",
  "max price": "maxPrice",
  "maximum price": "maxPrice",
  "max repair cost": "maxRepairCost",
  "maximum repair cost": "maxRepairCost",
};

interface ParsedRow {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status?: string;
  notes?: string;
  preferredStates?: string;
  preferredCities?: string;
  preferredZipcodes?: string;
  propertyTypes?: string;
  minBeds?: number | null;
  maxBeds?: number | null;
  minBaths?: number | null;
  maxBaths?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  maxRepairCost?: number | null;
}

interface ValidationRow {
  row: number;
  data: ParsedRow;
  valid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
}

type ImportStep = "upload" | "preview" | "importing" | "results";

interface ImportBuyersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportBuyersDialog({ open, onOpenChange }: ImportBuyersDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validations, setValidations] = useState<ValidationRow[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const validateMutation = trpc.buyers.validateImport.useMutation({
    onSuccess: (data) => {
      setValidations(data as any);
      setStep("preview");
    },
    onError: (error) => {
      toast.error("Validation failed: " + error.message);
    },
  });

  const importMutation = trpc.buyers.bulkImport.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      setStep("results");
      utils.buyers.list.invalidate();
      if (data.imported > 0) {
        toast.success(`Successfully imported ${data.imported} buyer${data.imported > 1 ? "s" : ""}!`);
      }
    },
    onError: (error) => {
      toast.error("Import failed: " + error.message);
      setStep("preview");
    },
  });

  const resetState = useCallback(() => {
    setStep("upload");
    setParsedRows([]);
    setValidations([]);
    setImportResult(null);
    setFileName("");
    setIsDragging(false);
    setShowInstructions(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  /**
   * Parse Excel file and extract rows
   */
  const parseExcelFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (jsonData.length === 0) {
          toast.error("The Excel file is empty. Please add buyer data and try again.");
          return;
        }

        // Map columns
        const rows: ParsedRow[] = jsonData.map((row: any) => {
          const mapped: any = {};
          Object.keys(row).forEach((key) => {
            const normalizedKey = key.toLowerCase().trim();
            const internalKey = COLUMN_MAP[normalizedKey];
            if (internalKey) {
              mapped[internalKey] = row[key];
            }
          });

          // Convert numeric fields
          const numericFields = ["minBeds", "maxBeds", "minBaths", "maxBaths", "minPrice", "maxPrice", "maxRepairCost"];
          numericFields.forEach((field) => {
            if (mapped[field] !== undefined && mapped[field] !== "") {
              const num = Number(mapped[field]);
              mapped[field] = isNaN(num) ? null : num;
            } else {
              mapped[field] = null;
            }
          });

          return {
            name: String(mapped.name || "").trim(),
            email: String(mapped.email || "").trim(),
            phone: mapped.phone ? String(mapped.phone).trim() : undefined,
            company: mapped.company ? String(mapped.company).trim() : undefined,
            status: mapped.status ? String(mapped.status).trim() : undefined,
            notes: mapped.notes ? String(mapped.notes).trim() : undefined,
            preferredStates: mapped.preferredStates ? String(mapped.preferredStates).trim() : undefined,
            preferredCities: mapped.preferredCities ? String(mapped.preferredCities).trim() : undefined,
            preferredZipcodes: mapped.preferredZipcodes ? String(mapped.preferredZipcodes).trim() : undefined,
            propertyTypes: mapped.propertyTypes ? String(mapped.propertyTypes).trim() : undefined,
            minBeds: mapped.minBeds,
            maxBeds: mapped.maxBeds,
            minBaths: mapped.minBaths,
            maxBaths: mapped.maxBaths,
            minPrice: mapped.minPrice,
            maxPrice: mapped.maxPrice,
            maxRepairCost: mapped.maxRepairCost,
          } as ParsedRow;
        });

        setParsedRows(rows);

        // Validate on server
        validateMutation.mutate({ rows });
      } catch (error) {
        toast.error("Failed to parse Excel file. Please check the file format.");
        console.error("Excel parse error:", error);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [validateMutation]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  }, [parseExcelFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        parseExcelFile(file);
      } else {
        toast.error("Please upload an Excel file (.xlsx, .xls) or CSV file.");
      }
    }
  }, [parseExcelFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  /**
   * Download template Excel file
   */
  const downloadTemplate = useCallback(() => {
    const headers = [
      "Name", "Email", "Phone", "Company", "Status", "Notes",
      "Preferred States", "Preferred Cities", "Preferred Zipcodes",
      "Property Types", "Min Beds", "Max Beds", "Min Baths", "Max Baths",
      "Min Price", "Max Price", "Max Repair Cost",
    ];

    const sampleData = [
      {
        "Name": "John Smith",
        "Email": "john@example.com",
        "Phone": "(555) 123-4567",
        "Company": "Smith Investments LLC",
        "Status": "Active",
        "Notes": "Cash buyer, closes fast",
        "Preferred States": "FL, TX",
        "Preferred Cities": "Miami, Fort Lauderdale, Hollywood",
        "Preferred Zipcodes": "33063, 33023, 33009",
        "Property Types": "Single Family, Multi-Family",
        "Min Beds": 3,
        "Max Beds": 5,
        "Min Baths": 2,
        "Max Baths": 4,
        "Min Price": 100000,
        "Max Price": 500000,
        "Max Repair Cost": 50000,
      },
      {
        "Name": "Maria Garcia",
        "Email": "maria@realestate.com",
        "Phone": "(305) 999-8888",
        "Company": "Garcia Properties",
        "Status": "Verified",
        "Notes": "Prefers move-in ready",
        "Preferred States": "FL",
        "Preferred Cities": "Miami, Hialeah",
        "Preferred Zipcodes": "",
        "Property Types": "Single Family",
        "Min Beds": 2,
        "Max Beds": 4,
        "Min Baths": 1,
        "Max Baths": 3,
        "Min Price": 150000,
        "Max Price": 350000,
        "Max Repair Cost": 25000,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });

    // Set column widths
    ws["!cols"] = headers.map((h) => ({
      wch: Math.max(h.length + 2, 15),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Buyers Template");

    // Add instructions sheet
    const instructions = [
      { "Instructions": "BUYER IMPORT TEMPLATE - Instructions" },
      { "Instructions": "" },
      { "Instructions": "REQUIRED FIELDS:" },
      { "Instructions": "  - Name: Full name of the buyer (required)" },
      { "Instructions": "  - Email: Email address, must be unique (required)" },
      { "Instructions": "" },
      { "Instructions": "OPTIONAL FIELDS:" },
      { "Instructions": "  - Phone: Phone number (any format)" },
      { "Instructions": "  - Company: Company or LLC name" },
      { "Instructions": "  - Status: Active, Inactive, Verified, or Blacklisted (defaults to Active)" },
      { "Instructions": "  - Notes: Any additional notes" },
      { "Instructions": "" },
      { "Instructions": "PREFERENCES (all optional):" },
      { "Instructions": "  - Preferred States: Comma-separated state codes (e.g., FL, TX, CA)" },
      { "Instructions": "  - Preferred Cities: Comma-separated city names (e.g., Miami, Fort Lauderdale)" },
      { "Instructions": "  - Preferred Zipcodes: Comma-separated zip codes (e.g., 33063, 33023)" },
      { "Instructions": "  - Property Types: Comma-separated (e.g., Single Family, Multi-Family, Condo)" },
      { "Instructions": "  - Min/Max Beds: Numbers only" },
      { "Instructions": "  - Min/Max Baths: Numbers only (decimals OK, e.g., 1.5)" },
      { "Instructions": "  - Min/Max Price: Numbers only, no $ or commas (e.g., 250000)" },
      { "Instructions": "  - Max Repair Cost: Numbers only, no $ or commas" },
      { "Instructions": "" },
      { "Instructions": "TIPS:" },
      { "Instructions": "  - The first sheet (Buyers Template) contains the data to import" },
      { "Instructions": "  - Delete the sample rows and add your own data" },
      { "Instructions": "  - Column headers are flexible (e.g., 'Full Name' also works for Name)" },
      { "Instructions": "  - Duplicate emails will be automatically detected and skipped" },
      { "Instructions": "  - You can preview and validate before importing" },
    ];
    const wsInstructions = XLSX.utils.json_to_sheet(instructions);
    wsInstructions["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

    XLSX.writeFile(wb, "Buyers_Import_Template.xlsx");
    toast.success("Template downloaded! Fill it with your buyer data and upload it.");
  }, []);

  const handleImport = useCallback(() => {
    if (parsedRows.length === 0) return;
    setStep("importing");
    importMutation.mutate({ rows: parsedRows, skipDuplicates: true });
  }, [parsedRows, importMutation]);

  // Stats from validation
  const validCount = validations.filter((v) => v.valid && !v.isDuplicate).length;
  const invalidCount = validations.filter((v) => !v.valid).length;
  const duplicateCount = validations.filter((v) => v.isDuplicate).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="h-6 w-6 text-purple-600" />
            Import Buyers from Excel
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx) with buyer data. You can download a template to get started.
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4 py-2">
            {/* Instructions Toggle */}
            <div className="border rounded-lg overflow-hidden">
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800 text-sm">Excel Template Structure & Instructions</span>
                </div>
                {showInstructions ? (
                  <ChevronUp className="h-4 w-4 text-blue-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                )}
              </button>
              {showInstructions && (
                <div className="p-4 bg-blue-50/50 text-sm space-y-3">
                  <div>
                    <p className="font-semibold text-blue-900 mb-1">Required Columns:</p>
                    <div className="grid grid-cols-2 gap-1 ml-2">
                      <span><Badge variant="destructive" className="text-[10px] mr-1">Required</Badge> <strong>Name</strong> — Full name</span>
                      <span><Badge variant="destructive" className="text-[10px] mr-1">Required</Badge> <strong>Email</strong> — Must be unique</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-900 mb-1">Optional Columns:</p>
                    <div className="grid grid-cols-2 gap-1 ml-2 text-muted-foreground">
                      <span><strong>Phone</strong> — Any format</span>
                      <span><strong>Company</strong> — Company/LLC name</span>
                      <span><strong>Status</strong> — Active, Inactive, Verified, Blacklisted</span>
                      <span><strong>Notes</strong> — Additional notes</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-900 mb-1">Buyer Preferences (optional):</p>
                    <div className="grid grid-cols-2 gap-1 ml-2 text-muted-foreground">
                      <span><strong>Preferred States</strong> — Comma-separated (FL, TX)</span>
                      <span><strong>Preferred Cities</strong> — Comma-separated</span>
                      <span><strong>Preferred Zipcodes</strong> — Comma-separated</span>
                      <span><strong>Property Types</strong> — Single Family, Multi-Family...</span>
                      <span><strong>Min/Max Beds</strong> — Numbers only</span>
                      <span><strong>Min/Max Baths</strong> — Numbers (1.5 OK)</span>
                      <span><strong>Min/Max Price</strong> — Numbers, no $ or commas</span>
                      <span><strong>Max Repair Cost</strong> — Numbers, no $ or commas</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Download Template */}
            <div className="flex items-center justify-center">
              <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                <Download className="h-4 w-4" />
                Download Excel Template
              </Button>
            </div>

            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                ${isDragging
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-300 hover:border-purple-400 hover:bg-gray-50"
                }
              `}
            >
              <Upload className={`h-12 w-12 mx-auto mb-3 ${isDragging ? "text-purple-500" : "text-gray-400"}`} />
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? "Drop your file here!" : "Drag & drop your Excel file here"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse — accepts .xlsx, .xls, .csv
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {validateMutation.isPending && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                <span className="text-sm text-muted-foreground">Validating {parsedRows.length} rows...</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Preview */}
        {step === "preview" && (
          <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{validations.length}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{validCount}</p>
                <p className="text-xs text-green-700">Ready to Import</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{duplicateCount}</p>
                <p className="text-xs text-yellow-700">Duplicates (skip)</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{invalidCount}</p>
                <p className="text-xs text-red-700">Errors</p>
              </div>
            </div>

            {/* File info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{fileName}</span>
            </div>

            {/* Validation Table */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Preferences</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validations.map((v, i) => (
                    <TableRow
                      key={i}
                      className={
                        !v.valid
                          ? "bg-red-50"
                          : v.isDuplicate
                          ? "bg-yellow-50"
                          : ""
                      }
                    >
                      <TableCell className="text-xs text-muted-foreground">{v.row}</TableCell>
                      <TableCell>
                        {!v.valid ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : v.isDuplicate ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{v.data.name || "—"}</TableCell>
                      <TableCell className="text-sm">{v.data.email || "—"}</TableCell>
                      <TableCell className="text-sm">{v.data.phone || "—"}</TableCell>
                      <TableCell className="text-sm">{v.data.company || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {v.data.preferredStates || v.data.preferredCities || v.data.propertyTypes ? (
                          <span className="text-muted-foreground">
                            {[v.data.preferredStates, v.data.preferredCities, v.data.propertyTypes].filter(Boolean).join(" | ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {v.errors.length > 0 && (
                          <div className="text-xs text-red-600">{v.errors.join("; ")}</div>
                        )}
                        {v.warnings.length > 0 && (
                          <div className="text-xs text-yellow-600">{v.warnings.join("; ")}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="flex justify-between items-center gap-2">
              <Button variant="outline" onClick={resetState}>
                Upload Different File
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={validCount === 0}
                  className="bg-purple-600 hover:bg-purple-700 gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import {validCount} Buyer{validCount !== 1 ? "s" : ""}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
            <p className="text-lg font-medium">Importing buyers...</p>
            <p className="text-sm text-muted-foreground">
              Processing {validCount} buyer{validCount !== 1 ? "s" : ""}. This may take a moment.
            </p>
          </div>
        )}

        {/* STEP 4: Results */}
        {step === "results" && importResult && (
          <div className="space-y-6 py-4">
            {/* Result Summary */}
            <div className="text-center">
              {importResult.imported > 0 ? (
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
              ) : (
                <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-3" />
              )}
              <h3 className="text-2xl font-bold">
                {importResult.imported > 0 ? "Import Complete!" : "No Buyers Imported"}
              </h3>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold">{importResult.totalRows}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
                <p className="text-sm text-green-700">Imported</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-yellow-600">{importResult.duplicates}</p>
                <p className="text-sm text-yellow-700">Duplicates Skipped</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{importResult.errors?.length || 0}</p>
                <p className="text-sm text-red-700">Errors</p>
              </div>
            </div>

            {/* Error details */}
            {importResult.errors?.length > 0 && (
              <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                <p className="font-medium text-red-800 mb-2">Errors:</p>
                <ul className="text-sm text-red-700 space-y-1">
                  {importResult.errors.map((err: any, i: number) => (
                    <li key={i}>Row {err.row}: {err.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={resetState}>
                Import More
              </Button>
              <Button onClick={handleClose} className="bg-purple-600 hover:bg-purple-700">
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
