CREATE TABLE `invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`email` varchar(255),
	`role` enum('agent','admin') NOT NULL DEFAULT 'agent',
	`status` enum('pending','accepted','expired','cancelled') NOT NULL DEFAULT 'pending',
	`created_by` int NOT NULL,
	`accepted_by` int,
	`accepted_at` timestamp,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invites_token_unique` UNIQUE(`token`)
);
