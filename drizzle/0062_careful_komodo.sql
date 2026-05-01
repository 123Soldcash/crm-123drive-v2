CREATE TABLE `dripCampaignTemplateSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`sortOrder` int NOT NULL,
	`templateName` varchar(255),
	`channel` enum('SMS Only','Email Only','SMS + Email') NOT NULL,
	`category` varchar(100),
	`emailSubject` text,
	`messageBody` text NOT NULL,
	`phase` varchar(50),
	`dayOffset` int NOT NULL,
	`timeOfDay` varchar(10),
	CONSTRAINT `dripCampaignTemplateSteps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dripCampaignTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`totalSteps` int NOT NULL,
	`totalDays` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dripCampaignTemplates_id` PRIMARY KEY(`id`),
	CONSTRAINT `dripCampaignTemplates_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `propertyDripCampaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`templateId` int NOT NULL,
	`status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
	`currentStepOrder` int NOT NULL DEFAULT 0,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`cancelledAt` timestamp,
	`cancelReason` varchar(255),
	`completedAt` timestamp,
	`launchedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `propertyDripCampaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `propertyDripSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`stepId` int NOT NULL,
	`sortOrder` int NOT NULL,
	`status` enum('pending','executed','skipped','cancelled') NOT NULL DEFAULT 'pending',
	`scheduledFor` timestamp NOT NULL,
	`executedAt` timestamp,
	`channel` enum('SMS Only','Email Only','SMS + Email') NOT NULL,
	`messageBody` text,
	`emailSubject` text,
	`phase` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `propertyDripSteps_id` PRIMARY KEY(`id`)
);
