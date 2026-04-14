ALTER TABLE stories ADD COLUMN sequence_number INTEGER;

WITH ranked_stories AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY project_id
            ORDER BY datetime(created_at) ASC, id ASC
        ) AS next_sequence
    FROM stories
)
UPDATE stories
SET sequence_number = (
    SELECT ranked_stories.next_sequence
    FROM ranked_stories
    WHERE ranked_stories.id = stories.id
)
WHERE sequence_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_project_sequence_number
ON stories(project_id, sequence_number);

ALTER TABLE tasks ADD COLUMN sequence_number INTEGER;

WITH ranked_tasks AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY project_id
            ORDER BY datetime(created_at) ASC, id ASC
        ) AS next_sequence
    FROM tasks
)
UPDATE tasks
SET sequence_number = (
    SELECT ranked_tasks.next_sequence
    FROM ranked_tasks
    WHERE ranked_tasks.id = tasks.id
)
WHERE sequence_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_project_sequence_number
ON tasks(project_id, sequence_number);

ALTER TABLE sprints ADD COLUMN sequence_number INTEGER;

WITH ranked_sprints AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY project_id
            ORDER BY
                CASE WHEN started_at IS NULL AND completed_at IS NULL THEN 1 ELSE 0 END ASC,
                COALESCE(started_at, completed_at, 0) ASC,
                id ASC
        ) AS next_sequence
    FROM sprints
)
UPDATE sprints
SET sequence_number = (
    SELECT ranked_sprints.next_sequence
    FROM ranked_sprints
    WHERE ranked_sprints.id = sprints.id
)
WHERE sequence_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sprints_project_sequence_number
ON sprints(project_id, sequence_number);
