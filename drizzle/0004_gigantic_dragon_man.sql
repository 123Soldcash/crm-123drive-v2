ALTER TABLE `properties` ADD `deskName` varchar(100);--> statement-breakpoint
ALTER TABLE `properties` ADD `deskStatus` enum('BIN','ACTIVE','ARCHIVED') DEFAULT 'BIN';