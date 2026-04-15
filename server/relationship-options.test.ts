import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

// ── Read the shared constant ──────────────────────────────────────────────────
const sharedFile = path.join(ROOT, "client/src/lib/contactRelationships.ts");
const sharedContent = fs.readFileSync(sharedFile, "utf-8");

// ── Read all consumer components ──────────────────────────────────────────────
const contactEditModal = fs.readFileSync(path.join(ROOT, "client/src/components/ContactEditModal.tsx"), "utf-8");
const contactManagement = fs.readFileSync(path.join(ROOT, "client/src/components/ContactManagement.tsx"), "utf-8");
const contactsSection = fs.readFileSync(path.join(ROOT, "client/src/components/ContactsSection.tsx"), "utf-8");
const callTrackingTable = fs.readFileSync(path.join(ROOT, "client/src/components/CallTrackingTable.tsx"), "utf-8");

describe("Shared RELATIONSHIP_OPTIONS constant", () => {
  it("defines the canonical list of 16 relationship options", () => {
    expect(sharedContent).toContain("RELATIONSHIP_OPTIONS");
    const options = [
      "Owner", "Spouse", "Son", "Daughter", "Heir", "Attorney", "Tenant",
      "Neighbor", "Family", "Resident", "Likely Owner", "Potential Owner",
      "Renting", "Current Resident - NOT on Board", "Representative", "Other",
    ];
    for (const opt of options) {
      expect(sharedContent).toContain(`"${opt}"`);
    }
  });

  it("exports RELATIONSHIP_OPTIONS as a const array", () => {
    expect(sharedContent).toContain("export const RELATIONSHIP_OPTIONS");
    expect(sharedContent).toContain("as const");
  });

  it("exports RelationshipOption type", () => {
    expect(sharedContent).toContain("export type RelationshipOption");
  });
});

describe("ContactEditModal uses shared RELATIONSHIP_OPTIONS", () => {
  it("imports from @/lib/contactRelationships", () => {
    expect(contactEditModal).toContain('from "@/lib/contactRelationships"');
  });

  it("no longer defines its own RELATIONSHIP_OPTIONS array", () => {
    // The local const definition should be replaced by a comment or removed
    expect(contactEditModal).not.toContain('const RELATIONSHIP_OPTIONS = [');
  });

  it("uses RELATIONSHIP_OPTIONS in the select", () => {
    expect(contactEditModal).toContain("RELATIONSHIP_OPTIONS");
  });
});

describe("ContactManagement uses shared RELATIONSHIP_OPTIONS", () => {
  it("imports from @/lib/contactRelationships", () => {
    expect(contactManagement).toContain('from "@/lib/contactRelationships"');
  });

  it("no longer has hard-coded Co-Owner option", () => {
    expect(contactManagement).not.toContain('<option value="Co-Owner">');
  });

  it("no longer has hard-coded Family Member option", () => {
    expect(contactManagement).not.toContain('<option value="Family Member">');
  });

  it("uses RELATIONSHIP_OPTIONS.map to render options", () => {
    expect(contactManagement).toContain("RELATIONSHIP_OPTIONS.map");
  });
});

describe("ContactsSection uses shared RELATIONSHIP_OPTIONS", () => {
  it("imports from @/lib/contactRelationships", () => {
    expect(contactsSection).toContain('from "@/lib/contactRelationships"');
  });

  it("no longer has hard-coded Child option", () => {
    expect(contactsSection).not.toContain('<SelectItem value="Child">');
  });

  it("no longer has hard-coded Parent option", () => {
    expect(contactsSection).not.toContain('<SelectItem value="Parent">');
  });

  it("no longer has hard-coded Sibling option", () => {
    expect(contactsSection).not.toContain('<SelectItem value="Sibling">');
  });

  it("uses RELATIONSHIP_OPTIONS.map to render SelectItems", () => {
    expect(contactsSection).toContain("RELATIONSHIP_OPTIONS.map");
  });
});

describe("CallTrackingTable uses shared RELATIONSHIP_OPTIONS", () => {
  it("imports from @/lib/contactRelationships", () => {
    expect(callTrackingTable).toContain('from "@/lib/contactRelationships"');
  });

  it("no longer has hard-coded Relative option", () => {
    expect(callTrackingTable).not.toContain('<SelectItem value="Relative">');
  });

  it("no longer has hard-coded Personal Representative option", () => {
    expect(callTrackingTable).not.toContain('<SelectItem value="Personal Representative">');
  });

  it("uses RELATIONSHIP_OPTIONS.map to render SelectItems", () => {
    expect(callTrackingTable).toContain("RELATIONSHIP_OPTIONS.map");
  });
});
