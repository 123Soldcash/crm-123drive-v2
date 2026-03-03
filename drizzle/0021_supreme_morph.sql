CREATE TABLE `smsTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(100) NOT NULL DEFAULT 'Custom',
	`body` text NOT NULL,
	`sortOrder` int DEFAULT 0,
	`createdByUserId` int,
	`createdByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smsTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `automatedFollowUps` ADD `templateId` int;--> statement-breakpoint
ALTER TABLE `automatedFollowUps` ADD `templateBody` text;--> statement-breakpoint
ALTER TABLE `automatedFollowUps` ADD `createdByUserId` int;--> statement-breakpoint
ALTER TABLE `automatedFollowUps` ADD `createdByName` varchar(255);