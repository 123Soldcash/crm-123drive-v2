/**
 * TrestleIQ Router — Phone validation, activity score, and litigator checks
 *
 * Supports dual phone data models:
 *   Model A: contactPhones table (legacy) — phoneId maps to contactPhones.id
 *   Model B: contacts table (new) — phoneId maps to contacts.id (phone stored directly on contact)
 *
 * The frontend passes phone.id which may be either a contactPhones.id or a contacts.id.
 * We try contactPhones first; if not found, fall back to contacts table.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { contactPhones, contacts, integrationSettings } from "../../drizzle/schema";
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
  model: "contactPhones" | "contacts";
  id: number; // original id in its own table
}

/**
 * Look up a phone record by ID, trying contactPhones first then contacts.
 * Returns null if not found in either table.
 */
async function findPhoneRecord(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, phoneId: number): Promise<PhoneRecord | null> {
  // Try contactPhones first (legacy model)
  const [cpRow] = await db
    .select()
    .from(contactPhones)
    .where(eq(contactPhones.id, phoneId));

  if (cpRow) {
    return {
      phoneNumber: cpRow.phoneNumber,
      carrier: cpRow.carrier ?? null,
      model: "contactPhones",
      id: cpRow.id,
    };
  }

  // Fall back to contacts table (new model — phone stored directly on contact)
  const [contactRow] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, phoneId));

  if (contactRow && contactRow.phoneNumber) {
    return {
      phoneNumber: contactRow.phoneNumber,
      carrier: contactRow.carrier ?? null,
      model: "contacts",
      id: contactRow.id,
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

  if (phone.model === "contactPhones") {
    await db
      .update(contactPhones)
      .set(updatePayload)
      .where(eq(contactPhones.id, phone.id));
  } else {
    await db
      .update(contacts)
      .set(updatePayload)
      .where(eq(contacts.id, phone.id));
  }
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
