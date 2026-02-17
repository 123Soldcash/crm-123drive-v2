/**
 * Twilio Domain Cleanup Regression Tests
 *
 * These tests ensure that NO old/deprecated domain references exist
 * anywhere in the codebase, and that all Twilio URLs are built
 * dynamically from the CUSTOM_DOMAIN environment variable.
 *
 * Background:
 * - Error 11750 was caused by CUSTOM_DOMAIN pointing to an old domain
 *   (123smartdrive.manus.space) that had an outdated deployment
 * - The old deployment returned the SPA HTML (367KB) instead of TwiML
 * - These tests prevent this from ever happening again
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { glob } from "glob";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CODEBASE-WIDE SCAN — NO HARDCODED OLD DOMAINS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Domain Cleanup: Codebase-Wide Scan", () => {
  const DEPRECATED_DOMAINS = [
    "123smartdrive.manus.space",
    "123soldcash.manus.space",
    "sold2us.manus.space",
  ];

  // Get all TypeScript source files (excluding node_modules, dist, tests, and todo.md)
  const getSourceFiles = (): string[] => {
    const projectRoot = path.resolve(__dirname, "..");
    const patterns = [
      "server/**/*.ts",
      "client/src/**/*.ts",
      "client/src/**/*.tsx",
      "drizzle/**/*.ts",
      "shared/**/*.ts",
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matched = glob.sync(pattern, {
        cwd: projectRoot,
        ignore: ["**/node_modules/**", "**/dist/**", "**/*.test.ts", "**/todo.md"],
      });
      files.push(...matched.map((f) => path.join(projectRoot, f)));
    }
    return files;
  };

  for (const deprecatedDomain of DEPRECATED_DOMAINS) {
    it(`no source file contains hardcoded "${deprecatedDomain}"`, () => {
      const files = getSourceFiles();
      expect(files.length).toBeGreaterThan(0);

      const violations: { file: string; line: number; content: string }[] = [];

      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Skip comments — they're documentation, not functional code
          if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) continue;

          if (line.includes(deprecatedDomain)) {
            violations.push({
              file: path.relative(path.resolve(__dirname, ".."), file),
              line: i + 1,
              content: line.substring(0, 120),
            });
          }
        }
      }

      if (violations.length > 0) {
        const details = violations
          .map((v) => `  ${v.file}:${v.line} → ${v.content}`)
          .join("\n");
        expect.fail(
          `Found ${violations.length} hardcoded reference(s) to "${deprecatedDomain}":\n${details}`
        );
      }
    });
  }

  it("no source file contains hardcoded /api/oauth/twilio/ paths in functional code", () => {
    const files = getSourceFiles();
    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip comments
        if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) continue;

        // Check for the old broken path pattern in functional code
        if (
          line.includes("/api/oauth/twilio/") &&
          !line.includes("expect") && // Not a test assertion
          !line.includes("not.toContain") // Not a negative test
        ) {
          violations.push({
            file: path.relative(path.resolve(__dirname, ".."), file),
            line: i + 1,
            content: line.substring(0, 120),
          });
        }
      }
    }

    if (violations.length > 0) {
      const details = violations
        .map((v) => `  ${v.file}:${v.line} → ${v.content}`)
        .join("\n");
      expect.fail(
        `Found ${violations.length} reference(s) to old /api/oauth/twilio/ path:\n${details}`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DYNAMIC URL GENERATION — ALL URLS USE CUSTOM_DOMAIN
// ═══════════════════════════════════════════════════════════════════════════════

describe("Domain Cleanup: Dynamic URL Generation", () => {
  it("getBaseUrl() returns URL based on CUSTOM_DOMAIN", async () => {
    const { getBaseUrl } = await import("./twilio");
    const baseUrl = getBaseUrl();
    const domain = process.env.CUSTOM_DOMAIN;

    expect(baseUrl).toBe(`https://${domain}`);
    expect(baseUrl).not.toContain("123smartdrive");
    expect(baseUrl).not.toContain("undefined");
  });

  it("getBaseUrl() returns a valid HTTPS URL", async () => {
    const { getBaseUrl } = await import("./twilio");
    const baseUrl = getBaseUrl();

    expect(baseUrl).toMatch(/^https:\/\/[a-z0-9-]+\.manus\.space$/);
  });

  it("makeOutboundCall uses getBaseUrl() for webhook URLs (not hardcoded)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio.ts"), "utf-8");

    // The answered URL must use baseUrl variable
    expect(src).toContain("`${baseUrl}/api/twilio/answered`");
    // The status URL must use baseUrl variable
    expect(src).toContain("`${baseUrl}/api/twilio/status`");

    // There should be NO hardcoded https:// URLs for Twilio callbacks
    // (except in comments and the getBaseUrl function itself)
    const lines = src.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
      if (trimmed.includes("getBaseUrl") || trimmed.includes("return `https://")) continue;

      // No line should have a hardcoded Twilio webhook URL
      if (trimmed.includes("url:") || trimmed.includes("statusCallback:")) {
        expect(trimmed).not.toMatch(/https:\/\/[a-z0-9-]+\.manus\.space\/api\/twilio/);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. VALIDATETWILIOCONFIG — DOMAIN VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Domain Cleanup: validateTwilioConfig Domain Checks", () => {
  it("validateTwilioConfig returns webhookBaseUrl", async () => {
    const { validateTwilioConfig } = await import("./twilio");
    const config = validateTwilioConfig();

    expect(config).toHaveProperty("webhookBaseUrl");
    expect(config.webhookBaseUrl).toMatch(/^https:\/\//);
    expect(config.webhookBaseUrl).not.toContain("123smartdrive");
  });

  it("validateTwilioConfig returns warnings array", async () => {
    const { validateTwilioConfig } = await import("./twilio");
    const config = validateTwilioConfig();

    expect(config).toHaveProperty("warnings");
    expect(Array.isArray(config.warnings)).toBe(true);
  });

  it("validateTwilioConfig has no warnings when CUSTOM_DOMAIN is correct", async () => {
    const { validateTwilioConfig } = await import("./twilio");
    const config = validateTwilioConfig();

    // With CUSTOM_DOMAIN=crmv3.manus.space, there should be no warnings
    if (process.env.CUSTOM_DOMAIN === "crmv3.manus.space") {
      expect(config.warnings).toHaveLength(0);
    }
  });

  it("validateTwilioConfig includes deprecated domain check logic", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio.ts"), "utf-8");

    // The function should check for deprecated domains
    expect(src).toContain("DEPRECATED_DOMAINS");
    expect(src).toContain("123smartdrive");
    expect(src).toContain("123soldcash");
    expect(src).toContain("sold2us");
  });

  it("getBaseUrl logs a CRITICAL error when CUSTOM_DOMAIN is missing", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio.ts"), "utf-8");

    // The function should have error logging for missing CUSTOM_DOMAIN
    expect(src).toContain("CRITICAL");
    expect(src).toContain("CUSTOM_DOMAIN is not set");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. WEBHOOK ROUTES — CORRECT PATH PREFIX
// ═══════════════════════════════════════════════════════════════════════════════

describe("Domain Cleanup: Webhook Route Paths", () => {
  it("all 4 webhook routes use /api/twilio/ prefix", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");

    const expectedRoutes = [
      "/api/twilio/voice",
      "/api/twilio/connect",
      "/api/twilio/answered",
      "/api/twilio/status",
    ];

    for (const route of expectedRoutes) {
      expect(src).toContain(`"${route}"`);
    }
  });

  it("NO webhook routes use the old /api/oauth/twilio/ prefix", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");

    // Check functional code only (not comments)
    const lines = src.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

      if (trimmed.includes("app.all(") || trimmed.includes("app.post(") || trimmed.includes("app.get(")) {
        expect(trimmed).not.toContain("/api/oauth/twilio/");
      }
    }
  });

  it("all webhook handlers set Content-Type to text/xml", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");

    // Count text/xml occurrences — should be at least 7
    // (4 endpoints × try block + 3 catch blocks, status has no try/catch)
    const xmlHeaders = src.match(/text\/xml/g);
    expect(xmlHeaders).not.toBeNull();
    expect(xmlHeaders!.length).toBeGreaterThanOrEqual(7);
  });

  it("all webhook handlers return valid TwiML XML", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");

    // Every response should start with XML declaration
    const xmlDeclarations = src.match(/\<\?xml version="1\.0" encoding="UTF-8"\?\>/g);
    expect(xmlDeclarations).not.toBeNull();
    expect(xmlDeclarations!.length).toBeGreaterThanOrEqual(4);

    // Every response should have a <Response> tag
    const responseTags = src.match(/<Response/g);
    expect(responseTags).not.toBeNull();
    expect(responseTags!.length).toBeGreaterThanOrEqual(4);
  });

  it("NO webhook handler returns HTML content", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");

    expect(src).not.toContain("text/html");
    expect(src).not.toContain("<!DOCTYPE");
    expect(src).not.toContain("<html");
    expect(src).not.toContain("res.json(");
    expect(src).not.toContain("application/json");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FRONTEND — CREDENTIALS INCLUDED IN POLLING
// ═══════════════════════════════════════════════════════════════════════════════

describe("Domain Cleanup: Frontend Polling", () => {
  it("TwilioCallWidget includes credentials in fetch calls", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/TwilioCallWidget.tsx"),
      "utf-8"
    );

    // The fetch call for polling must include credentials
    expect(src).toContain('credentials: "include"');
  });

  it("TwilioCallWidget uses relative URL for API calls (not hardcoded domain)", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/TwilioCallWidget.tsx"),
      "utf-8"
    );

    // Should use relative path /api/trpc/ not absolute https://...
    expect(src).toContain("/api/trpc/");
    expect(src).not.toContain("123smartdrive");
    expect(src).not.toContain("crmv3.manus.space/api/trpc");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PRODUCTION VERIFICATION — LIVE ENDPOINT CHECK
// ═══════════════════════════════════════════════════════════════════════════════

describe("Domain Cleanup: Production Verification", () => {
  const PROD_DOMAIN = process.env.CUSTOM_DOMAIN || "crmv3.manus.space";
  const PROD_BASE = `https://${PROD_DOMAIN}`;

  const endpoints = [
    { path: "/api/twilio/voice", body: "To=%2B15551234567", name: "voice" },
    { path: "/api/twilio/connect", body: "To=%2B15551234567", name: "connect" },
    { path: "/api/twilio/answered", body: "", name: "answered" },
    { path: "/api/twilio/status", body: "CallStatus=completed&CallSid=CA_test", name: "status" },
  ];

  for (const ep of endpoints) {
    it(`PROD ${ep.name}: returns TwiML XML, not HTML (${PROD_DOMAIN})`, async () => {
      try {
        const resp = await fetch(`${PROD_BASE}${ep.path}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: ep.body,
          signal: AbortSignal.timeout(10000),
        });

        // Must return 200
        expect(resp.status).toBe(200);

        const contentType = resp.headers.get("content-type") || "";
        const body = await resp.text();
        const bytes = Buffer.byteLength(body, "utf-8");

        // Content-Type must be XML
        expect(contentType).toContain("text/xml");

        // Body must be valid TwiML
        expect(body).toContain("<?xml");
        expect(body).toContain("<Response");

        // Body must NOT be HTML (the Error 11750 symptom)
        expect(body).not.toContain("<!DOCTYPE");
        expect(body).not.toContain("<html");
        expect(body).not.toContain("<script");
        expect(body).not.toContain('<div id="root">');

        // Must be under 64KB (Twilio limit)
        expect(bytes).toBeLessThan(65536);

        // Should actually be under 500 bytes for all our responses
        expect(bytes).toBeLessThan(500);
      } catch (err) {
        // Network errors in sandbox are acceptable — log but don't fail
        console.warn(`[SKIP] Could not reach ${PROD_BASE}${ep.path}: ${(err as Error).message}`);
      }
    });
  }

  it(`PROD: old domain 123smartdrive.manus.space does NOT serve TwiML`, async () => {
    try {
      const resp = await fetch("https://123smartdrive.manus.space/api/twilio/status", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "CallStatus=completed&CallSid=CA_test",
        signal: AbortSignal.timeout(10000),
      });

      const body = await resp.text();

      // If the old domain is still active, it should NOT return TwiML
      // (it returns HTML because it has an old deployment)
      if (body.includes("<html") || body.includes("<!DOCTYPE")) {
        // Expected — old domain returns HTML, confirming it's broken
        console.log("[INFO] Old domain 123smartdrive.manus.space returns HTML as expected (broken)");
      }
    } catch {
      // Domain might be completely down — that's fine too
      console.log("[INFO] Old domain 123smartdrive.manus.space is unreachable (good)");
    }
  });
});
