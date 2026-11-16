PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_notification_jobs` (
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
	CONSTRAINT "notification_jobs_event_check" CHECK("event_key" in ('account_access', 'password_reset', 'sub_request', 'sub_claimed', 'sub_bumped', 'game_cancelled', 'balance_overdue')),
	CONSTRAINT "notification_jobs_claim_check" CHECK(("__new_notification_jobs"."status" = 'sending') = ("__new_notification_jobs"."claimed_at" is not null)),
	CONSTRAINT "notification_jobs_status_check" CHECK("status" in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
	CONSTRAINT "notification_jobs_payload_check" CHECK(json_valid("__new_notification_jobs"."payload_json"))
);
--> statement-breakpoint
INSERT INTO `__new_notification_jobs`("id", "event_key", "user_id", "channel", "scheduled_for", "status", "payload_json", "dedupe_key", "attempts", "last_error", "created_at", "sent_at", "claimed_at", "read_at") SELECT "id", "event_key", "user_id", "channel", "scheduled_for", "status", "payload_json", "dedupe_key", "attempts", "last_error", "created_at", "sent_at", "claimed_at", "read_at" FROM `notification_jobs`;--> statement-breakpoint
DROP TABLE `notification_jobs`;--> statement-breakpoint
ALTER TABLE `__new_notification_jobs` RENAME TO `notification_jobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `notification_jobs_dedupe_unique` ON `notification_jobs` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notification_jobs_due_idx` ON `notification_jobs` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `notification_jobs_user_idx` ON `notification_jobs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_jobs_unread_idx` ON `notification_jobs` (`user_id`) WHERE "channel" = 'in_app' and "status" = 'sent' and "read_at" is null;