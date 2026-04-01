CREATE TABLE `sectionNoteAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sectionNoteId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sectionNoteAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sectionNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`section` varchar(100) NOT NULL,
	`text` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sectionNotes_id` PRIMARY KEY(`id`)
);
