CREATE TABLE `dealCalculations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`arv` decimal(10,2),
	`repairCost` decimal(10,2),
	`closingCost` decimal(10,2),
	`assignmentFee` decimal(10,2),
	`desiredProfit` decimal(10,2),
	`maxOffer` decimal(10,2),
	`maoFormula` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dealCalculations_id` PRIMARY KEY(`id`),
	CONSTRAINT `dealCalculations_propertyId_unique` UNIQUE(`propertyId`)
);
