# Property ID - Duplicate Prevention Guide

**Date:** January 10, 2026  
**Status:** Active  
**Purpose:** Prevent duplicate property imports using unique property identifiers

---

## Overview

The CRM now includes a **`propertyId`** field that uniquely identifies each property from DealMachine. This prevents duplicate entries when importing the same data multiple times.

**Key Benefits:**
- ✅ Prevents duplicate properties with same address
- ✅ Allows safe re-imports of the same file
- ✅ Tracks original DealMachine property ID
- ✅ Enables data reconciliation and updates

---

## How It Works

### 1. Property ID Storage

Each property now has a `propertyId` field that stores the unique identifier from DealMachine:

```
propertyId: VARCHAR(100) UNIQUE
```

This field is:
- **Unique**: No two properties can have the same propertyId
- **Optional**: Can be NULL if property was created manually
- **Indexed**: Fast lookup for duplicate checking

### 2. Import Process

When you import properties:

1. **Check for duplicates** - System looks for existing propertyId
2. **If found** - Property is skipped with error message: "Property with ID [ID] already exists (duplicate)"
3. **If not found** - Property is imported normally
4. **Result** - Only new properties are added, duplicates are prevented

### 3. Duplicate Detection

The import system checks for duplicates in this order:

1. **dealMachinePropertyId** - Primary DealMachine property ID
2. **propertyId** - Fallback to explicit propertyId column
3. **NULL** - If no ID provided, property is imported (no duplicate check)

---

## File Format

### Updated Converter

The Excel converter now includes `propertyId` as the **first column**:

```
Column 1: propertyId         ← Unique identifier (prevents duplicates)
Column 2: addressLine1       ← Street address
Column 3: addressLine2       ← Apt/Suite (optional)
Column 4: city               ← City name
Column 5: state              ← State code
... (remaining columns)
```

### Example Data

| propertyId | addressLine1 | city | state | zipcode | owner1Name |
|-----------|--------------|------|-------|---------|-----------|
| DM-270001 | 5226 Sw 24th St | West Park | FL | 33023 | George A Adams Iii |
| DM-270002 | 1301 S 16th Ave | Hollywood | FL | 33020 | John Smith |
| DM-270003 | 8935 Nw 10th St | Pembroke Pines | FL | 33024 | Jane Doe |

---

## Usage Scenarios

### Scenario 1: First Import

**Action:** Import `dealmachine-properties-CONVERTED.xlsx` with 25 properties

**Result:**
- All 25 properties imported successfully
- Each assigned a unique propertyId
- Database now contains 25 new properties

### Scenario 2: Re-import Same File

**Action:** Import the same file again

**Expected Result:**
- System detects all 25 propertyIds already exist
- All 25 rows rejected with "duplicate" message
- Database unchanged (0 new properties)
- Message: "Imported 0 properties, 25 rows had errors"

### Scenario 3: Import Updated Data

**Action:** Import file with 20 existing properties + 5 new properties

**Result:**
- 20 existing properties skipped (duplicate propertyIds)
- 5 new properties imported successfully
- Message: "Imported 5 properties, 20 rows had errors"

### Scenario 4: Manual Property Creation

**Action:** Create property manually in CRM (no propertyId)

**Result:**
- Property created with NULL propertyId
- Can be imported again from DealMachine without conflict
- propertyId remains NULL unless updated

---

## Database Schema

### Properties Table

```sql
CREATE TABLE properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  propertyId VARCHAR(100) UNIQUE,  -- NEW: Unique property identifier
  leadId INT,
  addressLine1 VARCHAR(255) NOT NULL,
  addressLine2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  zipcode VARCHAR(10) NOT NULL,
  -- ... other fields ...
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_propertyId (propertyId)  -- Unique index for fast lookup
);
```

### Index

```sql
CREATE UNIQUE INDEX idx_propertyId ON properties(propertyId);
```

This index ensures:
- Fast duplicate checking during import
- Uniqueness constraint at database level
- Efficient queries by propertyId

---

## Import Logic

### Duplicate Check Code

```typescript
// Get propertyId from dealMachinePropertyId or propertyId column
const propertyId = row['dealMachinePropertyId'] || row['propertyId'] || null;

// Check for duplicate propertyId
if (propertyId) {
  const existing = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.propertyId, propertyId))
    .limit(1);
  
  if (existing.length > 0) {
    // Property already exists - skip it
    errorCount++;
    errors.push(`Row ${i + 2}: Property with ID ${propertyId} already exists (duplicate)`);
    continue;
  }
}

// Insert new property
await db.insert(properties).values({
  propertyId: propertyId,
  // ... other fields ...
});
```

