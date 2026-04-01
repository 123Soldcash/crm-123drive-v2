ALTER TABLE `financialModule` ADD `fm_selectedTaxUrlId` int;--> statement-breakpoint
ALTER TABLE `taxUrls` DROP COLUMN `propertyId`;--> statement-breakpoint
ALTER TABLE `taxUrls` DROP COLUMN `isSelected`;