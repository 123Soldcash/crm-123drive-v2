import { getDb } from "./db";
import { agents, agentPermissions, leadAssignments, leadTransferHistory, properties } from "../drizzle/schema";
import { eq, and, or } from "drizzle-orm";

/**
 * Agent Management Database Functions
 */

// ============ AGENT CRUD ============

export async function createAgent(data: {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  agentType?: string;
  status?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(agents).values({
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: (data.role || "Birddog") as any,
    agentType: (data.agentType || "Internal") as any,
    status: (data.status || "Active") as any,
    notes: data.notes,
  }).$returningId();
  
  return result[0];
}

export async function updateAgent(agentId: number, data: Partial<typeof agents.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(agents).set(data as any).where(eq(agents.id, agentId));
  const updated = await db.select({ id: agents.id, name: agents.name, email: agents.email, phone: agents.phone, role: agents.role, agentType: agents.agentType, status: agents.status, notes: agents.notes, createdAt: agents.createdAt, updatedAt: agents.updatedAt }).from(agents).where(eq(agents.id, agentId));
  return updated[0];
}

export async function getAgent(agentId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const agent = await db.select({ id: agents.id, name: agents.name, email: agents.email, phone: agents.phone, role: agents.role, agentType: agents.agentType, status: agents.status, notes: agents.notes, createdAt: agents.createdAt, updatedAt: agents.updatedAt }).from(agents).where(eq(agents.id, agentId));
  return agent[0];
}

export async function listAgents(filters?: { status?: string; agentType?: string; role?: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  let query = db.select({ id: agents.id, name: agents.name, email: agents.email, phone: agents.phone, role: agents.role, agentType: agents.agentType, status: agents.status, notes: agents.notes, createdAt: agents.createdAt, updatedAt: agents.updatedAt }).from(agents);
  
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(agents.status, filters.status as any));
  if (filters?.agentType) conditions.push(eq(agents.agentType, filters.agentType as any));
  if (filters?.role) conditions.push(eq(agents.role, filters.role as any));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  
  return query;
}

export async function deleteAgent(agentId: number) {
  const db = await getDb();
  await db.delete(agents).where(eq(agents.id, agentId));
}

// ============ AGENT PERMISSIONS ============

export async function grantPermission(agentId: number, feature: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Check if permission already exists
  const existing = await db
    .select({ id: agentPermissions.id, agentId: agentPermissions.agentId, feature: agentPermissions.feature, granted: agentPermissions.granted })
    .from(agentPermissions)
    .where(and(eq(agentPermissions.agentId, agentId), eq(agentPermissions.feature, feature as any)));
  
  if (existing.length > 0) {
    // Update existing
    await db
      .update(agentPermissions)
      .set({ granted: 1 })
      .where(and(eq(agentPermissions.agentId, agentId), eq(agentPermissions.feature, feature)));
  } else {
    // Create new
    await db.insert(agentPermissions).values({
      agentId,
      feature,
      granted: 1,
    });
  }
}

export async function revokePermission(agentId: number, feature: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const existing = await db
    .select()
    .from(agentPermissions)
    .where(and(eq(agentPermissions.agentId, agentId), eq(agentPermissions.feature, feature as any)));
  
  if (existing.length > 0) {
    await db
      .update(agentPermissions)
      .set({ granted: 0 })
      .where(and(eq(agentPermissions.agentId, agentId), eq(agentPermissions.feature, feature)));
  }
}

export async function hasPermission(agentId: number, feature: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Get agent
  const agent = await getAgent(agentId);
  if (!agent) return false;
  
  // Admins have all permissions
  if (agent.role === "Admin" || agent.role === "Manager") return true;
  
  // Check specific permission
  const permission = await db
    .select()
    .from(agentPermissions)
    .where(and(eq(agentPermissions.agentId, agentId), eq(agentPermissions.feature, feature as any)));
  
  return permission.length > 0 && permission[0].granted === 1;
}

export async function getAgentPermissions(agentId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select({ id: agentPermissions.id, agentId: agentPermissions.agentId, feature: agentPermissions.feature, granted: agentPermissions.granted }).from(agentPermissions).where(eq(agentPermissions.agentId, agentId));
}

// ============ LEAD ASSIGNMENTS ============

export async function assignLeadToAgent(
  propertyId: number,
  agentId: number,
  assignmentType: "Exclusive" | "Shared" | "Temporary" = "Shared",
  assignedBy?: number,
  expiresAt?: Date
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Check if already assigned
  const existing = await db
    .select({ id: leadAssignments.id, propertyId: leadAssignments.propertyId, agentId: leadAssignments.agentId, assignmentType: leadAssignments.assignmentType, assignedBy: leadAssignments.assignedBy, expiresAt: leadAssignments.expiresAt })
    .from(leadAssignments)
    .where(and(eq(leadAssignments.propertyId, propertyId), eq(leadAssignments.agentId, agentId)));
  
  if (existing.length > 0) {
    // Update existing
    await db
      .update(leadAssignments)
      .set({ assignmentType, expiresAt })
      .where(and(eq(leadAssignments.propertyId, propertyId), eq(leadAssignments.agentId, agentId)));
  } else {
    // Create new
    const result = await db.insert(leadAssignments).values({
      propertyId,
      agentId,
      assignmentType,
      assignedBy,
      expiresAt,
    }).$returningId();
    
    return result[0];
  }
}

export async function getLeadAssignments(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select({ id: leadAssignments.id, propertyId: leadAssignments.propertyId, agentId: leadAssignments.agentId, assignmentType: leadAssignments.assignmentType, assignedBy: leadAssignments.assignedBy, expiresAt: leadAssignments.expiresAt }).from(leadAssignments).where(eq(leadAssignments.propertyId, propertyId));
}

export async function getAgentLeads(agentId: number, includeShared: boolean = false) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const conditions: any[] = [eq(leadAssignments.agentId, agentId)];
  if (!includeShared) {
    conditions.push(eq(leadAssignments.assignmentType, "Exclusive" as any));
  }
  
  const assignments = await db
    .select({ id: leadAssignments.id, propertyId: leadAssignments.propertyId, agentId: leadAssignments.agentId, assignmentType: leadAssignments.assignmentType, assignedBy: leadAssignments.assignedBy, expiresAt: leadAssignments.expiresAt })
    .from(leadAssignments)
    .where(and(...conditions));
  
  // Get the actual properties
  const propertyIds = assignments.map((a) => a.propertyId);
  if (propertyIds.length === 0) return [];
  
  return db.select({ id: properties.id, leadId: properties.leadId, addressLine1: properties.addressLine1, addressLine2: properties.addressLine2, city: properties.city, state: properties.state, zipcode: properties.zipcode, owner1Name: properties.owner1Name, owner2Name: properties.owner2Name, estimatedValue: properties.estimatedValue, equityPercent: properties.equityPercent, leadTemperature: properties.leadTemperature, trackingStatus: properties.trackingStatus, ownerVerified: properties.ownerVerified, assignedAgentId: properties.assignedAgentId }).from(properties).where(or(...propertyIds.map((id) => eq(properties.id, id))));
}

