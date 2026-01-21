import { eq, and, like, desc, sql, gte, lte, or, isNotNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, savedSearches, InsertSavedSearch, properties, InsertProperty, contacts, notes, InsertNote, visits, InsertVisit, photos, InsertPhoto, propertyTags, InsertPropertyTag, propertyAgents, InsertPropertyAgent, leadTransfers, InsertLeadTransfer, propertyDeepSearch, tasks, InsertTask, taskComments, InsertTaskComment, agents, leadAssignments, stageHistory, contactPhones, InsertContactPhone, contactEmails, InsertContactEmail, contactAddresses, InsertContactAddress } from "../drizzle/schema";
import { ENV } from './_core/env';

import * as schema from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // ✅ CRITICAL: Pass schema to enable db.query.* relational API
      _db = drizzle(process.env.DATABASE_URL, { schema, mode: 'default' });
      
      // Defensive check to catch configuration issues early
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
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

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

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function listAgents() {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(ne(users.role, 'admin'))
    .orderBy(users.name);

  return result;
}

// Property queries
export async function getProperties(filters?: {
  search?: string;
  ownerLocation?: string;
  minEquity?: number;
  maxEquity?: number;
  trackingStatus?: string;
  leadTemperature?: "SUPER HOT" | "HOT" | "WARM" | "COLD" | "DEAD";
  ownerVerified?: boolean;
  visited?: boolean;
  userId?: number;
  userRole?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select({
    id: properties.id,
    leadId: properties.leadId,
    addressLine1: properties.addressLine1,
    addressLine2: properties.addressLine2,
    city: properties.city,
    state: properties.state,
    zipcode: properties.zipcode,
    owner1Name: properties.owner1Name,
    owner2Name: properties.owner2Name,
    estimatedValue: properties.estimatedValue,
    equityPercent: properties.equityPercent,
    leadTemperature: properties.leadTemperature,
    trackingStatus: properties.trackingStatus,
    ownerVerified: properties.ownerVerified,
    assignedAgentId: properties.assignedAgentId,
    marketStatus: properties.marketStatus,
    dealMachineRawData: properties.dealMachineRawData,
    apnParcelId: properties.apnParcelId,
    propertyId: properties.propertyId,
    createdAt: properties.createdAt,
  }).from(properties);
  const conditions = [];

  // Agent filtering: non-admin users only see their assigned properties
  if (filters?.userId && filters?.userRole !== 'admin') {
    conditions.push(eq(properties.assignedAgentId, filters.userId));
  }

  if (filters?.ownerLocation) {
    conditions.push(eq(properties.ownerLocation, filters.ownerLocation));
  }
  if (filters?.minEquity !== undefined) {
    conditions.push(gte(properties.equityPercent, filters.minEquity));
  }
  if (filters?.maxEquity !== undefined) {
    conditions.push(lte(properties.equityPercent, filters.maxEquity));
  }

  if (filters?.trackingStatus) {
    conditions.push(eq(properties.marketStatus, filters.trackingStatus as any));
  }
  if (filters?.leadTemperature) {
    conditions.push(eq(properties.leadTemperature, filters.leadTemperature));
  }
  if (filters?.ownerVerified === true) {
    conditions.push(eq(properties.ownerVerified, 1));
  }
  // Note: visited filter requires joining with visits table - handled separately
  // Handle search separately - need to search in both properties and contacts
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    
    // First, search in properties table
    const propertyMatches = await db
      .select({ id: properties.id })
      .from(properties)
      .where(
        or(
          like(properties.addressLine1, searchTerm),
          like(properties.city, searchTerm),
          like(properties.state, searchTerm),
          like(properties.zipcode, searchTerm),
          like(properties.owner1Name, searchTerm),
          like(properties.owner2Name, searchTerm)
        )
      );
    
    // Then, search in contacts table (name)
    const contactMatches = await db
      .select({ propertyId: contacts.propertyId })
      .from(contacts)
      .where(like(contacts.name, searchTerm));
    
    // Search in contactPhones table
    const phoneMatches = await db
      .select({ propertyId: contacts.propertyId })
      .from(contactPhones)
      .leftJoin(contacts, eq(contactPhones.contactId, contacts.id))
      .where(and(like(contactPhones.phoneNumber, searchTerm), isNotNull(contacts.propertyId)));
      
    // Search in contactEmails table
    const emailMatches = await db
      .select({ propertyId: contacts.propertyId })
      .from(contactEmails)
      .leftJoin(contacts, eq(contactEmails.contactId, contacts.id))
      .where(and(like(contactEmails.email, searchTerm), isNotNull(contacts.propertyId)));
    
    // Combine unique property IDs from all searches
    const propertyIdsFromProperties = propertyMatches.map(p => p.id);
    const propertyIdsFromContacts = contactMatches.map(c => c.propertyId);
    const propertyIdsFromPhones = phoneMatches.map(p => p.propertyId);
    const propertyIdsFromEmails = emailMatches.map(e => e.propertyId);
    const searchPropertyIds = Array.from(new Set([
      ...propertyIdsFromProperties, 
      ...propertyIdsFromContacts,
      ...propertyIdsFromPhones,
      ...propertyIdsFromEmails
    ]));
    
    if (searchPropertyIds.length === 0) {
      return []; // No matches found
    }
    conditions.push(sql`${properties.id} IN (${sql.join(searchPropertyIds.map(id => sql`${id}`), sql`, `)})`);
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = await query.orderBy(desc(properties.estimatedValue));
  return results;
}


// Alias function for backward compatibility - the router calls getPropertiesWithAgents
export async function getPropertiesWithAgents(filters?: {
  search?: string;
  ownerLocation?: string;
  minEquity?: number;
  maxEquity?: number;
  trackingStatus?: string;
  leadTemperature?: "SUPER HOT" | "HOT" | "WARM" | "COLD" | "DEAD";
  ownerVerified?: boolean;
  visited?: boolean;
  userId?: number;
  userRole?: string;
}) {
  // Simply call getProperties - the agent filtering logic is already there
  return await getProperties(filters);
}

export async function getPropertyById(id: number) {
  const db = await getDb();
  if (!db) return null;

  // First get the property with ALL fields
  // Try to find by leadId first (since URLs use leadId), then fall back to database id
  let propertyResult = await db.select({
    id: properties.id,
    leadId: properties.leadId,
    addressLine1: properties.addressLine1,
    addressLine2: properties.addressLine2,
    city: properties.city,
    state: properties.state,
    zipcode: properties.zipcode,
    owner1Name: properties.owner1Name,
    owner2Name: properties.owner2Name,
    estimatedValue: properties.estimatedValue,
    equityAmount: properties.equityAmount,
    equityPercent: properties.equityPercent,
    mortgageAmount: properties.mortgageAmount,
    totalLoanBalance: properties.totalLoanBalance,
    taxAmount: properties.taxAmount,
    leadTemperature: properties.leadTemperature,
    trackingStatus: properties.trackingStatus,
    ownerVerified: properties.ownerVerified,
    assignedAgentId: properties.assignedAgentId,
    marketStatus: properties.marketStatus,
    dealMachineRawData: properties.dealMachineRawData,
    apnParcelId: properties.apnParcelId,
    propertyId: properties.propertyId,
    propertyType: properties.propertyType,
    totalBedrooms: properties.totalBedrooms,
    totalBaths: properties.totalBaths,
    buildingSquareFeet: properties.buildingSquareFeet,
    yearBuilt: properties.yearBuilt,
    ownerLocation: properties.ownerLocation,
    deskName: properties.deskName,
    deskStatus: properties.deskStatus,
    createdAt: properties.createdAt,
  }).from(properties).where(eq(properties.leadId, id)).limit(1);
  
  // If not found by leadId, try by database id as fallback
  if (propertyResult.length === 0) {
    propertyResult = await db.select({
      id: properties.id,
      leadId: properties.leadId,
      addressLine1: properties.addressLine1,
      addressLine2: properties.addressLine2,
      city: properties.city,
      state: properties.state,
      zipcode: properties.zipcode,
      owner1Name: properties.owner1Name,
      owner2Name: properties.owner2Name,
      estimatedValue: properties.estimatedValue,
      equityAmount: properties.equityAmount,
      equityPercent: properties.equityPercent,
      mortgageAmount: properties.mortgageAmount,
      totalLoanBalance: properties.totalLoanBalance,
      taxAmount: properties.taxAmount,
      leadTemperature: properties.leadTemperature,
      trackingStatus: properties.trackingStatus,
      ownerVerified: properties.ownerVerified,
      assignedAgentId: properties.assignedAgentId,
      marketStatus: properties.marketStatus,
      dealMachineRawData: properties.dealMachineRawData,
      apnParcelId: properties.apnParcelId,
      propertyId: properties.propertyId,
      propertyType: properties.propertyType,
      totalBedrooms: properties.totalBedrooms,
      totalBaths: properties.totalBaths,
      buildingSquareFeet: properties.buildingSquareFeet,
      yearBuilt: properties.yearBuilt,
    ownerLocation: properties.ownerLocation,
    deskName: properties.deskName,
    deskStatus: properties.deskStatus,
    createdAt: properties.createdAt,
  }).from(properties).where(eq(properties.id, id)).limit(1);
  }
  
  if (propertyResult.length === 0) return null;
  
  // Use the actual database id for related queries
  const propertyDbId = propertyResult[0].id;
  
  // Get contacts for this property
  const contactsResult = await db.select({
    id: contacts.id,
    name: contacts.name,
    relationship: contacts.relationship,
  }).from(contacts).where(eq(contacts.propertyId, propertyDbId));

  // --- V3: Fetch relational contact data (phones, emails, addresses) ---
  const contactIds = contactsResult.map(c => c.id);
  
  // Initialize empty arrays for contact data - will be populated if tables exist
  let phonesResult: any[] = [];
  let emailsResult: any[] = [];
  let addressesResult: any[] = [];
  
  // Try to fetch phones - table may not exist
  if (contactIds.length > 0) {
    try {
      phonesResult = await db.select({
        id: contactPhones.id,
        contactId: contactPhones.contactId,
        phoneNumber: contactPhones.phoneNumber,
        phoneType: contactPhones.phoneType,
        isPrimary: contactPhones.isPrimary,
        dnc: contactPhones.dnc,
        carrier: contactPhones.carrier,
        activityStatus: contactPhones.activityStatus,
        isPrepaid: contactPhones.isPrepaid,
        createdAt: contactPhones.createdAt,
      }).from(contactPhones).where(sql`${contactPhones.contactId} IN (${sql.join(contactIds.map(cId => sql`${cId}`), sql`, `)})`);
    } catch (e) {
      console.log('contactPhones table query failed, skipping:', e);
    }
  }
  
  // Try to fetch emails - table may not exist
  if (contactIds.length > 0) {
    try {
      emailsResult = await db.select({
        id: contactEmails.id,
        contactId: contactEmails.contactId,
        email: contactEmails.email,
        isPrimary: contactEmails.isPrimary,
        createdAt: contactEmails.createdAt,
      }).from(contactEmails).where(sql`${contactEmails.contactId} IN (${sql.join(contactIds.map(cId => sql`${cId}`), sql`, `)})`);
    } catch (e) {
      console.log('contactEmails table query failed, skipping:', e);
    }
  }
  
  // Try to fetch addresses - table may not exist
  if (contactIds.length > 0) {
    try {
      addressesResult = await db.select({
        id: contactAddresses.id,
        contactId: contactAddresses.contactId,
        addressLine1: contactAddresses.addressLine1,
        addressLine2: contactAddresses.addressLine2,
        city: contactAddresses.city,
        state: contactAddresses.state,
        zipcode: contactAddresses.zipcode,
        addressType: contactAddresses.addressType,
        isPrimary: contactAddresses.isPrimary,
        createdAt: contactAddresses.createdAt,
      }).from(contactAddresses).where(sql`${contactAddresses.contactId} IN (${sql.join(contactIds.map(cId => sql`${cId}`), sql`, `)})`);
    } catch (e) {
      console.log('contactAddresses table query failed, skipping:', e);
    }
  }

  // Map relational data back to contacts
  const contactsMap = new Map(contactsResult.map(c => [c.id, { ...c, phones: [] as any[], emails: [] as any[], addresses: [] as any[] }]));

  phonesResult.forEach(p => {
    if (contactsMap.has(p.contactId)) {
      contactsMap.get(p.contactId)!.phones.push(p);
    }
  });
  emailsResult.forEach(e => {
    if (contactsMap.has(e.contactId)) {
      contactsMap.get(e.contactId)!.emails.push(e);
    }
  });
  addressesResult.forEach(a => {
    if (contactsMap.has(a.contactId)) {
      contactsMap.get(a.contactId)!.addresses.push(a);
    }
  });

  const finalContacts = Array.from(contactsMap.values());
  // ------------------------------------------------------------------
  
  // Get deep search data
  const deepSearchResult = await db
    .select({
      propertyCondition: propertyDeepSearch.propertyCondition,
      issues: propertyDeepSearch.issues,
      hasMortgage: propertyDeepSearch.hasMortgage,
      delinquentTaxTotal: propertyDeepSearch.delinquentTaxTotal,
    })
    .from(propertyDeepSearch)
    .where(eq(propertyDeepSearch.propertyId, propertyDbId))
    .limit(1);
  
  const deepSearchData = deepSearchResult.length > 0 ? deepSearchResult[0] : null;
  
  // Combine the data
  const result = [{
    ...propertyResult[0],
    contacts: finalContacts,
    propertyCondition: deepSearchData?.propertyCondition || null,
    issues: deepSearchData?.issues || null,
    hasMortgage: deepSearchData?.hasMortgage || null,
    delinquentTaxTotal: deepSearchData?.delinquentTaxTotal || null,
  }];
  
  return result.length > 0 ? result[0] : null;
}

export async function getPropertiesForMap(filters?: { userId?: number; userRole?: string }) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      id: properties.id,
      addressLine1: properties.addressLine1,
      city: properties.city,
      state: properties.state,
      zipcode: properties.zipcode,
      estimatedValue: properties.estimatedValue,
      equityPercent: properties.equityPercent,
      status: properties.status,
      owner1Name: properties.owner1Name,
    })
    .from(properties);

  // Agent filtering: non-admin users only see their assigned properties
  if (filters?.userId && filters?.userRole !== 'admin') {
    query = query.where(eq(properties.assignedAgentId, filters.userId));
  }

  const results = await query;
  return results;
}

