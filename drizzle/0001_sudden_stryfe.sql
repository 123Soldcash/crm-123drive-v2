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
	`phone1` varchar(20),
	`phone1Type` varchar(50),
	`phone2` varchar(20),
	`phone2Type` varchar(50),
	`phone3` varchar(20),
	`phone3Type` varchar(50),
	`email1` varchar(255),
	`email2` varchar(255),
	`email3` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
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
	`addressLine1` varchar(255) NOT NULL,
	`addressLine2` varchar(255),
	`city` varchar(100) NOT NULL,
	`state` varchar(2) NOT NULL,
	`zipcode` varchar(10) NOT NULL,
	`subdivisionName` varchar(255),
	`status` text,
	`trackingStatus` enum('Not Visited','Off Market','Cash Buyer','Free And Clear','High Equity','Senior Owner','Tired Landlord','Absentee Owner','Corporate Owner','Empty Nester','Interested','Not Interested','Follow Up') DEFAULT 'Not Visited',
	`leadTemperature` enum('SUPER HOT','HOT','WARM','COLD','TBD','DEAD') DEFAULT 'COLD',
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
	`taxYear` int,
	`taxAmount` int,
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
	`title` varchar(255) NOT NULL,
	`description` text,
	`taskType` enum('Call','Email','Visit','Research','Follow-up','Offer','Negotiation','Contract','Inspection','Closing','Other') NOT NULL,
	`priority` enum('High','Medium','Low') NOT NULL DEFAULT 'Medium',
	`status` enum('To Do','In Progress','Done') NOT NULL DEFAULT 'To Do',
	`hidden` int NOT NULL DEFAULT 0,
	`assignedToId` int,
	`createdById` int NOT NULL,
	`propertyId` int,
	`dueDate` timestamp,
	`completedDate` timestamp,
	`checklist` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
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
ALTER TABLE `users` ADD `phone` varchar(20);