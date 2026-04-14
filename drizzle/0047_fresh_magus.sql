CREATE TABLE `twilioNumberDesks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`twilioNumberId` int NOT NULL,
	`deskId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `twilioNumberDesks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userDesks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deskId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userDesks_id` PRIMARY KEY(`id`)
);
