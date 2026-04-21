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
import { ListPlus, Upload, AlertCircle, CheckCircle2, Phone, Mail, User, AlertTriangle, Sparkles, Loader2, MapPin, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const majorParts = trimmed
    .split(/[;\t|]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (majorParts.length === 0) return null;

  const phones: string[] = [];
  const emails: string[] = [];
  const nameParts: string[] = [];

  for (const majorPart of majorParts) {
    const subParts = majorPart.split(",").map((s) => s.trim()).filter(Boolean);
    for (const part of subParts) {
      if (isEmail(part)) {
        emails.push(part.toLowerCase());
      } else if (isPhone(part)) {
        phones.push(normalizePhone(part));
      } else {
        nameParts.push(part);
      }
    }
  }

  const name = nameParts.length > 0 ? nameParts.join(" ") : "Unknown";

  if (phones.length === 0 && emails.length === 0 && nameParts.length === 0) {
    return null;
  }

  return { name, phones, emails, raw: trimmed };
}

function isEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function isPhone(str: string): boolean {
  const digits = str.replace(/[\s\-\(\)\.\+]/g, "");
  return /^\d{7,15}$/.test(digits);
}

function normalizePhone(str: string): string {
  return str.replace(/\s+/g, " ").trim();
}

interface BulkContactImportProps {
  propertyId: number;
  contactTab: "phones" | "emails";
  onSuccess?: () => void;
}

interface AIExtractedContact {
  name: string;
  firstName: string;
  lastName: string;
  phones: Array<{ phoneNumber: string; phoneType: string }>;
  emails: Array<{ email: string }>;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  relationship: string;
}

export function BulkContactImport({ propertyId, contactTab, onSuccess }: BulkContactImportProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");
  const [text, setText] = useState("");
  const [aiRawText, setAiRawText] = useState("");
  const [aiExtracted, setAiExtracted] = useState<AIExtractedContact[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    total: number;
    results: Array<{ name: string; success: boolean; error?: string }>;
  } | null>(null);

  const bulkCreate = trpc.communication.bulkCreateContacts.useMutation();
  const aiExtractMutation = trpc.contacts.aiExtract.useMutation();
  const utils = trpc.useUtils();
  const [crossPropertyWarnings, setCrossPropertyWarnings] = useState<Array<{ phone: string; propertyId: number; leadId: number | null; address: string }>>([]);
  const [showCrossPropertyConfirm, setShowCrossPropertyConfirm] = useState(false);

  const isPhoneMode = contactTab === "phones";

  // Parse contacts and filter based on the active contact tab
  const parsedContacts = useMemo(() => {
    if (!text.trim()) return [];
    const lines = text.split("\n");
    const contacts: ParsedContact[] = [];
    for (const line of lines) {
      const parsed = parseContactLine(line);
      if (parsed) {
        if (isPhoneMode) {
          // Phone mode: keep only phone data, ignore emails
          if (parsed.phones.length > 0) {
            contacts.push({ ...parsed, emails: [] });
          } else if (parsed.name !== "Unknown") {
            // Has a name but no phone — still show it but warn
            contacts.push({ ...parsed, emails: [] });
          }
        } else {
          // Email mode: keep only email data, ignore phones
          if (parsed.emails.length > 0) {
            contacts.push({ ...parsed, phones: [] });
          } else if (parsed.name !== "Unknown") {
            contacts.push({ ...parsed, phones: [] });
          }
        }
      }
    }
    return contacts;
  }, [text, isPhoneMode]);

  // Count valid contacts (those with the required data type)
  const validCount = useMemo(() => {
    if (isPhoneMode) {
      return parsedContacts.filter(c => c.phones.length > 0).length;
    }
    return parsedContacts.filter(c => c.emails.length > 0).length;
  }, [parsedContacts, isPhoneMode]);

  const doImport = async () => {
    setImporting(true);
    setImportResult(null);

    try {
      // Only send contacts that have the relevant data
      const filteredContacts = isPhoneMode
        ? parsedContacts.filter(c => c.phones.length > 0)
        : parsedContacts.filter(c => c.emails.length > 0);

      const contactsToCreate = filteredContacts.map((c) => ({
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
    if (validCount === 0) return;

    if (isPhoneMode) {
      // Collect all phones from all contacts for cross-property check
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
    }
    await doImport();
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setText("");
      setImportResult(null);
      setAiRawText("");
      setAiExtracted(null);
      setActiveTab("manual");
    }
  };

  const handleAIExtract = async () => {
    if (!aiRawText.trim()) return;
    setAiLoading(true);
    setAiExtracted(null);
    try {
      const result = await aiExtractMutation.mutateAsync({ text: aiRawText });
      if (result.contacts && result.contacts.length > 0) {
        // Filter AI results based on contact tab
        const filtered = isPhoneMode
          ? result.contacts.filter((c: AIExtractedContact) => c.phones.length > 0)
          : result.contacts.filter((c: AIExtractedContact) => c.emails.length > 0);

        if (filtered.length > 0) {
          setAiExtracted(filtered);
          toast.success(`AI extracted ${filtered.length} ${isPhoneMode ? 'phone' : 'email'} contact(s)!`);
        } else {
          toast.error(`No ${isPhoneMode ? 'phone numbers' : 'email addresses'} found in the text.`);
        }
      } else {
        toast.error("No contacts found in the text. Try pasting more details.");
      }
    } catch (err: any) {
      toast.error(err.message || "AI extraction failed");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIImport = async () => {
    if (!aiExtracted || aiExtracted.length === 0) return;
    setImporting(true);
    try {
      const contactsToCreate = aiExtracted.map((c) => ({
        name: c.name,
        phones: isPhoneMode
          ? c.phones.map((p) => ({ phoneNumber: p.phoneNumber, phoneType: (p.phoneType || "Mobile") as any }))
          : [],
        emails: !isPhoneMode
          ? c.emails.map((e) => ({ email: e.email }))
          : [],
      }));
      const result = await bulkCreate.mutateAsync({ propertyId, contacts: contactsToCreate });
      utils.communication.getContactsByProperty.invalidate({ propertyId });
      toast.success(`${result.imported} of ${result.total} contacts imported!`);
      if (result.imported === result.total) {
        setTimeout(() => {
          handleClose(false);
          onSuccess?.();
        }, 1200);
      }
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const phoneExampleText = `John Smith, (555) 123-4567
Jane Doe, 555-987-6543, 555-111-2222
Maria Garcia, 3055551234`;

  const emailExampleText = `John Smith, john@email.com
Jane Doe, jane@gmail.com
Bob Wilson, bob@company.com`;

  const exampleText = isPhoneMode ? phoneExampleText : emailExampleText;

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListPlus className="mr-2 h-4 w-4" />
          {isPhoneMode ? "Add Phone List" : "Add Email List"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5" />
            {isPhoneMode ? "Bulk Phone Contact Import" : "Bulk Email Contact Import"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="manual">
              <ListPlus className="h-4 w-4 mr-2" />
              Manual List
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Extract
            </TabsTrigger>
          </TabsList>

          {/* AI Extract Tab */}
          <TabsContent value="ai" className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4 text-sm">
              <p className="font-medium text-purple-800 dark:text-purple-300 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI {isPhoneMode ? "Phone" : "Email"} Contact Extractor
              </p>
              <p className="text-muted-foreground mt-1">
                Paste any raw text — website forms, emails, notes — and AI will extract names and {isPhoneMode ? "phone numbers" : "email addresses"} automatically.
              </p>
            </div>
            <Textarea
              placeholder={isPhoneMode
                ? `Paste raw text here, for example:\n\n=== Website Form ===\nName: Richard Weatherstone\nPhone: 447761505213\nAddress: 10710 Falling Leaf Court, Parrish, Florida, 34219`
                : `Paste raw text here, for example:\n\n=== Contact Info ===\nName: Richard Weatherstone\nEmail: richardw697@gmail.com\nAddress: 10710 Falling Leaf Court, Parrish, Florida, 34219`
              }
              value={aiRawText}
              onChange={(e) => { setAiRawText(e.target.value); setAiExtracted(null); }}
              rows={8}
              className="font-mono text-sm"
            />
            <Button
              onClick={handleAIExtract}
              disabled={!aiRawText.trim() || aiLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {aiLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Extract with AI</>
              )}
            </Button>

            {/* AI Results Preview */}
            {aiExtracted && aiExtracted.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {aiExtracted.length} {isPhoneMode ? "phone" : "email"} contact(s) extracted — review and import:
                </h4>
                {aiExtracted.map((c, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2 font-medium">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {c.name}
                      {c.relationship && <Badge variant="outline" className="text-xs">{c.relationship}</Badge>}
                    </div>
                    {isPhoneMode && c.phones.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                        {c.phones.map((p, j) => (
                          <Badge key={j} variant="secondary" className="text-xs font-mono">
                            {p.phoneNumber} <span className="text-muted-foreground ml-1">({p.phoneType})</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                    {!isPhoneMode && c.emails.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                        {c.emails.map((e, j) => (
                          <Badge key={j} variant="outline" className="text-xs font-mono">{e.email}</Badge>
                        ))}
                      </div>
                    )}
                    {(c.address || c.city) && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{[c.address, c.city, c.state, c.zip].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {c.notes && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span className="italic">{c.notes}</span>
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  onClick={handleAIImport}
                  disabled={importing}
                  className="w-full"
                >
                  {importing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" />Import {aiExtracted.length} {isPhoneMode ? "Phone" : "Email"} Contact(s)</>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Manual Tab */}
          <TabsContent value="manual" className="space-y-4">
          {/* Instructions */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">
              Paste your {isPhoneMode ? "phone" : "email"} contact list below — one contact per line.
            </p>
            <p className="text-muted-foreground">
              The system automatically detects <strong>names</strong> and <strong>{isPhoneMode ? "phone numbers" : "email addresses"}</strong> from each line.
              Separate values with <strong>commas</strong>, <strong>semicolons</strong>, <strong>tabs</strong>, or <strong>pipes (|)</strong>.
            </p>
            {!isPhoneMode && (
              <p className="text-xs text-muted-foreground italic">
                Only email addresses will be imported. Any phone numbers in the text will be ignored.
              </p>
            )}
            {isPhoneMode && (
              <p className="text-xs text-muted-foreground italic">
                Only phone numbers will be imported. Any email addresses in the text will be ignored.
              </p>
            )}
            <div className="mt-2 bg-background rounded p-3 font-mono text-xs text-muted-foreground border">
              <p className="font-medium text-foreground mb-1">Examples:</p>
              {exampleText.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <Textarea
            placeholder={isPhoneMode
              ? "Paste phone contacts here, one per line..."
              : "Paste email contacts here, one per line..."
            }
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
                  Preview ({validCount} {isPhoneMode ? "phone" : "email"} contact{validCount !== 1 ? "s" : ""} detected)
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
                      {isPhoneMode ? (
                        <th className="text-left p-2 font-medium">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Phone Numbers</span>
                        </th>
                      ) : (
                        <th className="text-left p-2 font-medium">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email Addresses</span>
                        </th>
                      )}
                      <th className="text-left p-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedContacts.map((contact, i) => {
                      const hasData = isPhoneMode ? contact.phones.length > 0 : contact.emails.length > 0;
                      const result = importResult?.results[i];
                      return (
                        <tr key={i} className={`border-b last:border-0 ${!hasData ? "opacity-50" : ""} ${result?.success === false ? "bg-destructive/10" : ""}`}>
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2 font-medium">{contact.name}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {isPhoneMode ? (
                                contact.phones.length > 0 ? (
                                  contact.phones.map((p, j) => (
                                    <Badge key={j} variant="secondary" className="text-xs font-mono">
                                      {formatPhone(p)}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-amber-600 text-xs flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> No phone found
                                  </span>
                                )
                              ) : (
                                contact.emails.length > 0 ? (
                                  contact.emails.map((e, j) => (
                                    <Badge key={j} variant="outline" className="text-xs font-mono">
                                      {e}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-amber-600 text-xs flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> No email found
                                  </span>
                                )
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            {importResult ? (
                              result?.success ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <div className="flex items-center gap-1">
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                  <span className="text-xs text-destructive">{result?.error || "Failed"}</span>
                                </div>
                              )
                            ) : hasData ? (
                              <Badge variant="secondary" className="text-xs">Ready</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-amber-600">Skipped</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {validCount < parsedContacts.length && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {parsedContacts.length - validCount} line(s) will be skipped (no {isPhoneMode ? "phone number" : "email address"} detected).
                </p>
              )}
            </div>
          )}

          {/* Empty state */}
          {text.trim() && parsedContacts.length === 0 && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>No valid contacts detected. Make sure each line has a name and at least one {isPhoneMode ? "phone number" : "email address"}.</span>
            </div>
          )}
          </TabsContent>
        </Tabs>

        {activeTab === "manual" && (
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={validCount === 0 || importing}
          >
            {importing ? (
              <>Importing...</>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import {validCount} {isPhoneMode ? "Phone" : "Email"} Contact{validCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>

    {/* Cross-Property Phone Warning Dialog (only relevant for phone mode) */}
    {isPhoneMode && (
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
    )}
    </>
  );
}
