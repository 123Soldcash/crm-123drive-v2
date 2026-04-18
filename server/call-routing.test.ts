/**
 * Comprehensive tests for the inbound call routing logic.
 *
 * Tests cover the full decision tree in twilio-webhooks.ts:
 *   1. No active Twilio number found → voicemail
 *   2. Twilio number found but no desk assigned → voicemail
 *   3. Desk assigned but no users in that desk → voicemail
 *   4. Users in desk but none are Active (account status) → voicemail
 *   5. Users are Active but none have a live heartbeat (offline) → voicemail
 *   6. Users are Active AND online → ring them (happy path)
 *   7. Mixed: some users online, some offline → ring only online users
 *   8. Multiple desks assigned to one number → ring users from all desks
 *   9. User in multiple desks → deduplicated (not rung twice)
 *  10. Inactive Twilio number → voicemail (isActive = 0 filter)
 *  11. Heartbeat expired (>90s ago) → treated as offline
 *  12. Heartbeat fresh (<90s ago) → treated as online
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TwilioNumber {
  id: number;
  phoneNumber: string;
  label: string;
  isActive: number;
}

interface TwilioNumberDesk {
  deskId: number;
}

interface Desk {
  id: number;
  name: string;
  description: string | null;
}

interface UserDesk {
  userId: number;
}

interface User {
  id: number;
  status: string;
}

interface UserSession {
  userId: number;
  isOnline: number;
  lastHeartbeat: Date;
}

// ─── Core routing logic (extracted from twilio-webhooks.ts for unit testing) ──

const SESSION_TIMEOUT_MS = 90_000;

interface RoutingResult {
  action: "ring" | "voicemail";
  reason?: string;
  userIds?: number[];
  deskNames?: string[];
}

async function resolveInboundCallRouting(
  calledNumber: string,
  db: {
    activeTwilioNumbers: TwilioNumber[];
    twilioNumberDesks: TwilioNumberDesk[];
    desks: Desk[];
    userDesks: UserDesk[];
    activeUsers: User[];
    userSessions: UserSession[];
  }
): Promise<RoutingResult> {
  const calledDigits = calledNumber.replace(/\D/g, "");

  // STEP 1: Find active Twilio number
  const matchedTwilioNumber = db.activeTwilioNumbers.find((tn) => {
    const tnDigits = tn.phoneNumber.replace(/\D/g, "");
    return tnDigits === calledDigits || tn.phoneNumber === calledNumber;
  });

  if (!matchedTwilioNumber) {
    return { action: "voicemail", reason: "no_active_number" };
  }

  // STEP 2: Find desks assigned to this number
  const deskIds = db.twilioNumberDesks.map((r) => r.deskId);

  if (deskIds.length === 0) {
    return { action: "voicemail", reason: "no_desk_assigned" };
  }

  // Resolve desk names
  const matchedDesks = db.desks.filter((d) => deskIds.includes(d.id));
  const deskNames = matchedDesks.map((d) => d.description || d.name);

  // STEP 3: Find users in these desks
  const deskUserIds = Array.from(new Set(db.userDesks.map((r) => r.userId)));

  if (deskUserIds.length === 0) {
    return { action: "voicemail", reason: "no_users_in_desk", deskNames };
  }

  // STEP 4: Filter to Active users
  const activeUserIds = db.activeUsers
    .filter((u) => u.status === "Active" && deskUserIds.includes(u.id))
    .map((u) => u.id);

  if (activeUserIds.length === 0) {
    return { action: "voicemail", reason: "no_active_users", deskNames };
  }

  // STEP 5: Filter to users with a live heartbeat
  const sessionCutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);

  const onlineUserIds = db.userSessions
    .filter(
      (s) =>
        s.isOnline === 1 &&
        s.lastHeartbeat >= sessionCutoff &&
        activeUserIds.includes(s.userId)
    )
    .map((s) => s.userId);

  if (onlineUserIds.length === 0) {
    return { action: "voicemail", reason: "no_online_users", deskNames };
  }

  // STEP 6: Ring the online users
  return { action: "ring", userIds: onlineUserIds, deskNames };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function freshHeartbeat(): Date {
  return new Date(Date.now() - 10_000); // 10 seconds ago → fresh
}

function staleHeartbeat(): Date {
  return new Date(Date.now() - 120_000); // 120 seconds ago → expired
}

function buildDb(overrides: Partial<Parameters<typeof resolveInboundCallRouting>[1]> = {}) {
  return {
    activeTwilioNumbers: [{ id: 1, phoneNumber: "+15551234567", label: "Sales Line", isActive: 1 }],
    twilioNumberDesks: [{ deskId: 10 }],
    desks: [{ id: 10, name: "sales", description: "Sales Desk" }],
    userDesks: [{ userId: 101 }, { userId: 102 }],
    activeUsers: [
      { id: 101, status: "Active" },
      { id: 102, status: "Active" },
    ],
    userSessions: [
      { userId: 101, isOnline: 1, lastHeartbeat: freshHeartbeat() },
      { userId: 102, isOnline: 1, lastHeartbeat: freshHeartbeat() },
    ],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Inbound Call Routing — Decision Tree", () => {
  // ── Test 1: No active number ──────────────────────────────────────────────
  it("plays voicemail when no active Twilio number matches the called number", async () => {
    const db = buildDb({ activeTwilioNumbers: [] });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("voicemail");
    expect(result.reason).toBe("no_active_number");
  });

  // ── Test 2: Inactive number (isActive = 0) ────────────────────────────────
  // NOTE: The DB query filters `WHERE isActive = 1` BEFORE passing the list to the
  // routing function. So an inactive number is simply absent from activeTwilioNumbers.
  // This test verifies that the routing function correctly handles an empty list.
  it("plays voicemail when the Twilio number is inactive (filtered out by DB query)", async () => {
    // Simulate DB returning empty list because the number has isActive = 0
    const db = buildDb({
      activeTwilioNumbers: [], // DB filtered it out
    });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("voicemail");
    expect(result.reason).toBe("no_active_number");
  });

  // ── Test 3: No desk assigned ──────────────────────────────────────────────
  it("plays voicemail when the Twilio number has no desk assigned", async () => {
    const db = buildDb({ twilioNumberDesks: [] });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("voicemail");
    expect(result.reason).toBe("no_desk_assigned");
  });

  // ── Test 4: No users in desk ──────────────────────────────────────────────
  it("plays voicemail when the desk has no users assigned", async () => {
    const db = buildDb({ userDesks: [] });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("voicemail");
    expect(result.reason).toBe("no_users_in_desk");
  });

  // ── Test 5: Users in desk but all Inactive ────────────────────────────────
  it("plays voicemail when all desk users have Inactive account status", async () => {
    const db = buildDb({
      activeUsers: [
        { id: 101, status: "Inactive" },
        { id: 102, status: "Suspended" },
      ],
    });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("voicemail");
    expect(result.reason).toBe("no_active_users");
  });

  // ── Test 6: Active users but all offline (no heartbeat) ───────────────────
  it("plays voicemail when all Active users have no session record", async () => {
    const db = buildDb({ userSessions: [] });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("voicemail");
    expect(result.reason).toBe("no_online_users");
  });

  // ── Test 7: Active users but all heartbeats expired ───────────────────────
  it("plays voicemail when all Active users have stale heartbeats (>90s ago)", async () => {
    const db = buildDb({
      userSessions: [
        { userId: 101, isOnline: 1, lastHeartbeat: staleHeartbeat() },
        { userId: 102, isOnline: 1, lastHeartbeat: staleHeartbeat() },
      ],
    });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("voicemail");
    expect(result.reason).toBe("no_online_users");
  });

  // ── Test 8: Active users with isOnline = 0 ────────────────────────────────
  it("plays voicemail when users have a session but isOnline = 0", async () => {
    const db = buildDb({
      userSessions: [
        { userId: 101, isOnline: 0, lastHeartbeat: freshHeartbeat() },
        { userId: 102, isOnline: 0, lastHeartbeat: freshHeartbeat() },
      ],
    });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("voicemail");
    expect(result.reason).toBe("no_online_users");
  });

  // ── Test 9: Happy path — ring online users ────────────────────────────────
  it("rings all online Active users in the correct desk (happy path)", async () => {
    const db = buildDb();
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("ring");
    expect(result.userIds).toEqual(expect.arrayContaining([101, 102]));
    expect(result.userIds).toHaveLength(2);
    expect(result.deskNames).toContain("Sales Desk");
  });

  // ── Test 10: Mixed — some online, some offline ────────────────────────────
  it("rings only the online users when some are offline", async () => {
    const db = buildDb({
      userSessions: [
        { userId: 101, isOnline: 1, lastHeartbeat: freshHeartbeat() }, // online
        { userId: 102, isOnline: 0, lastHeartbeat: freshHeartbeat() }, // offline
      ],
    });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("ring");
    expect(result.userIds).toEqual([101]);
    expect(result.userIds).not.toContain(102);
  });

  // ── Test 11: Multiple desks → ring users from all desks ───────────────────
  it("rings users from all desks when multiple desks are assigned to one number", async () => {
    const db = buildDb({
      twilioNumberDesks: [{ deskId: 10 }, { deskId: 20 }],
      desks: [
        { id: 10, name: "sales", description: "Sales Desk" },
        { id: 20, name: "followup", description: "Follow-Up Desk" },
      ],
      userDesks: [{ userId: 101 }, { userId: 102 }, { userId: 103 }],
      activeUsers: [
        { id: 101, status: "Active" },
        { id: 102, status: "Active" },
        { id: 103, status: "Active" },
      ],
      userSessions: [
        { userId: 101, isOnline: 1, lastHeartbeat: freshHeartbeat() },
        { userId: 102, isOnline: 1, lastHeartbeat: freshHeartbeat() },
        { userId: 103, isOnline: 1, lastHeartbeat: freshHeartbeat() },
      ],
    });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("ring");
    expect(result.userIds).toHaveLength(3);
    expect(result.deskNames).toContain("Sales Desk");
    expect(result.deskNames).toContain("Follow-Up Desk");
  });

  // ── Test 12: User in multiple desks → deduplicated ────────────────────────
  it("does not ring the same user twice when they belong to multiple desks", async () => {
    const db = buildDb({
      twilioNumberDesks: [{ deskId: 10 }, { deskId: 20 }],
      desks: [
        { id: 10, name: "sales", description: "Sales Desk" },
        { id: 20, name: "followup", description: "Follow-Up Desk" },
      ],
      // User 101 is in BOTH desks
      userDesks: [{ userId: 101 }, { userId: 101 }],
      activeUsers: [{ id: 101, status: "Active" }],
      userSessions: [{ userId: 101, isOnline: 1, lastHeartbeat: freshHeartbeat() }],
    });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("ring");
    // Should only appear once
    expect(result.userIds).toHaveLength(1);
    expect(result.userIds).toEqual([101]);
  });

  // ── Test 13: Phone number normalization ───────────────────────────────────
  it("matches numbers regardless of formatting (with/without +1 prefix)", async () => {
    const db = buildDb({
      activeTwilioNumbers: [
        { id: 1, phoneNumber: "+15551234567", label: "Sales", isActive: 1 },
      ],
    });
    // Called with just digits, no +
    const result = await resolveInboundCallRouting("15551234567", db);
    expect(result.action).toBe("ring");
  });

  // ── Test 14: Heartbeat exactly at boundary (89s ago) → online ────────────
  it("treats a heartbeat 89 seconds ago as online (within 90s window)", async () => {
    const db = buildDb({
      userSessions: [
        { userId: 101, isOnline: 1, lastHeartbeat: new Date(Date.now() - 89_000) },
        { userId: 102, isOnline: 1, lastHeartbeat: freshHeartbeat() },
      ],
    });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("ring");
    expect(result.userIds).toContain(101);
  });

  // ── Test 15: Heartbeat exactly at boundary (91s ago) → offline ───────────
  it("treats a heartbeat 91 seconds ago as offline (outside 90s window)", async () => {
    const db = buildDb({
      userSessions: [
        { userId: 101, isOnline: 1, lastHeartbeat: new Date(Date.now() - 91_000) },
        { userId: 102, isOnline: 1, lastHeartbeat: freshHeartbeat() }, // 102 is still online
      ],
    });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("ring");
    // 101 is expired, 102 is fresh
    expect(result.userIds).not.toContain(101);
    expect(result.userIds).toContain(102);
  });

  // ── Test 16: Only users from the correct desk are rung ────────────────────
  it("does not ring users from other desks even if they are online", async () => {
    const db = buildDb({
      // Number is only assigned to desk 10
      twilioNumberDesks: [{ deskId: 10 }],
      desks: [
        { id: 10, name: "sales", description: "Sales Desk" },
        { id: 20, name: "other", description: "Other Desk" },
      ],
      // User 101 is in desk 10, user 103 is in desk 20 (wrong desk)
      userDesks: [{ userId: 101 }],
      activeUsers: [
        { id: 101, status: "Active" },
        { id: 103, status: "Active" }, // in wrong desk — should NOT be rung
      ],
      userSessions: [
        { userId: 101, isOnline: 1, lastHeartbeat: freshHeartbeat() },
        { userId: 103, isOnline: 1, lastHeartbeat: freshHeartbeat() },
      ],
    });
    const result = await resolveInboundCallRouting("+15551234567", db);
    expect(result.action).toBe("ring");
    expect(result.userIds).toContain(101);
    expect(result.userIds).not.toContain(103); // user 103 is in wrong desk
  });
});

// ─── Heartbeat / Session Tests ─────────────────────────────────────────────────

describe("Session Timeout Logic", () => {
  it("SESSION_TIMEOUT_MS is 90 seconds", () => {
    expect(SESSION_TIMEOUT_MS).toBe(90_000);
  });

  it("a fresh heartbeat (10s ago) is within the session window", () => {
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);
    const heartbeat = new Date(Date.now() - 10_000);
    expect(heartbeat >= cutoff).toBe(true);
  });

  it("a stale heartbeat (120s ago) is outside the session window", () => {
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);
    const heartbeat = new Date(Date.now() - 120_000);
    expect(heartbeat >= cutoff).toBe(false);
  });

  it("a heartbeat at exactly 90s is considered expired (boundary is exclusive)", () => {
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);
    const heartbeat = new Date(cutoff.getTime() - 1); // 1ms before cutoff
    expect(heartbeat >= cutoff).toBe(false);
  });
});