export async function getPropertyTags(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: propertyTags.id,
      tag: propertyTags.tag,
    })
    .from(propertyTags)
    .where(eq(propertyTags.propertyId, propertyId));

  return results;
}

export async function getPropertyNotes(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: notes.id,
      content: notes.content,
      noteType: notes.noteType,
      userName: users.name,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .leftJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.propertyId, propertyId))
    .orderBy(desc(notes.createdAt));

  return results;
}

export async function addPropertyNote(note: InsertNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(notes).values(note);
  return result;
}

export async function deleteNote(noteId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete the note (only if it belongs to the user)
  const result = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
  
  return result;
}

export async function getPropertyVisits(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: visits.id,
      visitDate: visits.visitDate,
      notes: visits.notes,
      agentId: visits.agentId,
      createdAt: visits.createdAt,
    })
    .from(visits)
    .where(eq(visits.propertyId, propertyId))
    .orderBy(desc(visits.visitDate));

  return results;
}

export async function addPropertyVisit(visit: InsertVisit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(visits).values(visit);
  return result;
}

export async function getPropertyPhotos(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: photos.id,
      url: photos.url,
      description: photos.description,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .where(eq(photos.propertyId, propertyId))
    .orderBy(desc(photos.createdAt));

  return results;
}

export async function addPropertyPhoto(photo: InsertPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(photos).values(photo);
  return result;
}

