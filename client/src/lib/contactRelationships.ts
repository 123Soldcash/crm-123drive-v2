/**
 * Canonical list of contact relationship options.
 * Used across all contact forms (Add, Edit, CallTracking, ContactsSection).
 * Source of truth: ContactEditModal.tsx — keep this list in sync with the UI screenshot.
 */
export const RELATIONSHIP_OPTIONS = [
  "Owner",
  "Spouse",
  "Son",
  "Daughter",
  "Heir",
  "Attorney",
  "Tenant",
  "Neighbor",
  "Family",
  "Resident",
  "Likely Owner",
  "Potential Owner",
  "Renting",
  "Current Resident - NOT on Board",
  "Representative",
  "Other",
] as const;

export type RelationshipOption = (typeof RELATIONSHIP_OPTIONS)[number];
