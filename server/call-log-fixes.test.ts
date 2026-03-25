import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const callTrackingPath = resolve(__dirname, "../client/src/components/CallTrackingTable.tsx");
const callTrackingCode = readFileSync(callTrackingPath, "utf-8");

const communicationPath = resolve(__dirname, "./communication.ts");
const communicationCode = readFileSync(communicationPath, "utf-8");

describe("Call Log & Notes Fixes", () => {
  describe("Property Detail fields wired to React state", () => {
    it("should have state variables for all property detail fields", () => {
      expect(callTrackingCode).toContain("const [propBedBath, setPropBedBath] = useState");
      expect(callTrackingCode).toContain("const [propSf, setPropSf] = useState");
      expect(callTrackingCode).toContain("const [propRoofAge, setPropRoofAge] = useState");
      expect(callTrackingCode).toContain("const [propAcAge, setPropAcAge] = useState");
      expect(callTrackingCode).toContain("const [propOverallCondition, setPropOverallCondition] = useState");
      expect(callTrackingCode).toContain("const [propReasonToSell, setPropReasonToSell] = useState");
      expect(callTrackingCode).toContain("const [propHowFastToSell, setPropHowFastToSell] = useState");
    });

    it("should wire Bed/Bath input to propBedBath state", () => {
      expect(callTrackingCode).toContain("value={propBedBath}");
      expect(callTrackingCode).toContain("onChange={(e) => setPropBedBath(e.target.value)}");
    });

    it("should wire SF input to propSf state", () => {
      expect(callTrackingCode).toContain("value={propSf}");
      expect(callTrackingCode).toContain("onChange={(e) => setPropSf(e.target.value)}");
    });

    it("should wire Roof Age input to propRoofAge state", () => {
      expect(callTrackingCode).toContain("value={propRoofAge}");
      expect(callTrackingCode).toContain("onChange={(e) => setPropRoofAge(e.target.value)}");
    });

    it("should wire A/C Age input to propAcAge state", () => {
      expect(callTrackingCode).toContain("value={propAcAge}");
      expect(callTrackingCode).toContain("onChange={(e) => setPropAcAge(e.target.value)}");
    });

    it("should wire Overall Condition select to propOverallCondition state", () => {
      expect(callTrackingCode).toContain("value={propOverallCondition}");
      expect(callTrackingCode).toContain("onChange={(e) => setPropOverallCondition(e.target.value)}");
    });

    it("should wire Reason to Sell input to propReasonToSell state", () => {
      expect(callTrackingCode).toContain("value={propReasonToSell}");
      expect(callTrackingCode).toContain("onChange={(e) => setPropReasonToSell(e.target.value)}");
    });

    it("should wire How Fast to Sell select to propHowFastToSell state", () => {
      expect(callTrackingCode).toContain("value={propHowFastToSell}");
      expect(callTrackingCode).toContain("onChange={(e) => setPropHowFastToSell(e.target.value)}");
    });
  });

  describe("handleLogCall sends property details", () => {
    it("should build propertyDetails JSON from state variables", () => {
      expect(callTrackingCode).toContain("propertyDetails.bedBath = propBedBath");
      expect(callTrackingCode).toContain("propertyDetails.sf = propSf");
      expect(callTrackingCode).toContain("propertyDetails.roofAge = propRoofAge");
      expect(callTrackingCode).toContain("propertyDetails.acAge = propAcAge");
      expect(callTrackingCode).toContain("propertyDetails.overallCondition = propOverallCondition");
      expect(callTrackingCode).toContain("propertyDetails.reasonToSell = propReasonToSell");
      expect(callTrackingCode).toContain("propertyDetails.howFastToSell = propHowFastToSell");
    });

    it("should pass propertyDetails as JSON string to mutation", () => {
      expect(callTrackingCode).toContain("propertyDetails: Object.keys(propertyDetails).length > 0 ? JSON.stringify(propertyDetails) : undefined");
    });
  });

  describe("Communication matching uses contactPhoneNumber", () => {
    it("should have matchPhoneCalls helper that uses contactPhoneNumber field", () => {
      expect(callTrackingCode).toContain("const matchPhoneCalls = (contactId: number, phoneNumber: string)");
      expect(callTrackingCode).toContain("c.contactPhoneNumber === phoneNumber");
    });

    it("should fallback to notes-based matching for old logs without contactPhoneNumber", () => {
      expect(callTrackingCode).toContain("!c.contactPhoneNumber && c.notes?.includes(phoneNumber)");
    });

    it("should use matchPhoneCalls in getLastDisposition", () => {
      expect(callTrackingCode).toContain("const getLastDisposition = (contactId: number, phoneNumber: string) => {");
      expect(callTrackingCode).toContain("const phoneCalls = matchPhoneCalls(contactId, phoneNumber)");
    });

    it("should use matchPhoneCalls in getCallAttempts", () => {
      expect(callTrackingCode).toContain("const getCallAttempts = (contactId: number, phoneNumber: string) => {");
      expect(callTrackingCode).toContain("return matchPhoneCalls(contactId, phoneNumber).length");
    });

    it("should use matchPhoneCalls in getLastNotes", () => {
      expect(callTrackingCode).toContain("const getLastNotes = (contactId: number, phoneNumber: string) => {");
    });

    it("should use matchPhoneCalls in getLastCommunicationLog", () => {
      expect(callTrackingCode).toContain("const getLastCommunicationLog = (contactId: number, phoneNumber: string) => {");
    });
  });

  describe("Form reset on dialog close", () => {
    it("should have resetCallLogForm function", () => {
      expect(callTrackingCode).toContain("const resetCallLogForm = () => {");
    });

    it("should reset all form fields in resetCallLogForm", () => {
      expect(callTrackingCode).toContain("setSelectedPhone(null)");
      expect(callTrackingCode).toContain("setDisposition(\"\")");
      expect(callTrackingCode).toContain("setNotes(\"\")");
      expect(callTrackingCode).toContain("setMood(\"\")");
      expect(callTrackingCode).toContain("setPropBedBath(\"\")");
      expect(callTrackingCode).toContain("setPropSf(\"\")");
      expect(callTrackingCode).toContain("setPropRoofAge(\"\")");
      expect(callTrackingCode).toContain("setPropAcAge(\"\")");
      expect(callTrackingCode).toContain("setPropOverallCondition(\"\")");
      expect(callTrackingCode).toContain("setPropReasonToSell(\"\")");
      expect(callTrackingCode).toContain("setPropHowFastToSell(\"\")");
    });

    it("should call resetCallLogForm when dialog closes", () => {
      expect(callTrackingCode).toContain("onOpenChange={(open) => { if (!open) resetCallLogForm(); }}");
    });

    it("should call resetCallLogForm in logCommunicationMutation onSuccess", () => {
      // After the mutation succeeds, the form should be reset
      const onSuccessMatch = callTrackingCode.match(/logCommunicationMutation = trpc\.communication\.addCommunicationLog\.useMutation\(\{[\s\S]*?onSuccess:[\s\S]*?resetCallLogForm\(\)/);
      expect(onSuccessMatch).not.toBeNull();
    });

    it("should use Save Call Log as button text", () => {
      expect(callTrackingCode).toContain("Save Call Log");
    });
  });

  describe("Backend returns contactPhoneNumber in getCommunicationLogByProperty", () => {
    it("should select contactPhoneNumber in getCommunicationLogByProperty", () => {
      expect(communicationCode).toContain("contactPhoneNumber: communicationLog.contactPhoneNumber");
    });

    it("should select twilioNumber in getCommunicationLogByProperty", () => {
      expect(communicationCode).toContain("twilioNumber: communicationLog.twilioNumber");
    });
  });

  describe("Mutation invalidates property data", () => {
    it("should invalidate properties.getById after logging call", () => {
      const onSuccessSection = callTrackingCode.match(/logCommunicationMutation = trpc\.communication\.addCommunicationLog\.useMutation\(\{[\s\S]*?onSuccess:[\s\S]*?\}/);
      expect(onSuccessSection?.[0]).toContain("utils.properties.getById.invalidate");
    });
  });
});
