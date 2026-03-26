/**
 * Tests for Click-to-Call Phone Number feature
 * 
 * Verifies that:
 * 1. TwilioCallWidget button is removed from CallTrackingTable
 * 2. Phone number text is clickable and triggers call directly
 * 3. CallModal is rendered inside CallTrackingTable (not Log Call dialog)
 * 4. Popover for number selection appears when no primary number is set
 * 5. handlePhoneCallClick function exists (replaces old handlePhoneClick)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CALL_TRACKING_PATH = path.resolve(__dirname, "../client/src/components/CallTrackingTable.tsx");

describe("Click-to-Call Phone Number Feature", () => {
  const source = fs.readFileSync(CALL_TRACKING_PATH, "utf-8");

  describe("TwilioCallWidget removal", () => {
    it("should NOT import TwilioCallWidget", () => {
      expect(source).not.toContain('import { TwilioCallWidget }');
    });

    it("should NOT render <TwilioCallWidget", () => {
      expect(source).not.toContain('<TwilioCallWidget');
    });
  });

  describe("CallModal integration", () => {
    it("should import CallModal", () => {
      expect(source).toContain('import { CallModal }');
    });

    it("should render CallModal conditionally", () => {
      expect(source).toContain('callModalOpen && callModalPhone');
      expect(source).toContain('<CallModal');
    });

    it("should pass required props to CallModal", () => {
      expect(source).toContain('phoneNumber={callModalPhone.phoneNumber}');
      expect(source).toContain('contactName={callModalPhone.contactName}');
      expect(source).toContain('contactId={callModalPhone.contactId}');
      expect(source).toContain('callerPhone={callModalPhone.callerPhone}');
    });
  });

  describe("Inline call state", () => {
    it("should have callSelectorOpen state for popover", () => {
      expect(source).toContain('callSelectorOpen');
      expect(source).toContain('setCallSelectorOpen');
    });

    it("should have callModalOpen state", () => {
      expect(source).toContain('callModalOpen');
      expect(source).toContain('setCallModalOpen');
    });

    it("should have callModalPhone state with contact info", () => {
      expect(source).toContain('callModalPhone');
      expect(source).toContain('setCallModalPhone');
    });
  });

  describe("handlePhoneCallClick function", () => {
    it("should have handlePhoneCallClick function (replaces handlePhoneClick)", () => {
      expect(source).toContain('handlePhoneCallClick');
    });

    it("should NOT have old handlePhoneClick function", () => {
      // The old function that opened the Log Call dialog
      expect(source).not.toMatch(/const handlePhoneClick\s*=/);
    });

    it("should check for primaryTwilioNumber to auto-dial", () => {
      // When primary number exists, skip selector
      expect(source).toContain('if (primaryTwilioNumber)');
    });

    it("should open selector when no primary number", () => {
      expect(source).toContain('setCallSelectorOpen(phone.phoneNumber)');
    });
  });

  describe("Phone number is clickable", () => {
    it("should have onClick handler on phone number text", () => {
      expect(source).toContain('onClick={() => handlePhoneCallClick(contact, phone)');
    });

    it("should show phone icon next to number", () => {
      // Phone icon inside the clickable button
      expect(source).toContain('<Phone className="h-3 w-3 text-green-600"');
    });

    it("should style phone number as green (call action)", () => {
      expect(source).toContain('text-green-700 hover:text-green-900');
    });
  });

  describe("Popover for number selection", () => {
    it("should import Popover components", () => {
      expect(source).toContain('import { Popover, PopoverContent, PopoverTrigger }');
    });

    it("should render Popover around phone number", () => {
      expect(source).toContain('<Popover');
      expect(source).toContain('<PopoverTrigger');
      expect(source).toContain('<PopoverContent');
    });

    it("should have handleSelectTwilioNumber function", () => {
      expect(source).toContain('handleSelectTwilioNumber');
    });

    it("should show Twilio numbers list in popover", () => {
      expect(source).toContain('twilioNumbersList');
      expect(source).toContain('Select caller number:');
    });
  });

  describe("formatE164 helper", () => {
    it("should have formatE164 function for phone formatting", () => {
      expect(source).toContain('formatE164');
    });
  });

  describe("SMSChatButton preserved", () => {
    it("should still render SMSChatButton", () => {
      expect(source).toContain('<SMSChatButton');
    });
  });

  describe("Old Log Call dialog behavior removed", () => {
    it("should NOT have selectedPhone state that opens Log Call dialog on phone click", () => {
      // The old handlePhoneClick set selectedPhone which opened the Quick Call Log dialog
      // Now handlePhoneCallClick opens the CallModal instead
      const handlePhoneClickMatch = source.match(/const handlePhoneClick\s*=\s*\(contact/);
      expect(handlePhoneClickMatch).toBeNull();
    });
  });
});
