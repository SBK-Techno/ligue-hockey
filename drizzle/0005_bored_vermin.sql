CREATE TABLE `game_player_ratings` (
	`game_id` text NOT NULL,
	`player_id` text NOT NULL,
	`attribute` text NOT NULL,
	`value` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	PRIMARY KEY(`game_id`, `player_id`, `attribute`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "game_player_ratings_attribute_check" CHECK("attribute" in ('impact', 'effort', 'decisions', 'discipline', 'goaliePositioning', 'reboundControl', 'puckHandling', 'composure')),
	CONSTRAINT "game_player_ratings_value_check" CHECK("value" between 1 and 5)
);
--> statement-breakpoint
CREATE INDEX `game_player_ratings_player_idx` ON `game_player_ratings` (`player_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_player_ratings` (
	`player_id` text NOT NULL,
	`attribute` text NOT NULL,
	`value` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	PRIMARY KEY(`player_id`, `attribute`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "player_ratings_attribute_check" CHECK("attribute" in ('passing', 'speed', 'agility', 'backchecking', 'forecheck', 'netFront', 'wallPlay', 'gapControl', 'firstPass', 'netFrontDefence', 'goaliePositioning', 'reboundControl', 'hands', 'puckHandling', 'recovery', 'tracking')),
	CONSTRAINT "player_ratings_value_check" CHECK("value" between 1 and 5)
);
--> statement-breakpoint
INSERT INTO `__new_player_ratings`("player_id", "attribute", "value", "updated_at", "updated_by") SELECT "player_id", "attribute", "value", "updated_at", "updated_by" FROM `player_ratings`;--> statement-breakpoint
DROP TABLE `player_ratings`;--> statement-breakpoint
ALTER TABLE `__new_player_ratings` RENAME TO `player_ratings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;