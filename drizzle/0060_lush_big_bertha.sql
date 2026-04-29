ALTER TABLE `tasks` MODIFY COLUMN `repeatTask` enum('Daily','Weekly','Monthly','3 Months','6 Months','No repeat') DEFAULT 'No repeat';--> statement-breakpoint
ALTER TABLE `tasks` ADD `parentTaskId` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `repeatActive` tinyint DEFAULT 1;