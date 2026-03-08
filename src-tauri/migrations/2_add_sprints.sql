-- スプリント履歴を管理するテーブル
CREATE TABLE sprints (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL, -- Unix timestamp in milliseconds
    completed_at INTEGER NOT NULL, -- Unix timestamp in milliseconds
    duration_ms INTEGER NOT NULL
);

-- tasks テーブルに sprint_id カラムを追加
ALTER TABLE tasks ADD COLUMN sprint_id TEXT REFERENCES sprints(id);

-- stories テーブルに sprint_id カラムを追加
ALTER TABLE stories ADD COLUMN sprint_id TEXT REFERENCES sprints(id);
