import { getDb } from "./db";
import { emailWhitelist } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Check if an email is in the whitelist
 */
export async function isEmailWhitelisted(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select({ id: emailWhitelist.id })
    .from(emailWhitelist)
    .where(eq(emailWhitelist.email, email.toLowerCase().trim()))
    .limit(1);

  return result.length > 0;
}

/**
 * Get whitelist entry by email (returns role and other info)
 */
export async function getWhitelistEntry(email: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(emailWhitelist)
    .where(eq(emailWhitelist.email, email.toLowerCase().trim()))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * List all whitelisted emails
 */
export async function listWhitelist() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(emailWhitelist)
    .orderBy(emailWhitelist.createdAt);
}

/**
 * Add an email to the whitelist
 */
export async function addToWhitelist(data: {
  email: string;
  role?: "agent" | "admin";
  name?: string;
  addedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedEmail = data.email.toLowerCase().trim();

  // Check if already exists
  const existing = await db
    .select({ id: emailWhitelist.id })
    .from(emailWhitelist)
    .where(eq(emailWhitelist.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Email already in whitelist");
  }

  await db.insert(emailWhitelist).values({
    email: normalizedEmail,
    role: data.role || "agent",
    name: data.name || null,
    addedBy: data.addedBy,
  });

  return { success: true };
}

/**
 * Remove an email from the whitelist
 */
export async function removeFromWhitelist(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(emailWhitelist).where(eq(emailWhitelist.id, id));
  return { success: true };
}

/**
 * Mark a whitelist entry as used (when the user successfully logs in)
 */
export async function markWhitelistUsed(email: string) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(emailWhitelist)
    .set({ usedAt: new Date() })
    .where(eq(emailWhitelist.email, email.toLowerCase().trim()));
}
