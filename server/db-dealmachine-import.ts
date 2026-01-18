/**
 * DealMachine Import Functions
 * Handles importing properties and contacts from DealMachine Excel files
 */

import { getDb } from "./db";
import { properties, contacts, contactPhones, contactEmails } from "../drizzle/schema";
import { MappedProperty, MappedContact, parseContactFlags, getRelationshipType } from "./lib/dealmachine-mapper";

export interface ImportResult {
  success: boolean;
  propertiesImported: number;
  contactsImported: number;
  phonesImported: number;
  emailsImported: number;
  errors: string[];
  duplicates: string[];
}

/**
 * Import a single DealMachine property with its contacts
 */
export async function importDealMachineProperty(
  mappedProperty: MappedProperty,
  assignedAgentId?: number | null,
  listName?: string
): Promise<{ propertyId: number; errors: string[] }> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const errors: string[] = [];

  try {
    // Check for duplicate by propertyId
    const existingProperty = await db
      .select()
      .from(properties)
      .where(
        // @ts-ignore
        db.raw(`propertyId = ?`, [mappedProperty.propertyId])
      )
      .limit(1);

    if (existingProperty.length > 0) {
      throw new Error(`Property already exists: ${mappedProperty.propertyId}`);
    }

    // Insert property
    const result = await db.insert(properties).values({
      propertyId: mappedProperty.propertyId,
      dealMachinePropertyId: mappedProperty.propertyId,
      dealMachineLeadId: mappedProperty.leadId,
      addressLine1: mappedProperty.addressLine1,
      addressLine2: mappedProperty.addressLine2 || null,
      city: mappedProperty.city,
      state: mappedProperty.state,
      zipcode: mappedProperty.zipcode,
      owner1Name: mappedProperty.ownerName || null,
      assignedAgentId: assignedAgentId || null,
      leadTemperature: "TBD",
      deskStatus: "BIN",
      source: "DealMachine",
      listName: listName || null,
      entryDate: new Date(),
      dealMachineRawData: JSON.stringify({
        county: mappedProperty.county,
        lat: mappedProperty.lat,
        lng: mappedProperty.lng,
        dealMachineUrl: mappedProperty.dealMachineUrl,
        propertyFlags: mappedProperty.propertyFlags,
      }),
    });

    const propertyId = result[0].insertId;

    // Import contacts
    for (const contact of mappedProperty.contacts) {
      try {
        await importDealMachineContact(propertyId, contact);
      } catch (error) {
        errors.push(`Failed to import contact "${contact.name}": ${error}`);
      }
    }

    return { propertyId, errors };
  } catch (error) {
    throw error;
  }
}

/**
 * Import a single contact with phones and emails
 */
async function importDealMachineContact(
  propertyId: number,
  contact: MappedContact
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Parse flags to determine relationship and DNC status
  const flags = parseContactFlags(contact.flags);
  const relationship = getRelationshipType(contact.flags);

  // Insert contact
  const contactResult = await db.insert(contacts).values({
    propertyId,
    name: contact.name,
    relationship,
    phone1: contact.phones[0] || null,
    email1: contact.emails[0] || null,
    dnc: flags.isDNC ? 1 : 0,
    flags: `Imported from DealMachine. Flags: ${contact.flags || "none"}`,
  });

  const contactId = contactResult[0].insertId;

  // Import additional phones
  for (let i = 0; i < contact.phones.length; i++) {
    const phone = contact.phones[i];
    if (phone && phone.trim()) {
      await db.insert(contactPhones).values({
        contactId,
        phoneNumber: phone.trim(),
        dnc: flags.isDNC ? 1 : 0,
      });
    }
  }

  // Import emails
  for (const email of contact.emails) {
    if (email && email.trim()) {
      await db.insert(contactEmails).values({
        contactId,
        email: email.trim(),
      });
    }
  }
}

/**
 * Batch import multiple DealMachine properties
 */
export async function importDealMachineProperties(
  mappedProperties: MappedProperty[],
  assignedAgentId?: number | null,
  listName?: string
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    propertiesImported: 0,
    contactsImported: 0,
    phonesImported: 0,
    emailsImported: 0,
    errors: [],
    duplicates: [],
  };

  for (const mappedProperty of mappedProperties) {
    try {
      const importResult = await importDealMachineProperty(
        mappedProperty,
        assignedAgentId,
        listName
      );

      result.propertiesImported++;

      // Count contacts and their phones/emails
      for (const contact of mappedProperty.contacts) {
        result.contactsImported++;
        result.phonesImported += contact.phones.length;
        result.emailsImported += contact.emails.length;
      }

      if (importResult.errors.length > 0) {
        result.errors.push(...importResult.errors);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes("already exists")) {
        result.duplicates.push(`${mappedProperty.addressLine1}, ${mappedProperty.city}`);
      } else {
        result.errors.push(
          `Failed to import property at ${mappedProperty.addressLine1}: ${errorMsg}`
        );
      }
    }
  }

  result.success = result.errors.length === 0;

  return result;
}
