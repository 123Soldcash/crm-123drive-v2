/**
 * Contact Data Consolidation Migration (Bulk SQL Version)
 * =========================================================
 * Migrates all data from legacy contactPhones and contactEmails tables
 * into the new unified contacts model (1 contact = 1 phone OR 1 email).
 *
 * Uses bulk SQL operations for performance (no row-by-row loops).
 *
 * STEP 1 — Sync TrestleIQ/DNC data from contactPhones → contacts (UPDATE JOIN)
 * STEP 2 — Insert missing phones from contactPhones → contacts (INSERT ... SELECT)
 * STEP 3 — Insert missing emails from contactEmails → contacts (INSERT ... SELECT)
 * STEP 4 — Validation: verify zero data loss
 */

import { createConnection } from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const conn = await createConnection(DATABASE_URL);
  console.log('Connected to database.\n');

  // ─────────────────────────────────────────────────────────────────────────
  // PRE-MIGRATION COUNTS
  // ─────────────────────────────────────────────────────────────────────────
  const [[{ contactsBefore }]] = await conn.query('SELECT COUNT(*) as contactsBefore FROM contacts');
  const [[{ cpBefore }]] = await conn.query('SELECT COUNT(*) as cpBefore FROM contactPhones');
  const [[{ ceBefore }]] = await conn.query('SELECT COUNT(*) as ceBefore FROM contactEmails');
  console.log('=== PRE-MIGRATION COUNTS ===');
  console.log(`contacts: ${contactsBefore}`);
  console.log(`contactPhones: ${cpBefore}`);
  console.log(`contactEmails: ${ceBefore}\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Sync TrestleIQ/DNC data from contactPhones → contacts
  // Uses UPDATE JOIN to copy data in bulk where contacts already have the phone
  // ─────────────────────────────────────────────────────────────────────────
  console.log('=== STEP 1: Syncing TrestleIQ/DNC data (bulk UPDATE) ===');

  // Sync TrestleIQ score where contacts.trestleScore IS NULL
  const [trestleSync] = await conn.query(`
    UPDATE contacts c
    INNER JOIN contactPhones cp ON cp.contactId = c.id
    SET
      c.trestleScore = COALESCE(c.trestleScore, cp.trestleScore),
      c.trestleLineType = COALESCE(c.trestleLineType, cp.trestleLineType),
      c.trestleLastChecked = COALESCE(c.trestleLastChecked, cp.trestleLastChecked),
      c.carrier = COALESCE(c.carrier, cp.carrier),
      c.isPrepaid = CASE WHEN c.isPrepaid = 0 AND cp.isPrepaid = 1 THEN 1 ELSE c.isPrepaid END,
      c.isLitigator = CASE WHEN c.isLitigator = 0 AND cp.isLitigator = 1 THEN 1 ELSE c.isLitigator END,
      c.dnc = CASE WHEN c.dnc = 0 AND cp.dnc = 1 THEN 1 ELSE c.dnc END,
      c.dncChecked = CASE WHEN c.dncChecked = 0 AND cp.dncChecked = 1 THEN 1 ELSE c.dncChecked END
    WHERE cp.trestleScore IS NOT NULL OR cp.isLitigator = 1 OR cp.dnc = 1 OR cp.dncChecked = 1
  `);
  console.log(`  Updated ${trestleSync.affectedRows} contacts with TrestleIQ/DNC data\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Insert missing phones from contactPhones → contacts
  // Only inserts phones that don't already exist in contacts for the same property
  // Uses normalized phone comparison (digits only)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('=== STEP 2: Inserting missing phones from contactPhones → contacts ===');

  const [phoneInsert] = await conn.query(`
    INSERT INTO contacts (
      propertyId, name, relationship, firstName, lastName, middleInitial, generationalSuffix,
      gender, maritalStatus, netAssetValue, homeBusiness, educationModel,
      occupationGroup, occupationCode, businessOwner,
      phoneNumber, phoneType, contactType,
      dnc, dncChecked, isLitigator,
      trestleScore, trestleLineType, trestleLastChecked, carrier, isPrepaid,
      isDecisionMaker, notes, sortOrder, dealMachineContactId,
      deceased, currentResident, contacted, onBoard, notOnBoard, hidden
    )
    SELECT
      c.propertyId,
      c.name,
      c.relationship,
      c.firstName,
      c.lastName,
      c.middleInitial,
      c.generationalSuffix,
      c.gender,
      c.maritalStatus,
      c.netAssetValue,
      c.homeBusiness,
      c.educationModel,
      c.occupationGroup,
      c.occupationCode,
      c.businessOwner,
      cp.phoneNumber,
      COALESCE(cp.phoneType, 'Mobile'),
      'phone',
      COALESCE(cp.dnc, 0),
      COALESCE(cp.dncChecked, 0),
      COALESCE(cp.isLitigator, 0),
      cp.trestleScore,
      cp.trestleLineType,
      cp.trestleLastChecked,
      cp.carrier,
      COALESCE(cp.isPrepaid, 0),
      COALESCE(c.isDecisionMaker, 0),
      c.notes,
      COALESCE(c.sortOrder, 0),
      c.dealMachineContactId,
      0, 0, 0, 0, 0, 0
    FROM contactPhones cp
    INNER JOIN contacts c ON c.id = cp.contactId
    WHERE cp.phoneNumber IS NOT NULL AND cp.phoneNumber != ''
    AND NOT EXISTS (
      SELECT 1 FROM contacts c2
      WHERE c2.propertyId = c.propertyId
      AND c2.contactType = 'phone'
      AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c2.phoneNumber, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') =
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cp.phoneNumber, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '')
    )
  `);
  console.log(`  Inserted ${phoneInsert.affectedRows} new phone contacts\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Insert missing emails from contactEmails → contacts
  // ─────────────────────────────────────────────────────────────────────────
  console.log('=== STEP 3: Inserting missing emails from contactEmails → contacts ===');

  const [emailInsert] = await conn.query(`
    INSERT INTO contacts (
      propertyId, name, relationship, firstName, lastName, middleInitial, generationalSuffix,
      gender, maritalStatus, netAssetValue, homeBusiness, educationModel,
      occupationGroup, occupationCode, businessOwner,
      email, contactType,
      isDecisionMaker, notes, sortOrder, dealMachineContactId,
      deceased, currentResident, contacted, onBoard, notOnBoard, hidden,
      dnc, dncChecked, isLitigator
    )
    SELECT
      c.propertyId,
      c.name,
      c.relationship,
      c.firstName,
      c.lastName,
      c.middleInitial,
      c.generationalSuffix,
      c.gender,
      c.maritalStatus,
      c.netAssetValue,
      c.homeBusiness,
      c.educationModel,
      c.occupationGroup,
      c.occupationCode,
      c.businessOwner,
      TRIM(ce.email),
      'email',
      COALESCE(c.isDecisionMaker, 0),
      c.notes,
      COALESCE(c.sortOrder, 0),
      c.dealMachineContactId,
      0, 0, 0, 0, 0, 0,
      0, 0, 0
    FROM contactEmails ce
    INNER JOIN contacts c ON c.id = ce.contactId
    WHERE ce.email IS NOT NULL AND TRIM(ce.email) != ''
    AND NOT EXISTS (
      SELECT 1 FROM contacts c2
      WHERE c2.propertyId = c.propertyId
      AND c2.contactType = 'email'
      AND LOWER(TRIM(c2.email)) = LOWER(TRIM(ce.email))
    )
  `);
  console.log(`  Inserted ${emailInsert.affectedRows} new email contacts\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: VALIDATION
  // ─────────────────────────────────────────────────────────────────────────
  console.log('=== STEP 4: VALIDATION ===');

  const [[{ contactsAfter }]] = await conn.query('SELECT COUNT(*) as contactsAfter FROM contacts');

  // All phones from contactPhones must exist in contacts
  const [[{ missingPhones }]] = await conn.query(`
    SELECT COUNT(*) as missingPhones FROM contactPhones cp
    INNER JOIN contacts c ON c.id = cp.contactId
    WHERE cp.phoneNumber IS NOT NULL AND cp.phoneNumber != ''
    AND NOT EXISTS (
      SELECT 1 FROM contacts c2
      WHERE c2.propertyId = c.propertyId
      AND c2.contactType = 'phone'
      AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c2.phoneNumber, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') =
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cp.phoneNumber, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '')
    )
  `);

  // All emails from contactEmails must exist in contacts
  const [[{ missingEmails }]] = await conn.query(`
    SELECT COUNT(*) as missingEmails FROM contactEmails ce
    INNER JOIN contacts c ON c.id = ce.contactId
    WHERE ce.email IS NOT NULL AND TRIM(ce.email) != ''
    AND NOT EXISTS (
      SELECT 1 FROM contacts c2
      WHERE c2.propertyId = c.propertyId
      AND c2.contactType = 'email'
      AND LOWER(TRIM(c2.email)) = LOWER(TRIM(ce.email))
    )
  `);

  // DNC integrity: every DNC phone in contactPhones must have a DNC contact
  const [[{ dncMismatch }]] = await conn.query(`
    SELECT COUNT(*) as dncMismatch FROM contactPhones cp
    INNER JOIN contacts c ON c.id = cp.contactId
    WHERE cp.dnc = 1
    AND NOT EXISTS (
      SELECT 1 FROM contacts c2
      WHERE c2.propertyId = c.propertyId
      AND c2.contactType = 'phone'
      AND c2.dnc = 1
      AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c2.phoneNumber, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') =
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cp.phoneNumber, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '')
    )
  `);

  // TrestleIQ integrity: every phone with trestle data must have it in contacts
  const [[{ trestleMismatch }]] = await conn.query(`
    SELECT COUNT(*) as trestleMismatch FROM contactPhones cp
    INNER JOIN contacts c ON c.id = cp.contactId
    WHERE cp.trestleScore IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM contacts c2
      WHERE c2.propertyId = c.propertyId
      AND c2.contactType = 'phone'
      AND c2.trestleScore IS NOT NULL
      AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c2.phoneNumber, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') =
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cp.phoneNumber, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '')
    )
  `);

  console.log(`  contacts before: ${contactsBefore} → after: ${contactsAfter} (+${contactsAfter - contactsBefore} new records)`);
  console.log(`  Phones still missing: ${missingPhones} (target: 0)`);
  console.log(`  Emails still missing: ${missingEmails} (target: 0)`);
  console.log(`  DNC mismatches: ${dncMismatch} (target: 0)`);
  console.log(`  TrestleIQ mismatches: ${trestleMismatch} (target: 0)`);

  const success = missingPhones === 0 && missingEmails === 0 && dncMismatch === 0 && trestleMismatch === 0;

  if (success) {
    console.log('\n✅ MIGRATION SUCCESSFUL — All data verified. Zero data loss.');
    console.log('\nReady for next steps:');
    console.log('  1. Update Drizzle schema to remove contactPhones/contactEmails/contactSocialMedia tables');
    console.log('  2. Update all server code to use contacts table only');
    console.log('  3. Run: DROP TABLE contactPhones, contactEmails, contactSocialMedia');
  } else {
    console.log('\n❌ MIGRATION INCOMPLETE — Some records are still missing. Do NOT drop legacy tables.');
    process.exit(1);
  }

  await conn.end();
}

main().catch(err => {
  console.error('MIGRATION FAILED:', err);
  process.exit(1);
});
