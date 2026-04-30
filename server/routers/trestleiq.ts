/**
 * TrestleIQ Router — Phone validation, activity score, and litigator checks/**
 * Uses the new unified contacts model — phoneId maps to contacts.id.
 * Phone data (phoneNumber, carrier, DNC, etc.) is stored directly on the contacts row.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { contacts, integrationSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Get TrestleIQ config from DB
 */
async function getTrestleConfig() {
  const db = await getDb();
  const rows = await db!
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.integration, "trestleiq"));

  const config: Record<string, string> = {};
  for (const r of rows) config[r.settingKey] = r.settingValue ?? "";
  return config;
}

/**
 * Unified phone record — normalizes data from either model into a common shape
 */
interface PhoneRecord {
  phoneNumber: string;
  carrier: string | null;
  model: "contacts";
  id: number; // original id in its own table
}

/**
 * Look up a phone record by ID from the contacts table (new unified model).
 * Returns null if not found.
 */
async function findPhoneRecord(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, phoneId: number): Promise<PhoneRecord | null> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, phoneId));

  if (row && row.phoneNumber) {
    return {
      phoneNumber: row.phoneNumber,
      carrier: row.carrier ?? null,
      model: "contacts",
      id: row.id,
    };
  }

  return null;
}

/**
 * Persist TrestleIQ results back to the correct table
 */
async function saveTrestleResult(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  phone: PhoneRecord,
  result: {
    activityScore: number | null;
    isLitigator: number;
    lineType: string | null;
    carrier: string | null;
    isPrepaid: number;
  }
) {
  const updatePayload = {
    trestleScore: result.activityScore,
    isLitigator: result.isLitigator,
    trestleLineType: result.lineType,
    trestleLastChecked: new Date(),
    carrier: result.carrier || phone.carrier,
    isPrepaid: result.isPrepaid,
  };

  await db
    .update(contacts)
    .set(updatePayload)
    .where(eq(contacts.id, phone.id));
}

export const trestleiqRouter = router({
  /**
   * Lookup a single phone number via TrestleIQ Phone Validation API
   * Returns activity score, litigator status, line type, carrier, etc.
   * Also updates the phone record in the database (supports both models).
   */
  lookupPhone: protectedProcedure
    .input(
      z.object({
        phoneId: z.number(), // contactPhones.id OR contacts.id
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();

      // 1. Get the phone record (tries contactPhones, falls back to contacts)
      const phone = await findPhoneRecord(db!, input.phoneId);

      if (!phone) {
        throw new Error("Phone record not found");
      }

      // 2. Get TrestleIQ config
      const config = await getTrestleConfig();
      if (!config.api_key) {
        throw new Error("TrestleIQ API Key not configured. Go to Integrations to set it up.");
      }

      const baseUrl = config.base_url || "https://api.trestleiq.com";
      const enableLitigator = config.enable_litigator_checks !== "false";

      // 3. Clean phone number — strip to just digits, remove leading 1 if 11 digits
      let cleanPhone = phone.phoneNumber.replace(/\D/g, "");
      if (cleanPhone.length === 11 && cleanPhone.startsWith("1")) {
        cleanPhone = cleanPhone.substring(1); // TrestleIQ wants 10-digit US numbers
      }

      // 4. Build request URL
      let url = `${baseUrl}/3.0/phone_intel?phone=${cleanPhone}&phone.country_hint=US`;
      if (enableLitigator) {
        url += "&add_ons=litigator_checks";
      }

      // 5. Call TrestleIQ API
      const response = await fetch(url, {
        headers: { "x-api-key": config.api_key },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("TrestleIQ API Key is invalid or expired.");
        }
        if (response.status === 429) {
          throw new Error("TrestleIQ rate limit exceeded. Try again later.");
        }
        const errorText = await response.text();
        throw new Error(`TrestleIQ API error (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();

      // 6. Extract relevant fields
      const activityScore = data.activity_score ?? null;
      const isLitigator = data.add_ons?.litigator_checks?.["phone.is_litigator_risk"] === true ? 1 : 0;
      const lineType = data.line_type ?? null;
      const carrier = data.carrier ?? null;
      const isValid = data.is_valid ?? null;
      const isPrepaid = data.is_prepaid === true ? 1 : 0;

      // 7. Update the phone record in DB (correct table based on model)
      await saveTrestleResult(db!, phone, { activityScore, isLitigator, lineType, carrier, isPrepaid });

      // 8. Return the full result
      return {
        success: true,
        phoneId: input.phoneId,
        phoneNumber: phone.phoneNumber,
        isValid,
        activityScore,
        isLitigator: isLitigator === 1,
        lineType,
        carrier,
        isPrepaid: isPrepaid === 1,
        countryCode: data.country_code,
        warnings: data.warnings || [],
      };
    }),

  /**
   * Bulk lookup multiple phones for a property's contacts
   * Supports both contactPhones and contacts table models.
   */
  bulkLookup: protectedProcedure
    .input(
      z.object({
        phoneIds: z.array(z.number()),
      })
    )
    .mutation(async ({ input }) => {
      const config = await getTrestleConfig();
      if (!config.api_key) {
        throw new Error("TrestleIQ API Key not configured. Go to Integrations to set it up.");
      }

      const db = await getDb();
      const baseUrl = config.base_url || "https://api.trestleiq.com";
      const enableLitigator = config.enable_litigator_checks !== "false";

      const results: Array<{
        phoneId: number;
        phoneNumber: string;
        activityScore: number | null;
        isLitigator: boolean;
        lineType: string | null;
        success: boolean;
        error?: string;
      }> = [];

      for (const phoneId of input.phoneIds) {
        try {
          // Get phone record (tries contactPhones, falls back to contacts)
          const phone = await findPhoneRecord(db!, phoneId);

          if (!phone) {
            results.push({ phoneId, phoneNumber: "", activityScore: null, isLitigator: false, lineType: null, success: false, error: "Not found" });
            continue;
          }

          // Clean phone
          let cleanPhone = phone.phoneNumber.replace(/\D/g, "");
          if (cleanPhone.length === 11 && cleanPhone.startsWith("1")) {
            cleanPhone = cleanPhone.substring(1);
          }

          let url = `${baseUrl}/3.0/phone_intel?phone=${cleanPhone}&phone.country_hint=US`;
          if (enableLitigator) url += "&add_ons=litigator_checks";

          const response = await fetch(url, {
            headers: { "x-api-key": config.api_key },
          });

          if (!response.ok) {
            results.push({ phoneId, phoneNumber: phone.phoneNumber, activityScore: null, isLitigator: false, lineType: null, success: false, error: `HTTP ${response.status}` });
            continue;
          }

          const data = await response.json();
          const activityScore = data.activity_score ?? null;
          const isLitigator = data.add_ons?.litigator_checks?.["phone.is_litigator_risk"] === true ? 1 : 0;
          const lineType = data.line_type ?? null;
          const carrier = data.carrier ?? null;
          const isPrepaid = data.is_prepaid === true ? 1 : 0;

          // Update DB (correct table based on model)
          await saveTrestleResult(db!, phone, { activityScore, isLitigator, lineType, carrier, isPrepaid });

          results.push({
            phoneId,
            phoneNumber: phone.phoneNumber,
            activityScore,
            isLitigator: isLitigator === 1,
            lineType,
            success: true,
          });

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (err: any) {
          results.push({ phoneId, phoneNumber: "", activityScore: null, isLitigator: false, lineType: null, success: false, error: err.message });
        }
      }

      return {
        total: input.phoneIds.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };
    }),
});
