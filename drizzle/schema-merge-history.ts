import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";

/**
 * Lead Merge History table - tracks all merge operations
 * Records which leads were merged, by whom, and when
 */
export const leadMergeHistory = mysqlTable("leadMergeHistory", {
  id: int("id").autoincrement().primaryKey(),
  primaryLeadId: int("primaryLeadId").notNull(), // The lead that was kept
  secondaryLeadId: int("secondaryLeadId").notNull(), // The lead that was merged and deleted
  primaryLeadAddress: text("primaryLeadAddress"), // Snapshot of primary lead address
  secondaryLeadAddress: text("secondaryLeadAddress"), // Snapshot of secondary lead address
  mergedBy: int("mergedBy").notNull(), // User ID who performed the merge
  mergedAt: timestamp("mergedAt").defaultNow().notNull(),
  reason: text("reason"), // Optional reason for merge
  itemsMerged: text("itemsMerged"), // JSON: {contacts: 5, notes: 3, tasks: 2, photos: 1, visits: 0}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadMergeHistory = typeof leadMergeHistory.$inferSelect;
export type InsertLeadMergeHistory = typeof leadMergeHistory.$inferInsert;
