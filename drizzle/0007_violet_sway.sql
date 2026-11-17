CREATE TABLE `game_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`team` text NOT NULL,
	`period` integer NOT NULL,
	`clock` text NOT NULL,
	`kind` text NOT NULL,
	`scorer_player_id` text,
	`scorer_name` text NOT NULL,
	`scorer_number` integer,
	`assist1_player_id` text,
	`assist1_name` text,
	`assist1_number` integer,
	`assist2_player_id` text,
	`assist2_name` text,
	`assist2_number` integer,
	`created_at` integer NOT NULL,
	`created_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scorer_player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assist1_player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assist2_player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "game_goals_team_check" CHECK("team" in ('white', 'black')),
	CONSTRAINT "game_goals_period_check" CHECK("period" in (1, 2, 3, 4)),
	CONSTRAINT "game_goals_clock_check" CHECK("game_goals"."clock" glob '[0-9][0-9]:[0-9][0-9]' and "game_goals"."clock" between '00:00' and '20:00'),
	CONSTRAINT "game_goals_kind_check" CHECK("kind" in ('even', 'power_play', 'short_handed', 'penalty_shot', 'own_goal')),
	CONSTRAINT "game_goals_assists_check" CHECK("game_goals"."assist2_name" is null or "game_goals"."assist1_name" is not null)
);
--> statement-breakpoint
CREATE INDEX `game_goals_game_team_idx` ON `game_goals` (`game_id`,`team`);--> statement-breakpoint
CREATE TABLE `game_penalties` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`team` text NOT NULL,
	`period` integer NOT NULL,
	`clock` text NOT NULL,
	`player_id` text,
	`player_name` text NOT NULL,
	`player_number` integer,
	`infraction` text NOT NULL,
	`minutes` integer NOT NULL,
	`coincidental` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`user_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "game_penalties_team_check" CHECK("team" in ('white', 'black')),
	CONSTRAINT "game_penalties_period_check" CHECK("period" in (1, 2, 3, 4)),
	CONSTRAINT "game_penalties_clock_check" CHECK("game_penalties"."clock" glob '[0-9][0-9]:[0-9][0-9]' and "game_penalties"."clock" between '00:00' and '20:00'),
	CONSTRAINT "game_penalties_infraction_check" CHECK("infraction" in ('accrochage', 'obstruction', 'mise_en_echec', 'baton_eleve', 'rudesse', 'retard_de_jeu', 'coup_de_coude', 'trebucher', 'mise_en_echec_par_derriere', 'inconduite', 'contact_a_la_tete', 'dardage')),
	CONSTRAINT "game_penalties_minutes_check" CHECK("minutes" in (2, 4, 5, 10)),
	CONSTRAINT "game_penalties_coincidental_check" CHECK("game_penalties"."coincidental" in (0, 1))
);
--> statement-breakpoint
CREATE INDEX `game_penalties_game_team_idx` ON `game_penalties` (`game_id`,`team`);--> statement-breakpoint
ALTER TABLE `games` ADD `completed_at` integer;--> statement-breakpoint
UPDATE `games` SET `completed_at` = `updated_at` WHERE `status` = 'completed' AND `completed_at` IS NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `lineup_manual_at` integer;