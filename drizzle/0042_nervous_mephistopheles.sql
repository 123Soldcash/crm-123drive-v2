CREATE TABLE `integrationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`integration` varchar(100) NOT NULL,
	`settingKey` varchar(255) NOT NULL,
	`settingValue` text,
	`label` varchar(255),
	`description` text,
	`isSecret` int NOT NULL DEFAULT 0,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrationSettings_id` PRIMARY KEY(`id`)
);
