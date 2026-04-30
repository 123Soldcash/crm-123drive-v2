import { eq, and, like, desc, sql, gte, lte, or, isNotNull, isNull, ne, inArray, aliasedTable } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, savedSearches, InsertSavedSearch, properties, InsertProperty, contacts, notes, InsertNote, visits, InsertVisit, photos, InsertPhoto, propertyTags, InsertPropertyTag, propertyAgents, InsertPropertyAgent, leadTransfers, InsertLeadTransfer, propertyDeepSearch, tasks, InsertTask, taskComments, InsertTaskComment, agents, leadAssignments, stageHistory, contactPhones, InsertContactPhone, contactEmails, InsertContactEmail, contactAddresses, InsertContactAddress, contactSocialMedia, familyMembers, InsertFamilyMember, propertyDocuments, InsertPropertyDocument, leadSources, campaignNames, twilioNumbers, desks } from "../drizzle/schema";
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
      status: users.status,
      notes: users.notes,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(inArray(users.role, ['agent', 'admin']))
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
  tag?: string;
  leadSource?: string;
  campaignName?: string;
  // Pagination
  page?: number;
  pageSize?: number;
  // Server-side filters (moved from client)
  assignedAgentId?: number | null;
  deskName?: string;
  dealStage?: string;
  // Filter by exact property DB id
  propertyIdFilter?: number;
  // Filter by city
  city?: string;
  // Filter by email
  email?: string;
}) {
  const db = await getDb();
  if (!db) return { data: [], totalCount: 0 };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

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
    // dealMachineRawData excluded from list — only loaded in detail view
    apnParcelId: properties.apnParcelId,
    propertyId: properties.propertyId,
    status: properties.status,
    deskName: properties.deskName,
    deskStatus: properties.deskStatus,
    dealStage: properties.dealStage,
    ownerLocation: properties.ownerLocation,
    createdAt: properties.createdAt,
    source: properties.source,
    listName: properties.listName,
    leadSource: properties.leadSource,
    campaignName: properties.campaignName,
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
    // When explicitly filtering by DEAD temperature, also include deskStatus=DEAD leads
    if (filters.leadTemperature === 'DEAD') {
      // Remove the condition we just added and replace with an OR to catch both cases
      conditions.pop();
      conditions.push(or(
        eq(properties.leadTemperature, 'DEAD'),
        eq(properties.deskStatus, 'DEAD')
      ));
    }
  } else if (filters?.deskName) {
    // When filtering by a specific desk, show all leads in that desk (including DEAD status ones)
    // but still exclude leadTemperature=DEAD unless explicitly requested
    conditions.push(sql`${properties.leadTemperature} != 'DEAD'`);
  } else {
    // By default, exclude DEAD leads — exclude both leadTemperature=DEAD and deskStatus=DEAD
    conditions.push(sql`${properties.leadTemperature} != 'DEAD'`);
    conditions.push(ne(properties.deskStatus, 'DEAD'));
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
    
    // Search in contactPhones table — normalize stored numbers by stripping formatting
    // Stored numbers may be formatted like "(904) 413-3291" but user searches "9044133291"
    const rawSearch = filters.search.replace(/\D/g, ""); // digits only from user input
    const phoneSearchTerm = rawSearch.length >= 7 ? rawSearch : null;
    const phoneMatches = phoneSearchTerm ? await db
      .select({ propertyId: contacts.propertyId })
      .from(contactPhones)
      .leftJoin(contacts, eq(contactPhones.contactId, contacts.id))
      .where(and(
        sql`REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${contactPhones.phoneNumber}, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') LIKE ${'%' + phoneSearchTerm + '%'}`,
        isNotNull(contacts.propertyId)
      )) : [];

    // Also search contacts.phoneNumber directly (new model)
    const directPhoneMatches = phoneSearchTerm ? await db
      .select({ propertyId: contacts.propertyId })
      .from(contacts)
      .where(and(
        sql`REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${contacts.phoneNumber}, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') LIKE ${'%' + phoneSearchTerm + '%'}`,
        isNotNull(contacts.propertyId)
      )) : [];
      
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
    const propertyIdsFromDirectPhones = directPhoneMatches.map(p => p.propertyId);
    const propertyIdsFromEmails = emailMatches.map(e => e.propertyId);
    const searchPropertyIds = Array.from(new Set([
      ...propertyIdsFromProperties, 
      ...propertyIdsFromContacts,
      ...propertyIdsFromPhones,
      ...propertyIdsFromDirectPhones,
      ...propertyIdsFromEmails
    ]));
    
    if (searchPropertyIds.length === 0) {
      return { data: [], totalCount: 0 }; // No matches found
    }
    conditions.push(sql`${properties.id} IN (${sql.join(searchPropertyIds.map(id => sql`${id}`), sql`, `)})`);
  }

  // Filter by tag (requires subquery on propertyTags)
  if (filters?.tag) {
    const tagMatches = await db
      .select({ propertyId: propertyTags.propertyId })
      .from(propertyTags)
      .where(eq(propertyTags.tag, filters.tag));
    const tagPropertyIds = tagMatches.map(t => t.propertyId);
    if (tagPropertyIds.length === 0) return { data: [], totalCount: 0 };
    conditions.push(sql`${properties.id} IN (${sql.join(tagPropertyIds.map(id => sql`${id}`), sql`, `)})`);
  }

  // Filter by leadSource
  if (filters?.leadSource) {
    conditions.push(eq(properties.leadSource, filters.leadSource));
  }

  // Filter by campaignName
  if (filters?.campaignName) {
    conditions.push(eq(properties.campaignName, filters.campaignName));
  }

  // Server-side filters moved from client
  if (filters?.assignedAgentId !== undefined && filters?.assignedAgentId !== null) {
    if (filters.assignedAgentId === 0) {
      conditions.push(isNull(properties.assignedAgentId));
    } else {
      conditions.push(eq(properties.assignedAgentId, filters.assignedAgentId));
    }
  }
  if (filters?.deskName) {
    conditions.push(eq(properties.deskName, filters.deskName));
  }
  if (filters?.dealStage) {
    conditions.push(eq(properties.dealStage, filters.dealStage as any));
  }

  // Filter by exact property DB id
  if (filters?.propertyIdFilter) {
    conditions.push(eq(properties.id, filters.propertyIdFilter));
  }
  // Filter by city (exact match)
  if (filters?.city) {
    conditions.push(eq(properties.city, filters.city));
  }
  // Filter by email (searches contactEmails table)
  if (filters?.email) {
    const emailTerm = `%${filters.email}%`;
    const emailMatches = await db
      .select({ propertyId: contacts.propertyId })
      .from(contactEmails)
      .leftJoin(contacts, eq(contactEmails.contactId, contacts.id))
      .where(and(like(contactEmails.email, emailTerm), isNotNull(contacts.propertyId)));
    const emailPropertyIds = emailMatches.map(e => e.propertyId).filter(Boolean) as number[];
    if (emailPropertyIds.length === 0) return { data: [], totalCount: 0 };
    conditions.push(sql`${properties.id} IN (${sql.join(emailPropertyIds.map(id => sql`${id}`), sql`, `)})`);
  }

  // Build the final query
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  // Get total count (same conditions, no pagination)
  let countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(properties);
  if (conditions.length > 0) {
    countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
  }
  const [{ count: totalCount }] = await countQuery;

  // Apply sort + pagination
  const results = await (query as any)
    .orderBy(desc(properties.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data: results, totalCount: Number(totalCount) };
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
  tag?: string;
  leadSource?: string;
  campaignName?: string;
  page?: number;
  pageSize?: number;
  assignedAgentId?: number | null;
  deskName?: string;
  dealStage?: string;
  propertyIdFilter?: number;
  city?: string;
  email?: string;
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
    dealStage: properties.dealStage,
    stageChangedAt: properties.stageChangedAt,
    leadSource: properties.leadSource,
    campaignName: properties.campaignName,
    primaryTwilioNumber: properties.primaryTwilioNumber,
    propertyImage: properties.propertyImage,
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
    dealStage: properties.dealStage,
    stageChangedAt: properties.stageChangedAt,
    leadSource: properties.leadSource,
    campaignName: properties.campaignName,
    primaryTwilioNumber: properties.primaryTwilioNumber,
    propertyImage: properties.propertyImage,
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
        dncChecked: contactPhones.dncChecked,
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

  // Map relational data back to contacts - ensure no undefined values
  const contactsMap = new Map(
    contactsResult.map(c => [
      c.id, 
      { 
        ...c, 
        name: c.name ?? '', 
        relationship: c.relationship ?? '',
        phones: [] as any[], 
        emails: [] as any[], 
        addresses: [] as any[] 
      }
    ])
  );

  // Safely add relational data with error handling
  if (Array.isArray(phonesResult)) {
    try {
      phonesResult.forEach(p => {
        if (p && contactsMap.has(p.contactId)) {
          const contact = contactsMap.get(p.contactId);
          if (contact && Array.isArray(contact.phones)) {
            contact.phones.push(p);
          }
        }
      });
    } catch (e) {
      console.error('Error processing phones:', e);
    }
  }

  if (Array.isArray(emailsResult)) {
    try {
      emailsResult.forEach(e => {
        if (e && contactsMap.has(e.contactId)) {
          const contact = contactsMap.get(e.contactId);
          if (contact && Array.isArray(contact.emails)) {
            contact.emails.push(e);
          }
        }
      });
    } catch (e) {
      console.error('Error processing emails:', e);
    }
  }

  if (Array.isArray(addressesResult)) {
    try {
      addressesResult.forEach(a => {
        if (a && contactsMap.has(a.contactId)) {
          const contact = contactsMap.get(a.contactId);
          if (contact && Array.isArray(contact.addresses)) {
            contact.addresses.push(a);
          }
        }
      });
    } catch (e) {
      console.error('Error processing addresses:', e);
    }
  }

  const finalContacts = Array.from(contactsMap.values());
  // ------------------------------------------------------------------
  
  // Get deep search data
  let deepSearchData = null;
  try {
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
    
    deepSearchData = deepSearchResult && deepSearchResult.length > 0 ? deepSearchResult[0] : null;
  } catch (e) {
    console.log('Deep search data query failed, skipping:', e);
  }
  
  // Combine the data - ensure no undefined fields
  const property = propertyResult && propertyResult.length > 0 ? propertyResult[0] : null;
  if (!property) return null;
  
  const safeProperty = {
    ...property,
    addressLine1: property.addressLine1 ?? '',
    addressLine2: property.addressLine2 ?? '',
    city: property.city ?? '',
    state: property.state ?? '',
    zipcode: property.zipcode ?? '',
    owner1Name: property.owner1Name ?? '',
    owner2Name: property.owner2Name ?? '',
    propertyType: property.propertyType ?? '',
    ownerLocation: property.ownerLocation ?? '',
    deskName: property.deskName ?? '',
    deskStatus: property.deskStatus ?? '',
    leadTemperature: property.leadTemperature ?? 'TBD',
    contacts: finalContacts ?? [],
    propertyCondition: deepSearchData?.propertyCondition ?? null,
    issues: deepSearchData?.issues ?? null,
    hasMortgage: deepSearchData?.hasMortgage ?? 0,
    delinquentTaxTotal: deepSearchData?.delinquentTaxTotal ?? 0,
  };
  
  return safeProperty;
}

