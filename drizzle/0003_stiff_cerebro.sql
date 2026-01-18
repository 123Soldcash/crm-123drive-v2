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
DROP TABLE `contactEmails`;--> statement-breakpoint
DROP TABLE `contactPhones`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `phone1`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `phone1Type`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `phone2`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `phone2Type`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `phone3`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `phone3Type`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `email1`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `email2`;--> statement-breakpoint
ALTER TABLE `contacts` DROP COLUMN `email3`;