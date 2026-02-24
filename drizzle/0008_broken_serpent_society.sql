ALTER TABLE `users` MODIFY COLUMN `role` enum('agent','admin') NOT NULL DEFAULT 'agent';--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('Active','Inactive','Suspended') DEFAULT 'Active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notes` text;