/**
 * phoneToPropertyLookup.ts
 *
 * Single source of truth for resolving an inbound phone number to one or more
 * CRM property IDs.  Used by:
 *   - Inbound voice webhook (twilio-webhooks.ts)
 *   - Inbound SMS webhook  (twilio-webhooks.ts)
 *   - Voicemail recording callback (twilio-webhooks.ts)
 *
 * Strategy
 * --------
 * 1. Build a list of phone-number variants (E.164, digits-only, 10-digit, 11-digit)
 *    so we match regardless of how the number is stored in the DB.
 * 2. Search MODEL 1 — `contactPhones` table (legacy import model).
 * 3. Search MODEL 2 — `contacts.phoneNumber` where contactType = 'phone' (new model).
 * 4. Return the union of all matching property IDs (deduped).
 */

import { eq, and, inArray } from "drizzle-orm";

/** Build all reasonable variants of a phone number for DB matching. */
export function buildPhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  // Normalize to 10-digit core (strip leading country code 1 if present)
  const digits10 = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const digits11 = digits10.length === 10 ? `1${digits10}` : digits;

  const variants: (string | null)[] = [
    phone,                                                              // raw as-is
    `+${digits11}`,                                                     // E.164 with country code
    digits,                                                             // all digits as-is
    digits10.length === 10 ? digits10 : null,                          // 10-digit
    digits10.length === 10 ? digits11 : null,                          // 11-digit
    // formatted variants that might be stored in DB
    digits10.length === 10
      ? `(${digits10.slice(0, 3)}) ${digits10.slice(3, 6)}-${digits10.slice(6)}`
      : null,
  ];
  return Array.from(new Set(variants.filter(Boolean) as string[]));
}

/**
 * Look up all property IDs associated with a given phone number.
 * Returns an empty array if nothing is found or if DB is unavailable.
 */
/** Returns { propertyId, deskName } for each matched property. */
export async function lookupPropertiesByPhone(phone: string): Promise<{ propertyId: number; deskName: string | null }[]> {
  if (!phone || phone === "undefined" || phone.startsWith("client:")) {
    return [];
  }
  try {
    const { getDb } = await import("../db");
    const { contacts, contactPhones, properties: propertiesTable } = await import("../../drizzle/schema");
    const database = await getDb();
    if (!database) return [];
    const variants = buildPhoneVariants(phone);
    const allPropertyIds = new Set<number>();
    // ── MODEL 1: contactPhones table (legacy) ────────────────────────────────
    const matchingPhones: { contactId: number }[] = [];
    for (const variant of variants) {
      const rows = await database
        .select({ contactId: contactPhones.contactId })
        .from(contactPhones)
        .where(eq(contactPhones.phoneNumber, variant));
      matchingPhones.push(...rows);
    }
    const uniqueContactIds = Array.from(new Set(matchingPhones.map(r => r.contactId)));
    if (uniqueContactIds.length > 0) {
      const contactRows = await database
        .select({ propertyId: contacts.propertyId })
        .from(contacts)
        .where(inArray(contacts.id, uniqueContactIds));
      for (const c of contactRows) {
        if (c.propertyId != null && c.propertyId > 0) allPropertyIds.add(c.propertyId);
      }
    }
    // ── MODEL 2: contacts.phoneNumber directly (new model) ───────────────────
    for (const variant of variants) {
      const rows = await database
        .select({ propertyId: contacts.propertyId })
        .from(contacts)
        .where(
          and(
            eq(contacts.phoneNumber, variant),
            eq(contacts.contactType, "phone")
          )
        );
      for (const r of rows) {
        if (r.propertyId != null && r.propertyId > 0) allPropertyIds.add(r.propertyId);
      }
    }
    if (allPropertyIds.size === 0) return [];
    // Fetch deskName for each matched property
    const propIds = Array.from(allPropertyIds);
    const propRows = await database
      .select({ id: propertiesTable.id, deskName: propertiesTable.deskName })
      .from(propertiesTable)
      .where(inArray(propertiesTable.id, propIds));
    return propRows.map(r => ({ propertyId: r.id, deskName: r.deskName ?? null }));
  } catch (err) {
    console.error("[phoneToPropertyLookup] lookupPropertiesByPhone error:", err);
    return [];
  }
}

export async function lookupPropertyIdsByPhone(phone: string): Promise<number[]> {
  if (!phone || phone === "undefined" || phone.startsWith("client:")) {
    return [];
  }

  try {
    const { getDb } = await import("../db");
    const { contacts, contactPhones } = await import("../../drizzle/schema");
    const database = await getDb();
    if (!database) return [];

    const variants = buildPhoneVariants(phone);
    const allPropertyIds = new Set<number>();

    // ── MODEL 1: contactPhones table (legacy) ────────────────────────────────
    const matchingPhones: { contactId: number }[] = [];
    for (const variant of variants) {
      const rows = await database
        .select({ contactId: contactPhones.contactId })
        .from(contactPhones)
        .where(eq(contactPhones.phoneNumber, variant));
      matchingPhones.push(...rows);
    }
    const uniqueContactIds = Array.from(new Set(matchingPhones.map(r => r.contactId)));
    if (uniqueContactIds.length > 0) {
      const contactRows = await database
        .select({ propertyId: contacts.propertyId })
        .from(contacts)
        .where(inArray(contacts.id, uniqueContactIds));
      for (const c of contactRows) {
        if (c.propertyId != null && c.propertyId > 0) allPropertyIds.add(c.propertyId);
      }
    }

    // ── MODEL 2: contacts.phoneNumber directly (new model) ───────────────────
    for (const variant of variants) {
      const rows = await database
        .select({ propertyId: contacts.propertyId })
        .from(contacts)
        .where(
          and(
            eq(contacts.phoneNumber, variant),
            eq(contacts.contactType, "phone")
          )
        );
      for (const r of rows) {
        if (r.propertyId != null && r.propertyId > 0) allPropertyIds.add(r.propertyId);
      }
    }

    return Array.from(allPropertyIds);
  } catch (err) {
    console.error("[phoneToPropertyLookup] Error:", err);
    return [];
  }
}
