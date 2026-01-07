ALTER TABLE `contacts` ADD `equityPercent` decimal(5,2);--> statement-breakpoint
ALTER TABLE `contacts` ADD `currentResident` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `contacted` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `contactedDate` timestamp;--> statement-breakpoint
ALTER TABLE `contacts` ADD `onBoard` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `notOnBoard` int DEFAULT 0 NOT NULL;