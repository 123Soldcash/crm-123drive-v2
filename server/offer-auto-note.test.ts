import { describe, it, expect } from "vitest";

// ─── Unit tests for the formatOfferNote helper logic ───────────────
// We replicate the helper logic here since it's a private function in routers.ts

function formatOfferNote(offer: {
  toBeSent?: boolean;
  offerSent?: boolean;
  viaAdobe?: boolean;
  viaEmail?: boolean;
  viaTxt?: boolean;
  viaUps?: boolean;
  viaFedex?: boolean;
  viaUsps?: boolean;
  viaInPerson?: boolean;
  offerDate?: string;
  offerAmount?: number;
  isVerbal?: boolean;
  isWrittenOffer?: boolean;
}, title: string): string {
  const lines: string[] = [`📋 ${title}`];
  lines.push(`Date: ${offer.offerDate || new Date().toISOString().split("T")[0]}`);
  lines.push(`Amount: $${(offer.offerAmount || 0).toLocaleString("en-US")}`);

  const status: string[] = [];
  if (offer.toBeSent) status.push("To be Sent");
  if (offer.offerSent) status.push("Offer Sent");
  if (status.length) lines.push(`Status: ${status.join(", ")}`);

  const delivery: string[] = [];
  if (offer.viaAdobe) delivery.push("Adobe");
  if (offer.viaEmail) delivery.push("Email");
  if (offer.viaTxt) delivery.push("Txt");
  if (offer.viaUps) delivery.push("UPS");
  if (offer.viaFedex) delivery.push("FedEx");
  if (offer.viaUsps) delivery.push("USPS");
  if (offer.viaInPerson) delivery.push("In Person");
  if (delivery.length) lines.push(`Delivery: ${delivery.join(", ")}`);

  const type: string[] = [];
  if (offer.isVerbal) type.push("Verbal");
  if (offer.isWrittenOffer) type.push("Written Offer");
  if (type.length) lines.push(`Type: ${type.join(", ")}`);

  return lines.join("\n");
}

describe("formatOfferNote", () => {
  it("should include title with clipboard emoji", () => {
    const note = formatOfferNote({}, "New Offer Created");
    expect(note).toContain("📋 New Offer Created");
  });

  it("should include date when provided", () => {
    const note = formatOfferNote({ offerDate: "2026-03-20" }, "Test");
    expect(note).toContain("Date: 2026-03-20");
  });

  it("should use today's date when offerDate is not provided", () => {
    const today = new Date().toISOString().split("T")[0];
    const note = formatOfferNote({}, "Test");
    expect(note).toContain(`Date: ${today}`);
  });

  it("should format amount with US locale", () => {
    const note = formatOfferNote({ offerAmount: 200000 }, "Test");
    expect(note).toContain("Amount: $200,000");
  });

  it("should show $0 when amount is not provided", () => {
    const note = formatOfferNote({}, "Test");
    expect(note).toContain("Amount: $0");
  });

  it("should include 'To be Sent' status", () => {
    const note = formatOfferNote({ toBeSent: true }, "Test");
    expect(note).toContain("Status: To be Sent");
  });

  it("should include 'Offer Sent' status", () => {
    const note = formatOfferNote({ offerSent: true }, "Test");
    expect(note).toContain("Status: Offer Sent");
  });

  it("should combine multiple statuses", () => {
    const note = formatOfferNote({ toBeSent: true, offerSent: true }, "Test");
    expect(note).toContain("Status: To be Sent, Offer Sent");
  });

  it("should not include Status line when no status is set", () => {
    const note = formatOfferNote({}, "Test");
    expect(note).not.toContain("Status:");
  });

  it("should include all delivery methods", () => {
    const note = formatOfferNote({
      viaAdobe: true,
      viaEmail: true,
      viaTxt: true,
      viaUps: true,
      viaFedex: true,
      viaUsps: true,
      viaInPerson: true,
    }, "Test");
    expect(note).toContain("Delivery: Adobe, Email, Txt, UPS, FedEx, USPS, In Person");
  });

  it("should include single delivery method", () => {
    const note = formatOfferNote({ viaFedex: true }, "Test");
    expect(note).toContain("Delivery: FedEx");
  });

  it("should not include Delivery line when no delivery is set", () => {
    const note = formatOfferNote({}, "Test");
    expect(note).not.toContain("Delivery:");
  });

  it("should include Verbal type", () => {
    const note = formatOfferNote({ isVerbal: true }, "Test");
    expect(note).toContain("Type: Verbal");
  });

  it("should include Written Offer type", () => {
    const note = formatOfferNote({ isWrittenOffer: true }, "Test");
    expect(note).toContain("Type: Written Offer");
  });

  it("should combine Verbal and Written Offer types", () => {
    const note = formatOfferNote({ isVerbal: true, isWrittenOffer: true }, "Test");
    expect(note).toContain("Type: Verbal, Written Offer");
  });

  it("should not include Type line when no type is set", () => {
    const note = formatOfferNote({}, "Test");
    expect(note).not.toContain("Type:");
  });

  it("should produce a complete note with all fields", () => {
    const note = formatOfferNote({
      toBeSent: true,
      offerSent: true,
      viaEmail: true,
      viaFedex: true,
      offerDate: "2026-03-20",
      offerAmount: 150000,
      isVerbal: true,
      isWrittenOffer: true,
    }, "New Offer Created");

    expect(note).toBe(
      "📋 New Offer Created\n" +
      "Date: 2026-03-20\n" +
      "Amount: $150,000\n" +
      "Status: To be Sent, Offer Sent\n" +
      "Delivery: Email, FedEx\n" +
      "Type: Verbal, Written Offer"
    );
  });

  it("should produce a minimal note with no optional fields", () => {
    const today = new Date().toISOString().split("T")[0];
    const note = formatOfferNote({}, "Offer Updated");
    expect(note).toBe(
      `📋 Offer Updated\nDate: ${today}\nAmount: $0`
    );
  });

  it("should use 'Offer Updated' title for update notes", () => {
    const note = formatOfferNote({ offerAmount: 50000 }, "Offer Updated");
    expect(note).toContain("📋 Offer Updated");
  });

  it("should handle large amounts correctly", () => {
    const note = formatOfferNote({ offerAmount: 1500000 }, "Test");
    expect(note).toContain("Amount: $1,500,000");
  });
});

