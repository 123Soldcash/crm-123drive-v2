import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Tests for Delete Property feature ─────────────────────────────────────
// Verifies the backend procedure exists with admin-only guard, the db helper
// performs cascading delete, and the frontend component wires everything up.

describe("Delete Property – backend procedure", () => {
  const routersContent = readFileSync(
    resolve(__dirname, "routers.ts"),
    "utf-8"
  );

  it("has a deleteProperty procedure in the properties router", () => {
    expect(routersContent).toContain("deleteProperty: protectedProcedure");
  });

  it("requires propertyId as input", () => {
    // The procedure input schema should include propertyId
    const deleteSection = routersContent.slice(
      routersContent.indexOf("deleteProperty: protectedProcedure")
    );
    expect(deleteSection).toContain("propertyId: z.number()");
  });

  it("enforces admin-only access", () => {
    const deleteSection = routersContent.slice(
      routersContent.indexOf("deleteProperty: protectedProcedure"),
      routersContent.indexOf("deleteProperty: protectedProcedure") + 500
    );
    expect(deleteSection).toContain("role !== 'admin'");
    expect(deleteSection).toContain("Only admins can delete");
  });

  it("calls db.deleteProperty with the propertyId", () => {
    const deleteSection = routersContent.slice(
      routersContent.indexOf("deleteProperty: protectedProcedure"),
      routersContent.indexOf("deleteProperty: protectedProcedure") + 500
    );
    expect(deleteSection).toContain("db.deleteProperty(input.propertyId)");
  });

  it("also has a bulkDeleteProperties procedure", () => {
    expect(routersContent).toContain("bulkDeleteProperties: protectedProcedure");
  });
});

describe("Delete Property – db helper (cascading delete)", () => {
  const dbContent = readFileSync(resolve(__dirname, "db.ts"), "utf-8");

  it("exports deleteProperty function", () => {
    expect(dbContent).toContain(
      "export async function deleteProperty(propertyId: number)"
    );
  });

  it("returns { success: boolean }", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("return { success: true }");
  });

  it("deletes from properties table using the propertyId", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("db.delete(properties)");
    expect(fnSection).toContain("eq(properties.id, propertyId)");
  });

  it("fetches contacts for the property before deleting", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("contacts.propertyId");
    expect(fnSection).toContain("contactIds");
  });

  // contactPhones and contactEmails tables were DROPPED (2026-05-06).
  // Phone/email data is now stored inline on contacts.phoneNumber / contacts.email.
  // Deleting the contacts row is sufficient — no separate cleanup needed.

  it("deletes contactAddresses for each contact", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("db.delete(contactAddresses)");
  });

  // contactSocialMedia table was DROPPED (2026-05-06) — had 0 rows, never used.

  it("deletes contacts for the property", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("db.delete(contacts)");
  });

  it("deletes notes for the property", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("db.delete(notes)");
  });

  it("deletes propertyTags for the property", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("db.delete(propertyTags)");
  });

  it("deletes photos for the property", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("db.delete(photos)");
  });

  it("deletes tasks for the property", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("db.delete(tasks)");
  });

  it("deletes visits for the property", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("db.delete(visits)");
  });

  it("deletes propertyDocuments for the property", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("db.delete(propertyDocuments)");
  });

  it("deletes familyMembers for the property", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("db.delete(familyMembers)");
  });

  it("deletes propertyAgents for the property", () => {
    const fnStart = dbContent.indexOf(
      "export async function deleteProperty(propertyId: number)"
    );
    const fnSection = dbContent.slice(fnStart, fnStart + 2000);
    expect(fnSection).toContain("db.delete(propertyAgents)");
  });
});

describe("Delete Property – frontend component", () => {
  const componentContent = readFileSync(
    resolve(__dirname, "../client/src/components/EditPropertyDialog.tsx"),
    "utf-8"
  );

  it("imports AlertDialog components for confirmation", () => {
    expect(componentContent).toContain("AlertDialog");
    expect(componentContent).toContain("AlertDialogAction");
    expect(componentContent).toContain("AlertDialogCancel");
    expect(componentContent).toContain("AlertDialogContent");
  });

  it("imports Trash2 icon", () => {
    expect(componentContent).toContain("Trash2");
  });

  it("imports useAuth for role checking", () => {
    expect(componentContent).toContain('import { useAuth }');
  });

  it("imports useLocation for navigation after delete", () => {
    expect(componentContent).toContain('import { useLocation }');
  });

  it("checks admin role before showing delete button", () => {
    expect(componentContent).toContain("isAdmin");
    expect(componentContent).toContain('user?.role === \'admin\'');
  });

  it("uses deleteProperty mutation from tRPC", () => {
    expect(componentContent).toContain(
      "trpc.properties.deleteProperty.useMutation"
    );
  });

  it("has a delete confirmation dialog with warning text", () => {
    expect(componentContent).toContain("Are you absolutely sure?");
    expect(componentContent).toContain("permanently delete");
    expect(componentContent).toContain("cannot be undone");
  });

  it("renders a destructive Delete Property button", () => {
    expect(componentContent).toContain('variant="destructive"');
    expect(componentContent).toContain("Delete Property");
  });

  it("navigates to /properties after successful delete", () => {
    expect(componentContent).toContain('setLocation("/properties")');
  });

  it("shows success toast on delete", () => {
    expect(componentContent).toContain("Property deleted successfully");
  });

  it("shows error toast on delete failure", () => {
    expect(componentContent).toContain("Delete failed:");
  });

  it("conditionally renders delete button only for admins", () => {
    // The button should be wrapped in {isAdmin && (...)}
    expect(componentContent).toContain("{isAdmin && (");
  });
});
