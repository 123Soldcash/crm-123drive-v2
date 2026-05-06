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
      expect(webhooksSource).toContain('/api/twilio/voicemail-recording');
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

    it("matches caller phone to property via contacts.phoneNumber (inline model)", () => {
      expect(webhooksSource).toContain("matchedPropertyId");
      expect(webhooksSource).toContain("matchedContactId");
    });

    it("downloads recording from Twilio using API credentials (Basic auth)", () => {
      // The handler should fetch the recording with Twilio accountSid:authToken
      // Use a broader regex that captures the full recording handler section
      const recordingSection = webhooksSource.match(
        /voicemail-recording[\s\S]*?Saved voicemail/
      );
      expect(recordingSection).toBeTruthy();
      const section = recordingSection![0];
      expect(section).toContain("getIntegrationConfig");
      expect(section).toContain("accountSid");
      expect(section).toContain("authToken");
      expect(section).toContain('Buffer.from');
      expect(section).toContain('base64');
    });

    it("uploads recording to S3 via storagePut", () => {
      const recordingSection = webhooksSource.match(
        /voicemail-recording[\s\S]*?Saved voicemail/
      );
      expect(recordingSection).toBeTruthy();
      const section = recordingSection![0];
      expect(section).toContain("storagePut");
      expect(section).toContain("voicemail-recordings/");
      expect(section).toContain('"audio/mpeg"');
    });

    it("stores S3 public URL (not Twilio URL) in the database", () => {
      const recordingSection = webhooksSource.match(
        /voicemail-recording[\s\S]*?Saved voicemail/
      );
      expect(recordingSection).toBeTruthy();
      const section = recordingSection![0];
      // Should use the S3 URL variable (publicUrl) not the Twilio URL directly
      expect(section).toContain("publicUrl");
      expect(section).toContain("recordingUrl: publicUrl");
    });

    it("has fallback to Twilio URL if S3 upload fails", () => {
      const recordingSection = webhooksSource.match(
        /voicemail-recording[\s\S]*?Saved voicemail/
      );
      expect(recordingSection).toBeTruthy();
      const section = recordingSection![0];
      // Should set publicUrl = mp3TwilioUrl as initial fallback
      expect(section).toContain("let publicUrl = mp3TwilioUrl");
    });
  });

  describe("Voicemail Audio Proxy endpoint", () => {
    it("is registered at /api/twilio/voicemail-audio/:id", () => {
      expect(webhooksSource).toContain('/api/twilio/voicemail-audio/:id');
    });

    it("validates voicemail ID parameter", () => {
      const proxySection = webhooksSource.match(
        /voicemail-audio\/:id[\s\S]*?Webhook routes registered/
      );
      expect(proxySection).toBeTruthy();
      const section = proxySection![0];
      expect(section).toContain('parseInt(req.params.id');
      expect(section).toContain('isNaN(voicemailId)');
    });

    it("looks up voicemail by ID from database", () => {
      const proxySection = webhooksSource.match(
        /voicemail-audio\/:id[\s\S]*?Webhook routes registered/
      );
      expect(proxySection).toBeTruthy();
      const section = proxySection![0];
      expect(section).toContain('voicemails.id');
      expect(section).toContain('voicemails.recordingUrl');
      expect(section).toContain('eq(voicemails.id, voicemailId)');
    });

    it("redirects directly for non-Twilio URLs (S3/CDN)", () => {
      const proxySection = webhooksSource.match(
        /voicemail-audio\/:id[\s\S]*?Webhook routes registered/
      );
      expect(proxySection).toBeTruthy();
      const section = proxySection![0];
      expect(section).toContain('isTwilioUrl');
      expect(section).toContain('res.redirect(url)');
    });

    it("fetches from Twilio with Basic auth credentials for Twilio URLs", () => {
      const proxySection = webhooksSource.match(
        /voicemail-audio\/:id[\s\S]*?Webhook routes registered/
      );
      expect(proxySection).toBeTruthy();
      const section = proxySection![0];
      expect(section).toContain('getIntegrationConfig');
      expect(section).toContain('accountSid');
      expect(section).toContain('authToken');
      expect(section).toContain('Basic');
      expect(section).toContain('Buffer.from');
    });

    it("streams audio with correct content type", () => {
      const proxySection = webhooksSource.match(
        /voicemail-audio\/:id[\s\S]*?Webhook routes registered/
      );
      expect(proxySection).toBeTruthy();
      const section = proxySection![0];
      expect(section).toContain('"Content-Type", "audio/mpeg"');
      expect(section).toContain('"Content-Length"');
    });

    it("auto-migrates Twilio URLs to S3 in background", () => {
      const proxySection = webhooksSource.match(
        /voicemail-audio\/:id[\s\S]*?Webhook routes registered/
      );
      expect(proxySection).toBeTruthy();
      const section = proxySection![0];
      // After streaming to browser, should upload to S3 and update DB
      expect(section).toContain('storagePut');
      expect(section).toContain('database.update(voicemails)');
      expect(section).toContain('Migrated voicemail');
    });

    it("returns 404 for non-existent voicemail", () => {
      const proxySection = webhooksSource.match(
        /voicemail-audio\/:id[\s\S]*?Webhook routes registered/
      );
      expect(proxySection).toBeTruthy();
      const section = proxySection![0];
      expect(section).toContain('"Voicemail not found"');
      expect(section).toContain('404');
    });

    it("returns 502 when Twilio returns an error", () => {
      const proxySection = webhooksSource.match(
        /voicemail-audio\/:id[\s\S]*?Webhook routes registered/
      );
      expect(proxySection).toBeTruthy();
      const section = proxySection![0];
      expect(section).toContain('502');
      expect(section).toContain('twilioResponse.status');
    });
  });

  describe("Frontend URL routing (Voicemails.tsx)", () => {
    const voicemailsSource = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/Voicemails.tsx"),
      "utf-8"
    );

    it("has a getPlaybackUrl helper function", () => {
      expect(voicemailsSource).toContain('function getPlaybackUrl(vm: any): string');
    });

    it("detects Twilio URLs and routes through proxy", () => {
      expect(voicemailsSource).toContain('api.twilio.com');
      expect(voicemailsSource).toContain('/api/twilio/voicemail-audio/');
    });

    it("returns original URL for non-Twilio (S3) URLs", () => {
      // The function should return url directly when not a Twilio URL
      const helperMatch = voicemailsSource.match(
        /function getPlaybackUrl[\s\S]*?return url/
      );
      expect(helperMatch).toBeTruthy();
      // Verify it has both the proxy path and the direct return
      expect(helperMatch![0]).toContain('/api/twilio/voicemail-audio/');
      expect(helperMatch![0]).toContain('return url');
    });

    it("handlePlay uses getPlaybackUrl instead of direct recordingUrl", () => {
      const handlePlayMatch = voicemailsSource.match(
        /function handlePlay[\s\S]*?markHeardMutation/
      );
      expect(handlePlayMatch).toBeTruthy();
      const handlePlayBody = handlePlayMatch![0];
      expect(handlePlayBody).toContain('getPlaybackUrl(vm)');
      expect(handlePlayBody).not.toContain('new Audio(vm.recordingUrl)');
    });

    it("handlePlay has error handling for audio playback", () => {
      const handlePlayMatch = voicemailsSource.match(
        /function handlePlay[\s\S]*?markHeardMutation/
      );
      expect(handlePlayMatch).toBeTruthy();
      const handlePlayBody = handlePlayMatch![0];
      expect(handlePlayBody).toContain('.catch(');
      expect(handlePlayBody).toContain('audio.onerror');
    });
  });
});
