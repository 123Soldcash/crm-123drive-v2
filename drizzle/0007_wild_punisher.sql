ALTER TABLE `contactPhones` ADD `usage2Months` varchar(50);--> statement-breakpoint
ALTER TABLE `contactPhones` ADD `usage12Months` varchar(50);--> statement-breakpoint
ALTER TABLE `contacts` ADD `firstName` varchar(100);--> statement-breakpoint
ALTER TABLE `contacts` ADD `lastName` varchar(100);--> statement-breakpoint
ALTER TABLE `contacts` ADD `middleInitial` varchar(10);--> statement-breakpoint
ALTER TABLE `contacts` ADD `generationalSuffix` varchar(20);--> statement-breakpoint
ALTER TABLE `contacts` ADD `gender` varchar(20);--> statement-breakpoint
ALTER TABLE `contacts` ADD `maritalStatus` varchar(50);--> statement-breakpoint
ALTER TABLE `contacts` ADD `netAssetValue` varchar(50);--> statement-breakpoint
ALTER TABLE `contacts` ADD `homeBusiness` varchar(50);--> statement-breakpoint
ALTER TABLE `contacts` ADD `educationModel` varchar(100);--> statement-breakpoint
ALTER TABLE `contacts` ADD `occupationGroup` varchar(100);--> statement-breakpoint
ALTER TABLE `contacts` ADD `occupationCode` varchar(50);--> statement-breakpoint
ALTER TABLE `contacts` ADD `businessOwner` varchar(50);--> statement-breakpoint
ALTER TABLE `contacts` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `dealMachineContactId` varchar(50);