ALTER TABLE `properties` DROP INDEX `properties_propertyId_unique`;--> statement-breakpoint
ALTER TABLE `properties` ADD `parcelNumber` varchar(100);--> statement-breakpoint
ALTER TABLE `properties` ADD CONSTRAINT `properties_parcelNumber_unique` UNIQUE(`parcelNumber`);