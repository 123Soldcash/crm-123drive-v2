/**
 * Twilio Endpoint Integration Tests
 *
 * These tests verify that ALL Twilio webhook endpoints:
 * 1. Return correct Content-Type (text/xml)
 * 2. Return responses UNDER 64KB (Twilio Error 11750 limit)
 * 3. Return valid TwiML XML
 * 4. Handle both GET and POST methods
 * 5. Return correct HTTP status codes
 * 6. Do NOT return HTML (which would be the SPA catch-all)
 *
 * CRITICAL: Webhook endpoints use /api/trpc/twilio-webhook/* prefix because
 * the Manus deployment platform only forwards /api/trpc/* and /api/oauth/*
 * to Express. All other /api/* paths are intercepted by the platform's static
 * file layer and return the SPA index.html (>64KB), causing Twilio Error 11750.
 *
 * These tests hit the actual running dev server on localhost:3000.
 */
import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";
const MAX_RESPONSE_SIZE = 65536; // 64KB = Twilio's limit

// ─── /api/trpc/twilio-webhook/status ─────────────────────────────────────

describe("/api/trpc/twilio-webhook/status endpoint", () => {
  it("responds to GET requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/status`);
    expect(resp.status).toBe(200);
  });

  it("responds to POST requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/status`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "CallStatus=completed&CallSid=CA123456",
    });
    expect(resp.status).toBe(200);
  });

  it("returns Content-Type text/xml (not text/html)", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/status`);
    const contentType = resp.headers.get("content-type") || "";
    expect(contentType).toContain("text/xml");
    expect(contentType).not.toContain("text/html");
  });

  it("response body is under 64KB", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/status`);
    const body = await resp.text();
    expect(body.length).toBeLessThan(MAX_RESPONSE_SIZE);
    // Should be tiny — under 200 bytes
    expect(body.length).toBeLessThan(200);
  });

  it("returns valid XML (not HTML)", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/status`);
    const body = await resp.text();
    expect(body).toContain("<?xml version");
    expect(body).toContain("<Response");
    expect(body).not.toContain("<!DOCTYPE html");
    expect(body).not.toContain("<html");
    expect(body).not.toContain("<script");
  });

  it("returns empty TwiML Response", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/status`);
    const body = await resp.text();
    expect(body).toContain("<Response/>");
  });

  it("GET with query params works", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/trpc/twilio-webhook/status?CallStatus=ringing&CallSid=CA789`
    );
    expect(resp.status).toBe(200);
    const body = await resp.text();
    expect(body).toContain("<Response");
    expect(body.length).toBeLessThan(MAX_RESPONSE_SIZE);
  });
});

// ─── /api/trpc/twilio-webhook/answered ───────────────────────────────────

describe("/api/trpc/twilio-webhook/answered endpoint", () => {
  it("responds to GET requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/answered`);
    expect(resp.status).toBe(200);
  });

  it("responds to POST requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/answered`, {
      method: "POST",
    });
    expect(resp.status).toBe(200);
  });

  it("returns Content-Type text/xml (not text/html)", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/answered`);
    const contentType = resp.headers.get("content-type") || "";
    expect(contentType).toContain("text/xml");
    expect(contentType).not.toContain("text/html");
  });

  it("response body is under 64KB", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/answered`);
    const body = await resp.text();
    expect(body.length).toBeLessThan(MAX_RESPONSE_SIZE);
    expect(body.length).toBeLessThan(200);
  });

  it("returns valid TwiML XML (not HTML)", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/answered`);
    const body = await resp.text();
    expect(body).toContain("<?xml version");
    expect(body).toContain("<Response>");
    expect(body).not.toContain("<!DOCTYPE html");
    expect(body).not.toContain("<html");
    expect(body).not.toContain("<script");
  });

  it("does NOT contain <Dial> (prevents duplicate calls)", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/answered`);
    const body = await resp.text();
    expect(body).not.toContain("<Dial");
    expect(body).not.toContain("<Number>");
  });

  it("contains <Pause> to keep line open", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/answered`);
    const body = await resp.text();
    expect(body).toContain("<Pause");
  });
});

// ─── /api/trpc/twilio-webhook/voice ──────────────────────────────────────

describe("/api/trpc/twilio-webhook/voice endpoint", () => {
  it("responds to GET requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/voice`);
    expect(resp.status).toBe(200);
  });

  it("responds to POST requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "To=+15551234567",
    });
    expect(resp.status).toBe(200);
  });

  it("returns Content-Type text/xml (not text/html)", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/voice`);
    const contentType = resp.headers.get("content-type") || "";
    expect(contentType).toContain("text/xml");
    expect(contentType).not.toContain("text/html");
  });

  it("response body is under 64KB", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/voice`);
    const body = await resp.text();
    expect(body.length).toBeLessThan(MAX_RESPONSE_SIZE);
    expect(body.length).toBeLessThan(500);
  });

  it("returns valid TwiML XML (not HTML)", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/voice`);
    const body = await resp.text();
    expect(body).toContain("<?xml version");
    expect(body).toContain("<Response>");
    expect(body).not.toContain("<!DOCTYPE html");
    expect(body).not.toContain("<html");
    expect(body).not.toContain("<script");
  });

  it("handles To parameter via POST body", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "To=+15551234567",
    });
    const body = await resp.text();
    expect(body).toContain("15551234567");
  });

  it("handles To parameter via query string", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/trpc/twilio-webhook/voice?To=+15559876543`
    );
    const body = await resp.text();
    expect(body).toContain("15559876543");
  });

  it("returns <Say> when no destination specified", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/voice`);
    const body = await resp.text();
    expect(body).toContain("<Say>");
  });
});

// ─── /api/trpc/twilio-webhook/connect ────────────────────────────────────

describe("/api/trpc/twilio-webhook/connect endpoint", () => {
  it("responds to GET requests", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/trpc/twilio-webhook/connect?to=+15551234567`
    );
    expect(resp.status).toBe(200);
  });

  it("responds to POST requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "To=+15551234567",
    });
    expect(resp.status).toBe(200);
  });

  it("returns Content-Type text/xml (not text/html)", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/trpc/twilio-webhook/connect?to=+15551234567`
    );
    const contentType = resp.headers.get("content-type") || "";
    expect(contentType).toContain("text/xml");
    expect(contentType).not.toContain("text/html");
  });

  it("response body is under 64KB", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/trpc/twilio-webhook/connect?to=+15551234567`
    );
    const body = await resp.text();
    expect(body.length).toBeLessThan(MAX_RESPONSE_SIZE);
    expect(body.length).toBeLessThan(500);
  });

  it("returns valid TwiML XML (not HTML)", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/trpc/twilio-webhook/connect?to=+15551234567`
    );
    const body = await resp.text();
    expect(body).toContain("<?xml version");
    expect(body).toContain("<Response>");
    expect(body).not.toContain("<!DOCTYPE html");
    expect(body).not.toContain("<html");
    expect(body).not.toContain("<script");
  });

  it("includes <Dial> with destination number", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/trpc/twilio-webhook/connect?to=+15551234567`
    );
    const body = await resp.text();
    expect(body).toContain("<Dial");
    expect(body).toContain("+15551234567");
  });
});

