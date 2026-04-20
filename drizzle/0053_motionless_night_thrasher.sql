CREATE TABLE `voicemails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`callerPhone` varchar(30) NOT NULL,
	`calledTwilioNumber` varchar(30),
	`propertyId` int,
	`contactId` int,
	`recordingUrl` varchar(1000) NOT NULL,
	`recordingSid` varchar(100),
	`callSid` varchar(100),
	`durationSeconds` int,
	`isHeard` int NOT NULL DEFAULT 0,
	`heardByUserId` int,
	`heardAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `voicemails_id` PRIMARY KEY(`id`)
);
