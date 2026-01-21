# CRM Troubleshooting Guide

**Last Updated:** January 21, 2026  
**Purpose:** Document common errors and their solutions to save time in future debugging

---

## Table of Contents
1. [React Import Errors](#react-import-errors)
2. [Database Function Mismatches](#database-function-mismatches)
3. [Photo Upload Issues](#photo-upload-issues)
4. [Missing Database Tables](#missing-database-tables)
5. [TypeScript Errors](#typescript-errors)

---

## React Import Errors

### Problem: "ReferenceError: useRef is not defined"
**Symptoms:**
- CRM crashes with white error screen
- Error message: `ReferenceError: useRef is not defined`
- Occurs in NotesSection.tsx or other React components

**Root Cause:**
- Missing React hook import in component file
- Usually happens when editing import statements or adding documentation headers

**Solution:**
```typescript
// ❌ WRONG - Missing useRef
import { useState } from "react";

// ✅ CORRECT - Include all hooks used in the component
import { useState, useRef, useEffect } from "react";
```

**How to Fix:**
1. Open the component file (e.g., `/home/ubuntu/crm-123drive-v2/client/src/components/NotesSection.tsx`)
2. Check the import statement at the top
3. Add any missing hooks to the import: `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, etc.
4. Save the file and refresh the browser

**Prevention:**
- Always check imports after editing component headers
- Use automated tests to verify imports (see section below)
- Never manually edit the first line of a component file

**Related Errors:**
- `ReferenceError: useEffect is not defined`
- `ReferenceError: useState is not defined`
- `ReferenceError: useMemo is not defined`

**Time to Fix:** 2-3 minutes

---

## Database Function Mismatches

### Problem: Backend calls non-existent database functions
**Symptoms:**
- Backend error: `db.functionName is not a function`
- Features work in UI but fail to save/load data
- Console shows undefined function errors

**Root Cause:**
- Router calls a database function that doesn't exist in `server/db.ts`
- Function name mismatch between router and database file

**Common Examples:**

#### Example 1: Notes Creation
```typescript
// ❌ WRONG - Router calls db.createNote() but function doesn't exist
// In server/routers.ts:
const note = await db.createNote({ ... });

// ✅ CORRECT - Use the actual function name
const note = await db.addPropertyNote({ ... });
```

#### Example 2: Photo Queries
```typescript
// ❌ WRONG - Router calls db.getPhotosByPropertyId()
const photos = await db.getPhotosByPropertyId(propertyId);

// ✅ CORRECT - Use the actual function name
const photos = await db.getPropertyPhotos(propertyId);
```

#### Example 3: Note Deletion
```typescript
// ❌ WRONG - Router calls db.deleteNote() but function doesn't exist
await db.deleteNote(noteId);

// ✅ CORRECT - Add the missing function to db.ts
export async function deleteNote(noteId: number) {
  return await db.delete(propertyNotes).where(eq(propertyNotes.id, noteId));
}
```

**How to Fix:**
1. Identify the function name being called in the router
2. Search for that function in `server/db.ts`
3. If it doesn't exist, either:
   - **Option A:** Change the router to use the correct function name
   - **Option B:** Add the missing function to `server/db.ts`
4. Restart the dev server if needed

**Prevention:**
- Always check if database functions exist before calling them in routers
- Use consistent naming conventions (e.g., `get*`, `create*`, `update*`, `delete*`)
- Write unit tests for all database functions

**Time to Fix:** 5-10 minutes

---

## Photo Upload Issues

### Problem: Photos upload but don't display
**Symptoms:**
- "Add Photos" button works
- Photos are saved to database
- Photos don't appear in the UI after saving

**Root Cause:**
- Frontend doesn't invalidate/refetch the photos query after upload
- Photos query is cached and not refreshed

**Solution:**
```typescript
// ❌ WRONG - No query invalidation after upload
const uploadMutation = trpc.photos.uploadBulk.useMutation({
  onSuccess: () => {
    toast.success("Photos uploaded!");
  }
});

// ✅ CORRECT - Invalidate photos query to trigger refetch
const utils = trpc.useUtils();
const uploadMutation = trpc.photos.uploadBulk.useMutation({
  onSuccess: () => {
    utils.photos.getByProperty.invalidate({ propertyId });
    toast.success("Photos uploaded!");
  }
});
```

**How to Fix:**
1. Open the component with photo upload (e.g., `NotesSection.tsx`)
2. Find the upload mutation
3. Add `utils.photos.getByProperty.invalidate()` in the `onSuccess` callback
4. Make sure `propertyId` or `noteId` is passed correctly

**Prevention:**
- Always invalidate queries after mutations that affect displayed data
- Use optimistic updates for instant UI feedback
- Test the complete upload → display flow before marking feature as complete

**Time to Fix:** 3-5 minutes

---

## Missing Database Tables

### Problem: "Table 'database_name.tableName' doesn't exist"
**Symptoms:**
- Console error: `Table 'rdbafwhqbdqo37pina3pdu.automatedFollowUps' doesn't exist`
- Feature fails silently or shows error toast
- Database queries fail

**Root Cause:**
- Schema defined in `drizzle/schema.ts` but not pushed to database
- Table was deleted or never created

**Solution:**
1. Check if table is defined in `drizzle/schema.ts`
2. If defined, push the schema to database:
   ```bash
   cd /home/ubuntu/crm-123drive-v2
   pnpm db:push
   ```
3. If not defined, add the table schema first, then push

**Example - Adding Missing Table:**
```typescript
// In drizzle/schema.ts
export const automatedFollowUps = mysqlTable("automatedFollowUps", {
  id: int("id").primaryKey().autoincrement(),
  propertyId: int("propertyId").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  trigger: varchar("trigger", { length: 100 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
```

Then run:
```bash
pnpm db:push
```

**Prevention:**
- Always run `pnpm db:push` after adding new tables to schema
- Check database UI panel to verify tables exist
- Write migration scripts for production deployments

**Time to Fix:** 5-15 minutes (depending on schema complexity)

---

## TypeScript Errors

### Problem: Type errors in contact/property imports
**Symptoms:**
- TypeScript error: `Type 'string | undefined' is not assignable to type 'string'`
- Occurs when importing contacts from Excel
- Build warnings but code still runs

**Root Cause:**
- Optional fields in Excel data (e.g., `phone2`, `email3`) are `undefined` but database expects `string | null`
- Type mismatch between import data and database schema

**Solution:**
```typescript
// ❌ WRONG - Passing undefined directly
await db.insert(contacts).values({
  name: row.name,
  email: row.email,  // Could be undefined
  phone1: row.phone1, // Could be undefined
});

// ✅ CORRECT - Convert undefined to null or empty string
await db.insert(contacts).values({
  name: row.name || "",
  email: row.email || null,
  phone1: row.phone1 || null,
});
```

**How to Fix:**
1. Find the import function in `server/routers.ts` or `server/db.ts`
2. Add null coalescing (`|| null` or `|| ""`) for optional fields
3. Update the database schema if needed to allow null values

**Prevention:**
- Always handle optional fields in import functions
- Use TypeScript strict mode to catch these errors early
- Validate data before inserting into database

**Time to Fix:** 10-15 minutes

---

## Quick Reference: Common Fixes

| Error | Quick Fix | File to Check |
|-------|-----------|---------------|
| `useRef is not defined` | Add `useRef` to React imports | Component file (e.g., NotesSection.tsx) |
| `db.functionName is not a function` | Add function to db.ts or fix router call | `server/db.ts`, `server/routers.ts` |
| Photos don't display | Add query invalidation after upload | Component with upload mutation |
| Table doesn't exist | Run `pnpm db:push` | `drizzle/schema.ts` |
| Type 'undefined' not assignable | Add `|| null` or `|| ""` | Import/mutation functions |

---

## Debugging Checklist

When encountering an error:

1. **Check the error message** - Read it carefully, it usually tells you exactly what's wrong
2. **Check browser console** - Look for JavaScript errors
3. **Check terminal/dev server logs** - Look for backend errors
4. **Check this guide** - See if the error is documented here
5. **Check recent changes** - What was the last thing you edited?
6. **Use git diff** - Compare with last working version
7. **Check database** - Use Management UI → Database panel to verify data
8. **Restart dev server** - Sometimes fixes caching issues: `pnpm dev`

---

## Prevention Best Practices

1. **Always test after changes** - Don't make multiple changes without testing
2. **Use checkpoints frequently** - Save working states to roll back if needed
3. **Read error messages** - They're usually accurate and helpful
4. **Check imports first** - Most React errors are missing imports
5. **Verify database functions** - Make sure they exist before calling them
6. **Invalidate queries** - Always refresh data after mutations
7. **Run `pnpm db:push`** - After any schema changes
8. **Use TypeScript** - It catches many errors before runtime

---

## Contact Information

If you encounter an error not covered in this guide:
1. Document the error message and symptoms
2. Note what you were doing when it occurred
3. Check git history for recent changes
4. Add the solution to this guide once resolved

**Remember:** Every error is a learning opportunity. Document it here to help future you!
