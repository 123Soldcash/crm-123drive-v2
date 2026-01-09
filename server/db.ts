import { eq, and, like, desc, sql, gte, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, savedSearches, InsertSavedSearch, properties, InsertProperty, contacts, notes, InsertNote, visits, InsertVisit, photos, InsertPhoto, propertyTags, InsertPropertyTag, propertyAgents, InsertPropertyAgent, leadTransfers, InsertLeadTransfer, propertyDeepSearch, tasks, InsertTask, taskComments, InsertTaskComment, agents, leadAssignments } from "../drizzle/schema";
import { ENV } from './_core/env';
import { ne } from 'drizzle-orm';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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

  let query = db.select().from(properties);
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
    
    // Then, search in contacts table (phone, email, name)
    const contactMatches = await db
      .select({ propertyId: contacts.propertyId })
      .from(contacts)
      .where(
        or(
          like(contacts.name, searchTerm),
          like(contacts.phone1, searchTerm),
          like(contacts.phone2, searchTerm),
          like(contacts.phone3, searchTerm),
          like(contacts.email1, searchTerm),
          like(contacts.email2, searchTerm),
          like(contacts.email3, searchTerm)
        )
      );
    
    // Combine unique property IDs from both searches
    const propertyIdsFromProperties = propertyMatches.map(p => p.id);
    const propertyIdsFromContacts = contactMatches.map(c => c.propertyId);
    const searchPropertyIds = Array.from(new Set([...propertyIdsFromProperties, ...propertyIdsFromContacts]));
    
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

export async function getPropertyById(id: number) {
  const db = await getDb();
  if (!db) return null;

  // First get the property
  const propertyResult = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  if (propertyResult.length === 0) return null;
  
  // Then get deep search data
  const deepSearchResult = await db
    .select()
    .from(propertyDeepSearch)
    .where(eq(propertyDeepSearch.propertyId, id))
    .limit(1);
  
  const deepSearchData = deepSearchResult.length > 0 ? deepSearchResult[0] : null;
  
  // Combine the data
  const result = [{
    ...propertyResult[0],
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
    query = query.where(eq(properties.assignedAgentId, filters.userId)) as typeof query;
  }

  const results = await query;

  return results;
}

// Contact queries
export async function getContactsByPropertyId(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db.select().from(contacts).where(eq(contacts.propertyId, propertyId));
  return results;
}

// Notes queries
export async function getNotesByPropertyId(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: notes.id,
      propertyId: notes.propertyId,
      userId: notes.userId,
      content: notes.content,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      userName: users.name,
    })
    .from(notes)
    .leftJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.propertyId, propertyId))
    .orderBy(desc(notes.createdAt));

  return results;
}

export async function createNote(note: InsertNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(notes).values(note).$returningId();
  return result[0];
}

export async function updateNote(id: number, userId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(notes)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));
}

export async function deleteNote(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
}

export async function updatePropertyStatus(propertyId: number, trackingStatus: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(properties)
    .set({ trackingStatus: trackingStatus as any })
    .where(eq(properties.id, propertyId));
}

export async function updateLeadTemperature(
  propertyId: number,
  temperature: "SUPER HOT" | "HOT" | "WARM" | "COLD" | "DEAD" | "TBD"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(properties)
    .set({ leadTemperature: temperature })
    .where(eq(properties.id, propertyId));
}

// Reassign Property
export async function reassignProperty(propertyId: number, assignedAgentId: number | null, assignedBy?: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update the legacy assignedAgentId field
  await db
    .update(properties)
    .set({ assignedAgentId })
    .where(eq(properties.id, propertyId));

  // Also update propertyAgents table for access control
  if (assignedAgentId !== null) {
    // Check if already assigned
    const existing = await db
      .select()
      .from(propertyAgents)
      .where(and(
        eq(propertyAgents.propertyId, propertyId),
        eq(propertyAgents.agentId, assignedAgentId)
      ));

    if (existing.length === 0) {
      // Add to propertyAgents
      await db.insert(propertyAgents).values({
        propertyId,
        agentId: assignedAgentId,
        assignedBy: assignedBy || assignedAgentId,
      });
    }
  }
}

export async function bulkReassignProperties(propertyIds: number[], assignedAgentId: number | null, assignedBy?: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const propertyId of propertyIds) {
    // Update the legacy assignedAgentId field
    await db
      .update(properties)
      .set({ assignedAgentId })
      .where(eq(properties.id, propertyId));

    // Also update propertyAgents table for access control
    if (assignedAgentId !== null) {
      // Check if already assigned
      const existing = await db
        .select()
        .from(propertyAgents)
        .where(and(
          eq(propertyAgents.propertyId, propertyId),
          eq(propertyAgents.agentId, assignedAgentId)
        ));

      if (existing.length === 0) {
        // Add to propertyAgents
        await db.insert(propertyAgents).values({
          propertyId,
          agentId: assignedAgentId,
          assignedBy: assignedBy || assignedAgentId,
        });
      }
    }
  }
}

