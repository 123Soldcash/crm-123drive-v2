CREATE TABLE `leadSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`isDefault` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leadSources_id` PRIMARY KEY(`id`),
	CONSTRAINT `leadSources_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `properties` ADD `leadSource` varchar(255);