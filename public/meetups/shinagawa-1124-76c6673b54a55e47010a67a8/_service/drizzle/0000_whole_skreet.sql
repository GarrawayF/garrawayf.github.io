CREATE TABLE `ideas` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`team` text NOT NULL,
	`round` integer NOT NULL,
	`idea_text` text NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`parent_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ideas_id_unique` ON `ideas` (`id`);