-- Add num_spaces column to panels so slot count is explicit per-panel
-- instead of inferred via `is_main ? 30 : 42`. Backfill existing rows
-- from that inference so behavior is unchanged for data already in the DB.

ALTER TABLE panels
  ADD COLUMN num_spaces integer;

UPDATE panels
  SET num_spaces = CASE WHEN is_main IS TRUE THEN 30 ELSE 42 END
  WHERE num_spaces IS NULL;

ALTER TABLE panels
  ALTER COLUMN num_spaces SET NOT NULL,
  ALTER COLUMN num_spaces SET DEFAULT 42;

ALTER TABLE panels
  ADD CONSTRAINT panels_num_spaces_range
  CHECK (num_spaces > 0 AND num_spaces <= 84);

COMMENT ON COLUMN panels.num_spaces IS
  'Number of pole spaces in the panel (e.g. 30, 42). Must be > 0 and <= 84.';
