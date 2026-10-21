-- Introduce admin/user roles. Everyone defaults to 'user'; the oldest account
-- (the first user ever created) is promoted to 'admin' so there is always at
-- least one admin able to create and manage the rest after this migration runs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_role') THEN
    CREATE TYPE enum_users_role AS ENUM ('admin', 'user');
  END IF;
END
$$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role enum_users_role NOT NULL DEFAULT 'user';

UPDATE users
SET role = 'admin'
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);
