/**
 * Tests for voicemail webhook flow in twilio-webhooks.ts
 * 
 * Validates:
 * 1. playVoicemailAndRecord helper is invoked in all early-exit paths
 * 2. inbound-status handler uses getBaseUrl() for recording callback URL
 * 3. voicemail-recording endpoint saves to DB correctly
 * 4. TwiML output contains <Play> or <Say> + <Record> for voicemail paths
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Read the source file to validate structural patterns
const webhooksSource = fs.readFileSync(
  path.resolve(__dirname, "./twilio-webhooks.ts"),
  "utf-8"
);

describe("Voicemail Webhook Flow — Structural Validation", () => {

  it("has a shared playVoicemailAndRecord helper function", () => {
    expect(webhooksSource).toContain("async function playVoicemailAndRecord(response: any)");
  });

  it("playVoicemailAndRecord fetches greeting URL from integrationConfig", () => {
    // The helper should import and call getIntegrationConfig("voicemail")
    const helperMatch = webhooksSource.match(
      /async function playVoicemailAndRecord[\s\S]*?response\.hangup\(\)/
    );
    expect(helperMatch).toBeTruthy();
    const helperBody = helperMatch![0];
    expect(helperBody).toContain('getIntegrationConfig("voicemail")');
    expect(helperBody).toContain("greetingUrl");
  });

  it("playVoicemailAndRecord uses getBaseUrl() for recording callback URL", () => {
    const helperMatch = webhooksSource.match(
      /async function playVoicemailAndRecord[\s\S]*?response\.hangup\(\)/
    );
    expect(helperMatch).toBeTruthy();
    const helperBody = helperMatch![0];
    expect(helperBody).toContain('getBaseUrl()');
    expect(helperBody).toContain('/api/twilio/voicemail-recording');
    // Should NOT use req.headers for URL construction
    expect(helperBody).not.toContain('req.headers["x-forwarded-host"]');
  });

  it("playVoicemailAndRecord plays greeting MP3 when URL exists", () => {
    const helperMatch = webhooksSource.match(
      /async function playVoicemailAndRecord[\s\S]*?response\.hangup\(\)/
    );
    const helperBody = helperMatch![0];
    expect(helperBody).toContain("response.play({}, greetingUrl)");
  });

  it("playVoicemailAndRecord falls back to TTS when no greeting URL", () => {
    const helperMatch = webhooksSource.match(
      /async function playVoicemailAndRecord[\s\S]*?response\.hangup\(\)/
    );
    const helperBody = helperMatch![0];
    expect(helperBody).toContain("response.say(");
  });

  it("playVoicemailAndRecord includes <Record> with correct parameters", () => {
    const helperMatch = webhooksSource.match(
      /async function playVoicemailAndRecord[\s\S]*?response\.hangup\(\)/
    );
    const helperBody = helperMatch![0];
    expect(helperBody).toContain("response.record(");
    expect(helperBody).toContain("maxLength: 120");
    expect(helperBody).toContain("playBeep: true");
  });

  describe("Early-exit paths use playVoicemailAndRecord", () => {
    it("no active Twilio number → calls playVoicemailAndRecord", () => {
      // After the "No active Twilio number found" log, should call the helper
      const noNumberSection = webhooksSource.match(
        /No active Twilio number found[\s\S]*?return;\s*\}/
      );
      expect(noNumberSection).toBeTruthy();
      expect(noNumberSection![0]).toContain("playVoicemailAndRecord(response)");
      // Should NOT have response.say + response.hangup (old pattern)
      expect(noNumberSection![0]).not.toContain('response.say("Thank you');
    });

    it("no desk assigned → calls playVoicemailAndRecord", () => {
      const noDeskSection = webhooksSource.match(
        /has no desk assigned[\s\S]*?return;\s*\}/
      );
      expect(noDeskSection).toBeTruthy();
      expect(noDeskSection![0]).toContain("playVoicemailAndRecord(response)");
      expect(noDeskSection![0]).not.toContain('response.say("Thank you');
    });

    it("no users assigned to desks → calls playVoicemailAndRecord", () => {
      const noUsersSection = webhooksSource.match(
        /No users assigned to desks[\s\S]*?return;\s*\}/
      );
      expect(noUsersSection).toBeTruthy();
      expect(noUsersSection![0]).toContain("playVoicemailAndRecord(response)");
      expect(noUsersSection![0]).not.toContain('response.say("Thank you');
    });

    it("no online agents → calls playVoicemailAndRecord", () => {
      const noOnlineSection = webhooksSource.match(
        /No online agents for desks[\s\S]*?return;\s*\}/
      );
      expect(noOnlineSection).toBeTruthy();
      expect(noOnlineSection![0]).toContain("playVoicemailAndRecord(response)");
      expect(noOnlineSection![0]).not.toContain('response.say("Thank you');
    });

    it("error fallback → calls playVoicemailAndRecord", () => {
      const errorSection = webhooksSource.match(
        /Error during desk-based routing[\s\S]*?return;\s*\}/
      );
      expect(errorSection).toBeTruthy();
      expect(errorSection![0]).toContain("playVoicemailAndRecord(response)");
      expect(errorSection![0]).not.toContain('response.say("We\'re sorry');
    });
  });

  describe("Inbound-status handler (Dial no-answer)", () => {
    it("uses getBaseUrl() for recording callback URL", () => {
      // Find the inbound-status handler section (from the route registration to the end)
      const inboundStatusSection = webhooksSource.match(
        /\/api\/twilio\/inbound-status[\s\S]*?getBaseUrl\(\)[\s\S]*?voicemail-recording/
      );
      expect(inboundStatusSection).toBeTruthy();
      expect(inboundStatusSection![0]).toContain("getBaseUrl()");
    });

    it("does NOT use req.headers for URL construction in inbound-status", () => {
      // The inbound-status handler should not have the old header-based URL
      const inboundSection = webhooksSource.match(
        /\/api\/twilio\/inbound-status[\s\S]*?res\.send\(response\.toString\(\)\)/
      );
      expect(inboundSection).toBeTruthy();
      expect(inboundSection![0]).not.toContain('req.headers["x-forwarded-host"]');
    });

    it("handles no-answer, busy, and failed statuses", () => {
      expect(webhooksSource).toContain('"no-answer"');
      expect(webhooksSource).toContain('"busy"');
      expect(webhooksSource).toContain('"failed"');
    });
  });

  describe("Voicemail-recording endpoint", () => {
    it("is registered at /api/twilio/voicemail-recording", () => {
      expect(webhooksSource).toContain('"/api/twilio/voicemail-recording"');
    });

    it("extracts RecordingUrl, RecordingSid, From, and duration", () => {
      expect(webhooksSource).toContain("RecordingUrl");
      expect(webhooksSource).toContain("RecordingSid");
      expect(webhooksSource).toContain("RecordingDuration");
    });

    it("appends .mp3 to recording URL", () => {
      expect(webhooksSource).toContain('.mp3');
    });

    it("inserts into voicemails table", () => {
      expect(webhooksSource).toContain("database.insert(voicemails)");
    });

    it("matches caller phone to property via contactPhones", () => {
      expect(webhooksSource).toContain("matchedPropertyId");
      expect(webhooksSource).toContain("matchedContactId");
    });
  });
});
