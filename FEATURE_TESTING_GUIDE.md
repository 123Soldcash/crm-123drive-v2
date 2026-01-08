# Feature Testing Guide

## Quick Start

When implementing a new feature, follow this testing checklist:

### 1. Backend Testing

```bash
# Run all tests
pnpm test

# Expected: All tests should pass
# If tests fail, fix them before proceeding
```

### 2. Frontend Testing

- [ ] Feature works in browser
- [ ] No console errors or warnings
- [ ] Loading states display correctly
- [ ] Error states display correctly
- [ ] Success messages appear
- [ ] Data persists after page reload

### 3. Database Testing

- [ ] Data is saved to database
- [ ] Data can be retrieved correctly
- [ ] No duplicate entries created
- [ ] Foreign key constraints respected
- [ ] Migrations completed successfully

---

## Feature Testing Template

Use this template when testing a new feature:

### Feature: [Feature Name]

**Date:** [Date]
**Developer:** [Your Name]

#### Backend Tests
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Error handling tested
- [ ] Input validation tested
- [ ] Database queries tested

#### Frontend Tests
- [ ] Component renders correctly
- [ ] Loading state displays
- [ ] Error state displays
- [ ] Success state displays
- [ ] Data displays correctly
- [ ] Form validation works
- [ ] User can interact with feature

#### Integration Tests
- [ ] Backend and frontend communicate correctly
- [ ] Data flows from frontend to database
- [ ] Data flows from database to frontend
- [ ] No console errors
- [ ] No network errors

#### User Experience Tests
- [ ] Feature is intuitive
- [ ] Feedback is clear (toasts, messages)
- [ ] Loading times are acceptable
- [ ] Mobile responsive (if applicable)
- [ ] Accessibility is considered

---

## Common Testing Scenarios

### Scenario 1: Creating a New Record

**Steps:**
1. Open the create form
2. Fill in required fields
3. Click submit
4. Verify success message
5. Verify data appears in list
6. Refresh page
7. Verify data persists

**Expected Results:**
- ✅ Form submits successfully
- ✅ Success toast appears
- ✅ Data appears in list immediately
- ✅ Data persists after refresh
- ✅ No console errors

### Scenario 2: Updating a Record

**Steps:**
1. Open existing record
2. Modify a field
3. Click save
4. Verify success message
5. Verify changes appear
6. Refresh page
7. Verify changes persist

**Expected Results:**
- ✅ Update succeeds
- ✅ Success toast appears
- ✅ Changes appear immediately
- ✅ Changes persist after refresh
- ✅ No console errors

### Scenario 3: Deleting a Record

**Steps:**
1. Open existing record
2. Click delete
3. Confirm deletion
4. Verify success message
5. Verify record removed from list
6. Refresh page
7. Verify record is gone

**Expected Results:**
- ✅ Delete succeeds
- ✅ Success toast appears
- ✅ Record removed from list
- ✅ Record stays deleted after refresh
- ✅ No console errors

### Scenario 4: Filtering Data

**Steps:**
1. Open list view
2. Apply filter
3. Verify filtered results
4. Change filter
5. Verify results update
6. Clear filter
7. Verify all results show

**Expected Results:**
- ✅ Filter works correctly
- ✅ Results update immediately
- ✅ Multiple filters work together
- ✅ Filter state persists (if applicable)
- ✅ No console errors

### Scenario 5: Error Handling

**Steps:**
1. Try to perform action with invalid data
2. Verify error message appears
3. Verify action is not performed
4. Fix the issue
5. Try again
6. Verify action succeeds

**Expected Results:**
- ✅ Error message is clear
- ✅ Invalid action is prevented
- ✅ User can fix and retry
- ✅ Success after fix
- ✅ No console errors

---

## Test Automation

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test --watch

# Run specific test file
pnpm test server/agents.test.ts

# Run tests matching pattern
pnpm test --grep "Agent"
```

### Writing Tests

Create test files in these locations:
- Backend: `server/*.test.ts`
- Frontend: `client/src/**/*.test.ts`

**Example Backend Test:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../db';
import { agents } from '../../drizzle/schema';

describe('Agents API', () => {
  let database;

  beforeAll(async () => {
    database = await getDb();
  });

  it('should create a new agent', async () => {
    const result = await database.insert(agents).values({
      name: 'Test Agent',
      email: 'test@example.com',
      agentType: 'Internal',
    }).returning();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Agent');
  });

  afterAll(async () => {
    // Cleanup
  });
});
```

---

## Performance Testing

### Load Testing

- [ ] Feature works with 100 records
- [ ] Feature works with 1000 records
- [ ] Feature works with 10000 records
- [ ] Page loads in < 2 seconds
- [ ] Queries complete in < 1 second

### Memory Testing

- [ ] No memory leaks in browser
- [ ] No memory leaks in server
- [ ] Large lists don't cause slowdown
- [ ] Long-running operations don't freeze UI

---

## Browser Testing

### Desktop Browsers

- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Mobile Browsers

- [ ] Chrome Mobile
- [ ] Safari iOS
- [ ] Firefox Mobile

### Browser Console

- [ ] No errors
- [ ] No warnings
- [ ] No deprecated API usage

---

## Regression Testing

After implementing a new feature, verify that existing features still work:

- [ ] Dashboard loads correctly
- [ ] Properties list displays
- [ ] Property detail page works
- [ ] Tasks can be created
- [ ] Agents can be managed
- [ ] Filters work correctly
- [ ] Search works correctly
- [ ] Navigation works

---

## Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast is sufficient
- [ ] Focus indicators are visible
- [ ] Form labels are associated
- [ ] Error messages are announced

---

## Security Testing

- [ ] Input validation works
- [ ] SQL injection is prevented
- [ ] XSS is prevented
- [ ] CSRF tokens are used
- [ ] Authentication is required
- [ ] Authorization is enforced
- [ ] Sensitive data is not logged

---

## Sign-Off Checklist

Before marking a feature as complete:

- [ ] All tests pass
- [ ] Feature works in browser
- [ ] No console errors
- [ ] No console warnings
- [ ] Performance is acceptable
- [ ] Accessibility is considered
- [ ] Security is considered
- [ ] Documentation is updated
- [ ] todo.md is updated
- [ ] Checkpoint is saved

---

## Troubleshooting

### Tests Fail

1. Read the error message carefully
2. Check the test file for issues
3. Check the implementation for bugs
4. Run the test in isolation
5. Add console.log for debugging
6. Check database state

### Feature Doesn't Work in Browser

1. Check browser console for errors
2. Check network tab for failed requests
3. Check server logs for errors
4. Verify database has data
5. Clear browser cache
6. Restart dev server

### Data Not Persisting

1. Check database schema
2. Verify migration completed
3. Check database for data
4. Check for errors in mutation
5. Verify cache invalidation
6. Check for race conditions

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [tRPC Documentation](https://trpc.io/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

---

**Last Updated:** January 2026
