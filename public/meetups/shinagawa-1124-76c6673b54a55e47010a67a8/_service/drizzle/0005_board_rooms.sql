ALTER TABLE `ideas` ADD `room` text DEFAULT 'event' NOT NULL;--> statement-breakpoint
CREATE INDEX `ideas_room_sequence` ON `ideas` (`room`,`sequence`);--> statement-breakpoint
ALTER TABLE `team_themes` ADD `room` text DEFAULT 'event' NOT NULL;--> statement-breakpoint
CREATE INDEX `team_themes_room_sequence` ON `team_themes` (`room`,`sequence`);