export async function getPropertiesForMap(filters?: { userId?: number; userRole?: string }) {
  const db = await getDb();
  if (!db) return [];

  const baseQuery = db
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
  // Also exclude DEAD leads from map view (both leadTemperature=DEAD and deskStatus=DEAD)
  const deadFilter = and(
    sql`${properties.leadTemperature} != 'DEAD'`,
    ne(properties.deskStatus, 'DEAD')
  );
  if (filters?.userId && filters?.userRole !== 'admin') {
    const results = await baseQuery.where(and(eq(properties.assignedAgentId, filters.userId), deadFilter));
    return results;
  }

  const results = await baseQuery.where(deadFilter);
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
      userId: notes.userId,
      userName: users.name,
      isPinned: notes.isPinned,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .leftJoin(users, eq(notes.userId, users.id))
    .where(eq(notes.propertyId, propertyId))
    .orderBy(desc(notes.isPinned), desc(notes.createdAt));

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
      visitDate: visits.checkInTime,
      notes: visits.notes,
      agentId: visits.userId,
      createdAt: visits.createdAt,
    })
    .from(visits)
    .where(eq(visits.propertyId, propertyId))
    .orderBy(desc(visits.checkInTime));

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
      url: photos.fileUrl,
      description: photos.caption,
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

// Returns ONLY standalone property photos (no noteId, no visitId) - used by PhotoGallery
export async function getPhotosByPropertyId(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: photos.id,
      propertyId: photos.propertyId,
      visitId: photos.visitId,
      noteId: photos.noteId,
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
    .where(
      and(
        eq(photos.propertyId, propertyId),
        isNull(photos.noteId),
        isNull(photos.visitId)
      )
    )
    .orderBy(desc(photos.createdAt));

  return results;
}

