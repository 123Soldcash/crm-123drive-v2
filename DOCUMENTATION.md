# CRM 123Drive V2 - Documentation Index

Welcome! This folder contains comprehensive documentation to help you develop, test, and maintain the CRM 123Drive V2 project.

---

## 📚 Documentation Files

### 1. **BEST_PRACTICES.md** - Development Standards
**What it covers:**
- Development workflow (before, during, after)
- Code organization rules
- Testing requirements
- Database best practices
- Frontend development guidelines
- Common pitfalls to avoid
- Debugging checklist
- Pre-deployment checklist

**When to read:**
- Before starting development
- When writing new code
- When debugging issues
- Before saving checkpoints

**Key sections:**
- No duplicate code rule
- Import organization
- Router structure
- Test coverage requirements
- Error handling patterns

---

### 2. **FEATURE_TESTING_GUIDE.md** - Testing Standards
**What it covers:**
- Quick start testing checklist
- Feature testing template
- Common testing scenarios (CRUD operations)
- Test automation setup
- Performance testing
- Browser compatibility testing
- Accessibility testing
- Security testing
- Sign-off checklist

**When to read:**
- Before implementing a feature
- When writing tests
- Before marking feature as complete
- When debugging test failures

**Key sections:**
- Testing scenarios (Create, Read, Update, Delete)
- Error handling tests
- Performance benchmarks
- Regression testing checklist

---

### 3. **CHECKPOINT_GUIDELINES.md** - Version Control
**What it covers:**
- What is a checkpoint
- When to save checkpoints
- How to save checkpoints
- Checkpoint naming conventions
- Checkpoint frequency recommendations
- Rollback procedures
- Checkpoint best practices
- Checkpoint lifecycle
- Troubleshooting checkpoints

**When to read:**
- Before saving work
- Before rolling back changes
- When planning development sessions
- When something breaks

**Key sections:**
- Checkpoint checklist
- When to save vs. when not to save
- Naming conventions
- Rollback procedure

---

### 4. **DEVELOPMENT_WORKFLOW.md** (This file)
**Quick reference for the complete workflow**

---

## 🚀 Quick Start Workflow

### Day 1: Starting a New Feature

1. **Read the docs** (5 min)
   - Read relevant sections of BEST_PRACTICES.md
   - Read FEATURE_TESTING_GUIDE.md

2. **Check current state** (5 min)
   ```bash
   pnpm test          # Verify all tests pass
   pnpm dev           # Verify dev server works
   ```

3. **Update todo.md** (5 min)
   - Add [ ] items for new feature tasks

4. **Implement feature** (varies)
   - Follow BEST_PRACTICES.md guidelines
   - Write tests as you go
   - Test in browser frequently

5. **Verify quality** (10 min)
   ```bash
   pnpm test          # All tests must pass
   node scripts/validate-before-commit.mjs  # Check for issues
   ```

6. **Save checkpoint** (5 min)
   - Update todo.md with [x] for completed items
   - Save checkpoint with descriptive message
   - Verify checkpoint saved in Management UI

---

## 📋 Common Tasks

### Adding a New Feature

1. **Plan the feature**
   - Read BEST_PRACTICES.md sections 1-3
   - Add tasks to todo.md

