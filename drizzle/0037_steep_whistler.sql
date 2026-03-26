CREATE TABLE `desks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`color` varchar(20),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isSystem` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `desks_id` PRIMARY KEY(`id`),
	CONSTRAINT `desks_name_unique` UNIQUE(`name`)
);
