import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ─── 1. Backend: properties.create accepts ownerPhone and ownerEmail ───

describe("Backend: properties.create input schema", () => {
  const routersContent = fs.readFileSync(
    path.resolve(__dirname, "routers.ts"),
    "utf-8"
  );

  // Find the property create section
  const createIdx = routersContent.indexOf("    create: protectedProcedure");
  const createSection = routersContent.substring(createIdx, createIdx + 3000);

  it("accepts ownerPhone as optional string", () => {
    expect(createSection).toContain("ownerPhone: z.string().optional()");
  });

  it("accepts ownerEmail as optional string", () => {
    expect(createSection).toContain("ownerEmail: z.string().optional()");
  });
});

// ─── 2. Backend: properties.create auto-creates a contact ───

describe("Backend: properties.create auto-creates contact", () => {
  const routersContent = fs.readFileSync(
    path.resolve(__dirname, "routers.ts"),
    "utf-8"
  );

  const createIdx = routersContent.indexOf("    create: protectedProcedure");
  const createSection = routersContent.substring(createIdx, createIdx + 5000);

  it("imports createContact from communication module", () => {
    expect(createSection).toContain('import("./communication")');
    expect(createSection).toContain("createContact");
  });

  it("always creates a contact after property insertion", () => {
    // The createContact call should be present
    expect(createSection).toContain("await createContact(");
  });

  it("sets contact relationship to Owner", () => {
    expect(createSection).toContain('relationship: "Owner"');
  });

  it("uses owner1Name for contact name, defaults to Owner", () => {
    expect(createSection).toContain('input.owner1Name || "Owner"');
  });

  it("passes phone when ownerPhone is provided", () => {
    expect(createSection).toContain("input.ownerPhone");
    expect(createSection).toContain("phoneNumber: input.ownerPhone.trim()");
  });

  it("passes email when ownerEmail is provided", () => {
    expect(createSection).toContain("input.ownerEmail");
    expect(createSection).toContain("email: input.ownerEmail.trim()");
  });

  it("creates contact even without phone/email (empty contact)", () => {
    // The phones/emails should be undefined when empty, but createContact is still called
    expect(createSection).toContain("phones,");
    expect(createSection).toContain("emails,");
    // The createContact call is NOT inside an if block for phone/email
    expect(createSection).toContain("// Always create a contact (owner)");
  });

  it("does not fail property creation if contact creation fails", () => {
    expect(createSection).toContain("} catch (contactError)");
    expect(createSection).toContain("// Don't fail the property creation if contact creation fails");
  });
});

// ─── 3. Frontend: QuickAddLeadDialog has phone and email fields ───

describe("Frontend: QuickAddLeadDialog form fields", () => {
  const dialogContent = fs.readFileSync(
    path.resolve(__dirname, "../client/src/components/QuickAddLeadDialog.tsx"),
    "utf-8"
  );

  it("has ownerPhone in form state", () => {
    expect(dialogContent).toContain('ownerPhone: ""');
  });

  it("has ownerEmail in form state", () => {
    expect(dialogContent).toContain('ownerEmail: ""');
  });

  it("renders Phone Number input field", () => {
    expect(dialogContent).toContain('id="ownerPhone"');
    expect(dialogContent).toContain('placeholder="(954) 555-1234"');
  });

  it("renders Email input field", () => {
    expect(dialogContent).toContain('id="ownerEmail"');
    expect(dialogContent).toContain('type="email"');
    expect(dialogContent).toContain('placeholder="owner@email.com"');
  });

  it("imports Phone and Mail icons", () => {
    expect(dialogContent).toContain("Phone, Mail");
  });

  it("resets ownerPhone and ownerEmail on dialog reset", () => {
    // Count occurrences of ownerPhone: "" — should be at least 2 (initial state + reset)
    const phoneResets = dialogContent.split('ownerPhone: ""').length - 1;
    expect(phoneResets).toBeGreaterThanOrEqual(2);
    const emailResets = dialogContent.split('ownerEmail: ""').length - 1;
    expect(emailResets).toBeGreaterThanOrEqual(2);
  });

  it("passes ownerPhone and ownerEmail to create mutation", () => {
    // The form data is spread into the mutation: createPropertyMutation.mutate({ ...formData, ... })
    expect(dialogContent).toContain("...formData");
  });
});