// Owner Verified
export async function toggleOwnerVerified(propertyId: number, verified: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(properties)
    .set({ ownerVerified: verified ? 1 : 0 })
    .where(eq(properties.id, propertyId));
}

// Custom Tags
export async function addPropertyTag(propertyId: number, tag: string, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(propertyTags).values({
    propertyId,
    tag,
    createdBy: userId,
  });
}

export async function removePropertyTag(tagId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(propertyTags).where(eq(propertyTags.id, tagId));
}

export async function getPropertyTags(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(propertyTags)
    .where(eq(propertyTags.propertyId, propertyId));
}

export async function getAllUniqueTags(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .selectDistinct({ tag: propertyTags.tag })
    .from(propertyTags)
    .orderBy(propertyTags.tag);
  
  return result.map(r => r.tag);
}

export function generateZillowUrl(address: string, city: string, state: string, zipcode: string): string {
  // Format: https://www.zillow.com/homes/{address}-{city}-{state}-{zipcode}_rb/
  const formattedAddress = address.replace(/[^a-zA-Z0-9]/g, "-");
  const formattedCity = city.replace(/[^a-zA-Z0-9]/g, "-");
  return `https://www.zillow.com/homes/${formattedAddress}-${formattedCity}-${state}-${zipcode}_rb/`;
}

export async function getPropertyStats(filters?: { userId?: number; userRole?: string }) {
  const db = await getDb();
  if (!db) return null;

  let query = db
    .select({
      totalProperties: sql<number>`count(*)`,
      avgValue: sql<number>`avg(${properties.estimatedValue})`,
      totalValue: sql<number>`sum(${properties.estimatedValue})`,
      avgEquity: sql<number>`avg(${properties.equityPercent})`,
    })
    .from(properties);

  // Agent filtering: non-admin users only see their assigned properties
  if (filters?.userId && filters?.userRole !== 'admin') {
    query = query.where(eq(properties.assignedAgentId, filters.userId)) as typeof query;
  }

  const result = await query;
  return result[0];
}

// Visit queries
export async function createVisit(visit: InsertVisit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(visits).values(visit).$returningId();
  return result[0];
}

export async function getVisitsByPropertyId(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: visits.id,
      propertyId: visits.propertyId,
      userId: visits.userId,
      latitude: visits.latitude,
      longitude: visits.longitude,
      checkInTime: visits.checkInTime,
      notes: visits.notes,
      createdAt: visits.createdAt,
      userName: users.name,
    })
    .from(visits)
    .leftJoin(users, eq(visits.userId, users.id))
    .where(eq(visits.propertyId, propertyId))
    .orderBy(desc(visits.checkInTime));

  return results;
}

export async function getRecentVisits(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: visits.id,
      propertyId: visits.propertyId,
      userId: visits.userId,
      latitude: visits.latitude,
      longitude: visits.longitude,
      checkInTime: visits.checkInTime,
      notes: visits.notes,
      userName: users.name,
      propertyAddress: properties.addressLine1,
      propertyCity: properties.city,
      propertyState: properties.state,
    })
    .from(visits)
    .leftJoin(users, eq(visits.userId, users.id))
    .leftJoin(properties, eq(visits.propertyId, properties.id))
    .orderBy(desc(visits.checkInTime))
    .limit(limit);

  return results;
}

// Saved Searches queries
export async function getSavedSearchesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(desc(savedSearches.createdAt));

  return results;
}

export async function createSavedSearch(search: InsertSavedSearch) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(savedSearches).values(search).$returningId();
  return result[0];
}

export async function deleteSavedSearch(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(savedSearches).where(eq(savedSearches.id, id));
}

export async function updateSavedSearch(id: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(savedSearches).set({ name }).where(eq(savedSearches.id, id));
}

// Photo queries
export async function createPhoto(photo: InsertPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(photos).values(photo).$returningId();
  const photoId = result[0].id;

  // Return full photo record
  const fullPhoto = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
  return fullPhoto[0];
}

