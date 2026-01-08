# Checkpoint Guidelines

## What is a Checkpoint?

A checkpoint is a saved snapshot of your project at a specific point in time. It allows you to:
- Save your progress safely
- Rollback to a previous version if something breaks
- Track the history of your project
- Have a stable version to work from

---

## When to Save Checkpoints

### ✅ SAVE a checkpoint when:

1. **After Completing a Major Feature**
   - Example: "Implement bulk agent assignment"
   - All tests passing
   - Feature tested in browser
   - No console errors

2. **After Fixing a Critical Bug**
   - Example: "Fix agent assignment not saving to database"
   - Bug is verified as fixed
   - Tests are passing
   - No new issues introduced

3. **Before Making Risky Changes**
   - Example: Before refactoring large sections
   - Before upgrading dependencies
   - Before changing database schema
   - Before integrating new services

4. **End of Development Session**
   - All work is complete and tested
   - Tests are passing
   - Documentation is updated
   - Ready for next session

5. **Before Deploying to Production**
   - All features are complete
   - All tests passing
   - All bugs fixed
   - Performance verified

### ❌ DO NOT save a checkpoint when:

1. **Tests are Failing**
   - Fix tests first, then save
   - Never commit broken code

2. **There are Console Errors**
   - Fix errors first
   - Clean console before saving

3. **Feature is Incomplete**
   - Only save when feature is done
   - Don't save work-in-progress

4. **During Active Development**
   - Save only when stopping work
   - Not between every small change

5. **After Reverting Changes**
   - Don't save reverted code
   - Only save new, working code

---

## How to Save a Checkpoint

### Step 1: Verify Everything Works

```bash
# Run tests
pnpm test
# Expected: All tests pass

# Check for errors
pnpm dev
# Expected: No errors in console
```

### Step 2: Update Documentation

- [ ] Update `todo.md` with [x] for completed items
- [ ] Update `BEST_PRACTICES.md` if needed
- [ ] Add comments to complex code

### Step 3: Save the Checkpoint

Use the Management UI or the `webdev_save_checkpoint` tool:

```
Brief: "Save checkpoint with bulk agent assignment feature"
Description: "Implemented bulk agent assignment with filters:
- Added bulkAssignAgent mutation
- Created BulkAgentAssignment component
- Implemented Lead Temperature, Desk, Status filters
- All 34 tests passing
- Feature tested and working in browser"
```

### Step 4: Verify Checkpoint Saved

- Check Management UI for new checkpoint
- Verify checkpoint has correct description
- Note the checkpoint version ID

---

## Checkpoint Naming Convention

### Good Checkpoint Messages

```
✅ "Implement bulk agent assignment with temperature filter"
✅ "Fix agent assignment not persisting to database"
✅ "Add multiple agents per lead support"
✅ "Implement agent workload dashboard"
✅ "Fix duplicate router keys causing conflicts"
```

### Bad Checkpoint Messages

```
❌ "update"
❌ "checkpoint"
❌ "fix"
❌ "changes"
❌ "work in progress"
```

### Checkpoint Message Format

```
[ACTION] [FEATURE/FIX] [DETAILS]

Examples:
- "Implement agent filtering with @ mentions"
- "Fix task saving not persisting to database"
- "Add bulk assignment with preview"
- "Refactor PropertyDetail component"
```

---

## Checkpoint Frequency

### Recommended Schedule

| Situation | Frequency |
|-----------|-----------|
| Small bug fix | After fix is tested |
| Feature implementation | After feature is complete |
| Major refactoring | Before and after |
| End of day | Always save before stopping |
| Before risky changes | Always save before |
| After successful deploy | Always save after |

### Example Timeline

```
Monday:
  10:00 AM - Start work, check latest checkpoint
  12:00 PM - Complete feature 1 → SAVE CHECKPOINT
  1:00 PM - Lunch
  2:00 PM - Start feature 2
  5:00 PM - Complete feature 2 → SAVE CHECKPOINT
  5:30 PM - End of day → SAVE CHECKPOINT (even if no new work)

Tuesday:
  10:00 AM - Start work from latest checkpoint
  ...
```

---

## Rollback Procedure

If something breaks, you can rollback to a previous checkpoint:

### Step 1: Identify the Problem

- What is broken?
- When did it break?
- Which checkpoint was the last good one?

### Step 2: Find the Checkpoint

In the Management UI:
1. Go to Dashboard
2. Look at checkpoint history
3. Find the last good checkpoint

### Step 3: Rollback

In the Management UI:
1. Click "Rollback" button on the checkpoint
2. Confirm the rollback
3. Wait for rollback to complete

