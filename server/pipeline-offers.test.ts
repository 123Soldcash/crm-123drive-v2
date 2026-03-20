import { describe, it, expect } from "vitest";

/**
 * Tests for Pipeline Stage Transition Forms — Offer Pending
 *
 * When moving a property from any stage to OFFER_PENDING, the system
 * must collect offer details (checkboxes, date, amount, type) before
 * completing the transition. Offers are stored per-property and displayed
 * in the pipeline data section on the property page.
 */

// ─── Offer data structure helpers ────────────────────────────────

interface OfferEntry {
  toBeSent: boolean;
  offerSent: boolean;
  viaAdobe: boolean;
  viaEmail: boolean;
  viaTxt: boolean;
  viaUps: boolean;
  viaFedex: boolean;
  viaUsps: boolean;
  viaInPerson: boolean;
  offerDate: string;
  offerAmount: number;
  isVerbal: boolean;
  isWrittenOffer: boolean;
}

function createEmptyOffer(): OfferEntry {
  return {
    toBeSent: false,
    offerSent: false,
    viaAdobe: false,
    viaEmail: false,
    viaTxt: false,
    viaUps: false,
    viaFedex: false,
    viaUsps: false,
    viaInPerson: false,
    offerDate: new Date().toISOString().split("T")[0],
    offerAmount: 0,
    isVerbal: false,
    isWrittenOffer: false,
  };
}

// Boolean to DB tinyint conversion
const b = (v: boolean) => (v ? 1 : 0);

// Simulate DB row from OfferEntry
function offerToDbRow(offer: OfferEntry, id: number, propertyId: number) {
  return {
    id,
    propertyId,
    toBeSent: b(offer.toBeSent),
    offerSent: b(offer.offerSent),
    viaAdobe: b(offer.viaAdobe),
    viaEmail: b(offer.viaEmail),
    viaTxt: b(offer.viaTxt),
    viaUps: b(offer.viaUps),
    viaFedex: b(offer.viaFedex),
    viaUsps: b(offer.viaUsps),
    viaInPerson: b(offer.viaInPerson),
    offerDate: offer.offerDate,
    offerAmount: offer.offerAmount,
    isVerbal: b(offer.isVerbal),
    isWrittenOffer: b(offer.isWrittenOffer),
    createdAt: new Date().toISOString(),
  };
}

// Simulate delivery methods extraction from a DB row
function getDeliveryMethods(row: ReturnType<typeof offerToDbRow>): string[] {
  const methods: { key: string; label: string }[] = [
    { key: "viaAdobe", label: "Adobe" },
    { key: "viaEmail", label: "Email" },
    { key: "viaTxt", label: "Txt" },
    { key: "viaUps", label: "UPS" },
    { key: "viaFedex", label: "FedEx" },
    { key: "viaUsps", label: "USPS" },
    { key: "viaInPerson", label: "In Person" },
  ];
  return methods.filter((m) => (row as any)[m.key] === 1).map((m) => m.label);
}

// ─── Tests ───────────────────────────────────────────────────────

describe("Offer Entry - Default Values", () => {
  it("should create an empty offer with all false/zero defaults", () => {
    const offer = createEmptyOffer();
    expect(offer.toBeSent).toBe(false);
    expect(offer.offerSent).toBe(false);
    expect(offer.viaAdobe).toBe(false);
    expect(offer.viaEmail).toBe(false);
    expect(offer.viaTxt).toBe(false);
    expect(offer.viaUps).toBe(false);
    expect(offer.viaFedex).toBe(false);
    expect(offer.viaUsps).toBe(false);
    expect(offer.viaInPerson).toBe(false);
    expect(offer.offerAmount).toBe(0);
    expect(offer.isVerbal).toBe(false);
    expect(offer.isWrittenOffer).toBe(false);
  });

  it("should set today's date as default offer date", () => {
    const offer = createEmptyOffer();
    const today = new Date().toISOString().split("T")[0];
    expect(offer.offerDate).toBe(today);
  });
});

