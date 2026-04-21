ALTER TABLE `contacts` ADD `phoneNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `contacts` ADD `phoneType` enum('Mobile','Landline','Wireless','Work','Home','Other') DEFAULT 'Mobile';--> statement-breakpoint
ALTER TABLE `contacts` ADD `email` varchar(255);--> statement-breakpoint
ALTER TABLE `contacts` ADD `contactType` enum('phone','email') DEFAULT 'phone';--> statement-breakpoint
ALTER TABLE `contacts` ADD `carrier` varchar(100);--> statement-breakpoint
ALTER TABLE `contacts` ADD `activityStatus` varchar(50);--> statement-breakpoint
ALTER TABLE `contacts` ADD `isPrepaid` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `contacts` ADD `trestleScore` int;--> statement-breakpoint
ALTER TABLE `contacts` ADD `trestleLineType` varchar(50);--> statement-breakpoint
ALTER TABLE `contacts` ADD `trestleLastChecked` timestamp;