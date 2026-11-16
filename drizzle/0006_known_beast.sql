PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`map_url` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_name_unique` ON `locations` (`name`);--> statement-breakpoint
INSERT INTO `locations` (`id`, `name`, `address`, `map_url`, `notes`, `created_at`, `updated_at`)
SELECT 'loc_' || min(`rowid`), `location`, NULL, NULL, NULL, 0, 0
FROM `games`
GROUP BY `location`;--> statement-breakpoint
CREATE TABLE `__new_games` (
	`id` text PRIMARY KEY NOT NULL,
	`game_date` text NOT NULL,
	`start_time` text NOT NULL,
	`location_id` text NOT NULL,
	`location` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`roster_template_json` text NOT NULL,
	`generated_at` integer,
	`generation_json` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "games_status_check" CHECK("status" in ('scheduled', 'cancelled', 'completed')),
	CONSTRAINT "games_date_format" CHECK("game_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "games_time_format" CHECK("start_time" glob '[0-9][0-9]:[0-9][0-9]'),
	CONSTRAINT "games_roster_json" CHECK(json_valid("roster_template_json")),
	CONSTRAINT "games_generation_json" CHECK("generation_json" is null or json_valid("generation_json")),
	CONSTRAINT "games_generation_state" CHECK(("generated_at" is null) = ("generation_json" is null))
);
--> statement-breakpoint
INSERT INTO `__new_games` (`id`, `game_date`, `start_time`, `location_id`, `location`, `notes`, `status`, `roster_template_json`, `generated_at`, `generation_json`, `created_by`, `created_at`, `updated_at`)
SELECT `games`.`id`, `games`.`game_date`, `games`.`start_time`, `locations`.`id`, `games`.`location`, `games`.`notes`, `games`.`status`, `games`.`roster_template_json`, `games`.`generated_at`, `games`.`generation_json`, `games`.`created_by`, `games`.`created_at`, `games`.`updated_at`
FROM `games`
INNER JOIN `locations` ON `locations`.`name` = `games`.`location`;--> statement-breakpoint
CREATE TABLE `__new_game_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`team` text NOT NULL,
	`position` text NOT NULL,
	`slot_index` integer NOT NULL,
	`assigned_player_id` text,
	`assignment_kind` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `__new_games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "game_slots_team_check" CHECK("team" in ('white', 'black')),
	CONSTRAINT "game_slots_position_check" CHECK("position" in ('forward', 'defense', 'goalie')),
	CONSTRAINT "game_slots_kind_check" CHECK("assignment_kind" is null or "assignment_kind" in ('regular', 'sub')),
	CONSTRAINT "game_slots_assignment_check" CHECK(("assigned_player_id" is null) = ("assignment_kind" is null))
);
--> statement-breakpoint
INSERT INTO `__new_game_slots` (`id`, `game_id`, `team`, `position`, `slot_index`, `assigned_player_id`, `assignment_kind`, `created_at`, `updated_at`)
SELECT `id`, `game_id`, `team`, `position`, `slot_index`, `assigned_player_id`, `assignment_kind`, `created_at`, `updated_at` FROM `game_slots`;--> statement-breakpoint
CREATE TABLE `__new_game_availability` (
	`game_id` text NOT NULL,
	`player_id` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`game_id`, `player_id`),
	FOREIGN KEY (`game_id`) REFERENCES `__new_games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "game_availability_status_check" CHECK("status" in ('present', 'absent'))
);
--> statement-breakpoint
INSERT INTO `__new_game_availability` (`game_id`, `player_id`, `status`, `updated_at`)
SELECT `game_id`, `player_id`, `status`, `updated_at` FROM `game_availability`;--> statement-breakpoint
CREATE TABLE `__new_sub_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`requested_by_player_id` text,
	`created_by_user_id` text,
	`position` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`filled_by_player_id` text,
	`filled_at` integer,
	`cancelled_at` integer,
	FOREIGN KEY (`game_id`) REFERENCES `__new_games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by_player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`filled_by_player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "sub_requests_position_check" CHECK("position" in ('forward', 'defense', 'goalie')),
	CONSTRAINT "sub_requests_reason_check" CHECK("reason" in ('absence', 'manual', 'shortfall')),
	CONSTRAINT "sub_requests_status_check" CHECK("status" in ('open', 'filled', 'cancelled')),
	CONSTRAINT "sub_requests_filled_state" CHECK(("status" = 'filled') = ("filled_by_player_id" is not null)),
	CONSTRAINT "sub_requests_cancelled_state" CHECK(("status" = 'cancelled') = ("cancelled_at" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_sub_requests` (`id`, `game_id`, `requested_by_player_id`, `created_by_user_id`, `position`, `reason`, `status`, `created_at`, `filled_by_player_id`, `filled_at`, `cancelled_at`)
