ALTER TABLE `tasks` MODIFY COLUMN `title` varchar(255);--> statement-breakpoint
ALTER TABLE `tasks` ADD `dueTime` varchar(5);--> statement-breakpoint
ALTER TABLE `tasks` ADD `repeatTask` enum('Daily','Weekly','Monthly','None') DEFAULT 'None';