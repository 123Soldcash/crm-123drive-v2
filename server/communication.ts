import { eq, desc, inArray, and, ne, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  contacts,
  contactPhones,
  contactEmails,
  contactAddresses,
  contactSocialMedia,
  communicationLog,
  properties,
  InsertContact,
  InsertContactPhone,
  InsertContactEmail,
  InsertContactAddress,
  InsertContactSocialMedia,
  InsertCommunicationLog,
} from "../drizzle/schema";

/**
 * Helper function to resolve propertyId from URL parameter (which could be leadId or database id)
 */
async function resolvePropertyDbId(urlId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // First try to find by leadId (since URLs typically use leadId)
  let result = await db.select({ id: properties.id }).from(properties).where(eq(properties.leadId, urlId)).limit(1);
  if (result.length > 0) return result[0].id;
  
  // Fallback to database id
  result = await db.select({ id: properties.id }).from(properties).where(eq(properties.id, urlId)).limit(1);
  if (result.length > 0) return result[0].id;
  
  return null;
}

/**
 * Contact Management Functions
 */

export async function getContactsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Resolve the actual database id from the URL parameter (which could be leadId)
  const dbPropertyId = await resolvePropertyDbId(propertyId);
  if (!dbPropertyId) return [];
  
  const contactsData = await db.select({ id: contacts.id, propertyId: contacts.propertyId, name: contacts.name, relationship: contacts.relationship, dnc: contacts.dnc, isLitigator: contacts.isLitigator, isDecisionMaker: contacts.isDecisionMaker, hidden: contacts.hidden }).from(contacts).where(eq(contacts.propertyId, dbPropertyId));
  
  // For each contact, fetch phones, emails, and addresses with error handling for missing tables
  const contactsWithDetails = await Promise.all(
    contactsData.map(async (contact) => {
      let phones: any[] = [];
      let emails: any[] = [];
      let addresses: any[] = [];
      
      // Fetch phones - table should exist
      try {
        phones = await db.select({ id: contactPhones.id, contactId: contactPhones.contactId, phoneNumber: contactPhones.phoneNumber, phoneType: contactPhones.phoneType, dnc: contactPhones.dnc, isLitigator: contactPhones.isLitigator }).from(contactPhones).where(eq(contactPhones.contactId, contact.id));
      } catch (e) {
        console.error('Error fetching phones:', e);
      }
      
      // Fetch emails - table should exist
      try {
        emails = await db.select({ id: contactEmails.id, contactId: contactEmails.contactId, email: contactEmails.email }).from(contactEmails).where(eq(contactEmails.contactId, contact.id));
      } catch (e) {
        console.error('Error fetching emails:', e);
      }
      
      // Fetch addresses - table may not exist
      try {
        addresses = await db.select({ id: contactAddresses.id, contactId: contactAddresses.contactId, address: contactAddresses.addressLine1, city: contactAddresses.city, state: contactAddresses.state, zipcode: contactAddresses.zipcode }).from(contactAddresses).where(eq(contactAddresses.contactId, contact.id));
      } catch (e) {
        // Table doesn't exist, ignore
      }
      
      return {
        ...contact,
        phones: phones || [],
        emails: emails || [],
        addresses: addresses || [],
      };
    })
  );
  
  return contactsWithDetails;
}

export async function getContactById(contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select({ id: contacts.id, propertyId: contacts.propertyId, name: contacts.name, relationship: contacts.relationship }).from(contacts).where(eq(contacts.id, contactId)).limit(1);
  return result[0] || null;
}

// Helper: normalize phone number to digits only for comparison
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^1/, ''); // strip non-digits and leading country code 1
}

// Helper: get all existing phone numbers for a property
export async function getExistingPhonesForProperty(propertyId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  
  const propertyContacts = await db.select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.propertyId, propertyId));
  
  if (propertyContacts.length === 0) return [];
  
  const contactIds = propertyContacts.map(c => c.id);
  const phones = await db.select({ phoneNumber: contactPhones.phoneNumber })
    .from(contactPhones)
    .where(inArray(contactPhones.contactId, contactIds));
  
  return phones.map(p => normalizePhone(p.phoneNumber));
}

