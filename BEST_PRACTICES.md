# CRM 123Drive V2 - Best Practices Guide

## Overview
This document outlines best practices to maintain code quality, prevent bugs, and ensure smooth development workflow for the CRM 123Drive V2 project.

---

## 1. Development Workflow

### 1.1 Before Starting Work
- [ ] Read the latest `todo.md` to understand current status
- [ ] Check the most recent checkpoint to understand the stable state
- [ ] Run `pnpm test` to ensure all tests pass
- [ ] Run `pnpm dev` and verify the dev server starts without errors

### 1.2 During Development
- [ ] Make changes in small, focused commits
- [ ] Test each feature in the browser immediately after implementation
- [ ] Run `pnpm test` after each significant change
- [ ] Keep console clean (no warnings or errors)
- [ ] Update `todo.md` as you complete tasks

### 1.3 After Completing a Feature
- [ ] Verify all tests pass: `pnpm test`
- [ ] Test the feature thoroughly in the browser
- [ ] Check for console errors/warnings
- [ ] Update `todo.md` with [x] for completed items
- [ ] Save a checkpoint with descriptive message
- [ ] Document any breaking changes

---

## 2. Code Organization Rules

### 2.1 No Duplicate Code
**Problem:** Duplicate routers, functions, or components cause conflicts
**Solution:**
- Always consolidate into a single location
- Use search to check for duplicates: `grep -r "functionName" server/`
- If you find duplicates, merge them immediately

### 2.2 Import Organization
**Rule:** Keep imports organized at the top of files
```typescript
// ✅ Good
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

// ❌ Bad - duplicate imports
import React, { useState } from "react";
import React, { useEffect } from "react";
```

### 2.3 Router Structure
**Rule:** Each router should have a single definition
```typescript
// ✅ Good - one router definition
properties: router({
  list: protectedProcedure.query(...),
  get: protectedProcedure.query(...),
  update: protectedProcedure.mutation(...),
}),

// ❌ Bad - duplicate router
properties: router({...}),
properties: router({...}), // ERROR: duplicate key
```

---

## 3. Testing Requirements

### 3.1 Before Committing
```bash
# Run all tests
pnpm test

# Expected: All tests should pass
# If any test fails, fix it immediately
```

### 3.2 Test Coverage
- [ ] Create tests for new backend procedures
- [ ] Test both success and error cases
- [ ] Verify database mutations work correctly
- [ ] Test frontend components with different states

### 3.3 Test File Location
- Backend tests: `server/*.test.ts`
- Frontend tests: `client/src/**/*.test.ts`
- Example: `server/agents.test.ts`

---

## 4. Database Changes

### 4.1 Schema Updates
1. Update `drizzle/schema.ts` with new tables/columns
2. Run `pnpm db:push` to apply migrations
3. Verify changes in database UI
4. Test queries that use the new schema

### 4.2 Query Helpers
- Add helper functions in `server/db.ts` for complex queries
- Document parameters and return types
- Test queries with sample data

### 4.3 Backend Procedures
- Add tRPC procedures in `server/routers.ts`
- Use `protectedProcedure` for authenticated endpoints
- Validate input with Zod schemas
- Return typed responses

---

## 5. Frontend Development

### 5.1 Component Structure
```typescript
// ✅ Good structure
import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export function MyComponent() {
  const [state, setState] = useState("");
  const { data } = trpc.feature.useQuery();
  
  return <div>{/* JSX */}</div>;
}
```

### 5.2 Data Fetching
- Use `trpc.*.useQuery()` for reading data
- Use `trpc.*.useMutation()` for writing data
- Always handle loading and error states
- Invalidate cache after mutations: `trpc.useUtils().feature.invalidate()`

### 5.3 Error Handling
```typescript
// ✅ Good
const mutation = trpc.feature.useMutation({
  onSuccess: () => {
    toast.success("Success!");
    trpc.useUtils().feature.invalidate();
  },
  onError: (error) => {
    toast.error(error.message);
  },
});
```

---

## 6. Checkpoint Strategy

### 6.1 When to Save Checkpoints
- ✅ After completing a major feature
- ✅ Before making risky changes
- ✅ After fixing critical bugs
- ✅ Before testing new integrations

### 6.2 When NOT to Save Checkpoints
- ❌ During development (work-in-progress)
- ❌ When tests are failing
- ❌ When there are console errors
- ❌ Multiple times in a single session

### 6.3 Checkpoint Naming
```
Good: "Implement bulk agent assignment with filters"
Good: "Fix agent assignment not saving to database"
Bad: "update"
Bad: "checkpoint"
```

---

## 7. Common Pitfalls to Avoid

