CREATE TABLE IF NOT EXISTS `buyerPreferences` (
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
CREATE TABLE IF NOT EXISTS `buyers` (
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
ALTER TABLE `dealCalculations` DROP INDEX `dealCalculations_propertyId_unique`;--> statement-breakpoint
ALTER TABLE `dealCalculations` MODIFY COLUMN `id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `dealCalculations` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `dealCalculations` DROP COLUMN `id`;--> statement-breakpoint
ALTER TABLE `dealCalculations` DROP COLUMN `propertyId`;