CREATE TABLE `campaignNames` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaignNames_id` PRIMARY KEY(`id`),
	CONSTRAINT `campaignNames_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `properties` ADD `campaignName` varchar(255);