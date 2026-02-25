CREATE TABLE `email_whitelist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('agent','admin') NOT NULL DEFAULT 'agent',
	`name` varchar(255),
	`added_by` int NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_whitelist_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_whitelist_email_unique` UNIQUE(`email`)
);
