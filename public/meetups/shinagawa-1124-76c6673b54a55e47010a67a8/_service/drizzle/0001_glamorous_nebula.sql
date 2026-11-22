CREATE TABLE `team_themes` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`team` text NOT NULL,
	`round` integer NOT NULL,
	`theme_text` text NOT NULL,
	`initial_text` text NOT NULL,
	`source_idea_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_themes_id_unique` ON `team_themes` (`id`);