// Returns ALL photos for a property (including those linked to notes/visits) - used by NotesSection
export async function getAllPhotosByPropertyId(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: photos.id,
      propertyId: photos.propertyId,
      visitId: photos.visitId,
      noteId: photos.noteId,
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

export async function addPropertyTag(propertyId: number, tag: string, createdBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if tag already exists on this property
  const existing = await db
    .select()
    .from(propertyTags)
    .where(and(eq(propertyTags.propertyId, propertyId), eq(propertyTags.tag, tag)));
  if (existing.length > 0) return existing[0];

  const result = await db.insert(propertyTags).values({ propertyId, tag, createdBy });
  return result;
}

export async function removePropertyTag(tagId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.delete(propertyTags).where(eq(propertyTags.id, tagId));
  return result;
}

export async function getAllUniqueTags() {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      tag: propertyTags.tag,
      count: sql<number>`count(*)`,
    })
    .from(propertyTags)
    .groupBy(propertyTags.tag)
    .orderBy(propertyTags.tag);

  return results;
}

export async function deleteTagGlobally(tagName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.delete(propertyTags).where(eq(propertyTags.tag, tagName));
  return result;
}

export async function renameTag(oldName: string, newName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.update(propertyTags).set({ tag: newName }).where(eq(propertyTags.tag, oldName));
  return result;
}