// Helper: check if phones exist in OTHER properties (cross-property warning)
export async function findCrossPropertyPhones(
  currentPropertyId: number,
  phonesToCheck: string[]
): Promise<Array<{ phone: string; propertyId: number; leadId: number | null; address: string }>> {
  const db = await getDb();
  if (!db) return [];
  if (phonesToCheck.length === 0) return [];

  // Resolve the actual DB property id (URL might use leadId)
  const dbPropertyId = await resolvePropertyDbId(currentPropertyId);
  if (!dbPropertyId) return [];

  const normalizedInput = phonesToCheck.map(p => normalizePhone(p));

  // Get all phones from ALL contacts across ALL properties
  const allPhones = await db
    .select({
      phoneNumber: contactPhones.phoneNumber,
      contactId: contactPhones.contactId,
    })
    .from(contactPhones);

  // Build a map: normalized phone -> contactIds
  const phoneToContactIds = new Map<string, number[]>();
  for (const row of allPhones) {
    const norm = normalizePhone(row.phoneNumber);
    if (!phoneToContactIds.has(norm)) phoneToContactIds.set(norm, []);
    phoneToContactIds.get(norm)!.push(row.contactId);
  }

  // For each input phone, find contacts that are NOT in the current property
  const results: Array<{ phone: string; propertyId: number; leadId: number | null; address: string }> = [];
  const seenProperties = new Set<string>(); // phone+propertyId dedup

  for (const normPhone of normalizedInput) {
    const contactIds = phoneToContactIds.get(normPhone);
    if (!contactIds || contactIds.length === 0) continue;

    // Get the property info for these contacts
    for (const cId of contactIds) {
      const contactRow = await db
        .select({ propertyId: contacts.propertyId })
        .from(contacts)
        .where(eq(contacts.id, cId))
        .limit(1);

      if (contactRow.length === 0) continue;
      const propId = contactRow[0].propertyId;
      if (propId === dbPropertyId) continue; // same property, skip

      const key = `${normPhone}-${propId}`;
      if (seenProperties.has(key)) continue;
      seenProperties.add(key);

      // Get property address
      const propRow = await db
        .select({
          id: properties.id,
          leadId: properties.leadId,
          addressLine1: properties.addressLine1,
          city: properties.city,
          state: properties.state,
          zipcode: properties.zipcode,
        })
        .from(properties)
        .where(eq(properties.id, propId))
        .limit(1);

      if (propRow.length > 0) {
        const p = propRow[0];
        const address = [p.addressLine1, p.city, p.state, p.zipcode].filter(Boolean).join(", ");
        results.push({
          phone: normPhone,
          propertyId: p.id,
          leadId: p.leadId,
          address: address || `Property #${p.id}`,
        });
      }
    }
  }

  return results;
}

// Helper: check which phones are duplicates within a property
export async function findDuplicatePhones(propertyId: number, newPhones: string[], excludeContactId?: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  
  const propertyContacts = await db.select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.propertyId, propertyId));
  
  if (propertyContacts.length === 0) return [];
  
  let contactIds = propertyContacts.map(c => c.id);
  if (excludeContactId) {
    contactIds = contactIds.filter(id => id !== excludeContactId);
  }
  if (contactIds.length === 0) return [];
  
  const existingPhones = await db.select({ phoneNumber: contactPhones.phoneNumber })
    .from(contactPhones)
    .where(inArray(contactPhones.contactId, contactIds));
  
  const existingNormalized = new Set(existingPhones.map(p => normalizePhone(p.phoneNumber)));
  const newNormalized = newPhones.map(p => normalizePhone(p));
  
  return newNormalized.filter(p => existingNormalized.has(p));
}

