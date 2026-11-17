PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by_player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`filled_by_player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "sub_requests_position_check" CHECK("position" in ('forward', 'defense', 'goalie')),
	CONSTRAINT "sub_requests_reason_check" CHECK("reason" in ('absence', 'manual', 'shortfall')),
	CONSTRAINT "sub_requests_status_check" CHECK("status" in ('open', 'filled', 'cancelled')),
	CONSTRAINT "sub_requests_filled_state" CHECK(("__new_sub_requests"."status" = 'cancelled') or (("__new_sub_requests"."status" = 'filled') = ("__new_sub_requests"."filled_by_player_id" is not null))),
	CONSTRAINT "sub_requests_cancelled_state" CHECK(("__new_sub_requests"."status" = 'cancelled') = ("__new_sub_requests"."cancelled_at" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_sub_requests`("id", "game_id", "requested_by_player_id", "created_by_user_id", "position", "reason", "status", "created_at", "filled_by_player_id", "filled_at", "cancelled_at") SELECT "id", "game_id", "requested_by_player_id", "created_by_user_id", "position", "reason", "status", "created_at", "filled_by_player_id", "filled_at", "cancelled_at" FROM `sub_requests`;--> statement-breakpoint
DROP TABLE `sub_requests`;--> statement-breakpoint
ALTER TABLE `__new_sub_requests` RENAME TO `sub_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sub_requests_game_status_idx` ON `sub_requests` (`game_id`,`status`);--> statement-breakpoint
CREATE INDEX `sub_requests_position_idx` ON `sub_requests` (`game_id`,`position`);--> statement-breakpoint
CREATE INDEX `sub_requests_status_idx` ON `sub_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `sub_requests_requester_unique` ON `sub_requests` (`game_id`,`requested_by_player_id`) WHERE "requested_by_player_id" is not null and "status" <> 'cancelled';--> statement-breakpoint
CREATE UNIQUE INDEX `sub_requests_filler_unique` ON `sub_requests` (`game_id`,`filled_by_player_id`) WHERE "filled_by_player_id" is not null;