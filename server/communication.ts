import { eq, desc, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  contacts,
  contactPhones,
  contactEmails,
  contactSocialMedia,
  communicationLog,
  InsertContact,
  InsertContactPhone,
  InsertContactEmail,
  InsertContactSocialMedia,
  InsertCommunicationLog,
} from "../drizzle/schema";

/**
 * Contact Management Functions
 */

export async function getContactsByProperty(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const contactsData = await db.select().from(contacts).where(eq(contacts.propertyId, propertyId));
  
  // For each contact, fetch phones from BOTH sources:
  // 1. phone1/phone2/phone3 fields in contacts table
  // 2. contactPhones table (separate phone records)
  const contactsWithPhones = await Promise.all(
    contactsData.map(async (contact) => {
      const phones = [];
      
      // Add phones from phone1/phone2/phone3 fields
      if (contact.phone1) {
        phones.push({ phoneNumber: contact.phone1, phoneType: contact.phone1Type || 'Mobile' });
      }
      if (contact.phone2) {
        phones.push({ phoneNumber: contact.phone2, phoneType: contact.phone2Type || 'Mobile' });
      }
      if (contact.phone3) {
        phones.push({ phoneNumber: contact.phone3, phoneType: contact.phone3Type || 'Mobile' });
      }
      
      // Add phones from contactPhones table
      const additionalPhones = await db.select().from(contactPhones).where(eq(contactPhones.contactId, contact.id));
      additionalPhones.forEach(phone => {
        phones.push({ phoneNumber: phone.phoneNumber, phoneType: phone.phoneType });
      });
      
      return {
        ...contact,
        phones
      };
    })
  );
  
  return contactsWithPhones;
}

export async function getContactById(contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  return result[0] || null;
}

export async function createContact(contact: InsertContact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contacts).values(contact);
  return result[0].insertId;
}

export async function updateContact(contactId: number, updates: Partial<InsertContact>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(contacts).set(updates).where(eq(contacts.id, contactId));
}

export async function deleteContact(contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete related records first
  await db.delete(contactPhones).where(eq(contactPhones.contactId, contactId));
  await db.delete(contactEmails).where(eq(contactEmails.contactId, contactId));
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
  
  return await db.select().from(contactPhones).where(eq(contactPhones.contactId, contactId));
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
  
  return await db.select().from(contactEmails).where(eq(contactEmails.contactId, contactId));
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
  
  return await db.select().from(contactSocialMedia).where(eq(contactSocialMedia.contactId, contactId));
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
    .select()
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
  
  const [phones, emails, socialMedia, communications] = await Promise.all([
    getPhonesByContact(contactId),
    getEmailsByContact(contactId),
    getSocialMediaByContact(contactId),
    getCommunicationLogByContact(contactId),
  ]);
  
  return {
    ...contact,
    phones,
    emails,
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
      const [phonesFromTable, emails, socialMedia] = await Promise.all([
        getPhonesByContact(contact.id),
        getEmailsByContact(contact.id),
        getSocialMediaByContact(contact.id),
      ]);
      
      // MERGE phones from BOTH sources:
      // 1. contact.phones array (from phone1/phone2/phone3 fields) - already created by getContactsByProperty
      // 2. phonesFromTable (from contactPhones table)
      const phonesFromFields = contact.phones || [];
      const phonesFromContactTable = phonesFromTable.map(p => ({ phoneNumber: p.phoneNumber, phoneType: p.phoneType || 'Mobile' }));
      
      // Deduplicate: only add phones from contactPhones table if they don't already exist in phone1/phone2/phone3
      const allPhones = [...phonesFromFields];
      phonesFromContactTable.forEach(phone => {
        const exists = allPhones.some(existing => 
          existing.phoneNumber.replace(/\D/g, '') === phone.phoneNumber.replace(/\D/g, '')
        );
        if (!exists) {
          allPhones.push(phone);
        }
      });
      
      const mergedPhones = allPhones;
      
      return {
        ...contact,
        phones: mergedPhones,
        emails,
        socialMedia,
        // Preserve phone fields from contact table
        phone1: contact.phone1,
        phone1Type: contact.phone1Type,
        phone2: contact.phone2,
        phone2Type: contact.phone2Type,
        phone3: contact.phone3,
        phone3Type: contact.phone3Type,
      };
    })
  );
  
  return contactsWithDetails;
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
