CREATE INDEX `game_slots_assigned_player_idx` ON `game_slots` (`assigned_player_id`);--> statement-breakpoint
CREATE INDEX `game_goals_scorer_idx` ON `game_goals` (`scorer_player_id`);--> statement-breakpoint
CREATE INDEX `game_goals_assist1_idx` ON `game_goals` (`assist1_player_id`);--> statement-breakpoint
CREATE INDEX `game_goals_assist2_idx` ON `game_goals` (`assist2_player_id`);--> statement-breakpoint
CREATE INDEX `game_penalties_player_idx` ON `game_penalties` (`player_id`);