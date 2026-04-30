/**
 * phoneToPropertyLookup.ts
 *
 * Single source of truth for resolving an inbound phone number to one or more
 * CRM property IDs.  Used by:
 *   - Inbound voice webhook (twilio-webhooks.ts)
 *   - Inbound SMS webhook  (twilio-webhooks.ts)
 *   - Voicemail recording callback (twilio-webhooks.ts)
 *
 * New model: all phone data lives directly on contacts.phoneNumber.
 * Legacy contactPhones table has been removed.
 */

import { eq, and, inArray, isNotNull } from "drizzle-orm";

/** Build all reasonable variants of a phone number for DB matching. */
export function buildPhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const digits10 = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const digits11 = digits10.length === 10 ? `1${digits10}` : digits;

  const variants: (string | null)[] = [
    phone,
    `+${digits11}`,
    digits,
    digits10.length === 10 ? digits10 : null,
    digits10.length === 10 ? digits11 : null,
    digits10.length === 10
      ? `(${digits10.slice(0, 3)}) ${digits10.slice(3, 6)}-${digits10.slice(6)}`
      : null,
  ];
  return Array.from(new Set(variants.filter(Boolean) as string[]));
}

/**
 * Look up all property IDs associated with a given phone number.
 * Searches contacts.phoneNumber directly (new model).
 * FALLBACK: Search smsMessages history for prior outbound SMS to same contactPhone.
 */
export async function lookupPropertiesByPhone(phone: string): Promise<{ propertyId: number; deskName: string | null }[]> {
  if (!phone || phone === "undefined" || phone.startsWith("client:")) {
    return [];
  }
  try {
    const { getDb } = await import("../db");
    const { contacts, properties: propertiesTable } = await import("../../drizzle/schema");
    const database = await getDb();
    if (!database) return [];

    const variants = buildPhoneVariants(phone);
    const allPropertyIds = new Set<number>();

    // Search contacts.phoneNumber directly (new model)
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

    // FALLBACK: Conversation history (handles replies on different Twilio numbers)
    if (allPropertyIds.size === 0) {
      const { smsMessages } = await import("../../drizzle/schema");
      for (const variant of variants) {
        const historyRows = await database
          .select({ propertyId: smsMessages.propertyId })
          .from(smsMessages)
          .where(
            and(
              eq(smsMessages.contactPhone, variant),
              isNotNull(smsMessages.propertyId)
            )
          )
          .limit(5);
        for (const r of historyRows) {
          if (r.propertyId != null && r.propertyId > 0) allPropertyIds.add(r.propertyId);
        }
        if (allPropertyIds.size > 0) break;
      }
    }

    if (allPropertyIds.size === 0) return [];

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
    const { contacts } = await import("../../drizzle/schema");
    const database = await getDb();
    if (!database) return [];

    const variants = buildPhoneVariants(phone);
    const allPropertyIds = new Set<number>();

    // Search contacts.phoneNumber directly (new model)
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
