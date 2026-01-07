import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Saved searches for filter combinations
export const savedSearches = mysqlTable("savedSearches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  filters: text("filters").notNull(), // JSON string of filter configuration
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = typeof savedSearches.$inferInsert;

/**
 * Agents table - stores birddog/agent information for property assignments
 * Enhanced with agentType to distinguish internal vs external agents
 */
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  role: mysqlEnum("role", ["Birddog", "Acquisition Manager", "Disposition Manager", "Admin", "Manager", "Corretor", "Other"]).default("Birddog"),
  agentType: mysqlEnum("agentType", ["Internal", "External", "Birddog", "Corretor"]).default("Internal"),
  status: mysqlEnum("status", ["Active", "Inactive", "Suspended"]).default("Active"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;


/**
 * Agent Permissions table - granular feature access control
 * Allows admins to grant/revoke specific features per agent
 */
export const agentPermissions = mysqlTable("agentPermissions", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  feature: mysqlEnum("feature", [
    "VIEW_LEADS",
    "MAKE_CALLS",
    "SEND_EMAILS",
    "VIEW_DEEP_SEARCH",
    "EDIT_CONTACTS",
    "CREATE_TASKS",
    "TRANSFER_LEADS",
    "VIEW_AGENT_PERFORMANCE",
    "MANAGE_AGENTS",
    "VIEW_ALL_LEADS",
    "EDIT_LEAD_STATUS",
    "ADD_NOTES",
  ]).notNull(),
  granted: int("granted").default(1).notNull(), // 1=granted, 0=denied
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentPermission = typeof agentPermissions.$inferSelect;
export type InsertAgentPermission = typeof agentPermissions.$inferInsert;

/**
 * Lead Assignments table - tracks which leads are assigned to which agents
 * Supports exclusive assignments for external agents
 */
export const leadAssignments = mysqlTable("leadAssignments", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  agentId: int("agentId").notNull(),
  assignmentType: mysqlEnum("assignmentType", ["Exclusive", "Shared", "Temporary"]).default("Shared"),
  assignedBy: int("assignedBy"), // User ID of who assigned it
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // For temporary assignments
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeadAssignment = typeof leadAssignments.$inferSelect;
export type InsertLeadAssignment = typeof leadAssignments.$inferInsert;

/**
 * Lead Transfer History table - audit trail for lead transfers
 */
export const leadTransferHistory = mysqlTable("leadTransferHistory", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  fromAgentId: int("fromAgentId"),
  toAgentId: int("toAgentId").notNull(),
  transferredBy: int("transferredBy").notNull(), // User ID who made the transfer
  reason: text("reason"), // Why the transfer happened
  status: mysqlEnum("status", ["Pending", "Accepted", "Rejected", "Completed"]).default("Completed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadTransferHistory = typeof leadTransferHistory.$inferSelect;
export type InsertLeadTransferHistory = typeof leadTransferHistory.$inferInsert;

/**
 * Properties table stores real estate property information
 */
export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  // Address information
  addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  zipcode: varchar("zipcode", { length: 10 }).notNull(),
  
  // Property details
  subdivisionName: varchar("subdivisionName", { length: 255 }),
  status: text("status"), // Original status from data
  trackingStatus: mysqlEnum("trackingStatus", [
    "Not Visited",
    "Off Market",
    "Cash Buyer",
    "Free And Clear",
    "High Equity",
    "Senior Owner",
    "Tired Landlord",
    "Absentee Owner",
    "Corporate Owner",
    "Empty Nester",
    "Interested",
    "Not Interested",
    "Follow Up",
  ]).default("Not Visited"),
  leadTemperature: mysqlEnum("leadTemperature", ["SUPER HOT", "HOT", "WARM", "COLD", "TBD", "DEAD"]).default("COLD"),
  ownerVerified: int("ownerVerified").default(0).notNull(),
  assignedAgentId: int("assignedAgentId"), // User ID of assigned birddog agent
  marketStatus: varchar("marketStatus", { length: 100 }),
  ownerLocation: varchar("ownerLocation", { length: 100 }),
  
  // Financial information
  estimatedValue: int("estimatedValue"),
  equityAmount: int("equityAmount"),
  equityPercent: int("equityPercent"), // Store as percentage * 100 (e.g., 75% = 75)
  salePrice: int("salePrice"),
  saleDate: timestamp("saleDate"),
  mortgageAmount: int("mortgageAmount"),
  
  // Owner information
  owner1Name: varchar("owner1Name", { length: 255 }),
  owner2Name: varchar("owner2Name", { length: 255 }),
  
  // Property specifications
  buildingSquareFeet: int("buildingSquareFeet"),
  totalBedrooms: int("totalBedrooms"),
  totalBaths: int("totalBaths"),
  yearBuilt: int("yearBuilt"),
  propertyType: varchar("propertyType", { length: 100 }),
  constructionType: varchar("constructionType", { length: 100 }),
  
  // Additional details
  apnParcelId: varchar("apnParcelId", { length: 100 }),
  taxDelinquent: varchar("taxDelinquent", { length: 10 }),
  taxDelinquentYear: int("taxDelinquentYear"),
  taxYear: int("taxYear"),
  taxAmount: int("taxAmount"),
  
  // Desk management
  deskName: varchar("deskName", { length: 100 }), // Desk assignment (e.g., "Sales", "Follow-up")
  deskStatus: mysqlEnum("deskStatus", ["BIN", "ACTIVE", "ARCHIVED"]).default("BIN"), // BIN=new leads, ACTIVE=in progress, ARCHIVED=completed
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

/**
 * Contacts table - stores contact information for property owners
 * Enhanced for communication tracking system
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  
  // Contact details
  name: varchar("name", { length: 255 }),
  relationship: varchar("relationship", { length: 100 }), // Owner, Son, Daughter, Spouse, Heir, Attorney, etc.
  age: int("age"),
  deceased: int("deceased").default(0).notNull(), // 0=NO, 1=YES
  currentAddress: text("currentAddress"), // May be different from property address
  flags: text("flags"), // e.g., "Likely Owner, Family, Resident"
  
  // Decision making & flags
  isDecisionMaker: int("isDecisionMaker").default(0).notNull(), // 0=NO, 1=YES - who can sell the property
  dnc: int("dnc").default(0).notNull(), // 0=NO, 1=YES - Do Not Call flag
  isLitigator: int("isLitigator").default(0).notNull(), // 0=NO, 1=YES - Litigator flag
  hidden: int("hidden").default(0).notNull(), // 0=NO, 1=YES - Hide contact from main view
  
  // Phone numbers (keeping for backward compatibility)
  phone1: varchar("phone1", { length: 20 }),
  phone1Type: varchar("phone1Type", { length: 50 }),
  phone2: varchar("phone2", { length: 20 }),
  phone2Type: varchar("phone2Type", { length: 50 }),
  phone3: varchar("phone3", { length: 20 }),
  phone3Type: varchar("phone3Type", { length: 50 }),
  
  // Email addresses (keeping for backward compatibility)
  email1: varchar("email1", { length: 255 }),
  email2: varchar("email2", { length: 255 }),
  email3: varchar("email3", { length: 255 }),
  
  // Contact tracking & status
  currentResident: int("currentResident").default(0).notNull(), // 0=NO, 1=YES
  contacted: int("contacted").default(0).notNull(), // 0=NO, 1=YES
  contactedDate: timestamp("contactedDate"),
  onBoard: int("onBoard").default(0).notNull(), // 0=NO, 1=YES
  notOnBoard: int("notOnBoard").default(0).notNull(), // 0=NO, 1=YES
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * Contact Phones table - stores multiple phone numbers per contact
 */
export const contactPhones = mysqlTable("contactPhones", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  phoneType: mysqlEnum("phoneType", ["Mobile", "Landline", "Wireless", "Work", "Home", "Other"]).default("Mobile"),
  isPrimary: int("isPrimary").default(0).notNull(), // 0=NO, 1=YES
  dnc: int("dnc").default(0).notNull(), // 0=NO, 1=YES - Do Not Call for this specific number
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactPhone = typeof contactPhones.$inferSelect;
export type InsertContactPhone = typeof contactPhones.$inferInsert;

/**
 * Contact Emails table - stores multiple email addresses per contact
 */
export const contactEmails = mysqlTable("contactEmails", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  isPrimary: int("isPrimary").default(0).notNull(), // 0=NO, 1=YES
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactEmail = typeof contactEmails.$inferSelect;
export type InsertContactEmail = typeof contactEmails.$inferInsert;

/**
 * Contact Social Media table - stores social media profiles per contact
 */
export const contactSocialMedia = mysqlTable("contactSocialMedia", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  platform: mysqlEnum("platform", ["Facebook", "Instagram", "LinkedIn", "Twitter", "Other"]).notNull(),
  profileUrl: text("profileUrl"),
  contacted: int("contacted").default(0).notNull(), // 0=NO, 1=YES
  contactedDate: timestamp("contactedDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactSocialMedia = typeof contactSocialMedia.$inferSelect;
export type InsertContactSocialMedia = typeof contactSocialMedia.$inferInsert;

/**
 * Communication Log table - tracks ALL communication attempts
 */
export const communicationLog = mysqlTable("communicationLog", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  contactId: int("contactId"), // NULL if general property communication
  
  // Communication details
  communicationType: mysqlEnum("communicationType", [
    "Phone",
    "Email",
    "SMS",
    "Facebook",
    "Instagram",
    "DoorKnock",
    "Letter",
    "Other"
  ]).notNull(),
  
  // Call-specific fields
  callResult: mysqlEnum("callResult", [
    "Interested - HOT LEAD",
    "Interested - WARM LEAD - Wants too Much / Full Price",
    "Interested - WARM LEAD - Not Hated",
    "Left Message - Owner Verified",
    "Left Message",
    "Beep Beep",
    "Busy",
    "Call Back",
    "Disconnected",
    "Duplicated number",
    "Fax",
    "Follow-up",
    "Hang up",
    "Has calling restrictions",
    "Investor/Buyer/Realtor Owned",
    "Irate - DNC",
    "Mail box full",
    "Mail box not set-up",
    "Not Answer",
    "Not Available",
    "Not Ringing",
    "Not Service",
    "Number repeated",
    "Player",
    "Portuguese",
    "Property does not fit our criteria",
    "Restrict",
    "See Notes",
    "Sold - DEAD",
    "Spanish",
    "Voicemail",
    "Wrong Number",
    "Wrong Person",
    "Other"
  ]),
  
  direction: mysqlEnum("direction", ["Outbound", "Inbound"]).default("Outbound"),
  
  // Content
  notes: text("notes"),
  nextStep: text("nextStep"),
  
  // Attribution
  userId: int("userId").notNull(), // Who made the contact attempt
  
  // Metadata
  communicationDate: timestamp("communicationDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CommunicationLog = typeof communicationLog.$inferSelect;
export type InsertCommunicationLog = typeof communicationLog.$inferInsert;

/**
 * Notes table - stores visit notes and interactions for properties
 */
export const notes = mysqlTable("notes", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  userId: int("userId").notNull(),
  
  // Note content
  content: text("content").notNull(),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

/**
 * Visits table - tracks field agent check-ins at properties
 */
export const visits = mysqlTable("visits", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  userId: int("userId").notNull(),
  
  // Location data
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  
  // Visit details
  checkInTime: timestamp("checkInTime").defaultNow().notNull(),
  notes: text("notes"),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Visit = typeof visits.$inferSelect;
export type InsertVisit = typeof visits.$inferInsert;

/**
 * Photos table - stores property photos taken during visits
 */
export const photos = mysqlTable("photos", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  visitId: int("visitId"),
  noteId: int("noteId"),
  userId: int("userId").notNull(),
  
  // S3 storage
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  
  // Photo metadata
  caption: text("caption"),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;

export const propertyTags = mysqlTable("propertyTags", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  tag: varchar("tag", { length: 100 }).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PropertyTag = typeof propertyTags.$inferSelect;
export type InsertPropertyTag = typeof propertyTags.$inferInsert;

/**
 * PropertyAgents junction table - allows multiple agents per property
 */
export const propertyAgents = mysqlTable("propertyAgents", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  agentId: int("agentId").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  assignedBy: int("assignedBy"), // Admin who made the assignment
});

export type PropertyAgent = typeof propertyAgents.$inferSelect;
export type InsertPropertyAgent = typeof propertyAgents.$inferInsert;

/**
 * LeadTransfers table - tracks when agents transfer leads to other agents
 */
export const leadTransfers = mysqlTable("leadTransfers", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  fromAgentId: int("fromAgentId").notNull(), // Agent who is transferring
  toAgentId: int("toAgentId").notNull(), // Agent receiving the lead
  reason: text("reason"), // Optional reason for transfer
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  respondedAt: timestamp("respondedAt"), // When the receiving agent responded
});

export type LeadTransfer = typeof leadTransfers.$inferSelect;
export type InsertLeadTransfer = typeof leadTransfers.$inferInsert;

/**
 * PropertyDeepSearch table - stores detailed research and tracking information
 */
export const propertyDeepSearch = mysqlTable("propertyDeepSearch", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull().unique(),
  
  // MLS & Occupancy
  mlsStatus: mysqlEnum("mlsStatus", ["Listed", "Not Listed", "Fail", "Expired", "Sold", "Off Market"]),
  occupancy: mysqlEnum("occupancy", [
    "Owner-Occupied", 
    "Abandoned", 
    "Partially Occupied", 
    "Relatives", 
    "Second Home", 
    "Squatters", 
    "Vacant", 
    "Tenant-Occupied"
  ]),
  annualRent: int("annualRent"),
  monthlyRent: int("monthlyRent"),
  leaseType: mysqlEnum("leaseType", ["Annual", "Month to Month"]),
  overviewNotes: text("overviewNotes"),
  
  // Property Issues (stored as JSON array of selected issues)
  issues: text("issues"), // JSON: ["Probate", "Behind mortgage", etc.]
  
  // Property Condition (stored as JSON object with rating and tags)
  propertyCondition: text("propertyCondition"), // JSON: {rating, tags}
  
  // Property Type (stored as JSON object with type and tags)
  propertyType: text("propertyType"), // JSON: {type, tags}
  
  // Probate Finds (stored as JSON array)
  probateFinds: text("probateFinds"),
  probateNotes: text("probateNotes"),
  
  // Family Tree (stored as JSON array of family members)
  familyTree: text("familyTree"),
  familyTreeNotes: text("familyTreeNotes"),
  
  // Property Value Estimates
  zillowEstimate: int("zillowEstimate"),
  dealMachineEstimate: int("dealMachineEstimate"),
  ourEstimate: int("ourEstimate"),
  estimateNotes: text("estimateNotes"),
  
  // Records Check (stored as JSON array)
  recordsChecked: text("recordsChecked"), // JSON: ["County", "Property Taxes", etc.]
  recordsCheckedNotes: text("recordsCheckedNotes"),
  
  // Record Details (stored as JSON array)
  recordDetails: text("recordDetails"), // JSON: ["Company Owned", "Multiple Heirs", etc.]
  recordDetailsFindings: text("recordDetailsFindings"),
  
  // Deed Type (stored as JSON array for multiple entries)
  // JSON: [{"type": "General Warranty Deed", "deedDate": "2023-05-15", "amount": 450000, "notes": "Original purchase"}, ...]
  deedType: text("deedType"),
  
  // Delinquent Taxes by year
  delinquentTax2025: int("delinquentTax2025"),
  delinquentTax2024: int("delinquentTax2024"),
  delinquentTax2023: int("delinquentTax2023"),
  delinquentTax2022: int("delinquentTax2022"),
  delinquentTax2021: int("delinquentTax2021"),
  delinquentTax2020: int("delinquentTax2020"),
  delinquentTaxTotal: int("delinquentTaxTotal"),
  
  // Mortgage
  hasMortgage: int("hasMortgage").default(0), // 0=NO, 1=YES
  mortgageAmount: int("mortgageAmount"),
  equityPercent: int("equityPercent"),
  mortgageNotes: text("mortgageNotes"),
  
  // Repairs
  needsRepairs: int("needsRepairs").default(0), // 0=NO, 1=YES
  repairTypes: text("repairTypes"),
  estimatedRepairCost: int("estimatedRepairCost"),
  repairNotes: text("repairNotes"),
  
  // Code Violations
  hasCodeViolation: int("hasCodeViolation").default(0), // 0=NO, 1=YES
  codeViolationNotes: text("codeViolationNotes"),
  
  // Liens
  hasLiens: int("hasLiens").default(0), // 0=NO, 1=YES
  liensNotes: text("liensNotes"),
  
  // Skiptracing & Outreach (stored as JSON object with dates)
  skiptracingDone: text("skiptracingDone"), // JSON: {"RESimpli": "2024-01-15", "Deal_Machine": null, etc.}
  skiptracingNotes: text("skiptracingNotes"),
  outreachDone: text("outreachDone"), // JSON: {"Email": "2024-01-15", "Post Card": null, etc.}
  
  // Task Tracking (stored as JSON array of tasks with dates and agents)
  tasks: text("tasks"), // JSON: [{"task": "Analyze", "date": "2024-01-15", "agent": "John"}, ...]
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PropertyDeepSearch = typeof propertyDeepSearch.$inferSelect;
export type InsertPropertyDeepSearch = typeof propertyDeepSearch.$inferInsert;

/**
 * Tasks table - comprehensive task management system for lead workflow
 * Inspired by Mojo Dialer's action-oriented interface
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  
  // Task details
  title: varchar("title", { length: 255 }),
  description: text("description"),
  
  // Task type
  taskType: mysqlEnum("taskType", [
    "Call",
    "Email",
    "Visit",
    "Research",
    "Follow-up",
    "Offer",
    "Negotiation",
    "Contract",
    "Inspection",
    "Closing",
    "Other"
  ]).notNull(),
  
  // Priority
  priority: mysqlEnum("priority", ["High", "Medium", "Low"]).default("Medium").notNull(),
  
  // Status (for Kanban board)
  status: mysqlEnum("status", ["To Do", "In Progress", "Done"]).default("To Do").notNull(),
  
  // Visibility
  hidden: int("hidden").default(0).notNull(), // 0=NO, 1=YES - Hide task from main view
  
  // Assignment
  assignedToId: int("assignedToId"), // User ID of assigned agent
  createdById: int("createdById").notNull(), // User ID of creator
  
  // Property association
  propertyId: int("propertyId"), // NULL if general task not tied to specific property
  
  // Dates
  dueDate: timestamp("dueDate"),
  dueTime: varchar("dueTime", { length: 5 }), // HH:MM format
  completedDate: timestamp("completedDate"),
  
  // Repeat settings
  repeatTask: mysqlEnum("repeatTask", ["Daily", "Weekly", "Monthly", "No repeat"]).default("No repeat"),
  
  // Checklist (stored as JSON array of subtasks)
  checklist: text("checklist"), // JSON: [{"id": 1, "text": "Call owner", "completed": false}, ...]
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Task Comments table - activity timeline for tasks
 */
export const taskComments = mysqlTable("taskComments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskComment = typeof taskComments.$inferSelect;
export type InsertTaskComment = typeof taskComments.$inferInsert;

// Note templates for quick-insert in Log Call dialog
export const noteTemplates = mysqlTable("noteTemplates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // User who created this template
  templateText: varchar("templateText", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NoteTemplate = typeof noteTemplates.$inferSelect;
export type InsertNoteTemplate = typeof noteTemplates.$inferInsert;

/**
 * Skiptracing Logs table - structured tracking of skiptracing activities
 */
export const skiptracingLogs = mysqlTable("skiptracingLogs", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  
  // Skiptracing details
  method: varchar("method", { length: 100 }).notNull(), // e.g., "BeenVerified", "RESimpli", "Deal_Machine"
  source: varchar("source", { length: 255 }), // Additional source information
  agentId: int("agentId").notNull(), // User ID of agent who performed skiptracing
  agentName: varchar("agentName", { length: 255 }).notNull(), // Denormalized for display
  notes: text("notes"),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SkiptracingLog = typeof skiptracingLogs.$inferSelect;
export type InsertSkiptracingLog = typeof skiptracingLogs.$inferInsert;

/**
 * Outreach Logs table - structured tracking of outreach activities
 */
export const outreachLogs = mysqlTable("outreachLogs", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  
  // Outreach details
  method: mysqlEnum("method", ["Email", "Post Card", "Door Knock", "Text Message", "Letter", "Social Media", "Other"]).notNull(),
  agentId: int("agentId").notNull(), // User ID of agent who performed outreach
  agentName: varchar("agentName", { length: 255 }).notNull(), // Denormalized for display
  notes: text("notes"),
  
  // Response tracking
  responseReceived: int("responseReceived").default(0).notNull(), // 0=NO, 1=YES
  responseDate: timestamp("responseDate"),
  responseNotes: text("responseNotes"),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OutreachLog = typeof outreachLogs.$inferSelect;
export type InsertOutreachLog = typeof outreachLogs.$inferInsert;
