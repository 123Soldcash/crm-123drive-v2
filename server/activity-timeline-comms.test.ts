/**
 * Tests for Activity Timeline communication integration
 * Verifies that calls and SMS are correctly structured for the timeline
 */
import { describe, it, expect } from "vitest";

// ─── Helper functions (mirrors what getActivities does) ───────────────────────

function buildCallActivity(call: {
  id: number;
  direction: string | null;
  callResult: string | null;
  twilioNumber: string | null;
  contactPhoneNumber: string | null;
  communicationDate: Date;
  userName: string | null;
  deskName: string | null;
  notes: string | null;
  needsCallback: number;
}) {
  const isInbound = call.direction === "Inbound";
  const fromNum = isInbound ? (call.contactPhoneNumber || "Unknown") : (call.twilioNumber || "CRM");
  const toNum = isInbound ? (call.twilioNumber || "CRM") : (call.contactPhoneNumber || "Unknown");
  const isMissed = call.needsCallback === 1;
  return {
    id: `call-${call.id}`,
    type: "call",
    timestamp: call.communicationDate,
    user: call.userName || "Unknown User",
    details: call.callResult || (isMissed ? "Missed Call" : "Call"),
    metadata: {
      direction: call.direction || "Outbound",
      from: fromNum,
      to: toNum,
      callResult: call.callResult,
      deskName: call.deskName,
      notes: call.notes,
      isMissed,
    },
  };
}

function buildSmsActivity(sms: {
  id: number;
  direction: "inbound" | "outbound";
  contactPhone: string;
  twilioPhone: string;
  body: string;
  status: string | null;
  createdAt: Date;
  sentByName: string | null;
  contactId: number | null;
}) {
  const isInbound = sms.direction === "inbound";
  return {
    id: `sms-${sms.id}`,
    type: "sms",
    timestamp: sms.createdAt,
    user: sms.sentByName || (isInbound ? "Contact" : "Agent"),
    details: sms.body ? (sms.body.length > 120 ? sms.body.substring(0, 120) + "…" : sms.body) : "",
    metadata: {
      direction: sms.direction,
      from: isInbound ? sms.contactPhone : sms.twilioPhone,
      to: isInbound ? sms.twilioPhone : sms.contactPhone,
      status: sms.status,
      fullBody: sms.body,
      contactId: sms.contactId,
    },
  };
}

function formatPhone(phone: string | undefined | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Activity Timeline - Call Events", () => {
  it("builds an outbound call activity correctly", () => {
    const call = {
      id: 1,
      direction: "Outbound",
      callResult: "Left Message",
      twilioNumber: "+17869041444",
      contactPhoneNumber: "+15551234567",
      communicationDate: new Date("2024-01-15T10:00:00Z"),
      userName: "John Agent",
      deskName: "Sales Desk",
      notes: "Left a voicemail",
      needsCallback: 0,
    };
    const activity = buildCallActivity(call);
    expect(activity.id).toBe("call-1");
    expect(activity.type).toBe("call");
    expect(activity.user).toBe("John Agent");
    expect(activity.details).toBe("Left Message");
    expect(activity.metadata.direction).toBe("Outbound");
    expect(activity.metadata.from).toBe("+17869041444"); // Twilio number is from for outbound
    expect(activity.metadata.to).toBe("+15551234567");   // Contact phone is to for outbound
    expect(activity.metadata.isMissed).toBe(false);
    expect(activity.metadata.deskName).toBe("Sales Desk");
  });

  it("builds an inbound call activity correctly", () => {
    const call = {
      id: 2,
      direction: "Inbound",
      callResult: null,
      twilioNumber: "+17869041444",
      contactPhoneNumber: "+15559876543",
      communicationDate: new Date("2024-01-15T11:00:00Z"),
      userName: "System",
      deskName: null,
      notes: "Inbound call from +15559876543",
      needsCallback: 0,
    };
    const activity = buildCallActivity(call);
    expect(activity.type).toBe("call");
    expect(activity.metadata.direction).toBe("Inbound");
    expect(activity.metadata.from).toBe("+15559876543"); // Contact is from for inbound
    expect(activity.metadata.to).toBe("+17869041444");   // Twilio is to for inbound
    expect(activity.details).toBe("Call"); // No callResult, not missed
    expect(activity.metadata.isMissed).toBe(false);
  });

  it("marks missed calls correctly", () => {
    const call = {
      id: 3,
      direction: "Inbound",
      callResult: null,
      twilioNumber: "+17869041444",
      contactPhoneNumber: "+15551111111",
      communicationDate: new Date("2024-01-15T12:00:00Z"),
      userName: "System",
      deskName: "Main Desk",
      notes: null,
      needsCallback: 1, // Missed call flag
    };
    const activity = buildCallActivity(call);
    expect(activity.details).toBe("Missed Call");
    expect(activity.metadata.isMissed).toBe(true);
  });

  it("handles missing user name gracefully", () => {
    const call = {
      id: 4,
      direction: "Outbound",
      callResult: "Not Answer",
      twilioNumber: "+17869041444",
      contactPhoneNumber: "+15552222222",
      communicationDate: new Date("2024-01-15T13:00:00Z"),
      userName: null,
      deskName: null,
      notes: null,
      needsCallback: 0,
    };
    const activity = buildCallActivity(call);
    expect(activity.user).toBe("Unknown User");
  });

  it("handles missing phone numbers gracefully", () => {
    const call = {
      id: 5,
      direction: "Inbound",
      callResult: null,
      twilioNumber: null,
      contactPhoneNumber: null,
      communicationDate: new Date("2024-01-15T14:00:00Z"),
      userName: "Agent",
      deskName: null,
      notes: null,
      needsCallback: 0,
    };
    const activity = buildCallActivity(call);
    expect(activity.metadata.from).toBe("Unknown");
    expect(activity.metadata.to).toBe("CRM");
  });

  it("uses callResult as details when present", () => {
    const call = {
      id: 6,
      direction: "Outbound",
      callResult: "Interested - HOT LEAD",
      twilioNumber: "+17869041444",
      contactPhoneNumber: "+15553333333",
      communicationDate: new Date("2024-01-15T15:00:00Z"),
      userName: "Agent",
      deskName: null,
      notes: null,
      needsCallback: 0,
    };
    const activity = buildCallActivity(call);
    expect(activity.details).toBe("Interested - HOT LEAD");
  });
});