export async function createPhoto(photo: InsertPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(photos).values(photo);
  return result[0];
}

export async function getPhotosByPropertyId(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: photos.id,
      propertyId: photos.propertyId,
      visitId: photos.visitId,
      noteId: photos.noteId,
      fileKey: photos.fileKey,
      fileUrl: photos.fileUrl,
      caption: photos.caption,
      latitude: photos.latitude,
      longitude: photos.longitude,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .where(eq(photos.propertyId, propertyId))
    .orderBy(desc(photos.createdAt));

  return results;
}

export async function deletePhoto(photoId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify the photo belongs to the user before deleting
  const photo = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  if (photo.length === 0) {
    throw new Error("Photo not found");
  }

  // Delete from database
  await db.delete(photos).where(eq(photos.id, photoId));
  
  return { success: true };
}

export async function addPropertyTag(tag: InsertPropertyTag) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(propertyTags).values(tag);
  return result;
}

export async function removePropertyTag(tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.delete(propertyTags).where(eq(propertyTags.id, tagId));
  return result;
}

export async function assignAgentToProperty(assignment: InsertPropertyAgent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update the assignedAgentId in the properties table
  await db.update(properties).set({ assignedAgentId: assignment.agentId }).where(eq(properties.id, assignment.propertyId));

  // Log the assignment in the propertyAgents table
  const result = await db.insert(propertyAgents).values(assignment);
  return result;
}

