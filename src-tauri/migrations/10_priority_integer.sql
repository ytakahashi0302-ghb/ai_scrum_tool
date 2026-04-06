-- priorityカラムをテキストから整数に変換（小さい数字ほど優先度が高い）
-- 既存データ: 'High' → 2, 'Low' → 4, それ以外('Medium'等) → 3
UPDATE stories SET priority = '2' WHERE priority = 'High';
UPDATE stories SET priority = '4' WHERE priority = 'Low';
UPDATE stories SET priority = '3' WHERE priority NOT IN ('1', '2', '3', '4', '5');

UPDATE tasks SET priority = '2' WHERE priority = 'High';
UPDATE tasks SET priority = '4' WHERE priority = 'Low';
UPDATE tasks SET priority = '3' WHERE priority NOT IN ('1', '2', '3', '4', '5');
