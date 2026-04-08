import { eq, sql, asc } from "drizzle-orm";
import { desks, properties } from "../drizzle/schema";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/**
 * List all desks ordered by sortOrder
 */
export async function listDesks() {
  const db = await requireDb();
  const rows = await db.select().from(desks).orderBy(asc(desks.sortOrder), asc(desks.name));
  return rows;
}

/**
 * Get a single desk by ID
 */
export async function getDeskById(id: number) {
  const db = await requireDb();
  const [row] = await db.select().from(desks).where(eq(desks.id, id));
  return row || null;
}

/**
 * Get a single desk by name
 */
export async function getDeskByName(name: string) {
  const db = await requireDb();
  const [row] = await db.select().from(desks).where(eq(desks.name, name));
  return row || null;
}

/**
 * Create a new desk
 */
export async function createDesk(data: { name: string; description?: string; color?: string; icon?: string }) {
  const db = await requireDb();
  // Get max sortOrder to place new desk at end
  const [maxRow] = await db.select({ maxSort: sql<number>`COALESCE(MAX(sortOrder), 0)` }).from(desks);
  const nextSort = (maxRow?.maxSort ?? 0) + 1;
  
  const [result] = await db.insert(desks).values({
    name: data.name,
    description: data.description || null,
    color: data.color || null,
    icon: data.icon || null,
    sortOrder: nextSort,
    isSystem: 0,
  }).$returningId();
  
  return { id: result.id, name: data.name };
}

/**
 * Update a desk (rename, change description/color)
 */
export async function updateDesk(id: number, data: { name?: string; description?: string; color?: string; icon?: string }) {
  const db = await requireDb();
  
  // Get the current desk
  const [current] = await db.select().from(desks).where(eq(desks.id, id));
  if (!current) throw new Error("Desk not found");
  
  const oldName = current.name;
  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.color !== undefined) updates.color = data.color;
  if (data.icon !== undefined) updates.icon = data.icon;
  
  if (Object.keys(updates).length === 0) return { success: true };
  
  await db.update(desks).set(updates).where(eq(desks.id, id));
  
  // If name changed, update all properties referencing the old name
  if (data.name && data.name !== oldName) {
    await db.update(properties)
      .set({ deskName: data.name })
      .where(eq(properties.deskName, oldName));
  }
  
  return { success: true, oldName, newName: data.name || oldName };
}

/**
 * Delete a desk and transfer all its properties to another desk
 */
export async function deleteDesk(id: number, transferToDeskId: number) {
  const db = await requireDb();
  
  // Get the desk to delete
  const [deskToDelete] = await db.select().from(desks).where(eq(desks.id, id));
  if (!deskToDelete) throw new Error("Desk not found");
  if (deskToDelete.isSystem === 1) throw new Error("Cannot delete a system desk");
  
  // Get the target desk
  const [targetDesk] = await db.select().from(desks).where(eq(desks.id, transferToDeskId));
  if (!targetDesk) throw new Error("Target desk not found");
  
  // Count properties that will be transferred
  const [countRow] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(properties)
    .where(eq(properties.deskName, deskToDelete.name));
  const transferredCount = Number(countRow?.count ?? 0);
  
  // Transfer all properties from deleted desk to target desk
  if (transferredCount > 0) {
    // Determine deskStatus based on target desk name
    let newDeskStatus: "BIN" | "ACTIVE" | "DEAD" = "ACTIVE";
    if (targetDesk.name === "BIN" || targetDesk.name === "NEW_LEAD") newDeskStatus = "BIN";
    if (targetDesk.name === "DEAD") newDeskStatus = "DEAD";
    
    await db.update(properties)
      .set({ 
        deskName: targetDesk.name,
        deskStatus: newDeskStatus,
      })
      .where(eq(properties.deskName, deskToDelete.name));
  }
  
  // Delete the desk
  await db.delete(desks).where(eq(desks.id, id));
  
  return {
    success: true,
    deletedDesk: deskToDelete.name,
    transferredTo: targetDesk.name,
    transferredCount,
  };
}

/**
 * Get property count per desk (for display in management page)
 */
export async function getDeskPropertyCounts(): Promise<Record<string, number>> {
  const db = await requireDb();
  const rows = await db
    .select({
      deskName: properties.deskName,
      count: sql<number>`COUNT(*)`,
    })
    .from(properties)
    .groupBy(properties.deskName);
  
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = row.deskName || "UNASSIGNED";
    counts[key] = Number(row.count);
  }
  return counts;
}
