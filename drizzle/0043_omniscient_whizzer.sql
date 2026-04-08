ALTER TABLE `contactPhones` ADD `trestleScore` int;--> statement-breakpoint
ALTER TABLE `contactPhones` ADD `isLitigator` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contactPhones` ADD `trestleLineType` varchar(50);--> statement-breakpoint
ALTER TABLE `contactPhones` ADD `trestleLastChecked` timestamp;