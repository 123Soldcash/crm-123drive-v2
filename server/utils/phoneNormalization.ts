/**
 * Phone Number Normalization Utility
 * 
 * Normalizes phone numbers for duplicate detection by removing formatting
 * and standardizing to digits-only format.
 */

/**
 * Normalize phone number to digits-only format for comparison
 * 
 * Examples:
 * - (305) 555-1234 → 3055551234
 * - 305-555-1234 → 3055551234
 * - +1 305 555 1234 → 13055551234
 * - 305.555.1234 → 3055551234
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // If starts with 1 and has 11 digits, it's likely a US number with country code
  // Keep it as-is for consistency
  // Otherwise just return the digits
  return digitsOnly;
}

/**
 * Check if two phone numbers match after normalization
 */
export function phoneNumbersMatch(phone1: string, phone2: string): boolean {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  
  // Exact match
  if (normalized1 === normalized2) return true;
  
  // Handle US country code variations
  // 3055551234 should match 13055551234
  if (normalized1.length === 10 && normalized2.length === 11 && normalized2.startsWith('1')) {
    return normalized1 === normalized2.substring(1);
  }
  
  if (normalized2.length === 10 && normalized1.length === 11 && normalized1.startsWith('1')) {
    return normalized2 === normalized1.substring(1);
  }
  
  return false;
}

/**
 * Format phone number for display (US format)
 * 3055551234 → (305) 555-1234
 */
export function formatPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  
  // US phone number (10 digits)
  if (normalized.length === 10) {
    return `(${normalized.substring(0, 3)}) ${normalized.substring(3, 6)}-${normalized.substring(6)}`;
  }
  
  // US phone number with country code (11 digits starting with 1)
  if (normalized.length === 11 && normalized.startsWith('1')) {
    return `+1 (${normalized.substring(1, 4)}) ${normalized.substring(4, 7)}-${normalized.substring(7)}`;
  }
  
  // Return original if can't format
  return phone;
}