export async function getPhotosByPropertyId(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: photos.id,
      propertyId: photos.propertyId,
      visitId: photos.visitId,
      userId: photos.userId,
      fileKey: photos.fileKey,
      fileUrl: photos.fileUrl,
      caption: photos.caption,
      latitude: photos.latitude,
      longitude: photos.longitude,
      createdAt: photos.createdAt,
      userName: users.name,
    })
    .from(photos)
    .leftJoin(users, eq(photos.userId, users.id))
    .where(eq(photos.propertyId, propertyId))
    .orderBy(desc(photos.createdAt));

  return results;
}

export async function deletePhoto(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(photos).where(and(eq(photos.id, id), eq(photos.userId, userId)));
}

// Agent Statistics
export async function getAgentStatistics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all agents (non-admin users)
  const agents = await db
    .select()
    .from(users)
    .where(eq(users.role, "user"));

  const statistics = [];

  for (const agent of agents) {
    // Count total properties assigned
    const totalProperties = await db
      .select({ count: sql<number>`count(*)` })
      .from(properties)
      .where(eq(properties.assignedAgentId, agent.id));

    // Count properties by lead temperature
    const hotLeads = await db
      .select({ count: sql<number>`count(*)` })
      .from(properties)
      .where(and(eq(properties.assignedAgentId, agent.id), eq(properties.leadTemperature, "HOT")));

    const warmLeads = await db
      .select({ count: sql<number>`count(*)` })
      .from(properties)
      .where(and(eq(properties.assignedAgentId, agent.id), eq(properties.leadTemperature, "WARM")));

    const coldLeads = await db
      .select({ count: sql<number>`count(*)` })
      .from(properties)
      .where(and(eq(properties.assignedAgentId, agent.id), eq(properties.leadTemperature, "COLD")));

    // Count visited properties (properties with at least one visit)
    const visitedProperties = await db
      .selectDistinct({ propertyId: visits.propertyId })
      .from(visits)
      .leftJoin(properties, eq(visits.propertyId, properties.id))
      .where(and(eq(properties.assignedAgentId, agent.id), eq(visits.userId, agent.id)));

    // Count total check-ins by this agent
    const totalCheckIns = await db
      .select({ count: sql<number>`count(*)` })
      .from(visits)
      .where(eq(visits.userId, agent.id));

    // Count total notes by this agent
    const totalNotes = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(eq(notes.userId, agent.id));

    // Count total photos by this agent
    const totalPhotos = await db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(eq(photos.userId, agent.id));

    statistics.push({
      agentId: agent.id,
      agentName: agent.name || agent.openId,
      totalProperties: Number(totalProperties[0]?.count || 0),
      hotLeads: Number(hotLeads[0]?.count || 0),
      warmLeads: Number(warmLeads[0]?.count || 0),
      coldLeads: Number(coldLeads[0]?.count || 0),
      visitedProperties: visitedProperties.length,
      totalCheckIns: Number(totalCheckIns[0]?.count || 0),
      totalNotes: Number(totalNotes[0]?.count || 0),
      totalPhotos: Number(totalPhotos[0]?.count || 0),
    });
  }

  return statistics;
}


// Property Agents (many-to-many) queries
export async function getPropertyAgents(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: propertyAgents.id,
      propertyId: propertyAgents.propertyId,
      agentId: propertyAgents.agentId,
      assignedAt: propertyAgents.assignedAt,
      agentName: users.name,
      agentEmail: users.email,
    })
    .from(propertyAgents)
    .leftJoin(users, eq(propertyAgents.agentId, users.id))
    .where(eq(propertyAgents.propertyId, propertyId));

  return results;
}

export async function addPropertyAgent(propertyId: number, agentId: number, assignedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if already assigned
  const existing = await db
    .select()
    .from(propertyAgents)
    .where(and(
      eq(propertyAgents.propertyId, propertyId),
      eq(propertyAgents.agentId, agentId)
    ));

  if (existing.length > 0) {
    return { success: false, message: "Agent already assigned to this property" };
  }

  await db.insert(propertyAgents).values({
    propertyId,
    agentId,
    assignedBy,
  });

  return { success: true };
}

