-- Guard every job writer, including imports, within the write transaction.
CREATE TRIGGER jobs_owner_insert BEFORE INSERT ON jobs
WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE owner_id=NEW.owner_id)
BEGIN SELECT RAISE(ABORT, 'joblens_owner_deleted'); END;
--> statement-breakpoint
CREATE TRIGGER jobs_owner_update BEFORE UPDATE ON jobs
WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE owner_id=NEW.owner_id)
BEGIN SELECT RAISE(ABORT, 'joblens_owner_deleted'); END;