SELECT `id`, `game_id`, `requested_by_player_id`, `created_by_user_id`, `position`, `reason`, `status`, `created_at`, `filled_by_player_id`, `filled_at`, `cancelled_at` FROM `sub_requests`;--> statement-breakpoint
CREATE TABLE `__new_game_player_ratings` (
	`game_id` text NOT NULL,
	`player_id` text NOT NULL,
	`attribute` text NOT NULL,
	`value` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	PRIMARY KEY(`game_id`, `player_id`, `attribute`),
	FOREIGN KEY (`game_id`) REFERENCES `__new_games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "game_player_ratings_attribute_check" CHECK("attribute" in ('impact', 'effort', 'decisions', 'discipline', 'goaliePositioning', 'reboundControl', 'puckHandling', 'composure')),
	CONSTRAINT "game_player_ratings_value_check" CHECK("value" between 1 and 5)
);
--> statement-breakpoint
INSERT INTO `__new_game_player_ratings` (`game_id`, `player_id`, `attribute`, `value`, `updated_at`, `updated_by`)
SELECT `game_id`, `player_id`, `attribute`, `value`, `updated_at`, `updated_by` FROM `game_player_ratings`;--> statement-breakpoint
DROP TABLE `game_slots`;--> statement-breakpoint
ALTER TABLE `__new_game_slots` RENAME TO `game_slots`;--> statement-breakpoint
CREATE UNIQUE INDEX `game_slots_slot_unique` ON `game_slots` (`game_id`,`team`,`position`,`slot_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_slots_player_unique` ON `game_slots` (`game_id`,`assigned_player_id`);--> statement-breakpoint
DROP TABLE `game_availability`;--> statement-breakpoint
ALTER TABLE `__new_game_availability` RENAME TO `game_availability`;--> statement-breakpoint
DROP TABLE `sub_requests`;--> statement-breakpoint
ALTER TABLE `__new_sub_requests` RENAME TO `sub_requests`;--> statement-breakpoint
CREATE INDEX `sub_requests_game_status_idx` ON `sub_requests` (`game_id`,`status`);--> statement-breakpoint
CREATE INDEX `sub_requests_position_idx` ON `sub_requests` (`game_id`,`position`);--> statement-breakpoint
CREATE INDEX `sub_requests_status_idx` ON `sub_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `sub_requests_requester_unique` ON `sub_requests` (`game_id`,`requested_by_player_id`) WHERE "requested_by_player_id" is not null and "status" <> 'cancelled';--> statement-breakpoint
CREATE UNIQUE INDEX `sub_requests_filler_unique` ON `sub_requests` (`game_id`,`filled_by_player_id`) WHERE "filled_by_player_id" is not null;--> statement-breakpoint
DROP TABLE `game_player_ratings`;--> statement-breakpoint
ALTER TABLE `__new_game_player_ratings` RENAME TO `game_player_ratings`;--> statement-breakpoint
CREATE INDEX `game_player_ratings_player_idx` ON `game_player_ratings` (`player_id`);--> statement-breakpoint
DROP TABLE `games`;--> statement-breakpoint
ALTER TABLE `__new_games` RENAME TO `games`;--> statement-breakpoint
CREATE UNIQUE INDEX `games_schedule_unique` ON `games` (`game_date`,`start_time`) WHERE "status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX `games_status_date_idx` ON `games` (`status`,`game_date`);--> statement-breakpoint
CREATE INDEX `games_location_idx` ON `games` (`location_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TEMP TABLE `__locations_fk_check` (`violations` integer NOT NULL CHECK (`violations` = 0));--> statement-breakpoint
INSERT INTO `__locations_fk_check` (`violations`) SELECT count(*) FROM pragma_foreign_key_check;--> statement-breakpoint
DROP TABLE `__locations_fk_check`;
