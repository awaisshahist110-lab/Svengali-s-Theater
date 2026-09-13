CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`state_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
