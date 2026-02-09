CREATE TABLE `agentPermissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`feature` enum('VIEW_LEADS','MAKE_CALLS','SEND_EMAILS','VIEW_DEEP_SEARCH','EDIT_CONTACTS','CREATE_TASKS','TRANSFER_LEADS','VIEW_AGENT_PERFORMANCE','MANAGE_AGENTS','VIEW_ALL_LEADS','EDIT_LEAD_STATUS','ADD_NOTES') NOT NULL,
	`granted` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentPermissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`role` enum('Birddog','Acquisition Manager','Disposition Manager','Admin','Manager','Corretor','Other') DEFAULT 'Birddog',
	`agentType` enum('Internal','External','Birddog','Corretor') DEFAULT 'Internal',
	`status` enum('Active','Inactive','Suspended') DEFAULT 'Active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agents_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `automatedFollowUps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`type` enum('Cold Lead','No Contact','Stage Change','Custom') NOT NULL,
	`trigger` text NOT NULL,
	`action` enum('Create Task','Send Email','Send SMS','Change Stage') NOT NULL,
	`actionDetails` text,
	`status` enum('Active','Paused','Completed') NOT NULL DEFAULT 'Active',
	`lastTriggeredAt` timestamp,
	`nextRunAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automatedFollowUps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `buyerPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buyerId` int NOT NULL,
	`states` text,
	`cities` text,
	`zipcodes` text,
	`propertyTypes` text,
	`minBeds` int,
	`maxBeds` int,
	`minBaths` decimal(3,1),
	`maxBaths` decimal(3,1),
	`minPrice` int,
	`maxPrice` int,
	`maxRepairCost` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buyerPreferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `buyers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`company` varchar(255),
	`status` enum('Active','Inactive','Verified','Blacklisted') DEFAULT 'Active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buyers_id` PRIMARY KEY(`id`),
	CONSTRAINT `buyers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `communicationLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`contactId` int,
	`communicationType` enum('Phone','Email','SMS','Facebook','Instagram','DoorKnock','Letter','Other') NOT NULL,
	`callResult` enum('Interested - HOT LEAD','Interested - WARM LEAD - Wants too Much / Full Price','Interested - WARM LEAD - Not Hated','Left Message - Owner Verified','Left Message','Beep Beep','Busy','Call Back','Disconnected','Duplicated number','Fax','Follow-up','Hang up','Has calling restrictions','Investor/Buyer/Realtor Owned','Irate - DNC','Mail box full','Mail box not set-up','Not Answer','Not Available','Not Ringing','Not Service','Number repeated','Player','Portuguese','Property does not fit our criteria','Restrict','See Notes','Sold - DEAD','Spanish','Voicemail','Wrong Number','Wrong Person','Other'),
	`direction` enum('Outbound','Inbound') DEFAULT 'Outbound',
	`notes` text,
	`nextStep` text,
	`userId` int NOT NULL,
	`communicationDate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `communicationLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contactAddresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`addressLine1` varchar(255) NOT NULL,
	`addressLine2` varchar(255),
	`city` varchar(100) NOT NULL,
	`state` varchar(2) NOT NULL,
	`zipcode` varchar(10) NOT NULL,
	`addressType` varchar(50) DEFAULT 'Mailing',
	`isPrimary` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contactAddresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contactEmails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`email` varchar(255) NOT NULL,
	`isPrimary` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contactEmails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contactPhones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`phoneNumber` varchar(20) NOT NULL,
	`phoneType` enum('Mobile','Landline','Wireless','Work','Home','Other') DEFAULT 'Mobile',
	`isPrimary` int NOT NULL DEFAULT 0,
	`dnc` int NOT NULL DEFAULT 0,
	`carrier` varchar(100),
	`activityStatus` varchar(50),
	`isPrepaid` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contactPhones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contactSocialMedia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`platform` enum('Facebook','Instagram','LinkedIn','Twitter','Other') NOT NULL,
	`profileUrl` text,
	`contacted` int NOT NULL DEFAULT 0,
	`contactedDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contactSocialMedia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`name` varchar(255),
	`relationship` varchar(100),
	`age` int,
	`deceased` int NOT NULL DEFAULT 0,
	`currentAddress` text,
	`flags` text,
	`isDecisionMaker` int NOT NULL DEFAULT 0,
	`dnc` int NOT NULL DEFAULT 0,
	`isLitigator` int NOT NULL DEFAULT 0,
	`hidden` int NOT NULL DEFAULT 0,
	`currentResident` int NOT NULL DEFAULT 0,
	`contacted` int NOT NULL DEFAULT 0,
	`contactedDate` timestamp,
	`onBoard` int NOT NULL DEFAULT 0,
	`notOnBoard` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dealCalculations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apn` varchar(50) NOT NULL,
	`arv` decimal(10,2),
	`repairCost` decimal(10,2),
	`closingCost` decimal(10,2),
	`assignmentFee` decimal(10,2),
	`desiredProfit` decimal(10,2),
	`maxOffer` decimal(10,2),
	`maoFormula` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dealCalculations_id` PRIMARY KEY(`id`),
	CONSTRAINT `dealCalculations_apn_unique` UNIQUE(`apn`)
);
--> statement-breakpoint
CREATE TABLE `familyMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`relationship` enum('Owner','Spouse','Son','Daughter','Father','Mother','Brother','Sister','Grandfather','Grandmother','Grandson','Granddaughter','Uncle','Aunt','Cousin','Nephew','Niece','In-Law','Other') NOT NULL,
	`phone` varchar(20),
	`email` varchar(320),
	`isRepresentative` int NOT NULL DEFAULT 0,
	`isDeceased` int NOT NULL DEFAULT 0,
	`isContacted` int NOT NULL DEFAULT 0,
	`contactedDate` timestamp,
	`isOnBoard` int NOT NULL DEFAULT 0,
	`isNotOnBoard` int NOT NULL DEFAULT 0,
	`relationshipPercentage` int DEFAULT 0,
	`isCurrentResident` int NOT NULL DEFAULT 0,
	`parentId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `familyMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`agentId` int NOT NULL,
	`assignmentType` enum('Exclusive','Shared','Temporary') DEFAULT 'Shared',
	`assignedBy` int,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leadAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadMergeHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`primaryLeadId` int NOT NULL,
	`secondaryLeadId` int NOT NULL,
	`primaryLeadAddress` text,
	`secondaryLeadAddress` text,
	`mergedBy` int NOT NULL,
	`mergedAt` timestamp NOT NULL DEFAULT (now()),
	`reason` text,
	`itemsMerged` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadMergeHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadTransferHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`fromAgentId` int,
	`toAgentId` int NOT NULL,
	`transferredBy` int NOT NULL,
	`reason` text,
	`status` enum('Pending','Accepted','Rejected','Completed') DEFAULT 'Completed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadTransferHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadTransfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`fromAgentId` int NOT NULL,
	`toAgentId` int NOT NULL,
	`reason` text,
	`status` enum('pending','accepted','rejected') DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`respondedAt` timestamp,
	CONSTRAINT `leadTransfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mergeFeedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lead1Id` int NOT NULL,
	`lead2Id` int NOT NULL,
	`suggestedPrimaryId` int NOT NULL,
	`overallScore` int NOT NULL,
	`addressSimilarity` int NOT NULL,
	`ownerNameSimilarity` int NOT NULL,
	`dataCompletenessScore` int NOT NULL,
	`leadQualityScore` int NOT NULL,
	`riskScore` int NOT NULL,
	`confidenceLevel` enum('HIGH','MEDIUM','LOW','VERY_LOW') NOT NULL,
	`action` enum('accepted','rejected','ignored') NOT NULL,
	`actualPrimaryId` int,
	`rejectionReason` enum('wrong_address','wrong_owner','not_duplicates','too_risky','other'),
	`rejectionNotes` text,
	`userId` int NOT NULL,
	`feedbackAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mergeFeedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `noteTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`templateText` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `noteTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`noteType` enum('general','desk-chris') DEFAULT 'general',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outreachLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`method` enum('Email','Post Card','Door Knock','Text Message','Letter','Social Media','Other') NOT NULL,
	`agentId` int NOT NULL,
	`agentName` varchar(255) NOT NULL,
	`notes` text,
	`responseReceived` int NOT NULL DEFAULT 0,
	`responseDate` timestamp,
	`responseNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outreachLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`visitId` int,
	`noteId` int,
	`userId` int NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`caption` text,
	`latitude` varchar(50),
	`longitude` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int,
	`addressLine1` varchar(255) NOT NULL,
	`addressLine2` varchar(255),
	`city` varchar(100) NOT NULL,
	`state` varchar(2) NOT NULL,
	`zipcode` varchar(10) NOT NULL,
	`subdivisionName` varchar(255),
	`status` text,
	`trackingStatus` enum('Not Visited','Off Market','Cash Buyer','Free And Clear','High Equity','Senior Owner','Tired Landlord','Absentee Owner','Corporate Owner','Empty Nester','Interested','Not Interested','Follow Up') DEFAULT 'Not Visited',
	`leadTemperature` enum('SUPER HOT','HOT','DEEP SEARCH','WARM','COLD','TBD','DEAD') DEFAULT 'TBD',
	`ownerVerified` int NOT NULL DEFAULT 0,
	`assignedAgentId` int,
	`marketStatus` varchar(100),
	`ownerLocation` varchar(100),
	`estimatedValue` int,
	`equityAmount` int,
	`equityPercent` int,
	`salePrice` int,
	`saleDate` timestamp,
	`mortgageAmount` int,
	`totalLoanBalance` int,
	`totalLoanPayment` int,
	`estimatedRepairCost` int,
	`taxYear` int,
	`taxAmount` int,
	`owner1Name` varchar(255),
	`owner2Name` varchar(255),
	`buildingSquareFeet` int,
	`totalBedrooms` int,
	`totalBaths` int,
	`yearBuilt` int,
	`propertyType` varchar(100),
	`constructionType` varchar(100),
	`apnParcelId` varchar(100),
	`taxDelinquent` varchar(10),
	`taxDelinquentYear` int,
	`propertyId` varchar(100),
	`dealMachinePropertyId` varchar(100),
	`dealMachineLeadId` varchar(100),
	`dealMachineRawData` text,
	`source` enum('DealMachine','Manual','Import','API','CSV','Other') DEFAULT 'Manual',
	`listName` varchar(255),
	`entryDate` timestamp NOT NULL DEFAULT (now()),
	`deskName` varchar(100),
	`deskStatus` enum('BIN','ACTIVE','ARCHIVED') DEFAULT 'BIN',
	`dealStage` enum('NEW_LEAD','LEAD_IMPORTED','SKIP_TRACED','FIRST_CONTACT_MADE','ANALYZING_DEAL','OFFER_PENDING','FOLLOW_UP_ON_CONTRACT','UNDER_CONTRACT_A','MARKETING_TO_BUYERS','BUYER_INTERESTED','CONTRACT_B_SIGNED','ASSIGNMENT_FEE_AGREED','ESCROW_DEPOSIT_A','ESCROW_DEPOSIT_B','INSPECTION_PERIOD','TITLE_COMPANY','MUNICIPAL_LIENS','TITLE_SEARCH','TITLE_INSURANCE','CLOSING','CLOSED_WON','DEAD_LOST') DEFAULT 'NEW_LEAD',
	`stageChangedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `propertyAgents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`agentId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`assignedBy` int,
	CONSTRAINT `propertyAgents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `propertyDeepSearch` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`mlsStatus` enum('Listed','Not Listed','Fail','Expired','Sold','Off Market'),
	`occupancy` enum('Owner-Occupied','Abandoned','Partially Occupied','Relatives','Second Home','Squatters','Vacant','Tenant-Occupied'),
	`annualRent` int,
	`monthlyRent` int,
	`leaseType` enum('Annual','Month to Month'),
	`overviewNotes` text,
	`issues` text,
	`propertyCondition` text,
	`propertyType` text,
	`probateFinds` text,
	`probateNotes` text,
	`familyTree` text,
	`familyTreeNotes` text,
	`zillowEstimate` int,
	`dealMachineEstimate` int,
	`ourEstimate` int,
	`estimateNotes` text,
	`recordsChecked` text,
	`recordsCheckedNotes` text,
	`recordDetails` text,
	`recordDetailsFindings` text,
	`deedType` text,
	`delinquentTax2025` int,
	`delinquentTax2024` int,
	`delinquentTax2023` int,
	`delinquentTax2022` int,
	`delinquentTax2021` int,
	`delinquentTax2020` int,
	`delinquentTaxTotal` int,
	`hasMortgage` int DEFAULT 0,
	`mortgageAmount` int,
	`equityPercent` int,
	`mortgageNotes` text,
	`needsRepairs` int DEFAULT 0,
	`repairTypes` text,
	`estimatedRepairCost` int,
	`repairNotes` text,
	`hasCodeViolation` int DEFAULT 0,
	`codeViolationNotes` text,
	`hasLiens` int DEFAULT 0,
	`liensNotes` text,
	`skiptracingDone` text,
	`skiptracingNotes` text,
	`outreachDone` text,
	`tasks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `propertyDeepSearch_id` PRIMARY KEY(`id`),
	CONSTRAINT `propertyDeepSearch_propertyId_unique` UNIQUE(`propertyId`)
);
--> statement-breakpoint
CREATE TABLE `propertyTags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`tag` varchar(100) NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `propertyTags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savedSearches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`filters` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savedSearches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skiptracingLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`method` varchar(100) NOT NULL,
	`source` varchar(255),
	`agentId` int NOT NULL,
	`agentName` varchar(255) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `skiptracingLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stageHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`oldStage` varchar(50),
	`newStage` varchar(50) NOT NULL,
	`changedBy` int NOT NULL,
	`notes` text,
	`daysInPreviousStage` int,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stageHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`comment` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255),
	`description` text,
	`taskType` enum('Call','Email','Visit','Research','Follow-up','Offer','Negotiation','Contract','Inspection','Closing','Other') NOT NULL,
	`priority` enum('High','Medium','Low') NOT NULL DEFAULT 'Medium',
	`status` enum('To Do','In Progress','Done') NOT NULL DEFAULT 'To Do',
	`hidden` int NOT NULL DEFAULT 0,
	`assignedToId` int,
	`createdById` int NOT NULL,
	`propertyId` int,
	`dueDate` timestamp,
	`dueTime` varchar(5),
	`completedDate` timestamp,
	`repeatTask` enum('Daily','Weekly','Monthly','No repeat') DEFAULT 'No repeat',
	`checklist` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`phone` varchar(20),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`userId` int NOT NULL,
	`latitude` varchar(50),
	`longitude` varchar(50),
	`checkInTime` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `automatedFollowUps` ADD CONSTRAINT `automatedFollowUps_propertyId_properties_id_fk` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `familyMembers` ADD CONSTRAINT `familyMembers_propertyId_properties_id_fk` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;