---

## Troubleshooting

### Issue: "Property with ID [ID] already exists"

**Meaning:** You're trying to import a property that's already in the database

**Solutions:**
1. **Check if property exists** - Go to Properties page and search by address
2. **Update instead of import** - If you need to update data, edit the property directly
3. **Use different ID** - If this is a different property, ensure it has a unique propertyId
4. **Remove from file** - Delete the duplicate row from your Excel file before importing

### Issue: Some rows imported, some rejected

**Meaning:** Mixed results - some new properties, some duplicates

**Example:**
```
Imported 5 properties, 20 rows had errors
```

This means:
- 5 new properties were imported successfully
- 20 properties were duplicates (already in database)
- Check error messages to see which rows were rejected

### Issue: All rows rejected as duplicates

**Meaning:** All properties in your file already exist in the database

**Solutions:**
1. **Verify file content** - Make sure you're importing the right file
2. **Check database** - Go to Properties page to see existing properties
3. **Clear test data** - If testing, you may need to delete test properties first
4. **Use new data** - Import a different file with new properties

---

## Best Practices

### 1. Always Include propertyId

When exporting from DealMachine, ensure you include the property ID:

```
✅ GOOD: propertyId column populated with DM-270001, DM-270002, etc.
❌ BAD: propertyId column empty or missing
```

### 2. Keep propertyId Consistent

Use the same propertyId format across all imports:

```
✅ GOOD: DM-270001, DM-270002 (consistent format)
❌ BAD: 270001, DM-270001, dm_270001 (mixed formats)
```

### 3. Archive Old Imports

Keep records of what you've imported:

```
📁 2026-01-10 - Import 25 properties (propertyIds: DM-270001 to DM-270025)
📁 2026-01-15 - Import 30 properties (propertyIds: DM-270026 to DM-270055)
📁 2026-01-20 - Import 20 properties (propertyIds: DM-270056 to DM-270075)
```

### 4. Monitor Import Results

Always check the import summary:

```
✅ Successfully imported 25 properties
❌ 0 rows had errors
```

If you see errors, investigate before importing again.

### 5. Backup Before Large Imports

For large imports (100+ properties):
1. Export current properties as backup
2. Test import with small sample (5-10 properties)
3. Verify results before importing full batch

---

## Data Migration

### If You Have Existing Properties

For properties created before the propertyId field was added:

1. **propertyId is NULL** - These properties have no duplicate protection
2. **Can still import** - New imports won't conflict with NULL propertyIds
3. **Update manually** - If needed, add propertyId to existing properties:

```sql
UPDATE properties 
SET propertyId = CONCAT('DM-', LPAD(id, 6, '0'))
WHERE propertyId IS NULL;
```

This would set propertyIds like: DM-000001, DM-000002, etc.

---

## Technical Details

### Column Specifications

| Property | Value |
|----------|-------|
| Field Name | propertyId |
| Data Type | VARCHAR(100) |
| Nullable | Yes (NULL allowed) |
| Unique | Yes (UNIQUE constraint) |
| Indexed | Yes (idx_propertyId) |
| Default | NULL |

### Performance

- **Lookup Speed**: O(1) - Constant time via index
- **Insert Speed**: O(log n) - Index update overhead minimal
- **Storage**: ~100 bytes per property (VARCHAR(100))

### Compatibility

- **Backward Compatible**: Existing properties work without propertyId
- **Forward Compatible**: New imports always include propertyId
- **Mixed Environment**: Can have both NULL and populated propertyIds

---

## FAQ

**Q: Can I change a propertyId after import?**
A: Not recommended. propertyId should be immutable to maintain data integrity. If needed, contact support.

**Q: What if I import from multiple DealMachine accounts?**
A: Use unique prefixes for each account (e.g., "DM-ACCOUNT1-270001", "DM-ACCOUNT2-270001")

**Q: Can I have duplicate propertyIds across different agents?**
A: No. propertyId is unique at database level, not per-agent.

**Q: What happens if propertyId is empty in Excel?**
A: Property will import without duplicate checking. Not recommended for production use.

**Q: How do I know which propertyId format to use?**
A: Use DealMachine's property ID exactly as provided. The converter handles the mapping automatically.

---

## Support

For issues with propertyId or duplicate prevention:

1. **Check this guide** - Review the Troubleshooting section
2. **Verify file format** - Ensure propertyId column is populated
3. **Test with small batch** - Import 5 properties first to verify
4. **Review error messages** - They indicate which rows have issues

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-10  
**Status:** Active and Ready for Production
