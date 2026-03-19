import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { formatPhone } from "@/lib/formatPhone";
import { ListPlus, Upload, AlertCircle, CheckCircle2, Phone, Mail, User, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface ParsedContact {
  name: string;
  phones: string[];
  emails: string[];
  raw: string;
}

// Smart parser: detects name, phone numbers, and emails from each line
function parseContactLine(line: string): ParsedContact | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Split by common delimiters: semicolons, tabs, pipes
  // We use a two-pass approach: first split by pipe/semicolon/tab for major fields,
  // then within each field check for commas (which could separate multiple phones/emails)
  const majorParts = trimmed
    .split(/[;\t|]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (majorParts.length === 0) return null;

  const phones: string[] = [];
  const emails: string[] = [];
  const nameParts: string[] = [];

  for (const majorPart of majorParts) {
    // Each major part might contain comma-separated values
    const subParts = majorPart.split(",").map((s) => s.trim()).filter(Boolean);
    for (const part of subParts) {
      if (isEmail(part)) {
        emails.push(part.toLowerCase());
      } else if (isPhone(part)) {
        phones.push(normalizePhone(part));
      } else {
        // It's a name part (text that's not a phone or email)
        nameParts.push(part);
      }
    }
  }

  // If no name was found, use "Unknown"
  const name = nameParts.length > 0 ? nameParts.join(" ") : "Unknown";

  // Must have at least a name with some data
  if (phones.length === 0 && emails.length === 0 && nameParts.length === 0) {
    return null;
  }

  return { name, phones, emails, raw: trimmed };
}

function isEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function isPhone(str: string): boolean {
  // Remove common phone formatting characters
  const digits = str.replace(/[\s\-\(\)\.\+]/g, "");
  // Must be mostly digits (at least 7 digits for a phone number)
  return /^\d{7,15}$/.test(digits);
}

function normalizePhone(str: string): string {
  // Keep the original formatting but clean up extra spaces
  return str.replace(/\s+/g, " ").trim();
}

interface BulkContactImportProps {
  propertyId: number;
  onSuccess?: () => void;
}

export function BulkContactImport({ propertyId, onSuccess }: BulkContactImportProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    total: number;
    results: Array<{ name: string; success: boolean; error?: string }>;
  } | null>(null);

  const bulkCreate = trpc.communication.bulkCreateContacts.useMutation();
  const utils = trpc.useUtils();
  const [crossPropertyWarnings, setCrossPropertyWarnings] = useState<Array<{ phone: string; propertyId: number; leadId: number | null; address: string }>>([]);
  const [showCrossPropertyConfirm, setShowCrossPropertyConfirm] = useState(false);

  const parsedContacts = useMemo(() => {
    if (!text.trim()) return [];
    const lines = text.split("\n");
    const contacts: ParsedContact[] = [];
    for (const line of lines) {
      const parsed = parseContactLine(line);
      if (parsed) contacts.push(parsed);
    }
    return contacts;
  }, [text]);

  const doImport = async () => {
    setImporting(true);
    setImportResult(null);

    try {
      const contactsToCreate = parsedContacts.map((c) => ({
        name: c.name,
        phones: c.phones.map((p) => ({ phoneNumber: p, phoneType: "Mobile" as const })),
        emails: c.emails.map((e) => ({ email: e })),
      }));

      const result = await bulkCreate.mutateAsync({
        propertyId,
        contacts: contactsToCreate,
      });

      setImportResult(result);
      utils.communication.getContactsByProperty.invalidate({ propertyId });

      toast.success(`${result.imported} of ${result.total} contacts imported successfully.`);

      if (result.imported === result.total) {
        setTimeout(() => {
          setOpen(false);
          setText("");
          setImportResult(null);
          onSuccess?.();
        }, 1500);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to import contacts");
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (parsedContacts.length === 0) return;
    // Collect all phones from all contacts
    const allPhones = parsedContacts.flatMap(c => c.phones);
    if (allPhones.length > 0) {
      try {
        const result = await utils.communication.checkCrossPropertyPhones.fetch({
          propertyId,
          phones: allPhones,
        });
        if (result.matches && result.matches.length > 0) {
          setCrossPropertyWarnings(result.matches);
          setShowCrossPropertyConfirm(true);
          return;
        }
      } catch (e) {
        // If check fails, proceed anyway
      }
    }
    await doImport();
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setText("");
      setImportResult(null);
    }
  };

  const exampleText = `John Smith, (555) 123-4567, john@email.com
Jane Doe, 555-987-6543, 555-111-2222, jane@gmail.com
Bob Wilson, bob@company.com
Maria Garcia, 3055551234`;

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListPlus className="mr-2 h-4 w-4" />
          Add Contact List
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5" />
            Bulk Contact Import
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">Paste your contact list below — one contact per line.</p>
            <p className="text-muted-foreground">
              The system automatically detects <strong>names</strong>, <strong>phone numbers</strong>, and <strong>emails</strong> from each line.
              Separate values with <strong>commas</strong>, <strong>semicolons</strong>, <strong>tabs</strong>, or <strong>pipes (|)</strong>.
            </p>
            <div className="mt-2 bg-background rounded p-3 font-mono text-xs text-muted-foreground border">
              <p className="font-medium text-foreground mb-1">Examples:</p>
              {exampleText.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <Textarea
            placeholder="Paste contacts here, one per line..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />

          {/* Preview */}
          {parsedContacts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Preview ({parsedContacts.length} contact{parsedContacts.length !== 1 ? "s" : ""} detected)
                </h4>
                {importResult && (
                  <Badge variant={importResult.imported === importResult.total ? "default" : "destructive"}>
                    {importResult.imported}/{importResult.total} imported
                  </Badge>
                )}
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-2 font-medium">#</th>
                      <th className="text-left p-2 font-medium">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" /> Name</span>
                      </th>
                      <th className="text-left p-2 font-medium">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Phones</span>
                      </th>
                      <th className="text-left p-2 font-medium">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Emails</span>
                      </th>
                      {importResult && <th className="text-left p-2 font-medium">Status</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedContacts.map((contact, i) => {
                      const result = importResult?.results[i];
                      return (
                        <tr key={i} className={`border-b last:border-0 ${result?.success === false ? "bg-destructive/10" : ""}`}>
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2 font-medium">{contact.name}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {contact.phones.length > 0 ? (
                                contact.phones.map((p, j) => (
                                  <Badge key={j} variant="secondary" className="text-xs font-mono">
                                    {formatPhone(p)}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {contact.emails.length > 0 ? (
                                contact.emails.map((e, j) => (
                                  <Badge key={j} variant="outline" className="text-xs font-mono">
                                    {e}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </div>
                          </td>
                          {importResult && (
                            <td className="p-2">
                              {result?.success ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <div className="flex items-center gap-1">
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                  <span className="text-xs text-destructive">{result?.error || "Failed"}</span>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {text.trim() && parsedContacts.length === 0 && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>No valid contacts detected. Make sure each line has a name and at least one phone number or email.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedContacts.length === 0 || importing}
          >
            {importing ? (
              <>Importing...</>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import {parsedContacts.length} Contact{parsedContacts.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Cross-Property Phone Warning Dialog */}
    <AlertDialog open={showCrossPropertyConfirm} onOpenChange={setShowCrossPropertyConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Phone(s) Already Exist in Other Properties
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm space-y-3">
              <span className="block text-muted-foreground">The following phone number(s) are already linked to other properties:</span>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {crossPropertyWarnings.map((match, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                    <Phone className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">{formatPhone(match.phone)}</span>
                      <span className="block text-muted-foreground">
                        {match.address}
                        {match.leadId && <span className="text-xs ml-1">(Lead #{match.leadId})</span>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <span className="block text-muted-foreground">Do you want to import all contacts anyway?</span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { setShowCrossPropertyConfirm(false); setCrossPropertyWarnings([]); }}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setShowCrossPropertyConfirm(false);
              setCrossPropertyWarnings([]);
              doImport();
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Import Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
