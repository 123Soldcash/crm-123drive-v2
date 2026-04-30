/**
 * Supabase DNC Verification Service
 * Checks phone numbers against a Supabase DNC database via RPC function.
 *
 * New model: all phone data lives directly on the contacts table.
 * contactPhones / contactEmails legacy tables are no longer used.
 */

import { getDb } from "./db";
import { integrationSettings, contacts } from "../drizzle/schema";
import { eq, inArray, isNotNull } from "drizzle-orm";

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
    if (Array.isArray(data) && data.length > 0) return data[0] === true;
    if (typeof data === "boolean") return data;
    return false;
  } catch (err) {
    console.error(`[Supabase DNC] Error checking ${normalized}:`, err);
    return false;
  }
}

/**
 * Check multiple phone contacts against Supabase DNC.
 * phoneRecords: array of { id: contactId, phoneNumber, contactId }
 * Updates contacts.dnc and contacts.dncChecked directly.
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
      if (result.isDNC) flagged++;

      // Update contacts table directly (new model)
      await db
        .update(contacts)
        .set({ dnc: result.isDNC ? 1 : 0, dncChecked: 1 })
        .where(eq(contacts.id, result.contactId));
    }
  }

  return { checked: phoneRecords.length, flagged, results };
}

/**
 * Check DNC for all phone contacts of a property.
 * Uses contacts table directly (new model).
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

  const { properties } = await import("../drizzle/schema");

  // Resolve property ID (could be leadId or database id)
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
    if (byDbId.length > 0) propertyDbId = byDbId[0].id;
  }

  if (!propertyDbId) {
    return { checked: 0, flagged: 0, results: [], error: "Property not found" };
  }

  // Get all phone contacts for this property from contacts table
  const phoneContacts = await db
    .select({
      id: contacts.id,
      phoneNumber: contacts.phoneNumber,
    })
    .from(contacts)
    .where(eq(contacts.propertyId, propertyDbId));

  const phoneRecords = phoneContacts
    .filter((c) => c.phoneNumber && c.phoneNumber.trim() !== "")
    .map((c) => ({
      id: c.id,
      phoneNumber: c.phoneNumber!,
      contactId: c.id,
    }));

  if (phoneRecords.length === 0) {
    return { checked: 0, flagged: 0, results: [] };
  }

  return checkDNCForPhones(phoneRecords);
}

/**
 * Check DNC for specific contact IDs (phone contacts).
 * phoneIds here are contact IDs in the new model.
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

  // Look up in contacts table (new model)
  const phoneContacts = await db
    .select({
      id: contacts.id,
      phoneNumber: contacts.phoneNumber,
    })
    .from(contacts)
    .where(inArray(contacts.id, phoneIds));

  const phoneRecords = phoneContacts
    .filter((c) => c.phoneNumber && c.phoneNumber.trim() !== "")
    .map((c) => ({
      id: c.id,
      phoneNumber: c.phoneNumber!,
      contactId: c.id,
    }));

  if (phoneRecords.length === 0) {
    return { checked: 0, flagged: 0, results: [] };
  }

  return checkDNCForPhones(phoneRecords);
}
