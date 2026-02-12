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
  leadId: int("leadId"), // LEAD ID (e.g., 270001, 270002) - managed by application
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
  leadTemperature: mysqlEnum("leadTemperature", ["SUPER HOT", "HOT", "DEEP SEARCH", "WARM", "COLD", "TBD", "DEAD"]).default("TBD"),
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
  totalLoanBalance: int("totalLoanBalance"),
  totalLoanPayment: int("totalLoanPayment"),
  estimatedRepairCost: int("estimatedRepairCost"),
  taxYear: int("taxYear"),
  taxAmount: int("taxAmount"),
  
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
  
  // DealMachine integration
  propertyId: varchar("propertyId", { length: 100 }), // Property ID from DealMachine (NOT unique - can be duplicated from different sources)
  dealMachinePropertyId: varchar("dealMachinePropertyId", { length: 100 }),
  dealMachineLeadId: varchar("dealMachineLeadId", { length: 100 }),
  dealMachineRawData: text("dealMachineRawData"), // JSON string with all extra DealMachine data
  
  // Lead source tracking
  source: mysqlEnum("source", ["DealMachine", "Manual", "Import", "API", "CSV", "Other"]).default("Manual"),
  listName: varchar("listName", { length: 255 }), // Name of the list/campaign
  entryDate: timestamp("entryDate").defaultNow().notNull(), // When the lead entered the system
  
  // Desk management
  deskName: varchar("deskName", { length: 100 }), // Desk assignment (e.g., "Sales", "Follow-up")
  deskStatus: mysqlEnum("deskStatus", ["BIN", "ACTIVE", "ARCHIVED"]).default("BIN"), // BIN=new leads, ACTIVE=in progress, ARCHIVED=completed
  
  // Wholesale Deal Pipeline
  dealStage: mysqlEnum("dealStage", [
    "NEW_LEAD",
    "LEAD_IMPORTED",
    "SKIP_TRACED",
    "FIRST_CONTACT_MADE",
    "ANALYZING_DEAL",
    "OFFER_PENDING",
    "FOLLOW_UP_ON_CONTRACT",
    "UNDER_CONTRACT_A",
    "MARKETING_TO_BUYERS",
    "BUYER_INTERESTED",
    "CONTRACT_B_SIGNED",
    "ASSIGNMENT_FEE_AGREED",
    "ESCROW_DEPOSIT_A",
    "ESCROW_DEPOSIT_B",
    "INSPECTION_PERIOD",
    "TITLE_COMPANY",
    "MUNICIPAL_LIENS",
    "TITLE_SEARCH",
    "TITLE_INSURANCE",
    "CLOSING",
  "CLOSED_WON",
    "DEAD_LOST"
  ]).default("NEW_LEAD"),
  stageChangedAt: timestamp("stageChangedAt").defaultNow().notNull(),

  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

	/**
	 * Deal Calculations table - stores financial calculations for each property
	 * References properties.apn (Assessor Parcel Number) as unique identifier
	 */
export const dealCalculations = mysqlTable("dealCalculations", {
  id: int("id").autoincrement().primaryKey(),
  apn: varchar("apn", { length: 50 }).notNull().unique(), // Foreign key to properties.apn
	  
	  arv: decimal("arv", { precision: 10, scale: 2 }), // After Repair Value
	  repairCost: decimal("repairCost", { precision: 10, scale: 2 }),
	  closingCost: decimal("closingCost", { precision: 10, scale: 2 }),
	  assignmentFee: decimal("assignmentFee", { precision: 10, scale: 2 }),
	  desiredProfit: decimal("desiredProfit", { precision: 10, scale: 2 }),
	  
	  // Calculated Values
	  maxOffer: decimal("maxOffer", { precision: 10, scale: 2 }), // Maximum Allowable Offer (MAO)
	  maoFormula: text("maoFormula"), // Stores the formula used for transparency
	  
	  // Metadata
	  createdAt: timestamp("createdAt").defaultNow().notNull(),
	  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
	});
	
	export type DealCalculation = typeof dealCalculations.$inferSelect;
	export type InsertDealCalculation = typeof dealCalculations.$inferInsert;
	
	/**
	 * Buyers table - stores cash buyer information
	 */
	export const buyers = mysqlTable("buyers", {
	  id: int("id").autoincrement().primaryKey(),
	  name: varchar("name", { length: 255 }).notNull(),
	  email: varchar("email", { length: 320 }).notNull().unique(),
	  phone: varchar("phone", { length: 20 }),
	  company: varchar("company", { length: 255 }),
	  status: mysqlEnum("status", ["Active", "Inactive", "Verified", "Blacklisted"]).default("Active"),
	  notes: text("notes"),
	  createdAt: timestamp("createdAt").defaultNow().notNull(),
	  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
	});
	
	export type Buyer = typeof buyers.$inferSelect;
	export type InsertBuyer = typeof buyers.$inferInsert;
	
	/**
	 * Buyer Preferences table - stores property criteria for each buyer
	 */
	export const buyerPreferences = mysqlTable("buyerPreferences", {
	  id: int("id").autoincrement().primaryKey(),
	  buyerId: int("buyerId").notNull(),
	  // Location Preferences
	  states: text("states"), // JSON array of preferred states
	  cities: text("cities"), // JSON array of preferred cities
	  zipcodes: text("zipcodes"), // JSON array of preferred zipcodes
	  // Property Type Preferences
	  propertyTypes: text("propertyTypes"), // JSON array of preferred property types (e.g., Single Family, Multi-Family)
	  minBeds: int("minBeds"),
	  maxBeds: int("maxBeds"),
	  minBaths: decimal("minBaths", { precision: 3, scale: 1 }),
	  maxBaths: decimal("maxBaths", { precision: 3, scale: 1 }),
	  // Financial Preferences
	  minPrice: int("minPrice"),
	  maxPrice: int("maxPrice"),
	  maxRepairCost: int("maxRepairCost"),
	  // Metadata
	  createdAt: timestamp("createdAt").defaultNow().notNull(),
	  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
	});
	
	export type BuyerPreference = typeof buyerPreferences.$inferSelect;
	export type InsertBuyerPreference = typeof buyerPreferences.$inferInsert;

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
 * Contact Addresses table - standardized mailing addresses for Click2Mail/Zapier
 */
