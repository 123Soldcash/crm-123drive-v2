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
  const result = await db.insert(agents).values({
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role || "Birddog",
    agentType: data.agentType || "Internal",
    status: data.status || "Active",
    notes: data.notes,
  }).$returningId();
  
  return result[0];
}

export async function updateAgent(agentId: number, data: Partial<typeof agents.$inferInsert>) {
  const db = await getDb();
  await db.update(agents).set(data).where(eq(agents.id, agentId));
  const updated = await db.select().from(agents).where(eq(agents.id, agentId));
  return updated[0];
}

export async function getAgent(agentId: number) {
  const db = await getDb();
  const agent = await db.select().from(agents).where(eq(agents.id, agentId));
  return agent[0];
}

export async function listAgents(filters?: { status?: string; agentType?: string; role?: string }) {
  const db = await getDb();
  let query = db.select().from(agents);
  
  const conditions = [];
  if (filters?.status) conditions.push(eq(agents.status, filters.status));
  if (filters?.agentType) conditions.push(eq(agents.agentType, filters.agentType));
  if (filters?.role) conditions.push(eq(agents.role, filters.role));
  
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
  
  // Check if permission already exists
  const existing = await db
    .select()
    .from(agentPermissions)
    .where(and(eq(agentPermissions.agentId, agentId), eq(agentPermissions.feature, feature)));
  
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
  
  const existing = await db
    .select()
    .from(agentPermissions)
    .where(and(eq(agentPermissions.agentId, agentId), eq(agentPermissions.feature, feature)));
  
  if (existing.length > 0) {
    await db
      .update(agentPermissions)
      .set({ granted: 0 })
      .where(and(eq(agentPermissions.agentId, agentId), eq(agentPermissions.feature, feature)));
  }
}

export async function hasPermission(agentId: number, feature: string): Promise<boolean> {
  const db = await getDb();
  
  // Get agent
  const agent = await getAgent(agentId);
  if (!agent) return false;
  
  // Admins have all permissions
  if (agent.role === "Admin" || agent.role === "Manager") return true;
  
  // Check specific permission
  const permission = await db
    .select()
    .from(agentPermissions)
    .where(and(eq(agentPermissions.agentId, agentId), eq(agentPermissions.feature, feature)));
  
  return permission.length > 0 && permission[0].granted === 1;
}

export async function getAgentPermissions(agentId: number) {
  const db = await getDb();
  return db.select().from(agentPermissions).where(eq(agentPermissions.agentId, agentId));
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
  
  // Check if already assigned
  const existing = await db
    .select()
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
  return db.select().from(leadAssignments).where(eq(leadAssignments.propertyId, propertyId));
}

export async function getAgentLeads(agentId: number, includeShared: boolean = false) {
  const db = await getDb();
  
  const conditions = [eq(leadAssignments.agentId, agentId)];
  if (!includeShared) {
    conditions.push(eq(leadAssignments.assignmentType, "Exclusive"));
  }
  
  const assignments = await db
    .select()
    .from(leadAssignments)
    .where(and(...conditions));
  
  // Get the actual properties
  const propertyIds = assignments.map((a) => a.propertyId);
  if (propertyIds.length === 0) return [];
  
  return db.select().from(properties).where(or(...propertyIds.map((id) => eq(properties.id, id))));
}

export async function removeLeadAssignment(propertyId: number, agentId: number) {
  const db = await getDb();
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
  return db.select().from(leadTransferHistory).where(eq(leadTransferHistory.propertyId, propertyId));
}

// ============ AGENT FILTERING & SEARCH ============

export async function searchAgentsByMention(query: string) {
  const db = await getDb();
  const agents_list = await db
    .select()
    .from(agents)
    .where(or(
      eq(agents.status, "Active"),
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
  return db
    .select()
    .from(agents)
    .where(or(eq(agents.agentType, "External"), eq(agents.agentType, "Birddog"), eq(agents.agentType, "Corretor")));
}

export async function getInternalAgents() {
  const db = await getDb();
  return db.select().from(agents).where(eq(agents.agentType, "Internal"));
}

// ============ AGENT PERFORMANCE ============

export async function getAgentStats(agentId: number) {
  const db = await getDb();
  
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
