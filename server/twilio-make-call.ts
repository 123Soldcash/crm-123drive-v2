import { makeCall, formatPhoneNumber } from "./twilio";
import { createCallLog, updateCallLog } from "./db-call-logs";
import { z } from "zod";

/**
 * Make a phone call via Twilio API
 * This is used for direct phone-to-phone calls (not browser-based)
 */
export async function makeTwilioCall(params: {
  propertyId: number;
  contactId: number;
  userId: number;
  toPhoneNumber: string;
  contactName: string;
  notes?: string;
}) {
  const { propertyId, contactId, userId, toPhoneNumber, contactName, notes } = params;

  try {
    // Format phone number
    const formattedNumber = formatPhoneNumber(toPhoneNumber);

    // Create call log entry
    const callLogResult = await createCallLog({
      propertyId,
      contactId,
      userId,
      toPhoneNumber: formattedNumber,
      fromPhoneNumber: process.env.TWILIO_PHONE_NUMBER!,
      callType: "outbound",
      status: "ringing",
      notes: notes || `Call to ${contactName}`,
      startedAt: new Date(),
    });

    const callLogId = callLogResult.insertId;

    // Make the actual call via Twilio
    const call = await makeCall({
      to: formattedNumber,
      from: process.env.TWILIO_PHONE_NUMBER!,
      url: `${process.env.VITE_FRONTEND_FORGE_API_URL}/api/twilio/voice`,
    });

    // Update call log with Twilio call SID
    await updateCallLog(callLogId, {
      twilioCallSid: call.sid,
      status: "in-progress",
    });

    return {
      success: true,
      callLogId,
      twilioCallSid: call.sid,
      message: `Call initiated to ${contactName}`,
    };
  } catch (error: any) {
    console.error("[Twilio] Make call error:", error);

    // Try to create a failed call log entry
    try {
      await createCallLog({
        propertyId,
        contactId,
        userId,
        toPhoneNumber: formatPhoneNumber(toPhoneNumber),
        fromPhoneNumber: process.env.TWILIO_PHONE_NUMBER!,
        callType: "outbound",
        status: "failed",
        notes: notes || `Failed call to ${contactName}`,
        errorMessage: error.message || "Unknown error",
        startedAt: new Date(),
        endedAt: new Date(),
      });
    } catch (_) {
      // Silently fail if we can't log the error
    }

    throw new Error(`Failed to initiate call: ${error.message}`);
  }
}

/**
 * Zod schema for the makeCall input
 */
export const makeCallInputSchema = z.object({
  propertyId: z.number().int().positive(),
  contactId: z.number().int().positive(),
  toPhoneNumber: z.string().min(10).max(20),
  contactName: z.string().min(1).max(255),
  notes: z.string().optional(),
});

export type MakeCallInput = z.infer<typeof makeCallInputSchema>;
