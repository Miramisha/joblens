ALTER TABLE `jobs` ADD `duplicate_key` text;--> statement-breakpoint
CREATE INDEX `idx_jobs_owner_duplicate` ON `jobs` (`owner_id`,`duplicate_key`);
--> statement-breakpoint
-- Keep every accepted account snapshot below the 5 MB restore envelope.
-- Payload bytes plus 1024 bytes reserved per row for IDs/revisions and export overhead.
-- The budget is stable across restore generations and enforced atomically.
CREATE TRIGGER jobs_backup_budget_insert BEFORE INSERT ON jobs
WHEN (length(CAST(json_remove(NEW.payload, '$.id', '$.sourceId', '$.revision') AS BLOB)) + 1024) > 1000000 OR
  COALESCE((SELECT SUM(length(CAST(json_remove(payload, '$.id', '$.sourceId', '$.revision') AS BLOB)) + 1024) FROM jobs WHERE owner_id=NEW.owner_id AND id<>NEW.id),0) + (length(CAST(json_remove(NEW.payload, '$.id', '$.sourceId', '$.revision') AS BLOB)) + 1024) > 4000000
BEGIN SELECT RAISE(ABORT, 'joblens_storage_limit'); END;
--> statement-breakpoint
CREATE TRIGGER jobs_backup_budget_update BEFORE UPDATE OF payload,owner_id ON jobs
WHEN (length(CAST(json_remove(NEW.payload, '$.id', '$.sourceId', '$.revision') AS BLOB)) + 1024) > 1000000 OR
  COALESCE((SELECT SUM(length(CAST(json_remove(payload, '$.id', '$.sourceId', '$.revision') AS BLOB)) + 1024) FROM jobs WHERE owner_id=NEW.owner_id AND id<>OLD.id),0) + (length(CAST(json_remove(NEW.payload, '$.id', '$.sourceId', '$.revision') AS BLOB)) + 1024) > 4000000
BEGIN SELECT RAISE(ABORT, 'joblens_storage_limit'); END;

--> statement-breakpoint
PRAGMA optimize;