export async function removeLeadAssignment(propertyId: number, agentId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .delete(leadAssignments)
    .where(and(eq(leadAssignments.propertyId, propertyId), eq(leadAssignments.agentId, agentId)));
}

// ============ LEAD TRANSFERS ============

export async function transferLead(
  propertyId: number,
  toAgentId: number,
  transferredBy: number,
  reason?: string,
  fromAgentId?: number
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Record transfer in history
  const result = await db.insert(leadTransferHistory).values({
    propertyId,
    fromAgentId,
    toAgentId,
    transferredBy,
    reason,
    status: "Completed",
  }).$returningId();
  
  // Remove old assignment if exists
  if (fromAgentId) {
    await removeLeadAssignment(propertyId, fromAgentId);
  }
  
  // Create new assignment
  await assignLeadToAgent(propertyId, toAgentId, "Exclusive", transferredBy);
  
  // Update property assignedAgentId
  await db.update(properties).set({ assignedAgentId: toAgentId }).where(eq(properties.id, propertyId));
  
  return result[0];
}

export async function getLeadTransferHistory(propertyId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select({ id: leadTransferHistory.id, propertyId: leadTransferHistory.propertyId, fromAgentId: leadTransferHistory.fromAgentId, toAgentId: leadTransferHistory.toAgentId, transferredBy: leadTransferHistory.transferredBy, reason: leadTransferHistory.reason, status: leadTransferHistory.status, createdAt: leadTransferHistory.createdAt }).from(leadTransferHistory).where(eq(leadTransferHistory.propertyId, propertyId));
}

// ============ AGENT FILTERING & SEARCH ============

export async function searchAgentsByMention(query: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const agents_list = await db
    .select({ id: agents.id, name: agents.name, email: agents.email, phone: agents.phone, role: agents.role, agentType: agents.agentType, status: agents.status, notes: agents.notes, createdAt: agents.createdAt, updatedAt: agents.updatedAt })
    .from(agents)
    .where(or(
      eq(agents.status, "Active" as any),
      // Can add more conditions for search
    ));
  
  // Filter by name or email containing query
  return agents_list.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.email.toLowerCase().includes(query.toLowerCase())
  );
}

export async function getExternalAgents() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db
    .select({ id: agents.id, name: agents.name, email: agents.email, phone: agents.phone, role: agents.role, agentType: agents.agentType, status: agents.status, notes: agents.notes, createdAt: agents.createdAt, updatedAt: agents.updatedAt })
    .from(agents)
    .where(or(eq(agents.agentType, "External" as any), eq(agents.agentType, "Birddog" as any), eq(agents.agentType, "Corretor" as any)));
}

export async function getInternalAgents() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select({ id: agents.id, name: agents.name, email: agents.email, phone: agents.phone, role: agents.role, agentType: agents.agentType, status: agents.status, notes: agents.notes, createdAt: agents.createdAt, updatedAt: agents.updatedAt }).from(agents).where(eq(agents.agentType, "Internal" as any));
}

// ============ AGENT PERFORMANCE ============

export async function getAgentStats(agentId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Get assigned leads
  const leads = await getAgentLeads(agentId, true);
  
  // Get agent info
  const agent = await getAgent(agentId);
  
  // Count by lead temperature
  const hotLeads = leads.filter((l) => l.leadTemperature === "HOT" || l.leadTemperature === "SUPER HOT").length;
  const warmLeads = leads.filter((l) => l.leadTemperature === "WARM").length;
  const coldLeads = leads.filter((l) => l.leadTemperature === "COLD").length;
  
  return {
    agent,
    totalLeads: leads.length,
    hotLeads,
    warmLeads,
    coldLeads,
    leads,
  };
}