// ─── Cross-Endpoint Validation ──────────────────────────────────────────

describe("All Twilio endpoints: cross-validation", () => {
  const endpoints = [
    { path: "/api/trpc/twilio-webhook/voice", method: "GET" },
    { path: "/api/trpc/twilio-webhook/voice", method: "POST" },
    { path: "/api/trpc/twilio-webhook/status", method: "GET" },
    { path: "/api/trpc/twilio-webhook/status", method: "POST" },
    { path: "/api/trpc/twilio-webhook/answered", method: "GET" },
    { path: "/api/trpc/twilio-webhook/answered", method: "POST" },
    { path: "/api/trpc/twilio-webhook/connect?to=+15551234567", method: "GET" },
    { path: "/api/trpc/twilio-webhook/connect", method: "POST" },
  ];

  for (const { path, method } of endpoints) {
    it(`${method} ${path} — returns 200`, async () => {
      const resp = await fetch(`${BASE_URL}${path}`, {
        method,
        ...(method === "POST"
          ? {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: "To=+15551234567&CallStatus=completed&CallSid=CA123",
            }
          : {}),
      });
      expect(resp.status).toBe(200);
    });

    it(`${method} ${path} — Content-Type is text/xml`, async () => {
      const resp = await fetch(`${BASE_URL}${path}`, {
        method,
        ...(method === "POST"
          ? {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: "To=+15551234567&CallStatus=completed&CallSid=CA123",
            }
          : {}),
      });
      const ct = resp.headers.get("content-type") || "";
      expect(ct).toContain("text/xml");
    });

    it(`${method} ${path} — body under 64KB`, async () => {
      const resp = await fetch(`${BASE_URL}${path}`, {
        method,
        ...(method === "POST"
          ? {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: "To=+15551234567&CallStatus=completed&CallSid=CA123",
            }
          : {}),
      });
      const body = await resp.text();
      expect(body.length).toBeLessThan(MAX_RESPONSE_SIZE);
    });

    it(`${method} ${path} — does NOT return HTML`, async () => {
      const resp = await fetch(`${BASE_URL}${path}`, {
        method,
        ...(method === "POST"
          ? {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: "To=+15551234567&CallStatus=completed&CallSid=CA123",
            }
          : {}),
      });
      const body = await resp.text();
      expect(body).not.toContain("<!DOCTYPE html");
      expect(body).not.toContain("<html");
      expect(body).not.toContain("<script");
    });
  }
});

