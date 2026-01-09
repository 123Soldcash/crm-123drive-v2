ALTER TABLE `contactPhones` ADD `carrier` varchar(100);--> statement-breakpoint
ALTER TABLE `contactPhones` ADD `activityStatus` varchar(50);--> statement-breakpoint
ALTER TABLE `contactPhones` ADD `isPrepaid` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `totalLoanBalance` int;--> statement-breakpoint
ALTER TABLE `properties` ADD `totalLoanPayment` int;--> statement-breakpoint
ALTER TABLE `properties` ADD `estimatedRepairCost` int;--> statement-breakpoint
ALTER TABLE `properties` ADD `dealMachinePropertyId` varchar(100);--> statement-breakpoint
ALTER TABLE `properties` ADD `dealMachineLeadId` varchar(100);--> statement-breakpoint
ALTER TABLE `properties` ADD `dealMachineRawData` text;