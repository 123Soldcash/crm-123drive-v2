CREATE TABLE `leadMergeHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`primaryLeadId` int NOT NULL,
	`secondaryLeadId` int NOT NULL,
	`primaryLeadAddress` text,
	`secondaryLeadAddress` text,
	`mergedBy` int NOT NULL,
	`mergedAt` timestamp NOT NULL DEFAULT (now()),
	`reason` text,
	`itemsMerged` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadMergeHistory_id` PRIMARY KEY(`id`)
);