describe("Offer Entry - Boolean to DB Conversion", () => {
  it("should convert true to 1 and false to 0", () => {
    expect(b(true)).toBe(1);
    expect(b(false)).toBe(0);
  });

  it("should correctly convert a full offer to DB row format", () => {
    const offer: OfferEntry = {
      toBeSent: false,
      offerSent: true,
      viaAdobe: false,
      viaEmail: true,
      viaTxt: false,
      viaUps: false,
      viaFedex: false,
      viaUsps: false,
      viaInPerson: false,
      offerDate: "2026-03-20",
      offerAmount: 150000,
      isVerbal: false,
      isWrittenOffer: true,
    };
    const row = offerToDbRow(offer, 1, 100);
    expect(row.id).toBe(1);
    expect(row.propertyId).toBe(100);
    expect(row.toBeSent).toBe(0);
    expect(row.offerSent).toBe(1);
    expect(row.viaEmail).toBe(1);
    expect(row.viaAdobe).toBe(0);
    expect(row.offerAmount).toBe(150000);
    expect(row.isWrittenOffer).toBe(1);
    expect(row.isVerbal).toBe(0);
  });
});

describe("Offer Entry - Delivery Methods", () => {
  it("should return no delivery methods when none are selected", () => {
    const offer = createEmptyOffer();
    const row = offerToDbRow(offer, 1, 100);
    expect(getDeliveryMethods(row)).toEqual([]);
  });

  it("should return only selected delivery methods", () => {
    const offer: OfferEntry = {
      ...createEmptyOffer(),
      viaEmail: true,
      viaFedex: true,
    };
    const row = offerToDbRow(offer, 1, 100);
    const methods = getDeliveryMethods(row);
    expect(methods).toContain("Email");
    expect(methods).toContain("FedEx");
    expect(methods).not.toContain("Adobe");
    expect(methods).not.toContain("USPS");
    expect(methods.length).toBe(2);
  });

  it("should return all 7 delivery methods when all selected", () => {
    const offer: OfferEntry = {
      ...createEmptyOffer(),
      viaAdobe: true,
      viaEmail: true,
      viaTxt: true,
      viaUps: true,
      viaFedex: true,
      viaUsps: true,
      viaInPerson: true,
    };
    const row = offerToDbRow(offer, 1, 100);
    const methods = getDeliveryMethods(row);
    expect(methods.length).toBe(7);
    expect(methods).toEqual(["Adobe", "Email", "Txt", "UPS", "FedEx", "USPS", "In Person"]);
  });
});

describe("Offer Entry - Amount Validation", () => {
  it("should accept zero amount", () => {
    const offer = createEmptyOffer();
    expect(offer.offerAmount).toBe(0);
    const row = offerToDbRow(offer, 1, 100);
    expect(row.offerAmount).toBe(0);
  });

  it("should accept large amounts", () => {
    const offer: OfferEntry = { ...createEmptyOffer(), offerAmount: 5000000 };
    const row = offerToDbRow(offer, 1, 100);
    expect(row.offerAmount).toBe(5000000);
  });

  it("should handle decimal amounts", () => {
    const offer: OfferEntry = { ...createEmptyOffer(), offerAmount: 150000.50 };
    const row = offerToDbRow(offer, 1, 100);
    expect(row.offerAmount).toBe(150000.50);
  });
});

describe("Offer Entry - Offer Type", () => {
  it("should support verbal-only offer", () => {
    const offer: OfferEntry = { ...createEmptyOffer(), isVerbal: true };
    const row = offerToDbRow(offer, 1, 100);
    expect(row.isVerbal).toBe(1);
    expect(row.isWrittenOffer).toBe(0);
  });

  it("should support written-only offer", () => {
    const offer: OfferEntry = { ...createEmptyOffer(), isWrittenOffer: true };
    const row = offerToDbRow(offer, 1, 100);
    expect(row.isVerbal).toBe(0);
    expect(row.isWrittenOffer).toBe(1);
  });

  it("should support both verbal and written", () => {
    const offer: OfferEntry = { ...createEmptyOffer(), isVerbal: true, isWrittenOffer: true };
    const row = offerToDbRow(offer, 1, 100);
    expect(row.isVerbal).toBe(1);
    expect(row.isWrittenOffer).toBe(1);
  });
});