Or use the tool:
```
webdev_rollback_checkpoint(version_id="abc123def456")
```

### Step 4: Verify Rollback

1. Check that the issue is fixed
2. Verify all tests pass
3. Test in browser
4. Continue working from this point

---

## Checkpoint Best Practices

### 1. Descriptive Messages

**Bad:**
```
"update"
```

**Good:**
```
"Implement bulk agent assignment with Lead Temperature, Desk, and Status filters"
```

**Why:** Descriptive messages help you find the right checkpoint when you need to rollback.

### 2. Atomic Checkpoints

Save checkpoints for complete features, not partial work.

**Bad:**
```
Checkpoint 1: "Add database table"
Checkpoint 2: "Add backend route"
Checkpoint 3: "Add frontend component"
```

**Good:**
```
Checkpoint 1: "Implement agent assignment feature with backend, frontend, and tests"
```

**Why:** Atomic checkpoints are easier to rollback and understand.

### 3. Test Before Saving

Never save a checkpoint with failing tests.

```bash
# Before saving
pnpm test

# Expected: All tests pass
# If any test fails, fix it first
```

### 4. Clean Console

Never save a checkpoint with console errors or warnings.

```bash
# Check browser console
# Expected: No errors, no warnings
# If errors exist, fix them first
```

### 5. Document Changes

Update `todo.md` before saving:

```markdown
## Feature X
- [x] Backend implementation
- [x] Frontend component
- [x] Tests
- [x] Browser testing
```

---

## Checkpoint Lifecycle

```
┌─────────────────────────────────────────────┐
│ 1. Start Development                        │
│    - Check latest checkpoint                │
│    - Understand current state               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 2. Implement Feature                        │
│    - Write code                             │
│    - Write tests                            │
│    - Test in browser                        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 3. Verify Quality                           │
│    - Run tests: pnpm test                   │
│    - Check console for errors               │
│    - Update documentation                   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 4. Save Checkpoint                          │
│    - Use Management UI or tool              │
│    - Write descriptive message              │
│    - Verify checkpoint saved                │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 5. Continue or Stop                         │
│    - If more work: Go to step 2             │
│    - If done: End session                   │
└─────────────────────────────────────────────┘
```

---

## Checkpoint Checklist

Before saving a checkpoint, verify:

- [ ] All tests pass: `pnpm test`
- [ ] No console errors in browser
- [ ] No console warnings in browser
- [ ] Feature works as expected
- [ ] No breaking changes to existing features
- [ ] `todo.md` is updated
- [ ] Checkpoint message is descriptive
- [ ] Code is clean (no debug console.log)
- [ ] No duplicate imports or routers
- [ ] Database migrations completed (if applicable)

---

## Checkpoint Naming Examples

### Feature Implementation

```
"Implement bulk agent assignment with filters"
"Add multiple agents per lead support"
"Create agent workload dashboard"
"Add lead auto-distribution rules"
```

### Bug Fixes

```
"Fix agent assignment not persisting to database"
"Fix duplicate router keys causing conflicts"
"Fix task creation form validation"
"Fix property filter not working"
```

### Refactoring

```
"Refactor PropertyDetail component for clarity"
"Consolidate duplicate agent routers"
"Optimize database queries for performance"
"Clean up unused imports"
```

### Documentation

```
"Add Best Practices guide"
"Update Feature Testing Guide"
"Add Checkpoint Guidelines"
```

---

## Troubleshooting

### Problem: Can't Find a Good Checkpoint

**Solution:**
1. Go to Management UI Dashboard
2. Look at checkpoint history
3. Find one with a descriptive message
4. Check the timestamp
5. Rollback to that checkpoint

### Problem: Rollback Didn't Fix the Issue

**Solution:**
1. Try rolling back further
2. Check if the issue was introduced before that checkpoint
3. Look at the checkpoint messages to understand what changed
4. Contact support if needed

### Problem: Checkpoint Didn't Save

**Solution:**
1. Check if tests are passing
2. Check if there are console errors
3. Try saving again
4. Check Management UI to verify it saved

---

## Summary

**Key Points:**

1. **Save frequently** - After each completed feature
2. **Descriptive messages** - So you can find checkpoints later
3. **Test before saving** - Never save broken code
4. **Clean console** - No errors or warnings
5. **Update docs** - Keep `todo.md` current
6. **Rollback when needed** - Don't be afraid to go back

**Remember:**
- Checkpoints are your safety net
- Use them liberally
- They make it easy to experiment
- They make it easy to fix mistakes

---

**Last Updated:** January 2026
