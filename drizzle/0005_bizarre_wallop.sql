ALTER TABLE `renovationEstimates` ADD `kitchenRate` decimal(10,2) DEFAULT '180.00';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `kitchenPct` decimal(5,2) DEFAULT '10.00';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `bathroomRate` decimal(10,2) DEFAULT '110.00';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `bathroomPct` decimal(5,2) DEFAULT '3.00';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `paintingRate` decimal(10,2) DEFAULT '6.00';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `flooringRate` decimal(10,2) DEFAULT '11.00';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `flooringPct` decimal(5,2) DEFAULT '80.00';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `roofRate` decimal(10,2) DEFAULT '15.00';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `acRate` decimal(10,2) DEFAULT '6.50';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `cleaningRate` decimal(10,2) DEFAULT '1.50';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `gardensRate` decimal(10,2) DEFAULT '1.80';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `miscPct` decimal(5,2) DEFAULT '5.00';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `permitsPct` decimal(5,2) DEFAULT '3.00';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `holdCostRate` decimal(10,2) DEFAULT '2.00';--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `holdCostMonths` int DEFAULT 6;--> statement-breakpoint
ALTER TABLE `renovationEstimates` ADD `commissionPct` decimal(5,2) DEFAULT '6.00';