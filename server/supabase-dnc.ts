/**
 * Supabase DNC Verification Service
 * Checks phone numbers against a Supabase DNC database via RPC function.
 *
 * The Supabase RPC function `check_dnc` accepts { p_number: string }
 * and returns [true] if the number IS on the DNC list, [false] if NOT.
 */

import { getDb } from "./db";
import { integrationSettings, contactPhones, contacts } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

/**
 * Get Supabase DNC config from integrationSettings table
 */
async function getSupabaseDNCConfig(): Promise<{
  supabaseUrl: string;
  supabaseAnonKey: string;
  rpcFunctionName: string;
} | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.integration, "supabase_dnc"));

  const config: Record<string, string> = {};
  for (const r of rows) config[r.settingKey] = r.settingValue ?? "";

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }

  return {
    supabaseUrl: config.supabaseUrl.replace(/\/$/, ""),
    supabaseAnonKey: config.supabaseAnonKey,
    rpcFunctionName: config.rpcFunctionName || "check_dnc",
  };
}

/**
 * Normalize phone number to digits only (last 10 digits)
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Check a single phone number against Supabase DNC.
 * Returns true if the number IS on the DNC list.
 */
async function checkSingleDNC(
  config: { supabaseUrl: string; supabaseAnonKey: string; rpcFunctionName: string },
  phoneNumber: string
): Promise<boolean> {
  const normalized = normalizePhone(phoneNumber);
  if (!normalized || normalized.length < 7) return false;

  try {
    const url = `${config.supabaseUrl}/rest/v1/rpc/${config.rpcFunctionName}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_number: normalized }),
    });

    if (!response.ok) {
      console.error(`[Supabase DNC] HTTP ${response.status} for ${normalized}`);
      return false;
    }

    const data = await response.json();
    // Response is [true] or [false]
    if (Array.isArray(data) && data.length > 0) {
      return data[0] === true;
    }
    // Could also be a direct boolean
    if (typeof data === "boolean") {
      return data;
    }
    return false;
  } catch (err) {
    console.error(`[Supabase DNC] Error checking ${normalized}:`, err);
    return false;
  }
}

/**
 * Check multiple phone numbers against Supabase DNC.
 * Returns a map of phoneId -> isDNC (true/false).
 * Also updates the contactPhones.dnc field in the database.
 */
export async function checkDNCForPhones(
  phoneRecords: Array<{ id: number; phoneNumber: string; contactId: number }>
): Promise<{
  checked: number;
  flagged: number;
  results: Array<{ phoneId: number; phoneNumber: string; isDNC: boolean }>;
  error?: string;
}> {
  const config = await getSupabaseDNCConfig();
  if (!config) {
    return {
      checked: 0,
      flagged: 0,
      results: [],
      error: "Supabase DNC not configured. Go to Integrations → Supabase DNC to set URL and API Key.",
    };
  }

  const db = await getDb();
  if (!db) {
    return { checked: 0, flagged: 0, results: [], error: "Database not available" };
  }

  const results: Array<{ phoneId: number; phoneNumber: string; isDNC: boolean }> = [];
  let flagged = 0;

  // Process in batches of 10 to avoid overwhelming the API
  const BATCH_SIZE = 10;
  for (let i = 0; i < phoneRecords.length; i += BATCH_SIZE) {
    const batch = phoneRecords.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (phone) => {
        const isDNC = await checkSingleDNC(config, phone.phoneNumber);
        return { phoneId: phone.id, phoneNumber: phone.phoneNumber, contactId: phone.contactId, isDNC };
      })
    );

    for (const result of batchResults) {
      results.push({ phoneId: result.phoneId, phoneNumber: result.phoneNumber, isDNC: result.isDNC });

      if (result.isDNC) {
        flagged++;
      }

      // Update the phone's DNC flag in the database
      await db
        .update(contactPhones)
        .set({ dnc: result.isDNC ? 1 : 0 })
        .where(eq(contactPhones.id, result.phoneId));
    }

    // Also sync contact-level DNC: if any phone is DNC, mark contact as DNC
    const contactIds = Array.from(new Set(batchResults.map((r) => r.contactId)));
    for (const contactId of contactIds) {
      const phonesForContact = batchResults.filter((r) => r.contactId === contactId);
      const anyDNC = phonesForContact.some((r) => r.isDNC);
      if (anyDNC) {
        await db
          .update(contacts)
          .set({ dnc: 1 })
          .where(eq(contacts.id, contactId));
      }
    }
  }

  return { checked: phoneRecords.length, flagged, results };
}

/**
 * Check DNC for all phone numbers of a property.
 * Fetches all contacts → phones, checks each against Supabase, updates DB.
 */
export async function checkDNCForProperty(propertyId: number): Promise<{
  checked: number;
  flagged: number;
  results: Array<{ phoneId: number; phoneNumber: string; isDNC: boolean }>;
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { checked: 0, flagged: 0, results: [], error: "Database not available" };
  }

  // Resolve property ID (could be leadId or database id)
  const { properties } = await import("../drizzle/schema");

  let propertyDbId: number | null = null;
  const byLeadId = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.leadId, propertyId))
    .limit(1);

  if (byLeadId.length > 0) {
    propertyDbId = byLeadId[0].id;
  } else {
    const byDbId = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    if (byDbId.length > 0) {
      propertyDbId = byDbId[0].id;
    }
  }

  if (!propertyDbId) {
    return { checked: 0, flagged: 0, results: [], error: "Property not found" };
  }

  // Get all contacts for this property
  const contactsList = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.propertyId, propertyDbId));

  if (contactsList.length === 0) {
    return { checked: 0, flagged: 0, results: [] };
  }

  // Get all phones for these contacts
  const contactIds = contactsList.map((c) => c.id);
  const allPhones = await db
    .select({
      id: contactPhones.id,
      phoneNumber: contactPhones.phoneNumber,
      contactId: contactPhones.contactId,
    })
    .from(contactPhones)
    .where(inArray(contactPhones.contactId, contactIds));

  if (allPhones.length === 0) {
    return { checked: 0, flagged: 0, results: [] };
  }

  return checkDNCForPhones(allPhones);
}

/**
 * Check DNC for specific phone numbers (used after adding a contact).
 * Takes an array of phone IDs and checks them.
 */
export async function checkDNCForPhoneIds(phoneIds: number[]): Promise<{
  checked: number;
  flagged: number;
  results: Array<{ phoneId: number; phoneNumber: string; isDNC: boolean }>;
  error?: string;
}> {
  if (phoneIds.length === 0) {
    return { checked: 0, flagged: 0, results: [] };
  }

  const db = await getDb();
  if (!db) {
    return { checked: 0, flagged: 0, results: [], error: "Database not available" };
  }

  const phones = await db
    .select({
      id: contactPhones.id,
      phoneNumber: contactPhones.phoneNumber,
      contactId: contactPhones.contactId,
    })
    .from(contactPhones)
    .where(inArray(contactPhones.id, phoneIds));

  if (phones.length === 0) {
    return { checked: 0, flagged: 0, results: [] };
  }

  return checkDNCForPhones(phones);
}
