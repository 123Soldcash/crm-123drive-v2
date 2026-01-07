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
ALTER TABLE `agents` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` MODIFY COLUMN `role` enum('Birddog','Acquisition Manager','Disposition Manager','Admin','Manager','Corretor','Other') DEFAULT 'Birddog';--> statement-breakpoint
ALTER TABLE `agents` MODIFY COLUMN `status` enum('Active','Inactive','Suspended') DEFAULT 'Active';--> statement-breakpoint
ALTER TABLE `agents` ADD `agentType` enum('Internal','External','Birddog','Corretor') DEFAULT 'Internal';--> statement-breakpoint
ALTER TABLE `agents` ADD CONSTRAINT `agents_email_unique` UNIQUE(`email`);