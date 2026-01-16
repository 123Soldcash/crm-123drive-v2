# Drizzle ORM Initialization Best Practices

## Developer Onboarding Checklist

This guide ensures proper Drizzle ORM configuration and helps prevent common initialization errors in our property CRM project.

---

## ✅ Database Connection Setup

### 1. Schema Configuration (CRITICAL)

**Always pass the schema to drizzle() to enable the relational query API.**

```typescript
// ❌ WRONG - Missing schema
import { drizzle } from "drizzle-orm/mysql2";
const db = drizzle(process.env.DATABASE_URL);

// ✅ CORRECT - Schema included
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";
const db = drizzle(process.env.DATABASE_URL, { schema, mode: 'default' });
```

**Why this matters**: Without schema, `db.query.*` methods will be `undefined`, causing runtime errors like "Cannot read properties of undefined (reading 'findFirst')".

---

### 2. Import All Required Tables

**Ensure all tables used in your queries are imported from the schema.**

```typescript
// Import tables you'll query
import { 
  properties, 
  users, 
  stageHistory,  // Don't forget related tables!
  contacts,
  // ... add all tables your module needs
} from "../drizzle/schema";
```

**Common mistake**: Forgetting to import newly added tables (like `stageHistory`) when adding features.

---

### 3. Verify Query API Availability

**Add defensive checks during initialization to catch configuration issues early.**

```typescript
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL, { schema, mode: 'default' });
      
      // Defensive check
      if (!_db.query) {
        console.error("[Database] Query API not initialized - schema missing?");
        throw new Error("Drizzle query API not available");
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
```

---

### 4. Handle Null Database Connections

**Always check if database is available before querying.**

```typescript
export async function updatePropertyStage(propertyId: number, newStage: string) {
  const db = await getDb();
  
  // ✅ Check database availability
  if (!db) {
    throw new Error("Database not available");
  }
  
  // Now safe to query
  const property = await db.query.properties.findFirst({
    where: eq(properties.id, propertyId),
  });
}
```

---

## 🔄 Development Workflow

### 5. Restart Server After Configuration Changes

**Database connection configuration is cached. Always restart after changes.**

```bash
# Stop the dev server (Ctrl+C)
# Then restart
pnpm dev
```

**When to restart**:
- ✅ After modifying `server/db.ts` initialization
- ✅ After adding new schema tables
- ✅ After changing database connection strings
- ❌ NOT needed for query logic changes (hot-reload works)

---

### 6. Schema Migrations

**Push schema changes to database before using new tables.**

```bash
# After modifying drizzle/schema.ts
pnpm db:push

# This generates migrations and applies them
```

**Checklist before querying new tables**:
1. Define table in `drizzle/schema.ts`
2. Run `pnpm db:push`
3. Import table in your query file
4. Restart server if needed
5. Verify table exists in database

---

## 🎯 Query Best Practices

### 7. Choose the Right Query Method

**Drizzle offers two query styles - use the appropriate one.**

#### Relational Query API (Recommended for most cases)
```typescript
// ✅ Clean, type-safe, with relations
const property = await db.query.properties.findFirst({
  where: eq(properties.id, propertyId),
  with: {
    contacts: true,  // Auto-load relations
    visits: true,
  },
});
```

#### Core Query Builder (For complex queries)
```typescript
// ✅ Use when you need advanced SQL features
const results = await db
  .select({
    stage: properties.dealStage,
    count: sql<number>`count(*)`,
  })
  .from(properties)
  .groupBy(properties.dealStage);
```

---

### 8. Type Safety

**Leverage TypeScript for compile-time safety.**

```typescript
// ✅ Import types from schema
import { properties, type Property, type InsertProperty } from "../drizzle/schema";

// ✅ Use proper types in function signatures
export async function createProperty(data: InsertProperty): Promise<Property> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [newProperty] = await db.insert(properties).values(data);
  return newProperty;
}
```

---

## 🐛 Common Errors and Solutions

### Error: "Cannot read properties of undefined (reading 'findFirst')"

**Cause**: Schema not passed to drizzle initialization

**Solution**: 
```typescript
import * as schema from "../drizzle/schema";
const db = drizzle(url, { schema, mode: 'default' });
```

---

### Error: "Table 'database.tableName' doesn't exist"

**Cause**: Schema not pushed to database

**Solution**: 
```bash
pnpm db:push
```

---

### Error: "Property 'query' does not exist on type..."

**Cause**: TypeScript can't infer query types without schema

**Solution**: Ensure schema is imported and passed to drizzle with proper typing

---

## 📋 Pre-Deployment Checklist

Before deploying database changes to production:

- [ ] All schema changes defined in `drizzle/schema.ts`
- [ ] Schema passed to drizzle initialization with `{ schema, mode: 'default' }`
- [ ] All new tables imported in query files
- [ ] `pnpm db:push` executed successfully in development
- [ ] Server restarted after configuration changes
- [ ] All queries tested with actual database data
- [ ] Error handling in place for null database connections
- [ ] Migration scripts generated and reviewed
- [ ] Backup of production database created
- [ ] Rollback plan documented

---

## 🔍 Debugging Tips

### Check Database Connection
```typescript
const db = await getDb();
console.log("DB available:", !!db);
console.log("Query API available:", !!db?.query);
```

### Verify Schema Loading
```typescript
import * as schema from "../drizzle/schema";
console.log("Schema tables:", Object.keys(schema));
```

### Test Query Directly
```typescript
// Bypass abstraction to test raw query
const db = await getDb();
const result = await db.select().from(properties).limit(1);
console.log("Direct query works:", result);
```

---

## 📚 Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [MySQL2 Driver Setup](https://orm.drizzle.team/docs/get-started-mysql)
- [Relational Queries Guide](https://orm.drizzle.team/docs/rqb)
- [Schema Definition](https://orm.drizzle.team/docs/sql-schema-declaration)

---

## 🎓 Onboarding Exercise

New developers should complete this exercise to verify their understanding:

1. Add a new table `propertyNotes` to `drizzle/schema.ts`
2. Push the schema with `pnpm db:push`
3. Create a query function using `db.query.propertyNotes.findMany()`
4. Test the query and verify it returns data
5. Add error handling for null database connection
6. Document any issues encountered

**Expected outcome**: Successfully query the new table without runtime errors.

---

**Last Updated**: January 15, 2026  
**Maintainer**: Development Team  
**Version**: 1.0
