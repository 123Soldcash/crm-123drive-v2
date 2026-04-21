/**
 * Simple, direct contact fetching functions
 * Updated for new model: 1 contact = 1 phone OR 1 email (stored directly on contacts table)
 */

import { getDb } from "./db";
import { eq, asc } from "drizzle-orm";
import {
  contacts,
  contactAddresses,
  properties,
} from "../drizzle/schema";

/**
 * Get all contacts for a property by ANY property identifier
 * Handles both database ID and leadId automatically
 *
 * New model: phoneNumber, phoneType, email are directly on the contacts row.
 * We still return phones[] and emails[] arrays for backward compatibility with the frontend,
 * but each array will have at most 1 entry derived from the contact's own fields.
 */
export async function getPropertyContactsSimple(propertyIdentifier: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

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
  } else {
    // Try by database ID
    const byDbId = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, propertyIdentifier))
      .limit(1);
    if (byDbId.length > 0) {
      propertyDbId = byDbId[0].id;
    }
  }

  if (!propertyDbId) {
    return [];
  }

  // Step 2: Get all contacts for this property, ordered by sortOrder
  const contactsList = await db
    .select()
    .from(contacts)
    .where(eq(contacts.propertyId, propertyDbId))
    .orderBy(asc(contacts.sortOrder), asc(contacts.id));

  // Step 3: Build response with backward-compatible phones/emails arrays
  const contactsWithDetails = await Promise.all(
    contactsList.map(async (contact) => {
      // Build phones array from direct contact fields (at most 1 entry)
      const phones: Array<{
        id: number;
        contactId: number;
        phoneNumber: string;
        phoneType: string | null;
        isPrimary: number;
        dnc: number;
        isLitigator: number;
        trestleScore: number | null;
        trestleLineType: string | null;
        trestleLastChecked: Date | null;
      }> = [];

      if (contact.phoneNumber) {
        phones.push({
          id: contact.id, // use contact id as phone id for compatibility
          contactId: contact.id,
          phoneNumber: contact.phoneNumber,
          phoneType: contact.phoneType || "Mobile",
          isPrimary: 1,
          dnc: contact.dnc || 0,
          isLitigator: contact.isLitigator || 0,
          trestleScore: contact.trestleScore || null,
          trestleLineType: contact.trestleLineType || null,
          trestleLastChecked: contact.trestleLastChecked || null,
        });
      }

      // Build emails array from direct contact fields (at most 1 entry)
      const emails: Array<{
        id: number;
        contactId: number;
        email: string;
        isPrimary: number;
      }> = [];

      if (contact.email) {
        emails.push({
          id: contact.id,
          contactId: contact.id,
          email: contact.email,
          isPrimary: 1,
        });
      }

      // Get addresses (still from separate table)
      let addresses: any[] = [];
      try {
        addresses = await db
          .select()
          .from(contactAddresses)
          .where(eq(contactAddresses.contactId, contact.id));
      } catch (e) {
        // Table might not exist
      }

      return {
        ...contact,
        phones,
        emails,
        addresses,
        socialMedia: [],
      };
    })
  );

  return contactsWithDetails;
}
