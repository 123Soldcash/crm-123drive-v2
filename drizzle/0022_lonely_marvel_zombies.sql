ALTER TABLE `smsTemplates` ADD `channel` varchar(20) DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE `smsTemplates` ADD `emailSubject` varchar(500);