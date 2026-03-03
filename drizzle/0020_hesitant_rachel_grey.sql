CREATE TABLE `smsMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactPhone` varchar(20) NOT NULL,
	`twilioPhone` varchar(20) NOT NULL,
	`direction` enum('outbound','inbound') NOT NULL,
	`body` text NOT NULL,
	`twilioSid` varchar(64),
	`status` enum('queued','sent','delivered','failed','received','undelivered') DEFAULT 'queued',
	`contactId` int,
	`propertyId` int,
	`sentByUserId` int,
	`sentByName` varchar(255),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smsMessages_id` PRIMARY KEY(`id`)
);
