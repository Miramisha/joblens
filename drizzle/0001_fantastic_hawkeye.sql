CREATE TABLE `accounts` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`hh_attempt` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hh_connections` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`hh_user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`encrypted_tokens` text NOT NULL,
	`expires_at` integer NOT NULL,
	`connected_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hh_connections_hh_user_id_unique` ON `hh_connections` (`hh_user_id`);--> statement-breakpoint
CREATE TABLE `hh_oauth_states` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`state_hash` text NOT NULL,
	`encrypted_verifier` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hh_oauth_states_state_hash_unique` ON `hh_oauth_states` (`state_hash`);