export async function createContact(contactData: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { phones, emails, addresses, ...contactBase } = contactData;
  
  // Check for duplicate phones within the same property
  if (phones && Array.isArray(phones) && phones.length > 0 && contactBase.propertyId) {
    const phoneNumbers = phones.map((p: any) => p.phoneNumber);
    const duplicates = await findDuplicatePhones(contactBase.propertyId, phoneNumbers);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate phone number(s) already exist in this property: ${duplicates.join(', ')}`);
    }
  }
  
  const result = await db.insert(contacts).values(contactBase);
  const contactId = result[0].insertId;
  
  // Add phones
  if (phones && Array.isArray(phones)) {
    for (const phone of phones) {
      await addPhone({ ...phone, contactId });
    }
  }
  
  // Add emails
  if (emails && Array.isArray(emails)) {
    for (const email of emails) {
      await addEmail({ ...email, contactId });
    }
  }
  
  // Add addresses
  if (addresses && Array.isArray(addresses)) {
    for (const address of addresses) {
      await addAddress({ ...address, contactId });
    }
  }
  
  return contactId;
}

export async function updateContact(contactId: number, contactData: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { phones, emails, addresses, ...updates } = contactData;
  
  // Check for duplicate phones within the same property (exclude current contact)
  if (phones && Array.isArray(phones) && phones.length > 0) {
    const contact = await db.select({ propertyId: contacts.propertyId }).from(contacts).where(eq(contacts.id, contactId)).limit(1);
    if (contact[0]?.propertyId) {
      const phoneNumbers = phones.map((p: any) => p.phoneNumber);
      const duplicates = await findDuplicatePhones(contact[0].propertyId, phoneNumbers, contactId);
      if (duplicates.length > 0) {
        throw new Error(`Duplicate phone number(s) already exist in this property: ${duplicates.join(', ')}`);
      }
    }
  }
  
  // Update base contact info
  if (Object.keys(updates).length > 0) {
    await db.update(contacts).set(updates).where(eq(contacts.id, contactId));
    
    // Sync DNC: when contact.dnc is toggled, also update ALL phones for this contact
    if ('dnc' in updates) {
      const dncValue = updates.dnc ? 1 : 0;
      await db.update(contactPhones).set({ dnc: dncValue }).where(eq(contactPhones.contactId, contactId));
    }
  }
  
  // Update phones (simple approach: delete and recreate)
  if (phones && Array.isArray(phones)) {
    await db.delete(contactPhones).where(eq(contactPhones.contactId, contactId));
    for (const phone of phones) {
      await addPhone({ ...phone, contactId });
    }
  }
  
  // Update emails
  if (emails && Array.isArray(emails)) {
    await db.delete(contactEmails).where(eq(contactEmails.contactId, contactId));
    for (const email of emails) {
      await addEmail({ ...email, contactId });
    }
  }
  
  // Update addresses
  if (addresses && Array.isArray(addresses)) {
    await db.delete(contactAddresses).where(eq(contactAddresses.contactId, contactId));
    for (const address of addresses) {
      await addAddress({ ...address, contactId });
    }
  }
}

export async function deleteContact(contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete related records first
  await db.delete(contactPhones).where(eq(contactPhones.contactId, contactId));
  await db.delete(contactEmails).where(eq(contactEmails.contactId, contactId));
  await db.delete(contactAddresses).where(eq(contactAddresses.contactId, contactId));
  await db.delete(contactSocialMedia).where(eq(contactSocialMedia.contactId, contactId));
  await db.delete(communicationLog).where(eq(communicationLog.contactId, contactId));
  
  // Delete the contact
  await db.delete(contacts).where(eq(contacts.id, contactId));
}

/**
 * Contact Phone Functions
 */

export async function getPhonesByContact(contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select({ id: contactPhones.id, contactId: contactPhones.contactId, phoneNumber: contactPhones.phoneNumber, phoneType: contactPhones.phoneType }).from(contactPhones).where(eq(contactPhones.contactId, contactId));
}

export async function addPhone(phone: InsertContactPhone) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contactPhones).values(phone);
  return result[0].insertId;
}

export async function updatePhone(phoneId: number, updates: Partial<InsertContactPhone>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(contactPhones).set(updates).where(eq(contactPhones.id, phoneId));
}

export async function deletePhone(phoneId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(contactPhones).where(eq(contactPhones.id, phoneId));
}

/**
 * Contact Email Functions
 */

export async function getEmailsByContact(contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select({ id: contactEmails.id, contactId: contactEmails.contactId, email: contactEmails.email }).from(contactEmails).where(eq(contactEmails.contactId, contactId));
}

export async function addEmail(email: InsertContactEmail) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contactEmails).values(email);
  return result[0].insertId;
}

export async function updateEmail(emailId: number, updates: Partial<InsertContactEmail>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(contactEmails).set(updates).where(eq(contactEmails.id, emailId));
}

export async function deleteEmail(emailId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(contactEmails).where(eq(contactEmails.id, emailId));
}

/**
 * Contact Social Media Functions
 */

export async function getSocialMediaByContact(contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select({ id: contactSocialMedia.id, contactId: contactSocialMedia.contactId, platform: contactSocialMedia.platform, handle: contactSocialMedia.profileUrl }).from(contactSocialMedia).where(eq(contactSocialMedia.contactId, contactId));
}

export async function addSocialMedia(social: InsertContactSocialMedia) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contactSocialMedia).values(social);
  return result[0].insertId;
}

export async function updateSocialMedia(socialId: number, updates: Partial<InsertContactSocialMedia>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(contactSocialMedia).set(updates).where(eq(contactSocialMedia.id, socialId));
}

export async function deleteSocialMedia(socialId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(contactSocialMedia).where(eq(contactSocialMedia.id, socialId));
}

/**
 * Communication Log Functions
 */

export async function getCommunicationLogByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { users } = await import("../drizzle/schema.js");
  
  const logs = await db
    .select({
      id: communicationLog.id,
      propertyId: communicationLog.propertyId,
      contactId: communicationLog.contactId,
      communicationType: communicationLog.communicationType,
      callResult: communicationLog.callResult,
      direction: communicationLog.direction,
      mood: communicationLog.mood,
      disposition: communicationLog.disposition,
      propertyDetails: communicationLog.propertyDetails,
      notes: communicationLog.notes,
      nextStep: communicationLog.nextStep,
      twilioNumber: communicationLog.twilioNumber,
      contactPhoneNumber: communicationLog.contactPhoneNumber,
      userId: communicationLog.userId,
      communicationDate: communicationLog.communicationDate,
      createdAt: communicationLog.createdAt,
      userName: users.name,
    })
    .from(communicationLog)
    .leftJoin(users, eq(communicationLog.userId, users.id))
    .where(eq(communicationLog.propertyId, propertyId))
    .orderBy(desc(communicationLog.communicationDate));
  
  return logs;
}

export async function getCommunicationLogByContact(contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select({
      id: communicationLog.id,
      contactId: communicationLog.contactId,
      communicationType: communicationLog.communicationType,
      communicationDate: communicationLog.communicationDate,
      callResult: communicationLog.callResult,
      mood: communicationLog.mood,
      disposition: communicationLog.disposition,
      propertyDetails: communicationLog.propertyDetails,
      notes: communicationLog.notes,
    })
    .from(communicationLog)
    .where(eq(communicationLog.contactId, contactId))
    .orderBy(desc(communicationLog.communicationDate));
}

export async function addCommunicationLog(log: InsertCommunicationLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(communicationLog).values(log);
  return result[0].insertId;
}

export async function updateCommunicationLog(logId: number, updates: Partial<InsertCommunicationLog>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(communicationLog).set(updates).where(eq(communicationLog.id, logId));
}

export async function deleteCommunicationLog(logId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(communicationLog).where(eq(communicationLog.id, logId));
}

/**
 * Get full contact details with all related data
 */
export async function getContactWithDetails(contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const contact = await getContactById(contactId);
  if (!contact) return null;
  
  const [phones, emails, addresses, socialMedia, communications] = await Promise.all([
    getPhonesByContact(contactId),
    getEmailsByContact(contactId),
    getAddressesByContact(contactId),
    getSocialMediaByContact(contactId),
    getCommunicationLogByContact(contactId),
  ]);
  
  return {
    ...contact,
    phones,
    emails,
    addresses,
    socialMedia,
    communications,
  };
}

/**
 * Get all contacts for a property with their details
 */
export async function getPropertyContactsWithDetails(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const propertyContacts = await getContactsByProperty(propertyId);
  
  const contactsWithDetails = await Promise.all(
    propertyContacts.map(async (contact) => {
      const [phones, emails, addresses, socialMedia] = await Promise.all([
        getPhonesByContact(contact.id),
        getEmailsByContact(contact.id),
        getAddressesByContact(contact.id),
        getSocialMediaByContact(contact.id),
      ]);
      
      return {
        ...contact,
        phones,
        emails,
        addresses,
        socialMedia,
      };
    })
  );
  
  return contactsWithDetails;
}

/**
 * Contact Address Functions
 */

export async function getAddressesByContact(contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select({ id: contactAddresses.id, contactId: contactAddresses.contactId, address: contactAddresses.addressLine1, city: contactAddresses.city, state: contactAddresses.state, zipcode: contactAddresses.zipcode }).from(contactAddresses).where(eq(contactAddresses.contactId, contactId));
}

export async function addAddress(address: InsertContactAddress) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contactAddresses).values(address);
  return result[0].insertId;
}

export async function updateAddress(addressId: number, updates: Partial<InsertContactAddress>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(contactAddresses).set(updates).where(eq(contactAddresses.id, addressId));
}

export async function deleteAddress(addressId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(contactAddresses).where(eq(contactAddresses.id, addressId));
}

/**
 * Bulk Operations
 */

export async function bulkMarkDNC(contactIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Update dnc field to 1 for all specified contacts
  await db.update(contacts)
    .set({ dnc: 1 })
    .where(inArray(contacts.id, contactIds));
}

export async function bulkDeleteContacts(contactIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete related records first for all contacts
  await db.delete(contactPhones).where(inArray(contactPhones.contactId, contactIds));
  await db.delete(contactEmails).where(inArray(contactEmails.contactId, contactIds));
  await db.delete(contactSocialMedia).where(inArray(contactSocialMedia.contactId, contactIds));
  await db.delete(communicationLog).where(inArray(communicationLog.contactId, contactIds));
  
  // Delete all contacts
  await db.delete(contacts).where(inArray(contacts.id, contactIds));
}

/**
 * Toggle DNC flag on a specific phone number
 */
export async function togglePhoneDNC(phoneId: number, dnc: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Update the phone's DNC flag
  await db.update(contactPhones)
    .set({ dnc: dnc ? 1 : 0 })
    .where(eq(contactPhones.id, phoneId));
  
  // Sync contact.dnc: find the contact that owns this phone
  const phoneRow = await db.select({ contactId: contactPhones.contactId })
    .from(contactPhones)
    .where(eq(contactPhones.id, phoneId))
    .limit(1);
  
  if (phoneRow.length > 0) {
    const contactId = phoneRow[0].contactId;
    
    if (dnc) {
      // If marking a phone as DNC, also mark the contact as DNC
      await db.update(contacts)
        .set({ dnc: 1 })
        .where(eq(contacts.id, contactId));
    } else {
      // If unmarking a phone, check if ALL phones for this contact are now non-DNC
      const allPhones = await db.select({ dnc: contactPhones.dnc })
        .from(contactPhones)
        .where(eq(contactPhones.contactId, contactId));
      
      const anyStillDNC = allPhones.some(p => p.dnc === 1);
      if (!anyStillDNC) {
        // All phones are non-DNC, so unmark the contact too
        await db.update(contacts)
          .set({ dnc: 0 })
          .where(eq(contacts.id, contactId));
      }
    }
  }
}

/**
 * Mark ALL contacts and ALL their phones as DNC for a property.
 * Also updates the property desk status to DEAD.
 */
export async function markPropertyDNC(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const dbPropertyId = await resolvePropertyDbId(propertyId);
  if (!dbPropertyId) throw new Error("Property not found");
  
  // Get all contacts for this property
  const propertyContacts = await db.select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.propertyId, dbPropertyId));
  
  if (propertyContacts.length > 0) {
    const contactIds = propertyContacts.map(c => c.id);
    
    // Mark all contacts as DNC
    await db.update(contacts)
      .set({ dnc: 1 })
      .where(inArray(contacts.id, contactIds));
    
    // Mark all phones of these contacts as DNC
    await db.update(contactPhones)
      .set({ dnc: 1 })
      .where(inArray(contactPhones.contactId, contactIds));
  }
  
// Update property desk status and desk name to DEAD
   await db.update(properties)
    .set({ deskStatus: "DEAD", deskName: "DEAD" })
    .where(eq(properties.id, dbPropertyId));
}

/**
 * Unmark DNC for ALL contacts and ALL their phones for a property.
 * Also updates the property desk status to ACTIVE.
 */
export async function unmarkPropertyDNC(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const dbPropertyId = await resolvePropertyDbId(propertyId);
  if (!dbPropertyId) throw new Error("Property not found");
  
  // Get all contacts for this property
  const propertyContacts = await db.select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.propertyId, dbPropertyId));
  
  if (propertyContacts.length > 0) {
    const contactIds = propertyContacts.map(c => c.id);
    
    // Unmark all contacts DNC
    await db.update(contacts)
      .set({ dnc: 0 })
      .where(inArray(contacts.id, contactIds));
    
    // Unmark all phones DNC
    await db.update(contactPhones)
      .set({ dnc: 0 })
      .where(inArray(contactPhones.contactId, contactIds));
  }
  
  // Update property desk status to ACTIVE and reset desk name
  await db.update(properties)
    .set({ deskStatus: "ACTIVE", deskName: "NEW_LEAD" })
    .where(eq(properties.id, dbPropertyId));
}


/**
 * Get call history with filters for the Call History page.
 * Returns all phone communication logs with property and user info.
 */
export async function getCallHistory(filters: {
  direction?: "Inbound" | "Outbound" | "all";
  callResult?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { users } = await import("../drizzle/schema.js");

  const conditions: any[] = [
    eq(communicationLog.communicationType, "Phone"),
  ];

  if (filters.direction && filters.direction !== "all") {
    conditions.push(eq(communicationLog.direction, filters.direction));
  }

  if (filters.callResult) {
    conditions.push(eq(communicationLog.callResult, filters.callResult as any));
  }

  if (filters.userId) {
    conditions.push(eq(communicationLog.userId, filters.userId));
  }

  if (filters.dateFrom) {
    const { gte } = await import("drizzle-orm");
    conditions.push(gte(communicationLog.communicationDate, filters.dateFrom));
  }

  if (filters.dateTo) {
    const { lte } = await import("drizzle-orm");
    conditions.push(lte(communicationLog.communicationDate, filters.dateTo));
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const logs = await db
    .select({
      id: communicationLog.id,
      propertyId: communicationLog.propertyId,
      contactId: communicationLog.contactId,
      communicationType: communicationLog.communicationType,
      callResult: communicationLog.callResult,
      direction: communicationLog.direction,
      mood: communicationLog.mood,
      disposition: communicationLog.disposition,
      notes: communicationLog.notes,
      nextStep: communicationLog.nextStep,
      twilioNumber: communicationLog.twilioNumber,
      contactPhoneNumber: communicationLog.contactPhoneNumber,
      userId: communicationLog.userId,
      communicationDate: communicationLog.communicationDate,
      createdAt: communicationLog.createdAt,
      userName: users.name,
      propertyAddress: properties.addressLine1,
      propertyCity: properties.city,
      propertyState: properties.state,
      propertyLeadId: properties.leadId,
    })
    .from(communicationLog)
    .leftJoin(users, eq(communicationLog.userId, users.id))
    .leftJoin(properties, eq(communicationLog.propertyId, properties.id))
    .where(whereClause)
    .orderBy(desc(communicationLog.communicationDate))
    .limit(filters.limit || 100)
    .offset(filters.offset || 0);

  // If search filter, apply in-memory filtering on address/notes
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    return logs.filter(
      (log) =>
        (log.propertyAddress && log.propertyAddress.toLowerCase().includes(searchLower)) ||
        (log.notes && log.notes.toLowerCase().includes(searchLower)) ||
        (log.userName && log.userName.toLowerCase().includes(searchLower)) ||
        (log.callResult && log.callResult.toLowerCase().includes(searchLower))
    );
  }

  return logs;
}

/**
 * Get call history stats (total calls, inbound, outbound, by result).
 */
export async function getCallHistoryStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allCalls = await db
    .select({
      direction: communicationLog.direction,
      callResult: communicationLog.callResult,
    })
    .from(communicationLog)
    .where(eq(communicationLog.communicationType, "Phone"));

  const total = allCalls.length;
  const inbound = allCalls.filter((c) => c.direction === "Inbound").length;
  const outbound = allCalls.filter((c) => c.direction === "Outbound").length;

  // Count by call result
  const byResult: Record<string, number> = {};
  for (const call of allCalls) {
    const result = call.callResult || "No Result";
    byResult[result] = (byResult[result] || 0) + 1;
  }

  return { total, inbound, outbound, byResult };
}


// ─── Unified Communications Log (Calls + SMS) ─────────────────────────────

export type UnifiedCommRecord = {
  id: number;
  type: "call" | "sms";
  direction: "Inbound" | "Outbound";
  phoneNumber: string | null;
  twilioNumber: string | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyLeadId: number | null;
  propertyId: number | null;
  agentName: string | null;
  date: Date;
  // SMS-specific
  messageBody: string | null;
  messageStatus: string | null;
  // Call-specific
  callResult: string | null;
  disposition: string | null;
};

/**
 * Returns a unified list of calls and SMS, sorted by date descending.
 */
export async function getUnifiedCommunications(filters: {
  commType?: "call" | "sms" | "all";
  direction?: "Inbound" | "Outbound" | "all";
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: number;
  limit?: number;
  offset?: number;
}): Promise<UnifiedCommRecord[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { users, smsMessages } = await import("../drizzle/schema.js");
  const { gte, lte } = await import("drizzle-orm");

  const limit = filters.limit || 200;
  const offset = filters.offset || 0;

  let callRecords: UnifiedCommRecord[] = [];
  let smsRecords: UnifiedCommRecord[] = [];

  // ── Fetch CALL records ──
  if (filters.commType === "all" || filters.commType === "call" || !filters.commType) {
    const callConditions: any[] = [
      eq(communicationLog.communicationType, "Phone"),
    ];

    if (filters.direction && filters.direction !== "all") {
      callConditions.push(eq(communicationLog.direction, filters.direction));
    }

    if (filters.userId) {
      callConditions.push(eq(communicationLog.userId, filters.userId));
    }

    if (filters.dateFrom) {
      callConditions.push(gte(communicationLog.communicationDate, filters.dateFrom));
    }

    if (filters.dateTo) {
      callConditions.push(lte(communicationLog.communicationDate, filters.dateTo));
    }

    const callWhere = callConditions.length > 1 ? and(...callConditions) : callConditions[0];

    const rawCalls = await db
      .select({
        id: communicationLog.id,
        direction: communicationLog.direction,
        phoneNumber: communicationLog.contactPhoneNumber,
        twilioNumber: communicationLog.twilioNumber,
        propertyAddress: properties.addressLine1,
        propertyCity: properties.city,
        propertyState: properties.state,
        propertyLeadId: properties.leadId,
        propertyId: communicationLog.propertyId,
        agentName: users.name,
        date: communicationLog.communicationDate,
        callResult: communicationLog.callResult,
        disposition: communicationLog.disposition,
      })
      .from(communicationLog)
      .leftJoin(users, eq(communicationLog.userId, users.id))
      .leftJoin(properties, eq(communicationLog.propertyId, properties.id))
      .where(callWhere)
      .orderBy(desc(communicationLog.communicationDate));

    callRecords = rawCalls.map((c) => ({
      id: c.id,
      type: "call" as const,
      direction: (c.direction || "Outbound") as "Inbound" | "Outbound",
      phoneNumber: c.phoneNumber,
      twilioNumber: c.twilioNumber,
      propertyAddress: c.propertyAddress,
      propertyCity: c.propertyCity,
      propertyState: c.propertyState,
      propertyLeadId: c.propertyLeadId,
      propertyId: c.propertyId,
      agentName: c.agentName,
      date: c.date,
      messageBody: null,
      messageStatus: null,
      callResult: c.callResult,
      disposition: c.disposition,
    }));
  }

  // ── Fetch SMS records ──
  if (filters.commType === "all" || filters.commType === "sms" || !filters.commType) {
    const smsConditions: any[] = [];

    if (filters.direction && filters.direction !== "all") {
      // smsMessages uses lowercase direction, normalize
      const smsDir = filters.direction.toLowerCase() as "inbound" | "outbound";
      smsConditions.push(eq(smsMessages.direction, smsDir));
    }

    if (filters.userId) {
      smsConditions.push(eq(smsMessages.sentByUserId, filters.userId));
    }

    if (filters.dateFrom) {
      smsConditions.push(gte(smsMessages.createdAt, filters.dateFrom));
    }

    if (filters.dateTo) {
      smsConditions.push(lte(smsMessages.createdAt, filters.dateTo));
    }

    const smsWhere = smsConditions.length > 0
      ? (smsConditions.length > 1 ? and(...smsConditions) : smsConditions[0])
      : undefined;

    const rawSms = await db
      .select({
        id: smsMessages.id,
        direction: smsMessages.direction,
        phoneNumber: smsMessages.contactPhone,
        twilioNumber: smsMessages.twilioPhone,
        propertyAddress: properties.addressLine1,
        propertyCity: properties.city,
        propertyState: properties.state,
        propertyLeadId: properties.leadId,
        propertyId: smsMessages.propertyId,
        agentName: smsMessages.sentByName,
        date: smsMessages.createdAt,
        body: smsMessages.body,
        status: smsMessages.status,
      })
      .from(smsMessages)
      .leftJoin(properties, eq(smsMessages.propertyId, properties.id))
      .where(smsWhere)
      .orderBy(desc(smsMessages.createdAt));

    smsRecords = rawSms.map((s) => ({
      id: s.id,
      type: "sms" as const,
      direction: (s.direction === "inbound" ? "Inbound" : "Outbound") as "Inbound" | "Outbound",
      phoneNumber: s.phoneNumber,
      twilioNumber: s.twilioNumber,
      propertyAddress: s.propertyAddress,
      propertyCity: s.propertyCity,
      propertyState: s.propertyState,
      propertyLeadId: s.propertyLeadId,
      propertyId: s.propertyId,
      agentName: s.agentName,
      date: s.date,
      messageBody: s.body,
      messageStatus: s.status,
      callResult: null,
      disposition: null,
    }));
  }

  // ── Merge and sort by date DESC ──
  let merged = [...callRecords, ...smsRecords].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // ── Apply search filter (in-memory) ──
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    merged = merged.filter(
      (r) =>
        (r.phoneNumber && r.phoneNumber.toLowerCase().includes(searchLower)) ||
        (r.propertyAddress && r.propertyAddress.toLowerCase().includes(searchLower)) ||
        (r.agentName && r.agentName.toLowerCase().includes(searchLower)) ||
        (r.messageBody && r.messageBody.toLowerCase().includes(searchLower)) ||
        (r.callResult && r.callResult.toLowerCase().includes(searchLower))
    );
  }

  // ── Paginate ──
  return merged.slice(offset, offset + limit);
}

/**
 * Get unified communication stats (calls + SMS).
 */
export async function getUnifiedCommStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { smsMessages } = await import("../drizzle/schema.js");

  // Call stats
  const allCalls = await db
    .select({
      direction: communicationLog.direction,
      callResult: communicationLog.callResult,
    })
    .from(communicationLog)
    .where(eq(communicationLog.communicationType, "Phone"));

  const totalCalls = allCalls.length;
  const inboundCalls = allCalls.filter((c) => c.direction === "Inbound").length;
  const outboundCalls = allCalls.filter((c) => c.direction === "Outbound").length;

  // SMS stats
  const allSms = await db
    .select({
      direction: smsMessages.direction,
      status: smsMessages.status,
    })
    .from(smsMessages);

  const totalSms = allSms.length;
  const inboundSms = allSms.filter((s) => s.direction === "inbound").length;
  const outboundSms = allSms.filter((s) => s.direction === "outbound").length;

  return {
    totalCalls,
    inboundCalls,
    outboundCalls,
    totalSms,
    inboundSms,
    outboundSms,
    totalAll: totalCalls + totalSms,
    inboundAll: inboundCalls + inboundSms,
    outboundAll: outboundCalls + outboundSms,
  };
}
