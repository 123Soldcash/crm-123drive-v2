import { eq, and, like, desc, sql, gte, lte, or, isNotNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, savedSearches, InsertSavedSearch, properties, InsertProperty, contacts, notes, InsertNote, visits, InsertVisit, photos, InsertPhoto, propertyTags, InsertPropertyTag, propertyAgents, InsertPropertyAgent, leadTransfers, InsertLeadTransfer, propertyDeepSearch, tasks, InsertTask, taskComments, InsertTaskComment, agents, leadAssignments, stageHistory, contactPhones, InsertContactPhone, contactEmails, InsertContactEmail, contactAddresses, InsertContactAddress } from "../drizzle/schema";
import { ENV } from './_core/env';

import * as schema from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL, { schema, mode: 'default' });
      if (!_db.query) {
        console.error("[Database] Query API not initialized - schema missing?");
        throw new Error("Drizzle query API not available");
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    textFields.forEach(field => {
      const value = user[field];
      if (value !== undefined) {
        const normalized = value ?? null;
        values[field] = normalized;
        updateSet[field] = normalized;
      }
    });
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listAgents() {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: users.id,
    openId: users.openId,
    name: users.name,
    email: users.email,
    phone: users.phone,
    role: users.role,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).where(ne(users.role, 'admin')).orderBy(users.name);
}

export async function getProperties(filters?: any) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(properties);
  const conditions = [];
  if (filters?.userId && filters?.userRole !== 'admin') {
    conditions.push(eq(properties.assignedAgentId, filters.userId));
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(or(
      like(properties.addressLine1, searchTerm),
      like(properties.owner1Name, searchTerm)
    ));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return await query.orderBy(desc(properties.createdAt));
}

export async function getPropertyById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const propertyResult = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  if (propertyResult.length === 0) return null;
  
  const property = propertyResult[0];
  const propertyContacts = await db.select().from(contacts).where(eq(contacts.propertyId, id));

  const contactsWithDetails = await Promise.all(
    propertyContacts.map(async (contact) => {
      const [phones, emails, addresses] = await Promise.all([
        db.select().from(contactPhones).where(eq(contactPhones.contactId, contact.id)),
        db.select().from(contactEmails).where(eq(contactEmails.contactId, contact.id)),
        db.select().from(contactAddresses).where(eq(contactAddresses.contactId, contact.id)),
      ]);
      return { ...contact, phones, emails, addresses };
    })
  );

  const deepSearchResult = await db.select().from(propertyDeepSearch).where(eq(propertyDeepSearch.propertyId, id)).limit(1);
  const propertyNotes = await db.select().from(notes).where(eq(notes.propertyId, id)).orderBy(desc(notes.createdAt));
  const propertyTasks = await db.select().from(tasks).where(eq(tasks.propertyId, id)).orderBy(desc(tasks.createdAt));

  return {
    ...property,
    contacts: contactsWithDetails,
    notes: propertyNotes,
    tasks: propertyTasks,
    deepSearch: deepSearchResult[0] || null,
  };
}

export async function getPropertyNotes(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notes).where(eq(notes.propertyId, propertyId)).orderBy(desc(notes.createdAt));
}

export async function addPropertyNote(note: InsertNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(notes).values(note);
}

export async function getPropertyTasks(propertyId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tasks).where(eq(tasks.propertyId, propertyId)).orderBy(desc(tasks.createdAt));
}

export async function addPropertyTask(task: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(tasks).values(task);
}