2. **Implement backend**
   - Update schema in drizzle/schema.ts
   - Run `pnpm db:push`
   - Add helpers in server/db.ts
   - Add procedures in server/routers.ts
   - Write tests in server/*.test.ts

3. **Implement frontend**
   - Create component in client/src/pages/ or client/src/components/
   - Use tRPC hooks to call backend
   - Add error/loading states
   - Test in browser

4. **Test thoroughly**
   - Follow FEATURE_TESTING_GUIDE.md
   - Run `pnpm test`
   - Test in browser
   - Check console for errors

5. **Save checkpoint**
   - Follow CHECKPOINT_GUIDELINES.md
   - Update todo.md
   - Save with descriptive message

### Fixing a Bug

1. **Identify the bug**
   - Reproduce the issue
   - Check console for errors
   - Check server logs

2. **Find the root cause**
   - Follow BEST_PRACTICES.md debugging checklist
   - Check frontend code
   - Check backend code
   - Check database

3. **Fix the bug**
   - Make minimal changes
   - Write test to prevent regression
   - Verify fix works

4. **Verify fix**
   - Run `pnpm test`
   - Test in browser
   - Check console
   - Verify no new issues

5. **Save checkpoint**
   - Update todo.md
   - Save with message like "Fix [bug description]"

### Refactoring Code

1. **Plan refactoring**
   - Identify what needs to be refactored
   - Plan the changes
   - Save checkpoint before starting

2. **Refactor**
   - Make changes
   - Run tests frequently
   - Keep tests passing

3. **Verify**
   - Run `pnpm test`
   - Test in browser
   - Check for performance improvements

4. **Save checkpoint**
   - Save with message like "Refactor [component/feature]"

---

## 🔍 Debugging Guide

### When Tests Fail

1. Read the error message carefully
2. Run the specific test: `pnpm test server/agents.test.ts`
3. Add console.log to debug
4. Check the implementation
5. Fix the bug
6. Re-run tests

### When Feature Doesn't Work in Browser

1. Check browser console for errors
2. Check Network tab for failed requests
3. Check server logs
4. Verify database has data
5. Clear browser cache
6. Restart dev server

### When Data Doesn't Persist

1. Check database schema
2. Verify migration completed
3. Check database for data
4. Check for errors in mutation
5. Verify cache invalidation
6. Check for race conditions

---

## ✅ Pre-Deployment Checklist

Before considering work complete:

- [ ] All tests pass: `pnpm test`
- [ ] No console errors in browser
- [ ] No console warnings in browser
- [ ] Feature tested in browser
- [ ] No breaking changes to existing features
- [ ] todo.md updated with [x] for completed items
- [ ] Checkpoint saved with descriptive message
- [ ] Checkpoint verified in Management UI

---

## 📞 Getting Help

### If Something Breaks

1. **Check the docs**
   - Read relevant sections of BEST_PRACTICES.md
   - Check CHECKPOINT_GUIDELINES.md for rollback

2. **Rollback if needed**
   - Find last good checkpoint
   - Click "Rollback" in Management UI
   - Verify issue is fixed

3. **Debug systematically**
   - Follow debugging checklist in BEST_PRACTICES.md
   - Check console errors
   - Check server logs
   - Check database

---

## 📖 Documentation Structure

```
📁 CRM 123Drive V2
├── 📄 BEST_PRACTICES.md
│   └── Development standards and guidelines
├── 📄 FEATURE_TESTING_GUIDE.md
│   └── Testing procedures and templates
├── 📄 CHECKPOINT_GUIDELINES.md
│   └── Version control and checkpoint management
├── 📄 DOCUMENTATION.md
│   └── This file - Documentation index
├── 📁 scripts/
│   └── validate-before-commit.mjs
│       └── Automated validation script
└── 📄 todo.md
    └── Project task tracking
```

---

## 🎯 Key Principles

1. **Test First** - Write tests before or during implementation
2. **Test Often** - Run tests frequently during development
3. **Save Checkpoints** - Save after each completed feature
4. **Keep Docs Updated** - Update todo.md as you work
5. **Clean Code** - No debug code, no console.log
6. **Error Handling** - Always handle errors gracefully
7. **Verify Quality** - Use validation script before committing

---

## 📅 Recommended Reading Schedule

### First Time Setup
- [ ] Read BEST_PRACTICES.md (20 min)
- [ ] Read FEATURE_TESTING_GUIDE.md (15 min)
- [ ] Read CHECKPOINT_GUIDELINES.md (10 min)
- [ ] Skim DOCUMENTATION.md (5 min)

### Before Each Development Session
- [ ] Skim relevant sections of BEST_PRACTICES.md (5 min)
- [ ] Check todo.md for current status (2 min)
- [ ] Run `pnpm test` to verify current state (2 min)

### Before Saving a Checkpoint
- [ ] Review CHECKPOINT_GUIDELINES.md checklist (5 min)
- [ ] Verify all tests pass (2 min)
- [ ] Update todo.md (5 min)
- [ ] Write descriptive checkpoint message (2 min)

---

## 🚨 Critical Rules

**NEVER:**
- ❌ Save checkpoint with failing tests
- ❌ Commit code with console errors
- ❌ Leave duplicate imports or routers
- ❌ Skip error handling
- ❌ Forget to update todo.md

**ALWAYS:**
- ✅ Run tests before saving checkpoint
- ✅ Test in browser after changes
- ✅ Check console for errors
- ✅ Update documentation
- ✅ Write descriptive messages

---

## 📞 Quick Reference

| Task | Command | Time |
|------|---------|------|
| Run tests | `pnpm test` | 30s-2m |
| Start dev server | `pnpm dev` | 5s |
| Validate code | `node scripts/validate-before-commit.mjs` | 10s |
| Apply migrations | `pnpm db:push` | 5s |
| Check status | `pnpm test && pnpm dev` | 2m |

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial documentation |

---

**Last Updated:** January 2026

**Questions?** Check the relevant documentation file or use the debugging checklist in BEST_PRACTICES.md.
