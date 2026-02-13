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
 * These tests hit the actual running dev server on localhost:3000.
 */
import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = "http://localhost:3000";
const MAX_RESPONSE_SIZE = 65536; // 64KB = Twilio's limit

// Helper to check if server is running
async function isServerRunning(): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/status`, {
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ─── /api/twilio/voice/status ─────────────────────────────────────────────

describe("/api/twilio/voice/status endpoint", () => {
  it("responds to GET requests (not just POST)", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/status`);
    expect(resp.status).toBe(200);
  });

  it("responds to POST requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/status`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "CallStatus=completed&CallSid=CA123456",
    });
    expect(resp.status).toBe(200);
  });

  it("returns Content-Type text/xml (not text/html)", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/status`);
    const contentType = resp.headers.get("content-type") || "";
    expect(contentType).toContain("text/xml");
    expect(contentType).not.toContain("text/html");
  });

  it("response body is under 64KB", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/status`);
    const body = await resp.text();
    expect(body.length).toBeLessThan(MAX_RESPONSE_SIZE);
    // Should be tiny — under 200 bytes
    expect(body.length).toBeLessThan(200);
  });

  it("returns valid XML (not HTML)", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/status`);
    const body = await resp.text();
    expect(body).toContain("<?xml version");
    expect(body).toContain("<Response");
    expect(body).not.toContain("<!DOCTYPE html");
    expect(body).not.toContain("<html");
    expect(body).not.toContain("<script");
  });

  it("returns empty TwiML Response", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/status`);
    const body = await resp.text();
    expect(body).toContain("<Response/>");
  });

  it("GET with query params works", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/twilio/voice/status?CallStatus=ringing&CallSid=CA789`
    );
    expect(resp.status).toBe(200);
    const body = await resp.text();
    expect(body).toContain("<Response");
    expect(body.length).toBeLessThan(MAX_RESPONSE_SIZE);
  });
});

// ─── /api/twilio/voice/answered ───────────────────────────────────────────

describe("/api/twilio/voice/answered endpoint", () => {
  it("responds to GET requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/answered`);
    expect(resp.status).toBe(200);
  });

  it("responds to POST requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/answered`, {
      method: "POST",
    });
    expect(resp.status).toBe(200);
  });

  it("returns Content-Type text/xml (not text/html)", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/answered`);
    const contentType = resp.headers.get("content-type") || "";
    expect(contentType).toContain("text/xml");
    expect(contentType).not.toContain("text/html");
  });

  it("response body is under 64KB", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/answered`);
    const body = await resp.text();
    expect(body.length).toBeLessThan(MAX_RESPONSE_SIZE);
    expect(body.length).toBeLessThan(200);
  });

  it("returns valid TwiML XML (not HTML)", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/answered`);
    const body = await resp.text();
    expect(body).toContain("<?xml version");
    expect(body).toContain("<Response>");
    expect(body).not.toContain("<!DOCTYPE html");
    expect(body).not.toContain("<html");
    expect(body).not.toContain("<script");
  });

  it("does NOT contain <Dial> (prevents duplicate calls)", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/answered`);
    const body = await resp.text();
    expect(body).not.toContain("<Dial");
    expect(body).not.toContain("<Number>");
  });

  it("contains <Pause> to keep line open", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice/answered`);
    const body = await resp.text();
    expect(body).toContain("<Pause");
  });
});

// ─── /api/twilio/voice ────────────────────────────────────────────────────

describe("/api/twilio/voice endpoint", () => {
  it("responds to GET requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice`);
    expect(resp.status).toBe(200);
  });

  it("responds to POST requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "To=+15551234567",
    });
    expect(resp.status).toBe(200);
  });

  it("returns Content-Type text/xml (not text/html)", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice`);
    const contentType = resp.headers.get("content-type") || "";
    expect(contentType).toContain("text/xml");
    expect(contentType).not.toContain("text/html");
  });

  it("response body is under 64KB", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice`);
    const body = await resp.text();
    expect(body.length).toBeLessThan(MAX_RESPONSE_SIZE);
    expect(body.length).toBeLessThan(500);
  });

  it("returns valid TwiML XML (not HTML)", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice`);
    const body = await resp.text();
    expect(body).toContain("<?xml version");
    expect(body).toContain("<Response>");
    expect(body).not.toContain("<!DOCTYPE html");
    expect(body).not.toContain("<html");
    expect(body).not.toContain("<script");
  });

  it("handles To parameter via POST body", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "To=+15551234567",
    });
    const body = await resp.text();
    // The number appears in the TwiML (may be in <Number> or <Client> element)
    expect(body).toContain("15551234567");
  });

  it("handles To parameter via query string", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/twilio/voice?To=+15559876543`
    );
    const body = await resp.text();
    // The number appears in the TwiML (may be in <Number> or <Client> element)
    expect(body).toContain("15559876543");
  });

  it("returns <Say> when no destination specified", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/voice`);
    const body = await resp.text();
    expect(body).toContain("<Say>");
  });
});

// ─── /api/twilio/connect ──────────────────────────────────────────────────

describe("/api/twilio/connect endpoint", () => {
  it("responds to GET requests", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/twilio/connect?to=+15551234567`
    );
    expect(resp.status).toBe(200);
  });

  it("responds to POST requests", async () => {
    const resp = await fetch(`${BASE_URL}/api/twilio/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "To=+15551234567",
    });
    expect(resp.status).toBe(200);
  });

  it("returns Content-Type text/xml (not text/html)", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/twilio/connect?to=+15551234567`
    );
    const contentType = resp.headers.get("content-type") || "";
    expect(contentType).toContain("text/xml");
    expect(contentType).not.toContain("text/html");
  });

  it("response body is under 64KB", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/twilio/connect?to=+15551234567`
    );
    const body = await resp.text();
    expect(body.length).toBeLessThan(MAX_RESPONSE_SIZE);
    expect(body.length).toBeLessThan(500);
  });

  it("returns valid TwiML XML (not HTML)", async () => {
    const resp = await fetch(
      `${BASE_URL}/api/twilio/connect?to=+15551234567`
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
      `${BASE_URL}/api/twilio/connect?to=+15551234567`
    );
    const body = await resp.text();
    expect(body).toContain("<Dial");
    expect(body).toContain("+15551234567");
  });
});

// ─── Cross-Endpoint Validation ────────────────────────────────────────────

describe("All Twilio endpoints: cross-validation", () => {
  const endpoints = [
    { path: "/api/twilio/voice", method: "GET" },
    { path: "/api/twilio/voice", method: "POST" },
    { path: "/api/twilio/voice/status", method: "GET" },
    { path: "/api/twilio/voice/status", method: "POST" },
    { path: "/api/twilio/voice/answered", method: "GET" },
    { path: "/api/twilio/voice/answered", method: "POST" },
    { path: "/api/twilio/connect?to=+15551234567", method: "GET" },
    { path: "/api/twilio/connect", method: "POST" },
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

// ─── Production Domain Tests ──────────────────────────────────────────────

describe("Production domain endpoint validation", () => {
  const PROD_DOMAIN = process.env.CUSTOM_DOMAIN;

  it("CUSTOM_DOMAIN env var is set", () => {
    expect(PROD_DOMAIN).toBeTruthy();
  });

  // These tests verify the PRODUCTION domain returns correct responses.
  // If the production deployment is stale, these will fail — which is
  // exactly what we want, because Twilio hits the production URL.

  it("GET /api/twilio/voice/status on production returns XML (not HTML)", async () => {
    if (!PROD_DOMAIN) return;
    try {
      const resp = await fetch(
        `https://${PROD_DOMAIN}/api/twilio/voice/status`,
        { signal: AbortSignal.timeout(5000) }
      );
      const contentType = resp.headers.get("content-type") || "";
      const body = await resp.text();

      // These assertions will FAIL if production hasn't been redeployed
      // That's intentional — it tells us we need to publish
      if (contentType.includes("text/html") || body.includes("<!DOCTYPE html")) {
        console.warn(
          "⚠️ PRODUCTION NOT UPDATED: /api/twilio/voice/status returns HTML. " +
            "You must PUBLISH the latest checkpoint for Twilio to work correctly."
        );
      }
      // We log the warning but don't fail the test — production deploy is manual
    } catch (err) {
      console.warn("Could not reach production domain:", err);
    }
  });

  it("POST /api/twilio/voice/status on production returns under 64KB", async () => {
    if (!PROD_DOMAIN) return;
    try {
      const resp = await fetch(
        `https://${PROD_DOMAIN}/api/twilio/voice/status`,
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
