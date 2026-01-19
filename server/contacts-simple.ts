/**
 * Simple, direct contact fetching functions
 * This bypasses complex logic and gets contacts directly from the database
 */

import { getDb } from "./db";
import { eq } from "drizzle-orm";
import {
  contacts,
  contactPhones,
  contactEmails,
  contactAddresses,
  properties,
} from "../drizzle/schema";

/**
 * Get all contacts for a property by ANY property identifier
 * Handles both database ID and leadId automatically
 */
export async function getPropertyContactsSimple(propertyIdentifier: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  console.log(`[ContactsSimple] Fetching contacts for property identifier: ${propertyIdentifier}`);

  // Step 1: Find the actual database ID for this property
  let propertyDbId: number | null = null;

  // Try by leadId first (most common in URLs)
  const byLeadId = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.leadId, propertyIdentifier))
    .limit(1);

  if (byLeadId.length > 0) {
    propertyDbId = byLeadId[0].id;
    console.log(`[ContactsSimple] Found property by leadId, dbId: ${propertyDbId}`);
  } else {
    // Try by database ID
    const byDbId = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, propertyIdentifier))
      .limit(1);

    if (byDbId.length > 0) {
      propertyDbId = byDbId[0].id;
      console.log(`[ContactsSimple] Found property by dbId: ${propertyDbId}`);
    }
  }

  if (!propertyDbId) {
    console.log(`[ContactsSimple] Property not found for identifier: ${propertyIdentifier}`);
    return [];
  }

  // Step 2: Get all contacts for this property
  const contactsList = await db
    .select()
    .from(contacts)
    .where(eq(contacts.propertyId, propertyDbId));

  console.log(`[ContactsSimple] Found ${contactsList.length} contacts for property ${propertyDbId}`);

  // Step 3: For each contact, get phones and emails
  const contactsWithDetails = await Promise.all(
    contactsList.map(async (contact) => {
      // Get phones
      const phones = await db
        .select()
        .from(contactPhones)
        .where(eq(contactPhones.contactId, contact.id));

      // Get emails
      const emails = await db
        .select()
        .from(contactEmails)
        .where(eq(contactEmails.contactId, contact.id));

      // Get addresses
      let addresses: any[] = [];
      try {
        addresses = await db
          .select()
          .from(contactAddresses)
          .where(eq(contactAddresses.contactId, contact.id));
      } catch (e) {
        // Table might not exist
        console.log(`[ContactsSimple] Could not fetch addresses: ${e}`);
      }

      console.log(`[ContactsSimple] Contact ${contact.id} (${contact.name}): ${phones.length} phones, ${emails.length} emails`);

      return {
        ...contact,
        phones,
        emails,
        addresses,
        socialMedia: [], // Empty for now
      };
    })
  );

  return contactsWithDetails;
}
