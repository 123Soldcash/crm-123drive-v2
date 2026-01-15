CREATE TABLE `stageHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`oldStage` varchar(50),
	`newStage` varchar(50) NOT NULL,
	`changedBy` int NOT NULL,
	`notes` text,
	`daysInPreviousStage` int,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stageHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `properties` ADD `dealStage` enum('NEW_LEAD','LEAD_IMPORTED','SKIP_TRACED','FIRST_CONTACT_MADE','ANALYZING_DEAL','OFFER_PENDING','FOLLOW_UP_ON_CONTRACT','UNDER_CONTRACT_A','MARKETING_TO_BUYERS','BUYER_INTERESTED','CONTRACT_B_SIGNED','ASSIGNMENT_FEE_AGREED','ESCROW_DEPOSIT_A','ESCROW_DEPOSIT_B','INSPECTION_PERIOD','TITLE_COMPANY','MUNICIPAL_LIENS','TITLE_SEARCH','TITLE_INSURANCE','CLOSING','CLOSED_WON','DEAD_LOST') DEFAULT 'NEW_LEAD';--> statement-breakpoint
ALTER TABLE `properties` ADD `stageChangedAt` timestamp DEFAULT (now()) NOT NULL;