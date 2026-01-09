import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export default function ImportDealMachine() {
  const [propertiesFile, setPropertiesFile] = useState<File | null>(null);
  const [contactsFile, setContactsFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const utils = trpc.useUtils();

  const previewImport = trpc.dealmachine.preview.useMutation({
    onSuccess: (data) => {
      setPreview(data);
    },
    onError: (error) => {
      toast.error("Preview failed: " + error.message);
    },
  });

  const executeImport = trpc.dealmachine.import.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.propertiesCreated} properties and ${data.contactsCreated} contacts`);
      utils.properties.list.invalidate();
      setPropertiesFile(null);
      setContactsFile(null);
      setPreview(null);
    },
    onError: (error) => {
      toast.error("Import failed: " + error.message);
    },
  });

  const handlePreview = async () => {
    if (!propertiesFile) {
      toast.error("Please select a properties CSV file");
      return;
    }

    setLoading(true);
    try {
      const propertiesText = await propertiesFile.text();
      const contactsText = contactsFile ? await contactsFile.text() : "";

      previewImport.mutate({
        propertiesCSV: propertiesText,
        contactsCSV: contactsText,
      });
    } catch (error) {
      toast.error("Failed to read files");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!propertiesFile) {
      toast.error("Please select a properties CSV file");
      return;
    }

    setLoading(true);
    try {
      const propertiesText = await propertiesFile.text();
      const contactsText = contactsFile ? await contactsFile.text() : "";

      executeImport.mutate({
        propertiesCSV: propertiesText,
        contactsCSV: contactsText,
      });
    } catch (error) {
      toast.error("Failed to read files");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import from DealMachine</h1>
        <p className="text-muted-foreground">
          Upload CSV files exported from DealMachine to import properties and contacts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="properties-file">Properties CSV File</Label>
            <Input
              id="properties-file"
              type="file"
              accept=".csv"
              onChange={(e) => setPropertiesFile(e.target.files?.[0] || null)}
              disabled={loading}
            />
            {propertiesFile && (
              <p className="text-sm text-muted-foreground">
                ✓ {propertiesFile.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contacts-file">Contacts CSV File (Optional)</Label>
            <Input
              id="contacts-file"
              type="file"
              accept=".csv"
              onChange={(e) => setContactsFile(e.target.files?.[0] || null)}
              disabled={loading}
            />
            {contactsFile && (
              <p className="text-sm text-muted-foreground">
                ✓ {contactsFile.name}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handlePreview}
              disabled={!propertiesFile || loading}
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>

            {preview && (
              <Button
                onClick={handleImport}
                disabled={loading || executeImport.isPending}
              >
                {executeImport.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Import
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Preview shows first 5 properties. {preview.totalProperties} total properties found.
              {preview.duplicates > 0 && ` ${preview.duplicates} duplicates will be skipped.`}
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Properties Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead>City, State</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.properties.map((prop: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">
                          {prop.addressLine1}
                        </TableCell>
                        <TableCell>
                          {prop.city}, {prop.state} {prop.zipcode}
                        </TableCell>
                        <TableCell>{prop.owner1Name || "-"}</TableCell>
                        <TableCell>
                          {prop.estimatedValue
                            ? `$${prop.estimatedValue.toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {prop.isDuplicate ? (
                            <Badge variant="secondary">Duplicate</Badge>
                          ) : (
                            <Badge variant="default">New</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {preview.contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Contacts Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>DNC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.contacts.slice(0, 5).map((contact: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{contact.name}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {contact.phone || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {contact.email || "-"}
                          </TableCell>
                          <TableCell>
                            {contact.dnc ? (
                              <Badge variant="destructive">Yes</Badge>
                            ) : (
                              <Badge variant="outline">No</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
