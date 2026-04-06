-- priorityカラムの型をTEXTからINTEGERに変更（テーブル再作成）
-- FKカスケードによる意図しない削除を防ぐため、外部キー制約を一時無効化

PRAGMA foreign_keys = OFF;

-- stories テーブルを再作成
CREATE TABLE stories_new (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT 'default' REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    acceptance_criteria TEXT,
    status TEXT NOT NULL CHECK(status IN ('Backlog', 'Ready', 'In Progress', 'Done')),
    sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
    priority INTEGER NOT NULL DEFAULT 3,
    archived BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO stories_new (id, project_id, title, description, acceptance_criteria, status, sprint_id, priority, archived, created_at, updated_at)
SELECT
    id, project_id, title, description, acceptance_criteria, status, sprint_id,
    CAST(CASE
        WHEN priority = '1' OR CAST(priority AS TEXT) = '1' THEN 1
        WHEN priority = '2' OR CAST(priority AS TEXT) = '2' THEN 2
        WHEN priority = '4' OR CAST(priority AS TEXT) = '4' THEN 4
        WHEN priority = '5' OR CAST(priority AS TEXT) = '5' THEN 5
        ELSE 3
    END AS INTEGER),
    archived, created_at, updated_at
FROM stories;

DROP TABLE stories;
ALTER TABLE stories_new RENAME TO stories;

-- tasks テーブルを再作成（assignee_typeカラムも含む）
CREATE TABLE tasks_new (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT 'default' REFERENCES projects(id) ON DELETE CASCADE,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK(status IN ('To Do', 'In Progress', 'Done')),
    sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
    priority INTEGER NOT NULL DEFAULT 3,
    archived BOOLEAN DEFAULT FALSE,
    assignee_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tasks_new (id, project_id, story_id, title, description, status, sprint_id, priority, archived, assignee_type, created_at, updated_at)
SELECT
    id, project_id, story_id, title, description, status, sprint_id,
    CAST(CASE
        WHEN priority = '1' OR CAST(priority AS TEXT) = '1' THEN 1
        WHEN priority = '2' OR CAST(priority AS TEXT) = '2' THEN 2
        WHEN priority = '4' OR CAST(priority AS TEXT) = '4' THEN 4
        WHEN priority = '5' OR CAST(priority AS TEXT) = '5' THEN 5
        ELSE 3
    END AS INTEGER),
    archived, assignee_type, created_at, updated_at
FROM tasks;

DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;

-- インデックスを再作成
CREATE INDEX IF NOT EXISTS idx_stories_sprint_id ON stories(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);

PRAGMA foreign_keys = ON;
