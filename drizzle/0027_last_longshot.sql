CREATE TABLE `twilioNumbers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phoneNumber` varchar(20) NOT NULL,
	`label` varchar(255) NOT NULL,
	`description` text,
	`isActive` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `twilioNumbers_id` PRIMARY KEY(`id`),
	CONSTRAINT `twilioNumbers_phoneNumber_unique` UNIQUE(`phoneNumber`)
);
