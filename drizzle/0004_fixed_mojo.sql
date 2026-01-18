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
