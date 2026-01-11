# CRM Debug Reference Guide

## Common Issues & Solutions

### 1. Dashboard Shows Old Data
**Symptoms:** Dashboard shows "11 Properties" but database is empty
**Root Cause:** tRPC caching + hardcoded data
**Solution:**
```tsx
// In client/src/pages/Dashboard.tsx
const { data: dashboardStats, isLoading: statsLoading } = trpc.dashboard.getStats.useQuery(
  selectedAgentId === "all" ? undefined : parseInt(selectedAgentId),
  { staleTime: 0, gcTime: 0 } // Disable caching
);
```

### 2. Duplicate Properties in Database
**Symptoms:** Same address appears multiple times with different LEAD IDs
**Root Cause:** Multiple imports without deduplication
**Solution:**
```sql
-- Delete duplicates, keep first occurrence
DELETE FROM properties WHERE id NOT IN (
  SELECT MIN(id) FROM properties GROUP BY addressLine1, city, state, zipcode
);
```

### 3. Contacts Not Importing
**Symptoms:** Properties import but contacts section is empty
**Root Cause:** Column name mismatch (contact_1_name vs contact1Name)
**Solution:** Use Excel converter that transforms snake_case → camelCase
- File: `/home/ubuntu/upload/dealmachine-properties-CONVERTED.xlsx`
- Converter: Python script that maps DealMachine format to CRM schema

### 4. Agent Dropdown Empty
**Symptoms:** "Select an agent..." dropdown shows no options
**Root Cause:** `listAgents()` querying wrong table or filtering out all agents
**Solution:**
```ts
// In server/db.ts - listAgents should return from users table
export async function listAgents() {
  const database = getDb();
  if (!database) return [];
  
  const agents = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
    })
    .from(users)
    .where(ne(users.role, 'admin'))
    .orderBy(users.name)
    .execute();
  
  return agents || [];
}
```

### 5. Import Button Disabled
**Symptoms:** "Import Properties" button is grayed out even with file selected
**Root Cause:** Agent selection required but not selected
**Solution:** Make agent optional in ImportProperties.tsx
```tsx
const isFormValid = selectedFile !== null; // Don't require agent
```

### 6. propertyId Field Missing
**Symptoms:** Import fails with "propertyId not found"
**Root Cause:** Field not added to database schema
**Solution:**
```sql
-- Add propertyId column
ALTER TABLE properties ADD COLUMN propertyId VARCHAR(100) UNIQUE;

-- Create index
CREATE UNIQUE INDEX idx_propertyId ON properties(propertyId);
```

---

## Database Cleanup Commands

```sql
-- Delete all properties and contacts
DELETE FROM contacts;
DELETE FROM properties;

-- Verify cleanup
SELECT COUNT(*) as property_count FROM properties;
SELECT COUNT(*) as contact_count FROM contacts;
```

## File Locations

- **Excel Converter:** `/home/ubuntu/upload/dealmachine-properties-CONVERTED.xlsx`
- **Dashboard Component:** `/home/ubuntu/crm-123drive-v2/client/src/pages/Dashboard.tsx`
- **Import Component:** `/home/ubuntu/crm-123drive-v2/client/src/pages/ImportProperties.tsx`
- **DB Functions:** `/home/ubuntu/crm-123drive-v2/server/db.ts`
- **Router Procedures:** `/home/ubuntu/crm-123drive-v2/server/routers.ts`
- **Schema:** `/home/ubuntu/crm-123drive-v2/drizzle/schema.ts`

## Key Endpoints

- `GET /import` - Import Properties page
- `POST /api/trpc/import.uploadProperties` - Upload and process Excel file
- `GET /api/trpc/dashboard.getStats` - Fetch dashboard statistics
- `GET /api/trpc/agents.list` - Get list of available agents

## Testing Checklist

- [ ] Dashboard shows 0 properties when database is empty
- [ ] Agent dropdown populated with John Smith, Maria Garcia, etc.
- [ ] Import button enabled without agent selection
- [ ] Excel file converts correctly (snake_case → camelCase)
- [ ] propertyId prevents duplicate imports
- [ ] Contacts import with properties
- [ ] Dashboard updates in real-time (no cache)