export async function getPropertyAgents(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      agentId: propertyAgents.agentId,
      assignedAt: propertyAgents.assignedAt,
      agentName: users.name,
    })
    .from(propertyAgents)
    .leftJoin(users, eq(propertyAgents.agentId, users.id))
    .where(eq(propertyAgents.propertyId, propertyId))
    .orderBy(desc(propertyAgents.assignedAt));

  return results;
}

export async function transferLead(transfer: InsertLeadTransfer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update the assignedAgentId in the properties table
  await db.update(properties).set({ assignedAgentId: transfer.newAgentId }).where(eq(properties.id, transfer.propertyId));

  // Log the transfer in the leadTransfers table
  const result = await db.insert(leadTransfers).values(transfer);
  return result;
}

export async function getLeadTransfers(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      oldAgentId: leadTransfers.oldAgentId,
      newAgentId: leadTransfers.newAgentId,
      transferredAt: leadTransfers.transferredAt,
      oldAgentName: sql<string>`(SELECT name FROM users WHERE id = ${leadTransfers.oldAgentId})`,
      newAgentName: sql<string>`(SELECT name FROM users WHERE id = ${leadTransfers.newAgentId})`,
    })
    .from(leadTransfers)
    .where(eq(leadTransfers.propertyId, propertyId))
    .orderBy(desc(leadTransfers.transferredAt));

  return results;
}

export async function getPropertyTasks(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      dueDate: tasks.dueDate,
      status: tasks.status,
      priority: tasks.priority,
      assignedToId: tasks.assignedToId,
      createdAt: tasks.createdAt,
      assignedToName: users.name,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedToId, users.id))
    .where(eq(tasks.propertyId, propertyId))
    .orderBy(desc(tasks.createdAt));

  return results;
}

export async function addTask(task: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tasks).values(task);
  return result;
}

export async function updateTaskStatus(taskId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.update(tasks).set({ status: status }).where(eq(tasks.id, taskId));
  return result;
}

export async function getTaskComments(taskId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: taskComments.id,
      content: taskComments.content,
      createdAt: taskComments.createdAt,
      authorName: users.name,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.authorId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(desc(taskComments.createdAt));

  return results;
}

export async function addTaskComment(comment: InsertTaskComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(taskComments).values(comment);
  return result;
}

export async function getLeadAssignments(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      agentId: leadAssignments.agentId,
      assignedAt: leadAssignments.assignedAt,
      agentName: users.name,
    })
    .from(leadAssignments)
    .leftJoin(users, eq(leadAssignments.agentId, users.id))
    .where(eq(leadAssignments.propertyId, propertyId))
    .orderBy(desc(leadAssignments.assignedAt));

  return results;
}