export const contactAddresses = mysqlTable("contactAddresses", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  zipcode: varchar("zipcode", { length: 10 }).notNull(),
  addressType: varchar("addressType", { length: 50 }).default("Mailing"), // Mailing, Current, Previous
  isPrimary: int("isPrimary").default(0).notNull(), // 1=Primary, 0=Secondary
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContactAddress = typeof contactAddresses.$inferSelect;
export type InsertContactAddress = typeof contactAddresses.$inferInsert;

/**
 * Contact Phones table - stores multiple phone numbers per contact
 */
export const contactPhones = mysqlTable("contactPhones", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  phoneType: mysqlEnum("phoneType", ["Mobile", "Landline", "Wireless", "Work", "Home", "Other"]).default("Mobile"),
  isPrimary: int("isPrimary").default(0).notNull(),
  dnc: int("dnc").default(0).notNull(),
  carrier: varchar("carrier", { length: 100 }),
  activityStatus: varchar("activityStatus", { length: 50 }),
  isPrepaid: int("isPrepaid").default(0).notNull(),
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
  
  // Note type for categorization (general, desk-chris, etc.)
  noteType: mysqlEnum("noteType", ["general", "desk-chris"]).default("general"),
  
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

/**
 * Automated Follow-up table - tracks automated follow-up tasks
 */
export const automatedFollowUps = mysqlTable("automatedFollowUps", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull().references(() => properties.id, { onDelete: "cascade" }),
  
  // Follow-up details
  type: mysqlEnum("type", ["Cold Lead", "No Contact", "Stage Change", "Custom"]).notNull(),
  trigger: text("trigger").notNull(), // e.g., "No contact in 30 days", "Lead Temperature is COLD"
  action: mysqlEnum("action", ["Create Task", "Send Email", "Send SMS", "Change Stage"]).notNull(),
  
  // Action details
  actionDetails: text("actionDetails"), // JSON string with task details, email template ID, etc.
  
  // Status and tracking
  status: mysqlEnum("status", ["Active", "Paused", "Completed"]).default("Active").notNull(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  nextRunAt: timestamp("nextRunAt").notNull(),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AutomatedFollowUp = typeof automatedFollowUps.$inferSelect;
export type InsertAutomatedFollowUp = typeof automatedFollowUps.$inferInsert;

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


/**
 * Family Members table - stores family tree information for properties
 * Tracks family members, their relationships, and contact status
 */
export const familyMembers = mysqlTable("familyMembers", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull().references(() => properties.id, { onDelete: "cascade" }),
  
  // Family member information
  name: varchar("name", { length: 255 }).notNull(),
  relationship: mysqlEnum("relationship", [
    "Owner",
    "Spouse",
    "Son",
    "Daughter",
    "Father",
    "Mother",
    "Brother",
    "Sister",
    "Grandfather",
    "Grandmother",
    "Grandson",
    "Granddaughter",
    "Uncle",
    "Aunt",
    "Cousin",
    "Nephew",
    "Niece",
    "In-Law",
    "Other"
  ]).notNull(),
  
  // Contact information
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  
  // Status tracking
  isRepresentative: int("isRepresentative").default(0).notNull(), // 0=NO, 1=YES
  isDeceased: int("isDeceased").default(0).notNull(), // 0=NO, 1=YES
  isContacted: int("isContacted").default(0).notNull(), // 0=NO, 1=YES
  contactedDate: timestamp("contactedDate"),
  isOnBoard: int("isOnBoard").default(0).notNull(), // 0=NO, 1=YES (interested in selling)
  isNotOnBoard: int("isNotOnBoard").default(0).notNull(), // 0=NO, 1=YES (not interested)
  
  // Additional fields
  relationshipPercentage: int("relationshipPercentage").default(0), // 0-100% ownership/interest
  isCurrentResident: int("isCurrentResident").default(0).notNull(), // 0=NO, 1=YES
  parentId: int("parentId"), // Reference to parent family member for hierarchical tree
  
  // Notes
  notes: text("notes"),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = typeof familyMembers.$inferInsert;

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


/**
 * Merge Feedback table - tracks user feedback on AI merge suggestions
 * Used for AI learning to improve confidence scoring over time
 */
export const mergeFeedback = mysqlTable("mergeFeedback", {
  id: int("id").autoincrement().primaryKey(),
  lead1Id: int("lead1Id").notNull(), // First lead in the suggestion
  lead2Id: int("lead2Id").notNull(), // Second lead in the suggestion
  suggestedPrimaryId: int("suggestedPrimaryId").notNull(), // AI's suggested primary lead
  
  // AI confidence scores at time of suggestion
  overallScore: int("overallScore").notNull(), // 0-100
  addressSimilarity: int("addressSimilarity").notNull(), // 0-100
  ownerNameSimilarity: int("ownerNameSimilarity").notNull(), // 0-100
  dataCompletenessScore: int("dataCompletenessScore").notNull(), // 0-100
  leadQualityScore: int("leadQualityScore").notNull(), // 0-100
  riskScore: int("riskScore").notNull(), // 0-100
  confidenceLevel: mysqlEnum("confidenceLevel", ["HIGH", "MEDIUM", "LOW", "VERY_LOW"]).notNull(),
  
  // User feedback
  action: mysqlEnum("action", ["accepted", "rejected", "ignored"]).notNull(),
  actualPrimaryId: int("actualPrimaryId"), // Which lead user chose as primary (if accepted)
  rejectionReason: mysqlEnum("rejectionReason", [
    "wrong_address",
    "wrong_owner", 
    "not_duplicates",
    "too_risky",
    "other"
  ]),
  rejectionNotes: text("rejectionNotes"),
  
  userId: int("userId").notNull(), // User who provided feedback
  feedbackAt: timestamp("feedbackAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MergeFeedback = typeof mergeFeedback.$inferSelect;
export type InsertMergeFeedback = typeof mergeFeedback.$inferInsert;


/**
 * Stage History table - tracks all deal stage changes for pipeline analytics
 * Used to calculate time in stage, conversion rates, and bottlenecks
 */
export const stageHistory = mysqlTable("stageHistory", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  oldStage: varchar("oldStage", { length: 50 }),
  newStage: varchar("newStage", { length: 50 }).notNull(),
  changedBy: int("changedBy").notNull(), // User ID who changed the stage
  notes: text("notes"), // Optional notes about why stage changed
  daysInPreviousStage: int("daysInPreviousStage"), // Auto-calculated
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StageHistory = typeof stageHistory.$inferSelect;
export type InsertStageHistory = typeof stageHistory.$inferInsert;


/**
 * Call Logs table - tracks all phone calls made through Twilio integration
 * Used for call history, follow-up tracking, and agent performance analytics
 */
export const callLogs = mysqlTable("callLogs", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  contactId: int("contactId").notNull(),
  userId: int("userId").notNull(), // User who made the call
  toPhoneNumber: varchar("toPhoneNumber", { length: 20 }).notNull(),
  fromPhoneNumber: varchar("fromPhoneNumber", { length: 20 }).notNull(),
  callType: mysqlEnum("callType", ["outbound", "inbound", "missed"]).default("outbound").notNull(),
  status: mysqlEnum("status", ["ringing", "in-progress", "completed", "failed", "no-answer"]).notNull(),
  duration: int("duration"), // Duration in seconds (null if not completed)
  twilioCallSid: varchar("twilioCallSid", { length: 64 }), // Twilio call SID for reference
  notes: text("notes"), // Optional notes about the call
  recordingUrl: varchar("recordingUrl", { length: 500 }), // URL to call recording if available
  errorMessage: text("errorMessage"), // Error message if call failed
  startedAt: timestamp("startedAt").notNull(),
  endedAt: timestamp("endedAt"), // Null if still in progress
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = typeof callLogs.$inferInsert;