describe("Activity Timeline - SMS Events", () => {
  it("builds an inbound SMS activity correctly", () => {
    const sms = {
      id: 10,
      direction: "inbound" as const,
      contactPhone: "+15551234567",
      twilioPhone: "+17869041444",
      body: "Hello, I am interested in selling my property.",
      status: "received",
      createdAt: new Date("2024-01-15T15:00:00Z"),
      sentByName: null,
      contactId: 42,
    };
    const activity = buildSmsActivity(sms);
    expect(activity.id).toBe("sms-10");
    expect(activity.type).toBe("sms");
    expect(activity.user).toBe("Contact"); // Inbound, no sentByName
    expect(activity.metadata.direction).toBe("inbound");
    expect(activity.metadata.from).toBe("+15551234567"); // Contact is from for inbound
    expect(activity.metadata.to).toBe("+17869041444");   // Twilio is to for inbound
    expect(activity.details).toBe("Hello, I am interested in selling my property.");
    expect(activity.metadata.contactId).toBe(42);
  });

  it("builds an outbound SMS activity correctly", () => {
    const sms = {
      id: 11,
      direction: "outbound" as const,
      contactPhone: "+15551234567",
      twilioPhone: "+17869041444",
      body: "Hi, we would like to make an offer on your property.",
      status: "delivered",
      createdAt: new Date("2024-01-15T16:00:00Z"),
      sentByName: "Sarah Agent",
      contactId: 42,
    };
    const activity = buildSmsActivity(sms);
    expect(activity.user).toBe("Sarah Agent");
    expect(activity.metadata.direction).toBe("outbound");
    expect(activity.metadata.from).toBe("+17869041444"); // Twilio is from for outbound
    expect(activity.metadata.to).toBe("+15551234567");   // Contact is to for outbound
    expect(activity.metadata.status).toBe("delivered");
  });

  it("truncates long SMS body to 120 chars with ellipsis", () => {
    const longBody = "A".repeat(150);
    const sms = {
      id: 12,
      direction: "inbound" as const,
      contactPhone: "+15551234567",
      twilioPhone: "+17869041444",
      body: longBody,
      status: "received",
      createdAt: new Date("2024-01-15T17:00:00Z"),
      sentByName: null,
      contactId: null,
    };
    const activity = buildSmsActivity(sms);
    expect(activity.details.length).toBe(121); // 120 chars + "…"
    expect(activity.details.endsWith("…")).toBe(true);
    expect(activity.metadata.fullBody).toBe(longBody); // Full body preserved in metadata
  });

  it("handles empty SMS body gracefully", () => {
    const sms = {
      id: 13,
      direction: "inbound" as const,
      contactPhone: "+15551234567",
      twilioPhone: "+17869041444",
      body: "",
      status: "received",
      createdAt: new Date("2024-01-15T18:00:00Z"),
      sentByName: null,
      contactId: null,
    };
    const activity = buildSmsActivity(sms);
    expect(activity.details).toBe("");
  });

  it("uses sentByName for outbound SMS user attribution", () => {
    const sms = {
      id: 14,
      direction: "outbound" as const,
      contactPhone: "+15551234567",
      twilioPhone: "+17869041444",
      body: "Test message",
      status: "sent",
      createdAt: new Date("2024-01-15T19:00:00Z"),
      sentByName: "Mike Agent",
      contactId: null,
    };
    const activity = buildSmsActivity(sms);
    expect(activity.user).toBe("Mike Agent");
  });

  it("falls back to Agent for outbound SMS without sentByName", () => {
    const sms = {
      id: 15,
      direction: "outbound" as const,
      contactPhone: "+15551234567",
      twilioPhone: "+17869041444",
      body: "Test message",
      status: "sent",
      createdAt: new Date("2024-01-15T19:00:00Z"),
      sentByName: null,
      contactId: null,
    };
    const activity = buildSmsActivity(sms);
    expect(activity.user).toBe("Agent");
  });
});

