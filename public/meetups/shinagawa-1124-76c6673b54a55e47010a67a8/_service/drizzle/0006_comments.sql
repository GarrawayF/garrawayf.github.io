CREATE TABLE `comments` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`idea_id` text,
	`theme_id` text,
	`comment_text` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`theme_id`) REFERENCES `team_themes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "comment_has_one_target" CHECK(("comments"."idea_id" is null) <> ("comments"."theme_id" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comments_id_unique` ON `comments` (`id`);--> statement-breakpoint
CREATE INDEX `comments_by_idea` ON `comments` (`idea_id`);--> statement-breakpoint
CREATE INDEX `comments_by_theme` ON `comments` (`theme_id`);