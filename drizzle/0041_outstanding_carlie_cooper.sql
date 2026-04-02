CREATE TABLE `crmNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`source` enum('instantly','autocalls') NOT NULL,
	`campaignName` varchar(255) NOT NULL,
	`eventType` varchar(100) NOT NULL DEFAULT 'message',
	`messageText` text,
	`rawPayload` text,
	`isRead` int NOT NULL DEFAULT 0,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crmNotifications_id` PRIMARY KEY(`id`)
);
