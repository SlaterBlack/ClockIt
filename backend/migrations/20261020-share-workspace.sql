-- Projects are now shared by all users. Merge every user's workspace into the oldest one
-- so existing projects (and their tasks and time entries) stay visible to everyone.
UPDATE projects
SET workspace_id = (SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1)
WHERE workspace_id <> (SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1);

DELETE FROM workspaces
WHERE id <> (SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1);
