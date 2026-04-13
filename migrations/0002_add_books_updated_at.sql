-- Add updated_at for edit history tracking.
ALTER TABLE books ADD COLUMN updated_at DATETIME;

-- Backfill existing rows with created_at value when present.
UPDATE books
SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
