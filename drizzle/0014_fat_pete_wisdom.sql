CREATE TABLE `invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('agent','admin') NOT NULL,
	`status` enum('pending','accepted','expired','cancelled') NOT NULL DEFAULT 'pending',
	`createdBy` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`acceptedBy` int,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invites_token_unique` UNIQUE(`token`)
);