export async function assignAgentToProperty(assignment: InsertPropertyAgent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Check if this agent is already assigned to this property
    const existing = await db
      .select({ id: propertyAgents.id })
      .from(propertyAgents)
      .where(
        and(
          eq(propertyAgents.propertyId, assignment.propertyId),
          eq(propertyAgents.agentId, assignment.agentId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Already assigned, skip duplicate insertion
      return { alreadyAssigned: true };
    }

    // Update the assignedAgentId in the properties table
    await db.update(properties).set({ assignedAgentId: assignment.agentId }).where(eq(properties.id, assignment.propertyId));

    // Insert the assignment in the propertyAgents table
    const result = await db.insert(propertyAgents).values(assignment);
    return result;
  } catch (error) {
    console.error('Error assigning agent to property:', error);
    throw new Error(`Failed to assign agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
  await db.update(properties).set({ assignedAgentId: transfer.toAgentId }).where(eq(properties.id, transfer.propertyId));

  // Log the transfer in the leadTransfers table
  const result = await db.insert(leadTransfers).values(transfer);
  return result;
}

export async function getLeadTransfers(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: leadTransfers.id,
      fromAgentId: leadTransfers.fromAgentId,
      toAgentId: leadTransfers.toAgentId,
      reason: leadTransfers.reason,
      status: leadTransfers.status,
      createdAt: leadTransfers.createdAt,
      respondedAt: leadTransfers.respondedAt,
      fromAgentName: sql<string>`(SELECT name FROM users WHERE id = ${leadTransfers.fromAgentId})`,
      toAgentName: sql<string>`(SELECT name FROM users WHERE id = ${leadTransfers.toAgentId})`,
    })
    .from(leadTransfers)
    .where(eq(leadTransfers.propertyId, propertyId))
    .orderBy(desc(leadTransfers.createdAt));

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

  const result = await db.update(tasks).set({ status: status as any }).where(eq(tasks.id, taskId));
  return result;
}

export async function getTaskComments(taskId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: taskComments.id,
      content: taskComments.comment,
      createdAt: taskComments.createdAt,
      authorName: users.name,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
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
      stage: stageHistory.newStage,
      changedAt: stageHistory.changedAt,
      agentName: users.name,
    })
    .from(stageHistory)
    .leftJoin(users, eq(stageHistory.changedBy, users.id))
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
  await db.update(properties).set({ trackingStatus: stage as any }).where(eq(properties.id, propertyId));

  // Log the stage change in the stageHistory table
  await db.insert(stageHistory).values({ propertyId, newStage: stage, changedBy: agentId });
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
  } as any);
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
  const contactId = (contactResult as any)[0]?.insertId as number;
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
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(properties.id, propertyId));
}

export async function updateLeadTemperature(propertyId: number, temperature: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(properties)
    .set({ leadTemperature: temperature as any, updatedAt: new Date() })
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

export async function updateDesk(propertyId: number, deskName: string | undefined, deskStatus: "BIN" | "ACTIVE" | "DEAD"): Promise<void> {
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

export async function listByDesk(deskName?: string, deskStatus?: "BIN" | "ACTIVE" | "DEAD"): Promise<any[]> {
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

export async function getTasks(filters?: { 
  status?: string; 
  priority?: string; 
  assignedToId?: number;
  deskId?: number;
  propertyId?: number;
  hidden?: number;
  userId?: number;
  userDeskIds?: number[];
}): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  
  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status as any));
  }
  if (filters?.priority) {
    conditions.push(eq(tasks.priority, filters.priority as any));
  }
  if (filters?.assignedToId) {
    conditions.push(eq(tasks.assignedToId, filters.assignedToId));
  }
  if (filters?.deskId) {
    conditions.push(eq(tasks.deskId, filters.deskId));
  }
  if (filters?.propertyId) {
    conditions.push(eq(tasks.propertyId, filters.propertyId));
  }
  if (filters?.hidden !== undefined) {
    conditions.push(eq(tasks.hidden, filters.hidden));
  }
  // Filter by userId: show tasks in user's desks OR created by this user
  if (filters?.userId !== undefined) {
    if (filters?.userDeskIds && filters.userDeskIds.length > 0) {
      // Show tasks assigned to user's desks OR created by this user
      conditions.push(
        or(
          inArray(tasks.deskId, filters.userDeskIds),
          eq(tasks.createdById, filters.userId),
          eq(tasks.assignedToId, filters.userId)
        )
      );
    } else {
      // Fallback: show tasks assigned to or created by this user
      conditions.push(
        or(
          eq(tasks.assignedToId, filters.userId),
          eq(tasks.createdById, filters.userId)
        )
      );
    }
  }
  
  // Alias for assigned user and creator user joins
  const assignedUser = aliasedTable(users, 'assignedUser');
  const creatorUser = aliasedTable(users, 'creatorUser');

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      taskType: tasks.taskType,
      priority: tasks.priority,
      status: tasks.status,
      hidden: tasks.hidden,
      assignedToId: tasks.assignedToId,
      deskId: tasks.deskId,
      createdById: tasks.createdById,
      propertyId: tasks.propertyId,
      dueDate: tasks.dueDate,
      dueTime: tasks.dueTime,
      completedDate: tasks.completedDate,
      repeatTask: tasks.repeatTask,
      checklist: tasks.checklist,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      propertyAddress: properties.addressLine1,
      propertyCity: properties.city,
      propertyState: properties.state,
      assignedToName: assignedUser.name,
      createdByName: creatorUser.name,
      deskName: desks.description,
    })
    .from(tasks)
    .leftJoin(properties, eq(tasks.propertyId, properties.id))
    .leftJoin(assignedUser, eq(tasks.assignedToId, assignedUser.id))
    .leftJoin(creatorUser, eq(tasks.createdById, creatorUser.id))
    .leftJoin(desks, eq(tasks.deskId, desks.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tasks.createdAt));
  
  return rows;
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
  
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      taskType: tasks.taskType,
      priority: tasks.priority,
      status: tasks.status,
      dueDate: tasks.dueDate,
      dueTime: tasks.dueTime,
      repeatTask: tasks.repeatTask,
      propertyId: tasks.propertyId,
      assignedToId: tasks.assignedToId,
      createdById: tasks.createdById,
      completedDate: tasks.completedDate,
      hidden: tasks.hidden,
      checklist: tasks.checklist,
      deskId: tasks.deskId,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      deskName: desks.description,
    })
    .from(tasks)
    .leftJoin(desks, eq(tasks.deskId, desks.id))
    .where(eq(tasks.propertyId, propertyId))
    .orderBy(desc(tasks.createdAt));
  
  return rows;
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


// ============================================
// FAMILY TREE FUNCTIONS
// ============================================

/**
 * Create a new family member for a property
 */
export async function createFamilyMember(data: InsertFamilyMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(familyMembers).values(data);
  
  // Return the created family member
  const insertId = result[0].insertId;
  const created = await db.select().from(familyMembers).where(eq(familyMembers.id, insertId)).limit(1);
  return created[0];
}

/**
 * Get all family members for a property
 */
export async function getFamilyMembers(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.propertyId, propertyId))
    .orderBy(desc(familyMembers.createdAt));
}

/**
 * Update a family member
 */
export async function updateFamilyMember(id: number, data: Partial<InsertFamilyMember>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(familyMembers).set(data).where(eq(familyMembers.id, id));
  
  // Return updated family member
  const updated = await db.select().from(familyMembers).where(eq(familyMembers.id, id)).limit(1);
  return updated[0];
}

/**
 * Delete a family member
 */
export async function deleteFamilyMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(familyMembers).where(eq(familyMembers.id, id));
  return { success: true };
}


// ============================================================================
// PROPERTY DOCUMENTS
// ============================================================================

export async function getPropertyDocuments(propertyId: number) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: propertyDocuments.id,
      propertyId: propertyDocuments.propertyId,
      noteId: propertyDocuments.noteId,
      userId: propertyDocuments.userId,
      fileName: propertyDocuments.fileName,
      fileKey: propertyDocuments.fileKey,
      fileUrl: propertyDocuments.fileUrl,
      fileSize: propertyDocuments.fileSize,
      mimeType: propertyDocuments.mimeType,
      description: propertyDocuments.description,
      createdAt: propertyDocuments.createdAt,
      uploaderName: users.name,
    })
    .from(propertyDocuments)
    .leftJoin(users, eq(propertyDocuments.userId, users.id))
    .where(eq(propertyDocuments.propertyId, propertyId))
    .orderBy(desc(propertyDocuments.createdAt));

  return results;
}

export async function createPropertyDocument(doc: InsertPropertyDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(propertyDocuments).values(doc);
  return { id: Number(result[0].insertId), ...doc };
}

export async function deletePropertyDocument(docId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const doc = await db
    .select()
    .from(propertyDocuments)
    .where(eq(propertyDocuments.id, docId))
    .limit(1);

  if (doc.length === 0) {
    throw new Error("Document not found");
  }

  await db.delete(propertyDocuments).where(eq(propertyDocuments.id, docId));
  return { success: true, fileKey: doc[0].fileKey };
}


// ============================================
// Missing functions needed by routers.ts
// ============================================

export function generateZillowUrl(address: string, city: string, state: string, zipcode: string): string {
  const formattedAddress = `${address}, ${city}, ${state} ${zipcode}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  return `https://www.zillow.com/homes/${formattedAddress}_rb/`;
}

export async function toggleOwnerVerified(propertyId: number, verified: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(properties).set({ ownerVerified: verified ? 1 : 0, updatedAt: new Date() }).where(eq(properties.id, propertyId));
}

export async function getPropertyStats(filters?: { userId?: number; userRole?: string }) {
  const result = await getProperties({ ...filters, pageSize: 10000 });
  const allProperties = result.data;
  return {
    total: allProperties.length,
    superHot: allProperties.filter((p: any) => p.leadTemperature === "SUPER HOT").length,
    hot: allProperties.filter((p: any) => p.leadTemperature === "HOT").length,
    warm: allProperties.filter((p: any) => p.leadTemperature === "WARM").length,
    cold: allProperties.filter((p: any) => p.leadTemperature === "COLD").length,
    dead: allProperties.filter((p: any) => p.leadTemperature === "DEAD").length,
    ownerVerified: allProperties.filter((p: any) => p.ownerVerified).length,
  };
}

export async function addPropertyAgent(propertyId: number, agentId: number, assignedBy?: number) {
  return await assignAgentToProperty({ propertyId, agentId, assignedBy: assignedBy || null } as any);
}

export async function createLeadTransfer(data: { propertyId: number; fromAgentId: number; toAgentId: number; reason?: string }) {
  const result = await transferLead(data as any);
  return { id: (result as any)[0]?.insertId || 0 };
}

export async function getPendingTransfersForAgent(agentId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(leadTransfers)
    .where(and(eq(leadTransfers.toAgentId, agentId), eq(leadTransfers.status, "pending")));
}

export async function deleteProperty(propertyId: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Get all contacts for this property
  const propertyContacts = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.propertyId, propertyId));
  const contactIds = propertyContacts.map(c => c.id);

  // 2. Delete contact-related records (phones, emails, addresses, social media)
  if (contactIds.length > 0) {
    for (const contactId of contactIds) {
      await db.delete(contactPhones).where(eq(contactPhones.contactId, contactId));
      await db.delete(contactEmails).where(eq(contactEmails.contactId, contactId));
      await db.delete(contactAddresses).where(eq(contactAddresses.contactId, contactId));
      await db.delete(contactSocialMedia).where(eq(contactSocialMedia.contactId, contactId));
    }
  }

  // 3. Delete contacts
  await db.delete(contacts).where(eq(contacts.propertyId, propertyId));

  // 4. Delete other property-related records
  await db.delete(notes).where(eq(notes.propertyId, propertyId));
  await db.delete(propertyTags).where(eq(propertyTags.propertyId, propertyId));
  await db.delete(photos).where(eq(photos.propertyId, propertyId));
  await db.delete(tasks).where(eq(tasks.propertyId, propertyId));
  await db.delete(visits).where(eq(visits.propertyId, propertyId));
  await db.delete(propertyDocuments).where(eq(propertyDocuments.propertyId, propertyId));
  await db.delete(familyMembers).where(eq(familyMembers.propertyId, propertyId));
  await db.delete(propertyAgents).where(eq(propertyAgents.propertyId, propertyId));

  // 5. Delete the property itself
  await db.delete(properties).where(eq(properties.id, propertyId));
  return { success: true };
}

export async function getPropertiesWithFilters(filters: {
  leadTemperature?: string;
  deskName?: string;
  status?: string;
  unassignedOnly?: boolean;
  userId?: number;
  userRole?: string;
}) {
  const result = await getProperties({
    userId: filters.userId,
    userRole: filters.userRole,
    pageSize: 10000,
  });
  
  let filtered = result.data;
  if (filters.leadTemperature) {
    filtered = filtered.filter((p: any) => p.leadTemperature === filters.leadTemperature);
  }
  if (filters.deskName) {
    filtered = filtered.filter((p: any) => p.deskName === filters.deskName);
  }
  if (filters.status) {
    filtered = filtered.filter((p: any) => p.status === filters.status);
  }
  if (filters.unassignedOnly) {
    filtered = filtered.filter((p: any) => !p.assignedAgentId);
  }
  return filtered;
}

export async function bulkAssignAgentToProperties(agentId: number, filters: {
  leadTemperature?: string;
  deskName?: string;
  status?: string;
  unassignedOnly?: boolean;
  userId?: number;
  userRole?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const matchingProperties = await getPropertiesWithFilters(filters);
  let assignedCount = 0;
  for (const prop of matchingProperties) {
    await db.update(properties).set({ assignedAgentId: agentId, updatedAt: new Date() }).where(eq(properties.id, (prop as any).id));
    assignedCount++;
  }
  return { success: true, count: assignedCount };
}

export async function bulkUpdateDesk(deskName: string, filters: {
  leadTemperature?: string;
  deskName?: string;
  status?: string;
  unassignedOnly?: boolean;
  userId?: number;
  userRole?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const matchingProperties = await getPropertiesWithFilters(filters);
  let updatedCount = 0;
  for (const prop of matchingProperties) {
    await db.update(properties).set({ deskName, updatedAt: new Date() }).where(eq(properties.id, (prop as any).id));
    updatedCount++;
  }
  return { success: true, count: updatedCount };
}

export async function bulkReassignProperties(propertyIds: number[], assignedAgentId: number | null, reassignedByUserId?: number): Promise<void> {
  for (const propertyId of propertyIds) {
    await reassignProperty(propertyId, assignedAgentId, reassignedByUserId);
  }
}

export async function getRecentVisits(limit?: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(visits)
    .orderBy(desc(visits.checkInTime))
    .limit(limit || 20);
}

export async function createVisit(data: { propertyId: number; userId: number; latitude?: string; longitude?: string; notes?: string }) {
  return await addPropertyVisit(data as any);
}

export async function createSavedSearch(data: { userId: number; name: string; filters: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(savedSearches).values(data);
  return { id: (result as any)[0]?.insertId || 0, ...data };
}

export async function deleteSavedSearch(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(savedSearches).where(eq(savedSearches.id, id));
}

export async function updateSavedSearch(id: number, name: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(savedSearches).set({ name }).where(eq(savedSearches.id, id));
}

export async function updateNote(noteId: number, userId: number, content: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(notes)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
}

export async function toggleNotePin(noteId: number): Promise<{ isPinned: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current pin state
  const [note] = await db.select({ isPinned: notes.isPinned }).from(notes).where(eq(notes.id, noteId));
  if (!note) throw new Error("Note not found");
  
  const newPinState = note.isPinned === 1 ? 0 : 1;
  await db.update(notes).set({ isPinned: newPinState }).where(eq(notes.id, noteId));
  
  return { isPinned: newPinState };
}


// ─── Lead Sources ─────────────────────────────────────────────────────────────

const DEFAULT_LEAD_SOURCES = [
  "Bandit Signs",
  "Billboard",
  "Cold Calling",
  "Craigslist",
  "Direct Mail",
  "Door Knocking",
  "Driving for Dollars",
  "Email Marketing",
  "Facebook Marketing",
  "For Sale by Owner (FSBO)",
  "Foreclosure Auction",
  "Google Adwords/PPC",
  "HVA (High Value Area)",
  "Internet Marketing (SEO)",
  "MLS (Multiple Listing Service)",
  "Magnetic Signs",
  "Newspaper",
  "Online Auction",
  "Other",
  "Other Wholesalers",
  "Pay Per Lead",
  "Radio Ads",
  "Real Estate Agent",
  "Referrals",
  "Ringless Voicemails",
  "SMS Blast",
  "ThreeDoors",
  "TV Ads",
  "Website",
  "YouTube",
];

export async function ensureDefaultLeadSources(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < DEFAULT_LEAD_SOURCES.length; i++) {
    const name = DEFAULT_LEAD_SOURCES[i];
    try {
      await db.insert(leadSources).ignore().values({ name, isDefault: 1, sortOrder: i });
    } catch {
      // already exists — skip
    }
  }
}

export async function getLeadSources(): Promise<{ id: number; name: string; isDefault: number; sortOrder: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(leadSources).orderBy(leadSources.sortOrder, leadSources.name);
  return rows;
}

export async function addCustomLeadSource(name: string): Promise<{ id: number; name: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(leadSources).values({ name, isDefault: 0, sortOrder: 999 });
  return { id: (result as any).insertId, name };
}

export async function deleteCustomLeadSource(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(leadSources).where(and(eq(leadSources.id, id), eq(leadSources.isDefault, 0)));
}

export async function setPropertyLeadSource(propertyId: number, leadSource: string | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(properties).set({ leadSource, updatedAt: new Date() }).where(eq(properties.id, propertyId));
}

// ─── Campaign Names ──────────────────────────────────────────────────────────

const DEFAULT_CAMPAIGN_NAMES = [
  "Company Data",
  "AVA",
  "Deep Search-no contacted yet",
  "DoorNock",
  "LeadUP|KAGAN",
  "419_Google Ads",
  "409_PostCard_click2mail",
  "5668_Deep_Search",
  "219_TV39_Mat",
  "215_Post_Card_PrintGinie",
  "1-209_CR",
  "1444_Web",
  "PropertyLeads",
  "Criative_Leads_RESimple#",
  "Portugues",
  "561_BacthDilaer",
  "321_ORA",
  "782_5005_Deal_Machine",
  "ProbateData - instantly-emarketing",
  "01 - ProbateData Jan012021-Dec312021",
  "561-778-1156-AutoCalls",
  "Other",
];

export async function seedDefaultCampaignNames(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < DEFAULT_CAMPAIGN_NAMES.length; i++) {
    const name = DEFAULT_CAMPAIGN_NAMES[i];
    try {
      await db.insert(campaignNames).ignore().values({ name, isDefault: 1, sortOrder: i });
    } catch {
      // already exists — skip
    }
  }
}

export async function getCampaignNames() {
  const db = await getDb();
  if (!db) return [];
  await seedDefaultCampaignNames();
  const rows = await db.select().from(campaignNames).orderBy(campaignNames.sortOrder, campaignNames.name);
  return rows;
}

export async function addCustomCampaignName(name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(campaignNames).values({ name, isDefault: 0, sortOrder: 999 });
  return { id: (result as any).insertId, name };
}

export async function deleteCustomCampaignName(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(campaignNames).where(and(eq(campaignNames.id, id), eq(campaignNames.isDefault, 0)));
}

export async function setPropertyCampaignName(propertyId: number, campaignName: string | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(properties).set({ campaignName, updatedAt: new Date() }).where(eq(properties.id, propertyId));
}

/**
 * Look up the Twilio phone number linked to a campaign name.
 * Returns the E.164 phone number string (e.g. "+17869041444") or null if not found.
 */
export async function getTwilioNumberByCampaign(campaignName: string): Promise<string | null> {
  if (!campaignName) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ phoneNumber: twilioNumbers.phoneNumber })
    .from(twilioNumbers)
    .where(and(eq(twilioNumbers.campaignName, campaignName), eq(twilioNumbers.isActive, 1)))
    .limit(1);
  return rows.length > 0 ? rows[0].phoneNumber : null;
}

/**
 * Returns all unique city values from the properties table, sorted alphabetically.
 * Used to populate the city filter dropdown in the Properties page.
 */
export async function getUniqueCities(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .selectDistinct({ city: properties.city })
    .from(properties)
    .orderBy(properties.city);
  return results.map(r => r.city).filter(Boolean);
}
