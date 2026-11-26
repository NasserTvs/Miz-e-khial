CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`version` integer NOT NULL,
	`expires` integer NOT NULL
);