export async function getStageHistory(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      stage: stageHistory.stage,
      changedAt: stageHistory.changedAt,
      agentName: users.name,
    })
    .from(stageHistory)
    .leftJoin(users, eq(stageHistory.agentId, users.id))
    .where(eq(stageHistory.propertyId, propertyId))
    .orderBy(desc(stageHistory.changedAt));

  return results;
}

export async function addContactPhone(phone: InsertContactPhone) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(contactPhones).values(phone);
  return result;
}

export async function addContactEmail(email: InsertContactEmail) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(contactEmails).values(email);
  return result;
}

export async function addContactAddress(address: InsertContactAddress) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(contactAddresses).values(address);
  return result;
}

export async function getContactPhones(contactId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select()
    .from(contactPhones)
    .where(eq(contactPhones.contactId, contactId));

  return results;
}

export async function getContactEmails(contactId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select()
    .from(contactEmails)
    .where(eq(contactEmails.contactId, contactId));

  return results;
}

export async function getContactAddresses(contactId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select()
    .from(contactAddresses)
    .where(eq(contactAddresses.contactId, contactId));

  return results;
}

export async function getPropertyByApn(apn: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(properties)
    .where(eq(properties.apnParcelId, apn))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getPropertyByPropertyId(propertyId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(properties)
    .where(eq(properties.propertyId, propertyId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updatePropertyStage(propertyId: number, stage: string, agentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update the stage in the properties table
  await db.update(properties).set({ trackingStatus: stage }).where(eq(properties.id, propertyId));

  // Log the stage change in the stageHistory table
  await db.insert(stageHistory).values({ propertyId, stage, agentId });
}

export async function getPropertyCount() {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.select({ count: sql<number>`count(*)` }).from(properties);
  return result[0].count;
}

export async function getPropertyCountByStage() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      stage: properties.trackingStatus,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(properties.trackingStatus);

  return results;
}

export async function getPropertyCountByAgent() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      agentId: properties.assignedAgentId,
      agentName: users.name,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .leftJoin(users, eq(properties.assignedAgentId, users.id))
    .groupBy(properties.assignedAgentId, users.name)
    .orderBy(desc(sql<number>`count(*)`));

  return results;
}

export async function getPropertyCountByLeadTemperature() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      leadTemperature: properties.leadTemperature,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(properties.leadTemperature);

  return results;
}

export async function getPropertyCountByMarketStatus() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      marketStatus: properties.marketStatus,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(properties.marketStatus);

  return results;
}

export async function getPropertyCountByOwnerLocation() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      ownerLocation: properties.ownerLocation,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(properties.ownerLocation);

  return results;
}

export async function getPropertyCountByEquity() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      equityRange: sql<string>`CASE
        WHEN ${properties.equityPercent} >= 90 THEN '90%+'
        WHEN ${properties.equityPercent} >= 70 THEN '70-89%'
        WHEN ${properties.equityPercent} >= 50 THEN '50-69%'
        WHEN ${properties.equityPercent} >= 30 THEN '30-49%'
        ELSE '0-29%'
      END`,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(sql`equityRange`);

  return results;
}

export async function getPropertyCountByPropertyType() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      propertyType: properties.propertyType,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(properties.propertyType);

  return results;
}

export async function getPropertyCountByYearBuilt() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      yearBuiltRange: sql<string>`CASE
        WHEN ${properties.yearBuilt} >= 2000 THEN '2000+'
        WHEN ${properties.yearBuilt} >= 1980 THEN '1980-1999'
        WHEN ${properties.yearBuilt} >= 1960 THEN '1960-1979'
        ELSE 'Pre-1960'
      END`,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(sql`yearBuiltRange`);

  return results;
}

export async function getPropertyCountByBedrooms() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      totalBedrooms: properties.totalBedrooms,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(properties.totalBedrooms);

  return results;
}

export async function getPropertyCountByBaths() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      totalBaths: properties.totalBaths,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(properties.totalBaths);

  return results;
}

export async function getPropertyCountByBuildingSquareFeet() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      buildingSquareFeetRange: sql<string>`CASE
        WHEN ${properties.buildingSquareFeet} >= 3000 THEN '3000+'
        WHEN ${properties.buildingSquareFeet} >= 2000 THEN '2000-2999'
        WHEN ${properties.buildingSquareFeet} >= 1000 THEN '1000-1999'
        ELSE 'Under 1000'
      END`,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(sql`buildingSquareFeetRange`);

  return results;
}

export async function getPropertyCountByCity() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      city: properties.city,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(properties.city)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByState() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      state: properties.state,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(properties.state)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByZipcode() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      zipcode: properties.zipcode,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(properties.zipcode)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByOwnerVerified() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      ownerVerified: properties.ownerVerified,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .groupBy(properties.ownerVerified);

  return results;
}

export async function getPropertyCountByHasMortgage() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      hasMortgage: propertyDeepSearch.hasMortgage,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .leftJoin(propertyDeepSearch, eq(properties.id, propertyDeepSearch.propertyId))
    .groupBy(propertyDeepSearch.hasMortgage);

  return results;
}