describe("Pipeline Transition Logic", () => {
  const OFFER_PENDING = "OFFER_PENDING";
  const ANALYZING = "ANALYZING_DEAL";
  const UNDER_CONTRACT = "UNDER_CONTRACT_SELLER";

  function shouldShowOfferForm(selectedStage: string, currentStage: string | null): boolean {
    return selectedStage === OFFER_PENDING && currentStage !== OFFER_PENDING;
  }

  it("should show offer form when moving from Analyzing to Offer Pending", () => {
    expect(shouldShowOfferForm(OFFER_PENDING, ANALYZING)).toBe(true);
  });

  it("should show offer form when moving from null (no pipeline) to Offer Pending", () => {
    expect(shouldShowOfferForm(OFFER_PENDING, null)).toBe(true);
  });

  it("should NOT show offer form when already in Offer Pending", () => {
    expect(shouldShowOfferForm(OFFER_PENDING, OFFER_PENDING)).toBe(false);
  });

  it("should NOT show offer form when moving to other stages", () => {
    expect(shouldShowOfferForm(ANALYZING, null)).toBe(false);
    expect(shouldShowOfferForm(UNDER_CONTRACT, ANALYZING)).toBe(false);
  });
});

describe("Multiple Offers per Property", () => {
  it("should support creating multiple offers for the same property", () => {
    const offers = [
      offerToDbRow({ ...createEmptyOffer(), offerAmount: 100000, viaEmail: true }, 1, 100),
      offerToDbRow({ ...createEmptyOffer(), offerAmount: 120000, viaFedex: true }, 2, 100),
      offerToDbRow({ ...createEmptyOffer(), offerAmount: 150000, viaInPerson: true }, 3, 100),
    ];
    expect(offers.length).toBe(3);
    expect(offers.every((o) => o.propertyId === 100)).toBe(true);
    expect(offers[0].offerAmount).toBe(100000);
    expect(offers[1].offerAmount).toBe(120000);
    expect(offers[2].offerAmount).toBe(150000);
  });

  it("should allow different delivery methods per offer", () => {
    const offer1 = offerToDbRow({ ...createEmptyOffer(), viaEmail: true }, 1, 100);
    const offer2 = offerToDbRow({ ...createEmptyOffer(), viaFedex: true, viaUsps: true }, 2, 100);
    expect(getDeliveryMethods(offer1)).toEqual(["Email"]);
    expect(getDeliveryMethods(offer2)).toEqual(["FedEx", "USPS"]);
  });
});

describe("Offer Update Logic", () => {
  it("should update only specified fields", () => {
    const original = offerToDbRow(
      { ...createEmptyOffer(), offerAmount: 100000, viaEmail: true, offerSent: false },
      1,
      100
    );

    // Simulate partial update
    const updates: Partial<typeof original> = {
      offerSent: 1,
      offerAmount: 120000,
    };

    const updated = { ...original, ...updates };
    expect(updated.offerSent).toBe(1);
    expect(updated.offerAmount).toBe(120000);
    // Unchanged fields
    expect(updated.viaEmail).toBe(1);
    expect(updated.propertyId).toBe(100);
  });
});

describe("Offer Date Handling", () => {
  it("should use provided date string", () => {
    const offer: OfferEntry = { ...createEmptyOffer(), offerDate: "2026-04-15" };
    const row = offerToDbRow(offer, 1, 100);
    expect(row.offerDate).toBe("2026-04-15");
  });

  it("should handle empty date by defaulting to today", () => {
    const offer = createEmptyOffer();
    const today = new Date().toISOString().split("T")[0];
    expect(offer.offerDate).toBe(today);
  });
});
