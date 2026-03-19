/**
 * Format a phone number for display with mask: (XXX) XXX-XXXX
 * Handles various input formats:
 *   - 10 digits: 5551234567 → (555) 123-4567
 *   - 11 digits starting with 1: 15551234567 → (555) 123-4567
 *   - With +1 prefix: +15551234567 → (555) 123-4567
 *   - Already formatted: passes through
 *   - Short/international numbers: returned as-is
 *
 * Display only — does NOT modify stored values.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";

  const digits = phone.replace(/\D/g, "");

  // US number with country code: +1 or 1 prefix (11 digits)
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  // Standard US 10-digit number
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // 7-digit local number (no area code)
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  // Anything else (international, short codes, etc.) — return as-is
  return phone;
}
