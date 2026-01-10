ALTER TABLE `properties` ADD `propertyId` varchar(100);--> statement-breakpoint
ALTER TABLE `properties` ADD CONSTRAINT `properties_propertyId_unique` UNIQUE(`propertyId`);