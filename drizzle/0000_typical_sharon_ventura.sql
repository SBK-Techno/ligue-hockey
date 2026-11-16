CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`metadata_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`author_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` text,
	FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chat_messages_kind_check" CHECK("kind" in ('text', 'poll')),
	CONSTRAINT "chat_messages_body_check" CHECK(("chat_messages"."kind" = 'text' and "chat_messages"."body" is not null) or ("chat_messages"."kind" = 'poll' and "chat_messages"."body" is null))
);
--> statement-breakpoint
CREATE INDEX `chat_messages_created_idx` ON `chat_messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `poll_options` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`label` text NOT NULL,
	`option_index` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `polls`(`message_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poll_options_order_unique` ON `poll_options` (`message_id`,`option_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `poll_options_message_key_unique` ON `poll_options` (`id`,`message_id`);--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`message_id` text NOT NULL,
	`option_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`message_id`, `user_id`),
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`option_id`,`message_id`) REFERENCES `poll_options`(`id`,`message_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `poll_votes_option_idx` ON `poll_votes` (`option_id`);--> statement-breakpoint
CREATE TABLE `polls` (
	`message_id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`closes_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payment_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`total_cents` integer NOT NULL,
	`first_cents` integer NOT NULL,
	`second_cents` integer NOT NULL,
	`first_due_date` text,
	`second_due_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payment_plans_total_check" CHECK("payment_plans"."total_cents" >= 0),
	CONSTRAINT "payment_plans_first_check" CHECK("payment_plans"."first_cents" >= 0),
	CONSTRAINT "payment_plans_second_check" CHECK("payment_plans"."second_cents" >= 0),
	CONSTRAINT "payment_plans_sum_check" CHECK("payment_plans"."first_cents" + "payment_plans"."second_cents" = "payment_plans"."total_cents"),
	CONSTRAINT "payment_plans_dates_check" CHECK("payment_plans"."first_due_date" is null or "payment_plans"."second_due_date" is null or "payment_plans"."first_due_date" < "payment_plans"."second_due_date"),
	CONSTRAINT "payment_plans_first_date_format" CHECK("payment_plans"."first_due_date" is null or "payment_plans"."first_due_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "payment_plans_second_date_format" CHECK("payment_plans"."second_due_date" is null or "payment_plans"."second_due_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_plans_player_unique` ON `payment_plans` (`player_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_at` text NOT NULL,
	`method` text NOT NULL,
	`note` text,
	`recorded_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recorded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "payments_amount_check" CHECK("payments"."amount_cents" > 0),
	CONSTRAINT "payments_date_format" CHECK("payments"."paid_at" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "payments_method_check" CHECK("method" in ('etransfer', 'cash', 'card', 'other'))
);
--> statement-breakpoint
CREATE INDEX `payments_player_idx` ON `payments` (`player_id`,`paid_at`);--> statement-breakpoint
CREATE TABLE `game_availability` (
	`game_id` text NOT NULL,
	`player_id` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`game_id`, `player_id`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "game_availability_status_check" CHECK("status" in ('present', 'absent'))
);
--> statement-breakpoint
CREATE TABLE `game_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`team` text NOT NULL,
	`position` text NOT NULL,
	`slot_index` integer NOT NULL,
	`assigned_player_id` text,
	`assignment_kind` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "game_slots_team_check" CHECK("team" in ('white', 'black')),
	CONSTRAINT "game_slots_position_check" CHECK("position" in ('forward', 'defense', 'goalie')),
	CONSTRAINT "game_slots_kind_check" CHECK("assignment_kind" is null or "assignment_kind" in ('regular', 'sub')),
	CONSTRAINT "game_slots_assignment_check" CHECK(("game_slots"."assigned_player_id" is null) = ("game_slots"."assignment_kind" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_slots_slot_unique` ON `game_slots` (`game_id`,`team`,`position`,`slot_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_slots_player_unique` ON `game_slots` (`game_id`,`assigned_player_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`game_date` text NOT NULL,
	`start_time` text NOT NULL,
	`location` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`roster_template_json` text NOT NULL,
	`generated_at` integer,
	`generation_json` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "games_status_check" CHECK("status" in ('scheduled', 'cancelled', 'completed')),
	CONSTRAINT "games_date_format" CHECK("games"."game_date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "games_time_format" CHECK("games"."start_time" glob '[0-9][0-9]:[0-9][0-9]'),
	CONSTRAINT "games_roster_json" CHECK(json_valid("games"."roster_template_json")),
	CONSTRAINT "games_generation_json" CHECK("games"."generation_json" is null or json_valid("games"."generation_json")),
	CONSTRAINT "games_generation_state" CHECK(("games"."generated_at" is null) = ("games"."generation_json" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_schedule_unique` ON `games` (`game_date`,`start_time`) WHERE "status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX `games_status_date_idx` ON `games` (`status`,`game_date`);--> statement-breakpoint
CREATE TABLE `notification_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`event_key` text NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`scheduled_for` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload_json` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`sent_at` integer,
	`claimed_at` integer,
	`read_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notification_jobs_channel_check" CHECK("channel" in ('in_app', 'email', 'push')),
	CONSTRAINT "notification_jobs_event_check" CHECK("event_key" in ('account_access', 'sub_request', 'sub_claimed', 'sub_bumped', 'game_cancelled', 'balance_overdue')),
	CONSTRAINT "notification_jobs_claim_check" CHECK(("notification_jobs"."status" = 'sending') = ("notification_jobs"."claimed_at" is not null)),
	CONSTRAINT "notification_jobs_status_check" CHECK("status" in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
	CONSTRAINT "notification_jobs_payload_check" CHECK(json_valid("notification_jobs"."payload_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_jobs_dedupe_unique` ON `notification_jobs` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notification_jobs_due_idx` ON `notification_jobs` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `notification_jobs_user_idx` ON `notification_jobs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_jobs_unread_idx` ON `notification_jobs` (`user_id`) WHERE "channel" = 'in_app' and "status" = 'sent' and "read_at" is null;--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`player_id` text PRIMARY KEY NOT NULL,
	`email_enabled` integer DEFAULT true NOT NULL,
	`push_enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`failure_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`user_id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`position` text NOT NULL,
	`age` integer NOT NULL,
	`is_substitute` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "players_position_check" CHECK("position" in ('forward', 'defense', 'goalie')),
	CONSTRAINT "players_age_check" CHECK("players"."age" >= 5 and "players"."age" <= 99)
);
--> statement-breakpoint
CREATE TABLE `player_ratings` (
	`player_id` text NOT NULL,
	`attribute` text NOT NULL,
	`value` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	PRIMARY KEY(`player_id`, `attribute`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "player_ratings_attribute_check" CHECK("attribute" in ('passing', 'speed', 'agility', 'backchecking')),
	CONSTRAINT "player_ratings_value_check" CHECK("value" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE `pair_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`player_a_id` text NOT NULL,
	`player_b_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text,
	FOREIGN KEY (`player_a_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_b_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "pair_rules_order_check" CHECK("pair_rules"."player_a_id" < "pair_rules"."player_b_id"),
	CONSTRAINT "pair_rules_kind_check" CHECK("kind" in ('must', 'must_not'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pair_rules_pair_unique` ON `pair_rules` (`player_a_id`,`player_b_id`);--> statement-breakpoint
CREATE TABLE `league_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "league_settings_key_check" CHECK("key" in ('league.seasonLabel', 'games.defaultLocation', 'games.defaultStartTime', 'games.availabilityClosesHours', 'roster.goaliesPerTeam', 'roster.forwardsPerTeam', 'roster.defensePerTeam', 'notifications.generalLeadHours', 'notifications.priorityGapHours', 'notifications.emailEnabled', 'notifications.pushEnabled', 'notifications.subRequestOnAbsence', 'notifications.lastCallMinutes', 'finance.totalCents', 'finance.firstInstallmentPercent', 'finance.installment1Due', 'finance.installment2Due', 'finance.currency', 'finance.goalieDiscountPercent', 'finance.overdueGraceDays', 'teams.skillTolerance', 'teams.maxPlayers', 'teams.autoRegenerate', 'chat.maxMessageLength', 'chat.maxPollOptions', 'chat.pollMinOptions', 'chat.pageSize', 'chat.allowPlayerPolls')),
	CONSTRAINT "league_settings_value_json" CHECK(json_valid("league_settings"."value_json"))
);
--> statement-breakpoint
CREATE TABLE `sub_profiles` (
	`player_id` text PRIMARY KEY NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`positions_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sub_profiles_positions_json_check" CHECK(json_valid("sub_profiles"."positions_json") and json_type("sub_profiles"."positions_json") = 'array')
);
--> statement-breakpoint
CREATE TABLE `sub_requests` (
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
	CONSTRAINT "sub_requests_filled_state" CHECK(("sub_requests"."status" = 'filled') = ("sub_requests"."filled_by_player_id" is not null)),
	CONSTRAINT "sub_requests_cancelled_state" CHECK(("sub_requests"."status" = 'cancelled') = ("sub_requests"."cancelled_at" is not null))
);
--> statement-breakpoint
CREATE INDEX `sub_requests_game_status_idx` ON `sub_requests` (`game_id`,`status`);--> statement-breakpoint
CREATE INDEX `sub_requests_position_idx` ON `sub_requests` (`game_id`,`position`);--> statement-breakpoint
CREATE INDEX `sub_requests_status_idx` ON `sub_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `sub_requests_requester_unique` ON `sub_requests` (`game_id`,`requested_by_player_id`) WHERE "requested_by_player_id" is not null and "status" <> 'cancelled';--> statement-breakpoint
CREATE UNIQUE INDEX `sub_requests_filler_unique` ON `sub_requests` (`game_id`,`filled_by_player_id`) WHERE "filled_by_player_id" is not null;