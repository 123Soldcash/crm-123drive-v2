CREATE TABLE `taxUrls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`label` varchar(255) NOT NULL DEFAULT 'Tax Record',
	`url` text NOT NULL,
	`isSelected` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taxUrls_id` PRIMARY KEY(`id`)
);
