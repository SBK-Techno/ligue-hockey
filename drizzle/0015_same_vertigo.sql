PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_league_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "league_settings_key_check" CHECK("key" in ('league.seasonLabel', 'games.defaultLocation', 'games.defaultStartTime', 'games.availabilityClosesHours', 'roster.goaliesPerTeam', 'roster.forwardsPerTeam', 'roster.defensePerTeam', 'roster.playersPerTeam', 'notifications.generalLeadHours', 'notifications.priorityGapHours', 'notifications.emailEnabled', 'notifications.pushEnabled', 'notifications.subRequestOnAbsence', 'notifications.lastCallMinutes', 'finance.totalCents', 'finance.firstInstallmentPercent', 'finance.installment1Due', 'finance.installment2Due', 'finance.goalieDiscountPercent', 'finance.overdueGraceDays', 'teams.skillTolerance', 'teams.maxPlayers', 'teams.maxSkillSpread', 'teams.maxAgeSpread', 'teams.maxSizeSpread', 'chat.maxMessageLength', 'chat.maxPollOptions', 'chat.pollMinOptions', 'chat.pageSize', 'chat.allowPlayerPolls')),
	CONSTRAINT "league_settings_value_json" CHECK(json_valid("__new_league_settings"."value_json"))
);
--> statement-breakpoint
INSERT INTO `__new_league_settings`("key", "value_json", "updated_at", "updated_by") SELECT "key", "value_json", "updated_at", "updated_by" FROM `league_settings`;--> statement-breakpoint
DROP TABLE `league_settings`;--> statement-breakpoint
ALTER TABLE `__new_league_settings` RENAME TO `league_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;