### 7.1 Duplicate Imports
```typescript
// ❌ BAD - causes "Identifier already declared" error
import React, { useState } from "react";
import React, { useEffect } from "react";

// ✅ GOOD
import React, { useState, useEffect } from "react";
```

### 7.2 Duplicate Router Keys
```typescript
// ❌ BAD - causes "Duplicate key" warning
export const appRouter = router({
  agents: router({...}),
  agents: router({...}), // ERROR!
});

// ✅ GOOD - merge into one
export const appRouter = router({
  agents: router({
    list: protectedProcedure.query(...),
    create: protectedProcedure.mutation(...),
  }),
});
```

### 7.3 Missing Invalidation
```typescript
// ❌ BAD - data doesn't update after mutation
const mutation = trpc.feature.useMutation({
  onSuccess: () => {
    toast.success("Done!");
    // Missing: invalidate cache
  },
});

// ✅ GOOD
const mutation = trpc.feature.useMutation({
  onSuccess: () => {
    toast.success("Done!");
    trpc.useUtils().feature.invalidate();
  },
});
```

### 7.4 Unhandled Errors
```typescript
// ❌ BAD - errors are silent
const mutation = trpc.feature.useMutation();

// ✅ GOOD
const mutation = trpc.feature.useMutation({
  onError: (error) => {
    console.error("Error:", error);
    toast.error(error.message || "Something went wrong");
  },
});
```

---

## 8. Debugging Checklist

When something breaks, follow this checklist:

### 8.1 Frontend Issues
- [ ] Check browser console for errors
- [ ] Verify network requests in DevTools
- [ ] Check if data is loading correctly
- [ ] Verify component state with React DevTools
- [ ] Run `pnpm test` to check for test failures

### 8.2 Backend Issues
- [ ] Check server logs in terminal
- [ ] Verify database schema is correct
- [ ] Test procedure with sample data
- [ ] Check input validation with Zod
- [ ] Run `pnpm test` to verify procedure

### 8.3 Database Issues
- [ ] Check if schema migration completed
- [ ] Verify table exists in database UI
- [ ] Check if data is being inserted correctly
- [ ] Look for foreign key constraint errors
- [ ] Verify column types match schema

---

## 9. Pre-Deployment Checklist

Before saving a checkpoint and considering work complete:

- [ ] All tests pass: `pnpm test`
- [ ] No console errors or warnings
- [ ] Feature works in browser
- [ ] No duplicate code or imports
- [ ] Database schema is clean
- [ ] `todo.md` is updated with [x] for completed items
- [ ] Checkpoint message is descriptive
- [ ] No breaking changes to existing features

---

## 10. Quick Reference Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm test             # Run all tests
pnpm db:push          # Apply database migrations

# Debugging
grep -r "text" server/    # Search for text in server
grep -r "text" client/    # Search for text in client
npm run build         # Build for production

# Git/Checkpoints
# Checkpoints are managed through the UI
# Always use webdev_save_checkpoint tool, not git commands
```

---

## 11. Communication & Documentation

### 11.1 Update todo.md
- Add new tasks as [ ] items
- Mark completed tasks as [x]
- Keep history (don't delete old items)
- Update after each session

### 11.2 Code Comments
- Add comments for complex logic
- Document function parameters
- Explain "why", not "what"

### 11.3 Commit Messages (if using git)
```
✅ Good: "Add bulk agent assignment with temperature filter"
✅ Good: "Fix agent assignment not persisting to database"
❌ Bad: "update"
❌ Bad: "fix"
```

---

## 12. Performance Considerations

### 12.1 Query Optimization
- Use `.limit()` for large result sets
- Index frequently queried columns
- Avoid N+1 queries (use Promise.all for batch operations)
- Cache results when appropriate

### 12.2 Frontend Performance
- Lazy load components when possible
- Memoize expensive computations
- Avoid unnecessary re-renders
- Use optimistic updates for better UX

---

## 13. Security Best Practices

### 13.1 Authentication
- Always use `protectedProcedure` for sensitive operations
- Verify user permissions before data access
- Never expose sensitive data in logs

### 13.2 Input Validation
- Always validate input with Zod schemas
- Sanitize user input
- Check for SQL injection vulnerabilities

### 13.3 Error Messages
- Don't expose internal errors to users
- Log detailed errors server-side
- Show generic error messages to users

---

## Summary

Follow these practices to maintain code quality and prevent issues:

1. **Test Frequently** - Run `pnpm test` after each change
2. **Avoid Duplicates** - Search before adding new code
3. **Update Documentation** - Keep `todo.md` current
4. **Save Checkpoints** - After completing features
5. **Handle Errors** - Always add error handling
6. **Debug Systematically** - Follow the debugging checklist
7. **Review Before Committing** - Use the pre-deployment checklist

---

**Last Updated:** January 2026
**Version:** 1.0
