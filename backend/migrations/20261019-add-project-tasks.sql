CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS task_id UUID NULL
  REFERENCES tasks(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS time_entries_task_id_idx ON time_entries(task_id);
