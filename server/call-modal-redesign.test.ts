import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const callModalPath = resolve(__dirname, "../client/src/components/CallModal.tsx");
const callModalCode = readFileSync(callModalPath, "utf-8");

describe("CallModal Redesign - 3-Column Layout", () => {
  describe("Layout Structure", () => {
    it("should have a 3-column flex layout", () => {
      expect(callModalCode).toContain('className="flex h-full"');
    });

    it("should have a left panel for property info (320px)", () => {
      expect(callModalCode).toContain("w-[320px]");
      expect(callModalCode).toContain("LEFT PANEL");
    });

    it("should have a center panel for Call Log & Notes", () => {
      expect(callModalCode).toContain("CENTER PANEL");
      expect(callModalCode).toContain("Call Log & Notes");
    });

    it("should have a right panel for call controls (280px)", () => {
      expect(callModalCode).toContain("w-[280px]");
      expect(callModalCode).toContain("RIGHT PANEL");
    });

    it("should use a large dialog size (95vw)", () => {
      expect(callModalCode).toContain("95vw");
      expect(callModalCode).toContain("90vh");
    });
  });

  describe("Left Panel - Property Info", () => {
    it("should display property image", () => {
      expect(callModalCode).toContain("Property Image");
      expect(callModalCode).toContain('alt="Property"');
    });

    it("should display property address", () => {
      expect(callModalCode).toContain("prop.address");
    });

    it("should display temperature badge", () => {
      // Temperature is displayed via prop data
      expect(callModalCode).toContain("temperature");
    });

    it("should display desk/agent info", () => {
      expect(callModalCode).toContain("prop.deskName");
    });

    it("should show Property section with bed/bath/sqft", () => {
      expect(callModalCode).toContain("Bed/Bath");
      expect(callModalCode).toContain("prop.bedrooms");
      expect(callModalCode).toContain("prop.bathrooms");
    });

    it("should show Financial section with estimated value and mortgage", () => {
      expect(callModalCode).toContain("Financial");
      expect(callModalCode).toContain("estimatedValue");
      expect(callModalCode).toContain("mortgageAmount");
      expect(callModalCode).toContain("equityAmount");
    });

    it("should show Owner section", () => {
      expect(callModalCode).toContain("Owner");
      expect(callModalCode).toContain("prop.ownerName");
    });

    it("should fetch property data using trpc", () => {
      expect(callModalCode).toContain("trpc.properties.getById.useQuery");
    });
  });

  describe("Right Panel - Call Controls", () => {
    it("should display contact name and phone", () => {
      expect(callModalCode).toContain("contactName");
      expect(callModalCode).toContain("formatPhone(phoneNumber)");
    });

    it("should have Start Call button", () => {
      expect(callModalCode).toContain("Start call");
    });

    it("should have End Call / Hang Up button", () => {
      expect(callModalCode).toContain("handleHangUp");
      expect(callModalCode).toContain("PhoneOff");
    });

    it("should display call timer", () => {
      expect(callModalCode).toContain("formatDuration");
    });
  });

  describe("Dialpad (DTMF)", () => {
    it("should have a dialpad section", () => {
      expect(callModalCode).toContain("Dialpad");
    });

    it("should have all 12 keys (1-9, *, 0, #)", () => {
      expect(callModalCode).toContain("DIALPAD_KEYS");
      // Check for digit definitions
      expect(callModalCode).toMatch(/digit.*1/);
      expect(callModalCode).toMatch(/digit.*2/);
      expect(callModalCode).toMatch(/digit.*3/);
      expect(callModalCode).toMatch(/digit.*0/);
      expect(callModalCode).toContain("*");
      expect(callModalCode).toContain("#");
    });

    it("should send DTMF tones via activeCallRef", () => {
      expect(callModalCode).toContain("sendDigits");
    });

    it("should only be active during calls", () => {
      expect(callModalCode).toContain("Dialpad active during calls only");
    });

    it("should have a 3-column grid layout for keys", () => {
      expect(callModalCode).toContain("grid-cols-3");
    });
  });

  describe("Center Panel - Call Log & Notes", () => {
    it("should have disposition selector", () => {
      expect(callModalCode).toContain("Disposition");
      expect(callModalCode).toContain("DISPOSITION_OPTIONS");
    });

    it("should have mood selector", () => {
      expect(callModalCode).toContain("Mood");
      expect(callModalCode).toContain("MOOD_OPTIONS");
    });

    it("should have quick templates", () => {
      expect(callModalCode).toContain("Quick Templates");
    });

    it("should have call summary textarea", () => {
      expect(callModalCode).toContain("Call Summary");
      expect(callModalCode).toContain("Add notes about this call");
    });

    it("should have Save Call Log button", () => {
      expect(callModalCode).toContain("Save Call Log");
    });

    it("should have notes input section", () => {
      expect(callModalCode).toContain("Call Notes");
      expect(callModalCode).toContain("Type a note...");
    });

    it("should have DNC toggle", () => {
      expect(callModalCode).toContain("DNC");
    });
  });

  describe("Backend Integration", () => {
    it("should use createCallLog with correct field names (to, not phoneNumber)", () => {
      expect(callModalCode).toContain("to: phoneNumber");
    });

    it("should use updateCallLog with callLogId (not id)", () => {
      expect(callModalCode).toContain("callLogId: callLogIdRef.current");
    });

    it("should pass propertyId to createNoteMutation", () => {
      // Check that propertyId is in the createNoteMutation.mutate call
      const createNoteSection = callModalCode.substring(
        callModalCode.indexOf("handleAddNote"),
        callModalCode.indexOf("handleAddNote") + 500
      );
      expect(createNoteSection).toContain("propertyId");
    });

    it("should use noteId (not id) for deleteNoteMutation", () => {
      expect(callModalCode).toContain("{ noteId }");
    });
  });
});
