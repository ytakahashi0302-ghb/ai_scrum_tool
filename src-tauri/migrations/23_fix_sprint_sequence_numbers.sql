-- Migration 23: Fix NULL sequence_number on sprints created by complete_sprint rollover
-- complete_sprint が INSERT INTO sprints ... WHERE にsequence_number を含めていなかったため
-- NULL になっていた行を修正する。

UPDATE sprints
SET sequence_number = (
    SELECT COALESCE(MAX(s2.sequence_number), 0) + 1
    FROM sprints s2
    WHERE s2.project_id = sprints.project_id
      AND s2.sequence_number IS NOT NULL
)
WHERE sequence_number IS NULL;
