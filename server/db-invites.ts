import { getDb } from "./db";
import { invites, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createInvite(
  role: "agent" | "admin",
  createdBy: number,
  email?: string,
  expiresInDays = 7
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  await db.insert(invites).values({
    token,
    email: email || null,
    role,
    createdBy,
    status: "pending",
    expiresAt,
  });

  return { token, email, role, expiresAt };
}

export async function getInviteByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const result = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);

  return result[0] || null;
}

export async function isInviteValid(token: string): Promise<boolean> {
  const invite = await getInviteByToken(token);
  if (!invite) return false;
  if (invite.status !== "pending") return false;
  if (new Date() > invite.expiresAt) {
    const db = await getDb();
    if (db) {
      await db.update(invites).set({ status: "expired" }).where(eq(invites.token, token));
    }
    return false;
  }
  return true;
}

export async function acceptInvite(
  token: string,
  name: string,
  phone: string | null,
  password: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const invite = await getInviteByToken(token);
  if (!invite) throw new Error("Invite not found");
  if (invite.status !== "pending") throw new Error("Invite already used or cancelled");
  if (new Date() > invite.expiresAt) throw new Error("Invite expired");

  // Create user
  const newUserResult = await db
    .insert(users)
    .values({
      email: invite.email || null,
      name,
      phone: phone || null,
      role: invite.role,
      openId: `invite-${token.substring(0, 16)}`,
      loginMethod: "invite",
      status: "Active",
    })
    .$returningId();

  const userId = newUserResult[0]?.id;
  if (!userId) throw new Error("Failed to create user");

  // Mark invite as accepted
  await db
    .update(invites)
    .set({ status: "accepted", acceptedBy: userId, acceptedAt: new Date() })
    .where(eq(invites.token, token));

  return { userId, role: invite.role, name };
}

export async function getPendingInvites() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  return await db
    .select()
    .from(invites)
    .where(eq(invites.status, "pending"));
}

export async function cancelInvite(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db.update(invites).set({ status: "cancelled" }).where(eq(invites.token, token));
}