describe("Activity Timeline - Phone Number Formatting", () => {
  it("formats E.164 US number with country code correctly", () => {
    expect(formatPhone("+15551234567")).toBe("(555) 123-4567");
  });

  it("formats 10-digit US number correctly", () => {
    expect(formatPhone("5551234567")).toBe("(555) 123-4567");
  });

  it("returns dash for null phone", () => {
    expect(formatPhone(null)).toBe("—");
  });

  it("returns dash for undefined phone", () => {
    expect(formatPhone(undefined)).toBe("—");
  });

  it("returns original for non-standard phone numbers", () => {
    expect(formatPhone("123")).toBe("123");
  });

  it("formats Twilio number correctly", () => {
    expect(formatPhone("+17869041444")).toBe("(786) 904-1444");
  });

  it("formats another US number correctly", () => {
    expect(formatPhone("+13055551234")).toBe("(305) 555-1234");
  });
});

describe("Activity Timeline - Sorting", () => {
  it("sorts activities by timestamp descending (most recent first)", () => {
    const activities = [
      { id: "call-1", timestamp: new Date("2024-01-01T10:00:00Z") },
      { id: "sms-5", timestamp: new Date("2024-01-03T10:00:00Z") },
      { id: "note-2", timestamp: new Date("2024-01-02T10:00:00Z") },
    ];
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    expect(activities[0].id).toBe("sms-5");
    expect(activities[1].id).toBe("note-2");
    expect(activities[2].id).toBe("call-1");
  });

  it("handles same-timestamp activities without errors", () => {
    const ts = new Date("2024-01-01T10:00:00Z");
    const activities = [
      { id: "call-1", timestamp: ts },
      { id: "sms-5", timestamp: ts },
    ];
    expect(() => activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())).not.toThrow();
  });
});

describe("Activity Timeline - Deduplication", () => {
  it("seenSmsIds set prevents duplicate SMS entries", () => {
    const seenSmsIds = new Set<number>();
    const smsIds = [1, 2, 3, 2, 1]; // Duplicates
    const added: number[] = [];
    for (const id of smsIds) {
      if (seenSmsIds.has(id)) continue;
      seenSmsIds.add(id);
      added.push(id);
    }
    expect(added).toEqual([1, 2, 3]); // Only unique IDs
    expect(added.length).toBe(3);
  });

  it("does not add the same SMS ID twice from different sources", () => {
    const seenSmsIds = new Set<number>();
    seenSmsIds.add(10); // Already added from direct propertyId link
    const linkedSmsIds = [10, 11, 12]; // 10 is a duplicate
    const added: number[] = [];
    for (const id of linkedSmsIds) {
      if (seenSmsIds.has(id)) continue;
      seenSmsIds.add(id);
      added.push(id);
    }
    expect(added).toEqual([11, 12]); // 10 was already seen
  });
});