describe("formatOfferNoteFromRow", () => {
  // Replicate the row-to-note conversion
  function formatOfferNoteFromRow(row: {
    toBeSent: number | null;
    offerSent: number | null;
    viaAdobe: number | null;
    viaEmail: number | null;
    viaTxt: number | null;
    viaUps: number | null;
    viaFedex: number | null;
    viaUsps: number | null;
    viaInPerson: number | null;
    offerDate: Date | null;
    offerAmount: number | null;
    isVerbal: number | null;
    isWrittenOffer: number | null;
  }, title: string): string {
    return formatOfferNote({
      toBeSent: row.toBeSent === 1,
      offerSent: row.offerSent === 1,
      viaAdobe: row.viaAdobe === 1,
      viaEmail: row.viaEmail === 1,
      viaTxt: row.viaTxt === 1,
      viaUps: row.viaUps === 1,
      viaFedex: row.viaFedex === 1,
      viaUsps: row.viaUsps === 1,
      viaInPerson: row.viaInPerson === 1,
      offerDate: row.offerDate ? row.offerDate.toISOString().split("T")[0] : undefined,
      offerAmount: row.offerAmount ?? 0,
      isVerbal: row.isVerbal === 1,
      isWrittenOffer: row.isWrittenOffer === 1,
    }, title);
  }

  it("should convert database row (1/0) to boolean correctly", () => {
    const note = formatOfferNoteFromRow({
      toBeSent: 1,
      offerSent: 0,
      viaAdobe: 0,
      viaEmail: 1,
      viaTxt: 0,
      viaUps: 0,
      viaFedex: 0,
      viaUsps: 0,
      viaInPerson: 0,
      offerDate: new Date("2026-03-20"),
      offerAmount: 100000,
      isVerbal: 0,
      isWrittenOffer: 1,
    }, "New Offer Created");

    expect(note).toContain("Status: To be Sent");
    expect(note).not.toContain("Offer Sent");
    expect(note).toContain("Delivery: Email");
    expect(note).toContain("Type: Written Offer");
    expect(note).toContain("Amount: $100,000");
  });

  it("should handle null values as false/0", () => {
    const note = formatOfferNoteFromRow({
      toBeSent: null,
      offerSent: null,
      viaAdobe: null,
      viaEmail: null,
      viaTxt: null,
      viaUps: null,
      viaFedex: null,
      viaUsps: null,
      viaInPerson: null,
      offerDate: null,
      offerAmount: null,
      isVerbal: null,
      isWrittenOffer: null,
    }, "Test");

    expect(note).not.toContain("Status:");
    expect(note).not.toContain("Delivery:");
    expect(note).not.toContain("Type:");
    expect(note).toContain("Amount: $0");
  });

  it("should format date from Date object correctly", () => {
    const note = formatOfferNoteFromRow({
      toBeSent: 0,
      offerSent: 0,
      viaAdobe: 0,
      viaEmail: 0,
      viaTxt: 0,
      viaUps: 0,
      viaFedex: 0,
      viaUsps: 0,
      viaInPerson: 0,
      offerDate: new Date("2026-12-25"),
      offerAmount: 500000,
      isVerbal: 0,
      isWrittenOffer: 0,
    }, "Test");

    expect(note).toContain("Date: 2026-12-25");
    expect(note).toContain("Amount: $500,000");
  });
});