export async function getPropertyCountByDelinquentTaxTotal() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      delinquentTaxTotalRange: sql<string>`CASE
        WHEN ${propertyDeepSearch.delinquentTaxTotal} > 10000 THEN '>$10k'
        WHEN ${propertyDeepSearch.delinquentTaxTotal} > 5000 THEN '$5k-$10k'
        WHEN ${propertyDeepSearch.delinquentTaxTotal} > 1000 THEN '$1k-$5k'
        WHEN ${propertyDeepSearch.delinquentTaxTotal} > 0 THEN '$1-$1k'
        ELSE 'None'
      END`,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .leftJoin(propertyDeepSearch, eq(properties.id, propertyDeepSearch.propertyId))
    .groupBy(sql`delinquentTaxTotalRange`);

  return results;
}

export async function getPropertyCountByPropertyCondition() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      propertyCondition: propertyDeepSearch.propertyCondition,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .leftJoin(propertyDeepSearch, eq(properties.id, propertyDeepSearch.propertyId))
    .groupBy(propertyDeepSearch.propertyCondition);

  return results;
}

export async function getPropertyCountByIssues() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      issues: propertyDeepSearch.issues,
      count: sql<number>`count(*)`,
    })
    .from(properties)
    .leftJoin(propertyDeepSearch, eq(properties.id, propertyDeepSearch.propertyId))
    .groupBy(propertyDeepSearch.issues);

  return results;
}

