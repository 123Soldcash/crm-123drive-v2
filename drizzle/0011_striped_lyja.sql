ALTER TABLE `familyMembers` ADD `relationshipPercentage` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `familyMembers` ADD `isCurrentResident` int DEFAULT 0 NOT NULL;