CREATE TABLE `reactions` (
	`idea_id` text,
	`theme_id` text,
	`actor_hash` text NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`theme_id`) REFERENCES `team_themes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reaction_has_one_target" CHECK(("reactions"."idea_id" is null) <> ("reactions"."theme_id" is null)),
	CONSTRAINT "reaction_kind" CHECK("reactions"."kind" in ('like', 'love'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reaction_per_idea` ON `reactions` (`idea_id`,`kind`,`actor_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `reaction_per_theme` ON `reactions` (`theme_id`,`kind`,`actor_hash`);