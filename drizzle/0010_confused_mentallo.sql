CREATE TABLE `familyMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`relationship` enum('Owner','Spouse','Son','Daughter','Father','Mother','Brother','Sister','Grandfather','Grandmother','Grandson','Granddaughter','Uncle','Aunt','Cousin','Nephew','Niece','In-Law','Other') NOT NULL,
	`phone` varchar(20),
	`email` varchar(320),
	`isRepresentative` int NOT NULL DEFAULT 0,
	`isDeceased` int NOT NULL DEFAULT 0,
	`isContacted` int NOT NULL DEFAULT 0,
	`contactedDate` timestamp,
	`isOnBoard` int NOT NULL DEFAULT 0,
	`isNotOnBoard` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `familyMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `familyMembers` ADD CONSTRAINT `familyMembers_propertyId_properties_id_fk` FOREIGN KEY (`propertyId`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;