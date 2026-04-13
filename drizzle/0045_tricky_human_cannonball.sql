ALTER TABLE `communicationLog` ADD `needsCallback` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `smsMessages` ADD `isRead` int DEFAULT 1 NOT NULL;