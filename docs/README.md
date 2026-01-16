# CRM 123Drive Documentation

This directory contains technical documentation, bug reports, and best practices for the CRM 123Drive project.

---

## 📚 Documentation Index

### Bug Reports

- **[Drizzle ORM Query API Undefined](./BUG-REPORT-Drizzle-Query-API-Undefined.md)**  
  Critical bug where Pipeline move functionality failed due to missing schema configuration in Drizzle ORM. Includes complete debugging timeline, root cause analysis, and prevention strategies.

### Best Practices

- **[Drizzle ORM Best Practices](./drizzle-orm-best-practices.md)**  
  Comprehensive guide for proper Drizzle ORM initialization, query patterns, and common pitfalls. Essential reading for all developers working with the database layer.

---

## 🎯 Quick Links

### For New Developers

1. Start with [Drizzle ORM Best Practices](./drizzle-orm-best-practices.md)
2. Review the onboarding checklist in the best practices guide
3. Complete the onboarding exercise before making database changes

### For Debugging

1. Check [Bug Reports](#bug-reports) for similar issues
2. Follow the debugging tips in the best practices guide
3. Document new bugs using the bug report template

---

## 📝 Document Templates

### Bug Report Template

```markdown
# BUG REPORT: [Title]

**Date**: [Date]
**Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
**Status**: [OPEN/IN PROGRESS/RESOLVED]

## Symptoms
[What the user experienced]

## Root Cause
[Technical explanation]

## Solution
[Code changes and deployment steps]

## Prevention
[How to avoid this in the future]
```

---

## 🔄 Maintenance

- **Update frequency**: After resolving critical bugs or discovering new patterns
- **Review cycle**: Monthly review of all documentation for accuracy
- **Ownership**: Development team collectively maintains these docs

---

**Last Updated**: January 15, 2026  
**Maintained by**: Development Team