export async function getPropertyCountByVisited() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      visited: sql<boolean>`CASE WHEN ${visits.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
      count: sql<number>`count(DISTINCT ${properties.id})`,
    })
    .from(properties)
    .leftJoin(visits, eq(properties.id, visits.propertyId))
    .groupBy(sql`visited`);

  return results;
}

export async function getPropertyCountByTags() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      tag: propertyTags.tag,
      count: sql<number>`count(*)`,
    })
    .from(propertyTags)
    .groupBy(propertyTags.tag)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByLeadTransfer() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      transferCount: sql<number>`count(*)`,
      propertyId: leadTransfers.propertyId,
    })
    .from(leadTransfers)
    .groupBy(leadTransfers.propertyId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByNoteCount() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      noteCount: sql<number>`count(*)`,
      propertyId: notes.propertyId,
    })
    .from(notes)
    .groupBy(notes.propertyId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByPhotoCount() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      photoCount: sql<number>`count(*)`,
      propertyId: photos.propertyId,
    })
    .from(photos)
    .groupBy(photos.propertyId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByTaskCount() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      taskCount: sql<number>`count(*)`,
      propertyId: tasks.propertyId,
    })
    .from(tasks)
    .groupBy(tasks.propertyId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByTaskCommentCount() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      taskCommentCount: sql<number>`count(*)`,
      taskId: taskComments.taskId,
    })
    .from(taskComments)
    .groupBy(taskComments.taskId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByLeadAssignmentCount() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      leadAssignmentCount: sql<number>`count(*)`,
      propertyId: leadAssignments.propertyId,
    })
    .from(leadAssignments)
    .groupBy(leadAssignments.propertyId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByStageHistoryCount() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      stageHistoryCount: sql<number>`count(*)`,
      propertyId: stageHistory.propertyId,
    })
    .from(stageHistory)
    .groupBy(stageHistory.propertyId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByContactCount() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      contactCount: sql<number>`count(*)`,
      propertyId: contacts.propertyId,
    })
    .from(contacts)
    .groupBy(contacts.propertyId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByContactPhoneCount() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      contactPhoneCount: sql<number>`count(*)`,
      contactId: contactPhones.contactId,
    })
    .from(contactPhones)
    .groupBy(contactPhones.contactId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByContactEmailCount() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      contactEmailCount: sql<number>`count(*)`,
      contactId: contactEmails.contactId,
    })
    .from(contactEmails)
    .groupBy(contactEmails.contactId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

export async function getPropertyCountByContactAddressCount() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      contactAddressCount: sql<number>`count(*)`,
      contactId: contactAddresses.contactId,
    })
    .from(contactAddresses)
    .groupBy(contactAddresses.contactId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return results;
}

/**
 * Add a new contact phone (V3)
 */
export async function addContactPhoneNew(
  contactId: number,
  phoneNumber: string,
  phoneType: string = "Mobile",
  isPrimary: number = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contactPhones).values({
    contactId,
    phoneNumber,
    phoneType: phoneType as any,
    isPrimary,
  });
  return result;
}
/**
 * Add a new contact email (V3)
 */
export async function addContactEmailNew(
  contactId: number,
  email: string,
  emailType: string = "Personal",
  isPrimary: number = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contactEmails).values({
    contactId,
    email,
    emailType: emailType as any,
    isPrimary,
  });
  return result;
}
/**
 * Add a new contact address (V3)
 */
export async function addContactAddressNew(
  contactId: number,
  addressLine1: string,
  city: string,
  state: string,
  zipcode: string,
  addressLine2?: string,
  addressType: string = "Mailing",
  isPrimary: number = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const validTypes = ["Mailing", "Property", "Current", "Previous"];
  const type = validTypes.includes(addressType) ? addressType : "Mailing";
  const result = await db.insert(contactAddresses).values({
    contactId,
    addressLine1,
    addressLine2: addressLine2 || null,
    city,
    state,
    zipcode,
    addressType: type as any,
    isPrimary,
  });
  return result;
}
/**
 * Get all addresses for a contact
 */
export async function getContactAddressesNew(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  const addresses = await db
    .select()
    .from(contactAddresses)
    .where(eq(contactAddresses.contactId, contactId))
    .orderBy(contactAddresses.isPrimary);
  return addresses;
}
/**
 * Update a contact address
 */
export async function updateContactAddress(
  addressId: number,
  addressLine1: string,
  addressLine2: string | null,
  city: string,
  state: string,
  zipcode: string,
  addressType: string,
  isPrimary: number
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db
    .update(contactAddresses)
    .set({
      addressLine1,
      addressLine2,
      city,
      state,
      zipcode,
      addressType,
      isPrimary,
      updatedAt: new Date(),
    })
    .where(eq(contactAddresses.id, addressId));
}
/**
 * Delete a contact address
 */
export async function deleteContactAddress(addressId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.delete(contactAddresses).where(eq(contactAddresses.id, addressId));
}
/**
 * Get a contact with all associated phones, emails, and addresses
 */
export async function getContactWithDetails(contactId: number) {
  const db = await getDb();
  if (!db) return null;
  const contact = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  if (!contact || contact.length === 0) {
    return null;
  }
  const phones = await getContactPhones(contactId);
  const emails = await getContactEmails(contactId);
  const addresses = await getContactAddresses(contactId);
  return {
    ...contact[0],
    phones,
    emails,
    addresses,
  };
}
/**
 * Create a new contact with phones, emails, and addresses
 */
export async function createContactWithDetails(
  propertyId: number,
  contactData: {
    name: string;
    relationship?: string;
    age?: number;
    deceased?: number;
    currentAddress?: string;
    flags?: string;
    isDecisionMaker?: number;
    dnc?: number;
    isLitigator?: number;
    hidden?: number;
    currentResident?: number;
    contacted?: number;
    onBoard?: number;
    notOnBoard?: number;
    phones?: Array<{ phoneNumber: string; phoneType?: string; isPrimary?: number }>;
    emails?: Array<{ email: string; emailType?: string; isPrimary?: number }>;
    addresses?: Array<{
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      zipcode: string;
      addressType?: string;
      isPrimary?: number;
    }>;
  }
): Promise<any> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  // Create the contact
  const contactResult = await db.insert(contacts).values({
    propertyId,
    name: contactData.name,
    relationship: contactData.relationship,
    age: contactData.age,
    deceased: contactData.deceased || 0,
    currentAddress: contactData.currentAddress,
    flags: contactData.flags,
    isDecisionMaker: contactData.isDecisionMaker || 0,
    dnc: contactData.dnc || 0,
    isLitigator: contactData.isLitigator || 0,
    hidden: contactData.hidden || 0,
    currentResident: contactData.currentResident || 0,
    contacted: contactData.contacted || 0,
    onBoard: contactData.onBoard || 0,
    notOnBoard: contactData.notOnBoard || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const contactId = contactResult.insertId as number;
  // Add phones
  if (contactData.phones && contactData.phones.length > 0) {
    for (const phone of contactData.phones) {
      await addContactPhoneNew(
        contactId,
        phone.phoneNumber,
        phone.phoneType || "Mobile",
        phone.isPrimary || 0
      );
    }
  }
  // Add emails
  if (contactData.emails && contactData.emails.length > 0) {
    for (const email of contactData.emails) {
      await addContactEmailNew(
        contactId,
        email.email,
        email.emailType || "Personal",
        email.isPrimary || 0
      );
    }
  }
  // Add addresses
  if (contactData.addresses && contactData.addresses.length > 0) {
    for (const address of contactData.addresses) {
      await addContactAddressNew(
        contactId,
        address.addressLine1,
        address.city,
        address.state,
        address.zipcode,
        address.addressLine2,
        address.addressType || "Mailing",
        address.isPrimary || 0
      );
    }
  }
  return { contactId, ...contactResult };
}
// ============================================
// Missing Functions - Restored for Compatibility
// ============================================

export async function getNextLeadId(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get the highest leadId from properties table
  const result = await db
    .select({ maxLeadId: sql<number>`MAX(CAST(${properties.leadId} AS UNSIGNED))` })
    .from(properties);
  
  const currentMax = result[0]?.maxLeadId || 0;
  return currentMax + 1;
}


export async function updatePropertyStatus(propertyId: number, status: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(properties)
    .set({ status, updatedAt: new Date() })
    .where(eq(properties.id, propertyId));
}

export async function updateLeadTemperature(propertyId: number, temperature: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(properties)
    .set({ leadTemperature: temperature, updatedAt: new Date() })
    .where(eq(properties.id, propertyId));
}

export async function reassignProperty(propertyId: number, assignedAgentId: number | null, reassignedByUserId?: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(properties)
    .set({ assignedAgentId, updatedAt: new Date() })
    .where(eq(properties.id, propertyId));
}


// ============================================
// Desk Management Functions
// ============================================

export async function updateDesk(propertyId: number, deskName: string | undefined, deskStatus: "BIN" | "ACTIVE" | "ARCHIVED"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(properties)
    .set({ 
      deskName: deskName || null, 
      deskStatus,
      updatedAt: new Date() 
    })
    .where(eq(properties.id, propertyId));
}

export async function getDeskStats(): Promise<{ deskName: string | null; count: number }[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select({
      deskName: properties.deskName,
      count: sql<number>`COUNT(*)`,
    })
    .from(properties)
    .groupBy(properties.deskName);
  
  return result;
}

export async function listByDesk(deskName?: string, deskStatus?: "BIN" | "ACTIVE" | "ARCHIVED"): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let query = db.select().from(properties);
  
  const conditions = [];
  if (deskName) {
    conditions.push(eq(properties.deskName, deskName));
  }
  if (deskStatus) {
    conditions.push(eq(properties.deskStatus, deskStatus));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query;
}


// ============================================
// Deep Search Functions
// ============================================

export async function getPropertyDeepSearch(propertyId: number): Promise<any | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(propertyDeepSearch)
    .where(eq(propertyDeepSearch.propertyId, propertyId))
    .limit(1);
  
  return result[0] || null;
}

export async function upsertPropertyDeepSearch(propertyId: number, data: Partial<any>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if record exists
  const existing = await db
    .select({ id: propertyDeepSearch.id })
    .from(propertyDeepSearch)
    .where(eq(propertyDeepSearch.propertyId, propertyId))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing record
    await db
      .update(propertyDeepSearch)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(propertyDeepSearch.propertyId, propertyId));
  } else {
    // Insert new record
    await db
      .insert(propertyDeepSearch)
      .values({ propertyId, ...data });
  }
}


export async function updatePropertyDeepSearch(input: { propertyId: number; [key: string]: any }): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { propertyId, ...data } = input;
  
  // Check if record exists
  const existing = await db
    .select({ id: propertyDeepSearch.id })
    .from(propertyDeepSearch)
    .where(eq(propertyDeepSearch.propertyId, propertyId))
    .limit(1);
  
  // Remove undefined values from data
  const cleanData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  }
  
  if (existing.length > 0) {
    // Update existing record
    await db
      .update(propertyDeepSearch)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(propertyDeepSearch.propertyId, propertyId));
  } else {
    // Insert new record
    await db
      .insert(propertyDeepSearch)
      .values({ propertyId, ...cleanData });
  }
  
  return { success: true };
}


// ============================================
// Task Functions
// ============================================

export async function createTask(taskData: any): Promise<any> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tasks).values(taskData);
  const insertId = result[0].insertId;
  
  // Return the created task
  const created = await db.select().from(tasks).where(eq(tasks.id, insertId)).limit(1);
  return created[0];
}

export async function getTasks(filters: { 
  status?: string; 
  priority?: string; 
  assignedToId?: number;
  propertyId?: number;
  hidden?: number;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  
  if (filters.status) {
    conditions.push(eq(tasks.status, filters.status as any));
  }
  if (filters.priority) {
    conditions.push(eq(tasks.priority, filters.priority as any));
  }
  if (filters.assignedToId) {
    conditions.push(eq(tasks.assignedToId, filters.assignedToId));
  }
  if (filters.propertyId) {
    conditions.push(eq(tasks.propertyId, filters.propertyId));
  }
  if (filters.hidden !== undefined) {
    conditions.push(eq(tasks.hidden, filters.hidden));
  }
  
  let query = db.select().from(tasks);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return await query.orderBy(desc(tasks.createdAt));
}

export async function getTaskById(taskId: number): Promise<any | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return result[0] || null;
}

export async function getTasksByPropertyId(propertyId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(tasks)
    .where(eq(tasks.propertyId, propertyId))
    .orderBy(desc(tasks.createdAt));
}

export async function updateTask(taskId: number, updateData: any): Promise<any> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(tasks).set(updateData).where(eq(tasks.id, taskId));
  
  // Return updated task
  const updated = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return updated[0];
}

export async function deleteTask(taskId: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(tasks).where(eq(tasks.id, taskId));
  return { success: true };
}

export async function getTaskStatistics(userId?: number): Promise<any> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get counts by status
  const allTasks = await db.select().from(tasks);
  
  const stats = {
    total: allTasks.length,
    toDo: allTasks.filter(t => t.status === "To Do").length,
    inProgress: allTasks.filter(t => t.status === "In Progress").length,
    done: allTasks.filter(t => t.status === "Done").length,
    highPriority: allTasks.filter(t => t.priority === "High").length,
    overdue: allTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Done").length,
  };
  
  return stats;
}