export async function removePropertyAgent(propertyId: number, agentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(propertyAgents).where(
    and(
      eq(propertyAgents.propertyId, propertyId),
      eq(propertyAgents.agentId, agentId)
    )
  );

  return { success: true };
}

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
  const db = await getDb();
  if (!db) return [];

  // First get all properties
  let query = db.select().from(properties);
  const conditions = [];

  // Agent filtering: non-admin users only see properties they are assigned to
  // Admin users see all properties
  if (filters?.userId && filters?.userRole && filters.userRole !== 'admin') {
    // Get property IDs where this user is assigned
    const assignedPropertyIds = await db
      .select({ propertyId: propertyAgents.propertyId })
      .from(propertyAgents)
      .where(eq(propertyAgents.agentId, filters.userId));
    
    const ids = assignedPropertyIds.map(p => p.propertyId);
    if (ids.length === 0) {
      return []; // No properties assigned
    }
    conditions.push(sql`${properties.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
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
    
    // Then, search in contacts table (phone, email, name)
    const contactMatches = await db
      .select({ propertyId: contacts.propertyId })
      .from(contacts)
      .where(
        or(
          like(contacts.name, searchTerm),
          like(contacts.phone1, searchTerm),
          like(contacts.phone2, searchTerm),
          like(contacts.phone3, searchTerm),
          like(contacts.email1, searchTerm),
          like(contacts.email2, searchTerm),
          like(contacts.email3, searchTerm)
        )
      );
    
    // Combine unique property IDs from both searches
    const propertyIdsFromProperties = propertyMatches.map(p => p.id);
    const propertyIdsFromContacts = contactMatches.map(c => c.propertyId);
    const searchPropertyIds = Array.from(new Set([...propertyIdsFromProperties, ...propertyIdsFromContacts]));
    
    if (searchPropertyIds.length === 0) {
      return []; // No matches found
    }
    conditions.push(sql`${properties.id} IN (${sql.join(searchPropertyIds.map(id => sql`${id}`), sql`, `)})`);
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const propertyResults = await query.orderBy(desc(properties.estimatedValue));

  // Get all property agents in one query
  const allPropertyAgents = await db
    .select({
      propertyId: propertyAgents.propertyId,
      agentId: propertyAgents.agentId,
      agentName: users.name,
    })
    .from(propertyAgents)
    .leftJoin(users, eq(propertyAgents.agentId, users.id));

  // Map agents to properties
  const agentsByProperty = new Map<number, Array<{ agentId: number; agentName: string | null }>>();
  for (const pa of allPropertyAgents) {
    if (!agentsByProperty.has(pa.propertyId)) {
      agentsByProperty.set(pa.propertyId, []);
    }
    agentsByProperty.get(pa.propertyId)!.push({
      agentId: pa.agentId,
      agentName: pa.agentName,
    });
  }

  // Combine properties with their agents
  return propertyResults.map(property => ({
    ...property,
    agents: agentsByProperty.get(property.id) || [],
  }));
}


// Lead Transfer functions
export async function createLeadTransfer(transfer: {
  propertyId: number;
  fromAgentId: number;
  toAgentId: number;
  reason?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Create the transfer record
  const result = await db.insert(leadTransfers).values({
    propertyId: transfer.propertyId,
    fromAgentId: transfer.fromAgentId,
    toAgentId: transfer.toAgentId,
    reason: transfer.reason || null,
    status: "accepted", // Auto-accept for now (can add pending/accept flow later)
  }).$returningId();

  // Add the new agent to propertyAgents
  const existing = await db
    .select()
    .from(propertyAgents)
    .where(and(
      eq(propertyAgents.propertyId, transfer.propertyId),
      eq(propertyAgents.agentId, transfer.toAgentId)
    ));

  if (existing.length === 0) {
    await db.insert(propertyAgents).values({
      propertyId: transfer.propertyId,
      agentId: transfer.toAgentId,
      assignedBy: transfer.fromAgentId,
    });
  }

  // Update the legacy assignedAgentId field
  await db
    .update(properties)
    .set({ assignedAgentId: transfer.toAgentId })
    .where(eq(properties.id, transfer.propertyId));

  return result[0];
}

export async function getLeadTransfersByPropertyId(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: leadTransfers.id,
      propertyId: leadTransfers.propertyId,
      fromAgentId: leadTransfers.fromAgentId,
      toAgentId: leadTransfers.toAgentId,
      reason: leadTransfers.reason,
      status: leadTransfers.status,
      createdAt: leadTransfers.createdAt,
      respondedAt: leadTransfers.respondedAt,
    })
    .from(leadTransfers)
    .where(eq(leadTransfers.propertyId, propertyId))
    .orderBy(desc(leadTransfers.createdAt));

  // Get agent names
  const fromAgentIds = Array.from(new Set(results.map(r => r.fromAgentId)));
  const toAgentIds = Array.from(new Set(results.map(r => r.toAgentId)));
  const allAgentIds = Array.from(new Set([...fromAgentIds, ...toAgentIds]));

  const agentNames: Record<number, string> = {};
  for (const agentId of allAgentIds) {
    const agent = await db.select({ name: users.name }).from(users).where(eq(users.id, agentId)).limit(1);
    agentNames[agentId] = agent[0]?.name || 'Unknown';
  }

  return results.map(r => ({
    ...r,
    fromAgentName: agentNames[r.fromAgentId],
    toAgentName: agentNames[r.toAgentId],
  }));
}

export async function getPendingTransfersForAgent(agentId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: leadTransfers.id,
      propertyId: leadTransfers.propertyId,
      fromAgentId: leadTransfers.fromAgentId,
      reason: leadTransfers.reason,
      createdAt: leadTransfers.createdAt,
      propertyAddress: properties.addressLine1,
      propertyCity: properties.city,
      propertyState: properties.state,
    })
    .from(leadTransfers)
    .leftJoin(properties, eq(leadTransfers.propertyId, properties.id))
    .where(and(
      eq(leadTransfers.toAgentId, agentId),
      eq(leadTransfers.status, "pending")
    ))
    .orderBy(desc(leadTransfers.createdAt));

  // Get from agent names
  const fromAgentIds = Array.from(new Set(results.map(r => r.fromAgentId)));
  const agentNames: Record<number, string> = {};
  for (const id of fromAgentIds) {
    const agent = await db.select({ name: users.name }).from(users).where(eq(users.id, id)).limit(1);
    agentNames[id] = agent[0]?.name || 'Unknown';
  }

  return results.map(r => ({
    ...r,
    fromAgentName: agentNames[r.fromAgentId],
  }));
}


export async function deleteAgent(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Count assignments before deleting
  const assignmentCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(propertyAgents)
    .where(eq(propertyAgents.agentId, userId));

  const deletedCount = assignmentCount[0]?.count || 0;

  // Delete all property assignments for this agent
  await db
    .delete(propertyAgents)
    .where(eq(propertyAgents.agentId, userId));

  // Delete the user
  await db.delete(users).where(eq(users.id, userId));

  return { 
    success: true, 
    deletedPropertyAgents: deletedCount 
  };
}

export async function reassignAgentProperties(fromAgentId: number, toAgentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all properties assigned to the source agent
  const assignments = await db
    .select()
    .from(propertyAgents)
    .where(eq(propertyAgents.agentId, fromAgentId));

  let reassignedCount = 0;

  for (const assignment of assignments) {
    // Check if target agent already has this property
    const existing = await db
      .select()
      .from(propertyAgents)
      .where(and(
        eq(propertyAgents.propertyId, assignment.propertyId),
        eq(propertyAgents.agentId, toAgentId)
      ))
      .limit(1);

    if (existing.length === 0) {
      // Add property to target agent
      await db.insert(propertyAgents).values({
        propertyId: assignment.propertyId,
        agentId: toAgentId,
      });
      reassignedCount++;
    }

    // Remove from source agent
    await db
      .delete(propertyAgents)
      .where(and(
        eq(propertyAgents.propertyId, assignment.propertyId),
        eq(propertyAgents.agentId, fromAgentId)
      ));
  }

  return { success: true, reassignedCount };
}

export async function deleteProperty(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete related records first (cascade delete)
  // 1. Delete property agents
  await db.delete(propertyAgents).where(eq(propertyAgents.propertyId, propertyId));
  
  // 2. Delete visits
  await db.delete(visits).where(eq(visits.propertyId, propertyId));
  
  // 3. Delete photos
  await db.delete(photos).where(eq(photos.propertyId, propertyId));
  
  // 4. Delete notes
  await db.delete(notes).where(eq(notes.propertyId, propertyId));
  
  // 5. Delete contacts
  await db.delete(contacts).where(eq(contacts.propertyId, propertyId));
  
  // 6. Delete property tags
  await db.delete(propertyTags).where(eq(propertyTags.propertyId, propertyId));
  
  // 7. Delete lead transfers
  await db.delete(leadTransfers).where(eq(leadTransfers.propertyId, propertyId));
  
  // Finally, delete the property itself
  await db.delete(properties).where(eq(properties.id, propertyId));
  
  return { success: true };
}

export async function getPropertyDeepSearch(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [deepSearch] = await db
    .select()
    .from(propertyDeepSearch)
    .where(eq(propertyDeepSearch.propertyId, propertyId))
    .limit(1);

  return deepSearch || null;
}

export async function updatePropertyDeepSearch(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { propertyId, ...updateData } = data;

  // Check if deep search record exists
  const existing = await getPropertyDeepSearch(propertyId);

  if (existing) {
    // Update existing record
    await db
      .update(propertyDeepSearch)
      .set(updateData)
      .where(eq(propertyDeepSearch.propertyId, propertyId));
  } else {
    // Create new record
    await db.insert(propertyDeepSearch).values({
      propertyId,
      ...updateData,
    });
  }

  return { success: true };
}

// ============================================
// TASK MANAGEMENT FUNCTIONS
// ============================================

/**
 * Create a new task
 */
export async function createTask(task: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tasks).values(task).$returningId();
  return result[0];
}

/**
 * Get all tasks with optional filters
 */
export async function getTasks(filters?: {
  userId?: number;
  propertyId?: number;
  status?: string;
  priority?: string;
  taskType?: string;
  assignedToId?: number;
  overdue?: boolean;
  dueToday?: boolean;
  upcoming?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      task: tasks,
      assignedToName: users.name,
      createdByName: sql<string>`creator.name`,
      propertyId: properties.id,
      propertyAddress: properties.addressLine1,
      propertyCity: properties.city,
      propertyState: properties.state,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedToId, users.id))
    .leftJoin(sql`users as creator`, sql`${tasks.createdById} = creator.id`)
    .leftJoin(properties, eq(tasks.propertyId, properties.id));

  const conditions = [];

  // Filter by assigned user (for agents to see their tasks)
  if (filters?.userId) {
    conditions.push(eq(tasks.assignedToId, filters.userId));
  }

  // Filter by property
  if (filters?.propertyId) {
    conditions.push(eq(tasks.propertyId, filters.propertyId));
  }

  // Filter by status
  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status as any));
  }

  // Filter by priority
  if (filters?.priority) {
    conditions.push(eq(tasks.priority, filters.priority as any));
  }

  // Filter by task type
  if (filters?.taskType) {
    conditions.push(eq(tasks.taskType, filters.taskType as any));
  }

  // Filter by assigned agent
  if (filters?.assignedToId) {
    conditions.push(eq(tasks.assignedToId, filters.assignedToId));
  }

  // Date-based filters
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  if (filters?.overdue) {
    conditions.push(and(
      sql`${tasks.dueDate} < ${todayStart}`,
      sql`${tasks.status} != 'Done'`
    ) as any);
  }

  if (filters?.dueToday) {
    conditions.push(and(
      sql`${tasks.dueDate} >= ${todayStart}`,
      sql`${tasks.dueDate} <= ${todayEnd}`
    ) as any);
  }

  if (filters?.upcoming) {
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    conditions.push(and(
      sql`${tasks.dueDate} > ${todayEnd}`,
      sql`${tasks.dueDate} <= ${weekFromNow}`
    ) as any);
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = await query.orderBy(desc(tasks.createdAt));

  return results.map(r => ({
    ...r.task,
    assignedToName: r.assignedToName,
    createdByName: r.createdByName,
    propertyId: r.propertyId,
    propertyAddress: r.propertyAddress,
    propertyCity: r.propertyCity,
    propertyState: r.propertyState,
  }));
}

/**
 * Get a single task by ID
 */
export async function getTaskById(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db
    .select({
      task: tasks,
      assignedToName: users.name,
      createdByName: sql<string>`creator.name`,
      propertyAddress: properties.addressLine1,
      propertyCity: properties.city,
      propertyState: properties.state,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedToId, users.id))
    .leftJoin(sql`users as creator`, sql`${tasks.createdById} = creator.id`)
    .leftJoin(properties, eq(tasks.propertyId, properties.id))
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (results.length === 0) return null;

  const r = results[0];
  return {
    ...r.task,
    assignedToName: r.assignedToName,
    createdByName: r.createdByName,
    propertyAddress: r.propertyAddress,
    propertyCity: r.propertyCity,
    propertyState: r.propertyState,
  };
}

/**
 * Update a task
 */
export async function updateTask(taskId: number, updates: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(tasks).set(updates).where(eq(tasks.id, taskId));
  return { success: true };
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete comments first
  await db.delete(taskComments).where(eq(taskComments.taskId, taskId));

  // Delete the task
  await db.delete(tasks).where(eq(tasks.id, taskId));

  return { success: true };
}

/**
 * Add a comment to a task
 */
export async function addTaskComment(comment: InsertTaskComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(taskComments).values(comment).$returningId();
  return result[0];
}

/**
 * Get comments for a task
 */
export async function getTaskComments(taskId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      comment: taskComments,
      userName: users.name,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(desc(taskComments.createdAt));

  return results.map(r => ({
    ...r.comment,
    userName: r.userName,
  }));
}

/**
 * Get task statistics for dashboard
 */
export async function getTaskStatistics(userId?: number) {
  const db = await getDb();
  if (!db) return {
    total: 0,
    todo: 0,
    inProgress: 0,
    done: 0,
    overdue: 0,
    dueToday: 0,
    highPriority: 0,
  };

  let baseQuery = db.select().from(tasks);

  if (userId) {
    baseQuery = baseQuery.where(eq(tasks.assignedToId, userId)) as typeof baseQuery;
  }

  const allTasks = await baseQuery;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  return {
    total: allTasks.length,
    todo: allTasks.filter(t => t.status === "To Do").length,
    inProgress: allTasks.filter(t => t.status === "In Progress").length,
    done: allTasks.filter(t => t.status === "Done").length,
    overdue: allTasks.filter(t => t.dueDate && t.dueDate < todayStart && t.status !== "Done").length,
    dueToday: allTasks.filter(t => t.dueDate && t.dueDate >= todayStart && t.dueDate <= todayEnd).length,
    highPriority: allTasks.filter(t => t.priority === "High" && t.status !== "Done").length,
  };
}

/**
 * Get tasks by property ID
 */
export async function getTasksByPropertyId(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      task: tasks,
      assignedToName: users.name,
      createdByName: sql<string>`creator.name`,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedToId, users.id))
    .leftJoin(sql`users as creator`, sql`${tasks.createdById} = creator.id`)
    .where(eq(tasks.propertyId, propertyId))
    .orderBy(desc(tasks.createdAt));

  return results.map(r => ({
    ...r.task,
    assignedToName: r.assignedToName,
    createdByName: r.createdByName,
  }));
}


export async function updateDesk(propertyId: number, deskName: string | undefined, deskStatus: "BIN" | "ACTIVE" | "ARCHIVED"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { deskStatus };
  if (deskName !== undefined) {
    updateData.deskName = deskName;
  }

  await db
    .update(properties)
    .set(updateData)
    .where(eq(properties.id, propertyId));
}

export async function getDeskStats() {
  const db = await getDb();
  if (!db) return [];

  const stats = await db
    .select({
      deskName: properties.deskName,
      deskStatus: properties.deskStatus,
      count: sql<number>`COUNT(*) as count`,
    })
    .from(properties)
    .groupBy(properties.deskName, properties.deskStatus);

  return stats;
}

export async function listByDesk(deskName?: string, deskStatus?: "BIN" | "ACTIVE" | "ARCHIVED") {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];

  if (deskName) {
    conditions.push(eq(properties.deskName, deskName));
  }
  if (deskStatus) {
    conditions.push(eq(properties.deskStatus, deskStatus));
  }

  let query = db.select().from(properties);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  return await query;
}


export async function createAgent(data: {
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  notes?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error('Database not initialized');
  return await database.insert(agents).values({
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    role: data.role as any,
    status: data.status as any,
    notes: data.notes || null,
  });
}

export async function updateAgent(id: number, data: {
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  notes?: string;
}) {
  const database = await getDb();
  if (!database) throw new Error('Database not initialized');
  return await database.update(agents).set({
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    role: data.role as any,
    status: data.status as any,
    notes: data.notes || null,
  }).where(eq(agents.id, id));
}


// ============ LEAD ASSIGNMENTS ============

export async function assignAgentToProperty(propertyId: number, agentId: number, assignedBy?: number) {
  const database = await getDb();
  if (!database) throw new Error('Database not initialized');
  
  // Insert into leadAssignments
  const result = await database.insert(leadAssignments).values({
    propertyId,
    agentId,
    assignmentType: 'Shared',
    assignedBy: assignedBy || undefined,
  });
  
  // Update property's assignedAgentId
  await database.update(properties).set({
    assignedAgentId: agentId,
  }).where(eq(properties.id, propertyId));
  
  return result;
}

export async function getLeadAssignmentsByProperty(propertyId: number) {
  const database = await getDb();
  if (!database) throw new Error('Database not initialized');
  
  return await database.select().from(leadAssignments).where(eq(leadAssignments.propertyId, propertyId));
}


export async function bulkAssignAgentToProperties(
  agentId: number,
  filters: {
    leadTemperature?: string;
    deskName?: string;
    status?: string;
    unassignedOnly?: boolean;
  }
) {
  const database = await getDb();
  if (!database) throw new Error('Database not initialized');
  
  // Build query based on filters
  let query = database.select().from(properties);
  
  // Apply filters
  if (filters.leadTemperature && filters.leadTemperature !== 'All') {
    query = query.where(eq(properties.leadTemperature, filters.leadTemperature));
  }
  
  if (filters.deskName && filters.deskName !== 'All') {
    query = query.where(eq(properties.deskName, filters.deskName));
  }
  
  if (filters.status && filters.status !== 'All') {
    query = query.where(eq(properties.trackingStatus, filters.status));
  }
  
  if (filters.unassignedOnly) {
    query = query.where(eq(properties.assignedAgentId, null));
  }
  
  const propertiesToAssign = await query.execute();
  
  // Assign all properties to the agent
  let assignedCount = 0;
  for (const prop of propertiesToAssign) {
    try {
      await database.insert(leadAssignments).values({
        propertyId: prop.id,
        agentId,
        assignmentType: 'Shared',
      });
      
      await database.update(properties).set({
        assignedAgentId: agentId,
      }).where(eq(properties.id, prop.id));
      
      assignedCount++;
    } catch (error) {
      console.error(`Failed to assign property ${prop.id}:`, error);
    }
  }
  
  return {
    success: true,
    assignedCount,
    totalFiltered: propertiesToAssign.length,
  };
}


export async function getPropertiesWithFilters(filters: {
  leadTemperature?: string;
  deskName?: string;
  status?: string;
  unassignedOnly?: boolean;
  userId?: number;
  userRole?: string;
}) {
  const database = await getDb();
  if (!database) {
    console.warn("[Database] Cannot get properties: database not available");
    return [];
  }

  try {
    let query = database.select().from(properties);
    const conditions: any[] = [];

    // Filter by lead temperature
    if (filters.leadTemperature) {
      conditions.push(eq(properties.leadTemperature, filters.leadTemperature));
    }

    // Filter by desk name
    if (filters.deskName) {
      conditions.push(eq(properties.deskName, filters.deskName));
    }

    // Filter by status
    if (filters.status) {
      conditions.push(eq(properties.status, filters.status));
    }

    // Filter by unassigned only
    if (filters.unassignedOnly) {
      conditions.push(eq(properties.assignedAgentId, null));
    }

    // Combine all conditions
    if (conditions.length > 0) {
      const { and } = await import('drizzle-orm');
      query = query.where(and(...conditions));
    }

    const result = await query.limit(1000);
    return result;
  } catch (error) {
    console.error("[Database] Error fetching filtered properties:", error);
    return [];
  }
}


/**
 * Family Members Management
 */

export async function createFamilyMember(data: {
  propertyId: number;
  name: string;
  relationship: string;
  phone?: string | null;
  email?: string | null;
  isRepresentative?: number;
  isDeceased?: number;
  isContacted?: number;
  contactedDate?: Date | null;
  isOnBoard?: number;
  isNotOnBoard?: number;
  relationshipPercentage?: number | null;
  isCurrentResident?: number;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { familyMembers } = await import("../drizzle/schema");
  const result = await db.insert(familyMembers).values({
    propertyId: data.propertyId,
    name: data.name,
    relationship: data.relationship,
    phone: data.phone || null,
    email: data.email || null,
    isRepresentative: data.isRepresentative || 0,
    isDeceased: data.isDeceased || 0,
    isContacted: data.isContacted || 0,
    contactedDate: data.contactedDate || null,
    isOnBoard: data.isOnBoard || 0,
    isNotOnBoard: data.isNotOnBoard || 0,
    relationshipPercentage: data.relationshipPercentage || 0,
    isCurrentResident: data.isCurrentResident || 0,
    notes: data.notes || null,
  });

  return result;
}

export async function getFamilyMembers(propertyId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { familyMembers } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  
  return await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.propertyId, propertyId))
    .orderBy(familyMembers.createdAt);
}

export async function updateFamilyMember(id: number, data: {
  name?: string;
  relationship?: "Owner" | "Spouse" | "Son" | "Daughter" | "Father" | "Mother" | "Brother" | "Sister" | "Grandfather" | "Grandmother" | "Grandson" | "Granddaughter" | "Uncle" | "Aunt" | "Cousin" | "Nephew" | "Niece" | "In-Law" | "Other";
  phone?: string | null;
  email?: string | null;
  isRepresentative?: number;
  isDeceased?: number;
  isContacted?: number;
  contactedDate?: Date | null;
  isOnBoard?: number;
  isNotOnBoard?: number;
  relationshipPercentage?: number | null;
  isCurrentResident?: number;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { familyMembers } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  
  // Filter out undefined values to avoid overwriting with undefined
  const updateData: any = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      updateData[key] = value;
    }
  });
  
  return await db
    .update(familyMembers)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(familyMembers.id, id));
}

export async function deleteFamilyMember(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const { familyMembers } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  
  return await db
    .delete(familyMembers)
    .where(eq(familyMembers.id, id));
}
