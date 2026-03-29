-- 1. Create extended sprints table
CREATE TABLE sprints_new (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT 'default' REFERENCES projects(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Completed', -- 'Planned', 'Active', 'Completed'
    started_at INTEGER,
    completed_at INTEGER,
    duration_ms INTEGER
);

-- 2. Migrate existing completed sprints (they are all completed in the current app logic)
INSERT INTO sprints_new (id, project_id, status, started_at, completed_at, duration_ms)
SELECT id, project_id, 'Completed', started_at, completed_at, duration_ms 
FROM sprints;

-- 3. Drop old table and rename the new one
DROP TABLE sprints;
ALTER TABLE sprints_new RENAME TO sprints;

-- 4. Add index for sprint_id to improve backlog/board query performance
CREATE INDEX IF NOT EXISTS idx_stories_sprint_id ON stories(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
