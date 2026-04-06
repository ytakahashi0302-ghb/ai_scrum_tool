-- ストーリーに優先度カラムを追加 (High / Medium / Low)
ALTER TABLE stories ADD COLUMN priority TEXT NOT NULL DEFAULT 'Medium';

-- タスクに優先度カラムを追加 (High / Medium / Low)
ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'Medium';

-- タスク依存関係テーブル（多対多）
-- blocked_by_task_id が完了するまで task_id は着手できない
CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id TEXT NOT NULL,
    blocked_by_task_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, blocked_by_task_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_by_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
