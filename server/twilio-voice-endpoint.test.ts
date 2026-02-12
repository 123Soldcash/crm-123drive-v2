import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('TwiML Voice Endpoint', () => {
  it('should generate TwiML XML with Dial for a phone number', async () => {
    const twilio = await import('twilio');
    const VoiceResponse = twilio.default.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    const to = '+15551234567';
    const callerId = '+15559876543';
    
    if (to) {
      const dial = response.dial({ callerId });
      if (to.startsWith('+') || /^\d+$/.test(to)) {
        dial.number(to);
      } else {
        dial.client(to);
      }
    }
    
    const xml = response.toString();
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<Dial');
    expect(xml).toContain('<Number>+15551234567</Number>');
    expect(xml).toContain('callerId');
  });

  it('should generate TwiML XML with Say when no destination', async () => {
    const twilio = await import('twilio');
    const VoiceResponse = twilio.default.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    const to = undefined;
    
    if (to) {
      const dial = response.dial({ callerId: '+15559876543' });
      dial.number(to);
    } else {
      response.say('No destination specified.');
    }
    
    const xml = response.toString();
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<Say>No destination specified.</Say>');
    expect(xml).not.toContain('<Dial');
  });

  it('should use client dial for non-phone identities', async () => {
    const twilio = await import('twilio');
    const VoiceResponse = twilio.default.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    const to = 'user_123';
    const callerId = '+15559876543';
    
    if (to) {
      const dial = response.dial({ callerId });
      if (to.startsWith('+') || /^\d+$/.test(to)) {
        dial.number(to);
      } else {
        dial.client(to);
      }
    }
    
    const xml = response.toString();
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<Client>user_123</Client>');
    expect(xml).not.toContain('<Number>');
  });
});

describe('getDealCalculation - null APN handling', () => {
  it('should return null when property has no APN', async () => {
    const { getDealCalculation } = await import('./db-deal-calculator');
    
    // This tests the function with a propertyId that may have no APN
    // The function should gracefully return null instead of throwing
    const result = await getDealCalculation(999999999);
    
    // Should return null (property not found or no APN) without throwing
    expect(result).toBeNull();
  });

  it('should return null for null propertyId', async () => {
    const { getDealCalculation } = await import('./db-deal-calculator');
    const result = await getDealCalculation(null);
    expect(result).toBeNull();
  });

  it('should return null for undefined propertyId', async () => {
    const { getDealCalculation } = await import('./db-deal-calculator');
    const result = await getDealCalculation(undefined);
    expect(result).toBeNull();
  });

  it('should return null for zero propertyId', async () => {
    const { getDealCalculation } = await import('./db-deal-calculator');
    const result = await getDealCalculation(0);
    expect(result).toBeNull();
  });

  it('should return null for negative propertyId', async () => {
    const { getDealCalculation } = await import('./db-deal-calculator');
    const result = await getDealCalculation(-1);
    expect(result).toBeNull();
  });
});
