import { eq, desc, inArray } from "drizzle-orm";
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
  
  const contactsData = await db.select({ id: contacts.id, propertyId: contacts.propertyId, name: contacts.name, relationship: contacts.relationship, phone1: contacts.phone1, phone2: contacts.phone2, phone3: contacts.phone3, email1: contacts.email1, email2: contacts.email2, email3: contacts.email3 }).from(contacts).where(eq(contacts.propertyId, dbPropertyId));
  
  // For each contact, fetch phones, emails, and addresses
  const contactsWithDetails = await Promise.all(
    contactsData.map(async (contact) => {
      const [phones, emails, addresses] = await Promise.all([
        db.select({ id: contactPhones.id, contactId: contactPhones.contactId, phoneNumber: contactPhones.phoneNumber, phoneType: contactPhones.phoneType }).from(contactPhones).where(eq(contactPhones.contactId, contact.id)),
        db.select({ id: contactEmails.id, contactId: contactEmails.contactId, email: contactEmails.email }).from(contactEmails).where(eq(contactEmails.contactId, contact.id)),
        db.select({ id: contactAddresses.id, contactId: contactAddresses.contactId, address: contactAddresses.address, city: contactAddresses.city, state: contactAddresses.state, zipcode: contactAddresses.zipcode }).from(contactAddresses).where(eq(contactAddresses.contactId, contact.id)),
      ]);
      
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
  
  const result = await db.select({ id: contacts.id, propertyId: contacts.propertyId, name: contacts.name, relationship: contacts.relationship, phone1: contacts.phone1, phone2: contacts.phone2, phone3: contacts.phone3, email1: contacts.email1, email2: contacts.email2, email3: contacts.email3 }).from(contacts).where(eq(contacts.id, contactId)).limit(1);
  return result[0] || null;
}

export async function createContact(contactData: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { phones, emails, addresses, ...contactBase } = contactData;
  
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
  
  // Update base contact info
  if (Object.keys(updates).length > 0) {
    await db.update(contacts).set(updates).where(eq(contacts.id, contactId));
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
  
  return await db.select({ id: contactSocialMedia.id, contactId: contactSocialMedia.contactId, platform: contactSocialMedia.platform, handle: contactSocialMedia.handle }).from(contactSocialMedia).where(eq(contactSocialMedia.contactId, contactId));
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
      notes: communicationLog.notes,
      nextStep: communicationLog.nextStep,
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
    .select({ id: communicationLog.id, contactId: communicationLog.contactId, communicationType: communicationLog.communicationType, communicationDate: communicationLog.communicationDate, notes: communicationLog.notes })
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
  
  return await db.select({ id: contactAddresses.id, contactId: contactAddresses.contactId, address: contactAddresses.address, city: contactAddresses.city, state: contactAddresses.state, zipcode: contactAddresses.zipcode }).from(contactAddresses).where(eq(contactAddresses.contactId, contactId));
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
