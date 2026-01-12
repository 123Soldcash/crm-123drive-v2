ALTER TABLE `properties` ADD `source` enum('DealMachine','Manual','Import','API','CSV','Other') DEFAULT 'Manual';--> statement-breakpoint
ALTER TABLE `properties` ADD `listName` varchar(255);--> statement-breakpoint
ALTER TABLE `properties` ADD `entryDate` timestamp DEFAULT (now()) NOT NULL;