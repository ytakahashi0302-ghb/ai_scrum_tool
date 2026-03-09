-- 1. Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insert default project
INSERT OR IGNORE INTO projects (id, name, description) 
VALUES ('default', 'Default Project', 'Initial default workspace project.');

-- 3. Recreate stories table and copy data
CREATE TABLE stories_new (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT 'default' REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    acceptance_criteria TEXT,
    status TEXT NOT NULL CHECK(status IN ('Backlog', 'Ready', 'In Progress', 'Done')),
    sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO stories_new (id, project_id, title, description, acceptance_criteria, status, sprint_id, created_at, updated_at)
SELECT id, 'default', title, description, acceptance_criteria, status, sprint_id, created_at, updated_at FROM stories;

DROP TABLE stories;
ALTER TABLE stories_new RENAME TO stories;

-- 4. Recreate tasks table and copy data
CREATE TABLE tasks_new (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT 'default' REFERENCES projects(id) ON DELETE CASCADE,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK(status IN ('To Do', 'In Progress', 'Done')),
    sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tasks_new (id, project_id, story_id, title, description, status, sprint_id, created_at, updated_at)
SELECT id, 'default', story_id, title, description, status, sprint_id, created_at, updated_at FROM tasks;

DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;

-- 5. Recreate sprints table and copy data
CREATE TABLE sprints_new (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT 'default' REFERENCES projects(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    completed_at INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL
);

INSERT INTO sprints_new (id, project_id, started_at, completed_at, duration_ms)
SELECT id, 'default', started_at, completed_at, duration_ms FROM sprints;

DROP TABLE sprints;
ALTER TABLE sprints_new RENAME TO sprints;