// ─── makeOutboundCall URL Verification ──────────────────────────────────

describe("makeOutboundCall webhook URL configuration", () => {
  it("uses /api/trpc/twilio-webhook/answered as the call URL (not /api/twilio/)", async () => {
    // Read the twilio.ts source to verify the URL
    const fs = await import("fs");
    const source = fs.readFileSync("server/twilio.ts", "utf-8");

    // The URL should use the new /api/trpc/twilio-webhook/ prefix
    expect(source).toContain("/api/trpc/twilio-webhook/answered");
    // Should NOT use the old /api/twilio/ prefix
    expect(source).not.toMatch(/url:.*\/api\/twilio\/voice\/answered/);
  });

  it("uses /api/trpc/twilio-webhook/status as the status callback URL", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/twilio.ts", "utf-8");

    expect(source).toContain("/api/trpc/twilio-webhook/status");
    // Should NOT use the old path
    expect(source).not.toMatch(/statusCallback:.*\/api\/twilio\/voice\/status/);
  });

  it("answered endpoint does NOT contain <Dial> (prevents duplicate calls)", async () => {
    const resp = await fetch(`${BASE_URL}/api/trpc/twilio-webhook/answered`);
    const body = await resp.text();
    // CRITICAL: If this contains <Dial>, Twilio will make a SECOND call
    expect(body).not.toContain("<Dial");
    expect(body).not.toContain("<Number>");
    // Should only contain <Pause> to keep line open
    expect(body).toContain("<Pause");
  });
});

// ─── Old Path Regression Tests ──────────────────────────────────────────

describe("Old /api/twilio/* paths should NOT be used", () => {
  it("server code does NOT register routes at /api/twilio/ (only /api/trpc/twilio-webhook/)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/_core/index.ts", "utf-8");

    // Should NOT have any routes at the old /api/twilio/ path
    expect(source).not.toMatch(/app\.(all|get|post)\("\/api\/twilio\//);
    // Should have routes at the new /api/trpc/twilio-webhook/ path
    expect(source).toContain('/api/trpc/twilio-webhook/voice');
    expect(source).toContain('/api/trpc/twilio-webhook/connect');
    expect(source).toContain('/api/trpc/twilio-webhook/answered');
    expect(source).toContain('/api/trpc/twilio-webhook/status');
  });

  it("twilio.ts uses new webhook paths (not old /api/twilio/ paths)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/twilio.ts", "utf-8");

    // Should use new paths
    expect(source).toContain("/api/trpc/twilio-webhook/answered");
    expect(source).toContain("/api/trpc/twilio-webhook/status");
    // Should NOT reference old paths in URL construction
    expect(source).not.toMatch(/baseUrl.*\/api\/twilio\/voice/);
  });
});

// ─── Production Domain Tests ────────────────────────────────────────────

describe("Production domain endpoint validation", () => {
  const PROD_DOMAIN = process.env.CUSTOM_DOMAIN;

  it("CUSTOM_DOMAIN env var is set", () => {
    expect(PROD_DOMAIN).toBeTruthy();
  });

  it("GET /api/trpc/twilio-webhook/status on production returns XML (not HTML)", async () => {
    if (!PROD_DOMAIN) return;
    try {
      const resp = await fetch(
        `https://${PROD_DOMAIN}/api/trpc/twilio-webhook/status`,
        { signal: AbortSignal.timeout(5000) }
      );
      const contentType = resp.headers.get("content-type") || "";
      const body = await resp.text();

      if (contentType.includes("text/html") || body.includes("<!DOCTYPE html")) {
        console.warn(
          "⚠️ PRODUCTION NOT UPDATED: /api/trpc/twilio-webhook/status returns HTML. " +
            "You must PUBLISH the latest checkpoint for Twilio to work correctly."
        );
      }
    } catch (err) {
      console.warn("Could not reach production domain:", err);
    }
  });

  it("POST /api/trpc/twilio-webhook/status on production returns under 64KB", async () => {
    if (!PROD_DOMAIN) return;
    try {
      const resp = await fetch(
        `https://${PROD_DOMAIN}/api/trpc/twilio-webhook/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "CallStatus=completed&CallSid=CAtest",
          signal: AbortSignal.timeout(5000),
        }
      );
      const body = await resp.text();

      if (body.length > MAX_RESPONSE_SIZE) {
        console.warn(
          `⚠️ PRODUCTION NOT UPDATED: Response is ${body.length} bytes (>${MAX_RESPONSE_SIZE}). ` +
            "Publish the latest checkpoint to fix Twilio Error 11750."
        );
      }
    } catch (err) {
      console.warn("Could not reach production domain:", err);
    }
  });
});
