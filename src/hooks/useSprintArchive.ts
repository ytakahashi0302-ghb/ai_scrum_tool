import { useCallback, useState } from 'react';
import { useDatabase } from './useDatabase';

export function useSprintArchive() {
    const { db } = useDatabase();
    const [isArchiving, setIsArchiving] = useState(false);

    /**
     * スプリントを完了し、現在のDONEタスクおよび、未完了タスクがないStoryをアーカイブする
     * @param startedAt スプリント開始時刻 (Unix ms)
     * @param completedAt スプリント完了時刻 (Unix ms)
     * @param durationMs スプリント総時間 (ms)
     */
    const archiveSprint = useCallback(async (
        startedAt: number,
        completedAt: number,
        durationMs: number
    ) => {
        if (!db) {
            console.error('Database is not initialized');
            return false;
        }

        setIsArchiving(true);
        try {
            // 新しいスプリントIDを生成 (UUID v4 相当のランダム文字列表現)
            const sprintId = crypto.randomUUID();

            // 1. sprints テーブルにレコードを作成
            await db.execute(
                'INSERT INTO sprints (id, started_at, completed_at, duration_ms) VALUES ($1, $2, $3, $4)',
                [sprintId, startedAt, completedAt, durationMs]
            );

            // 2. 現在のボード上で完了している（status = 'Done'）かつ未アーカイブのタスクをアーカイブする
            // ※ SQLite では UPDATE で対象がなかった場合でもエラーにはならない
            await db.execute(
                "UPDATE tasks SET sprint_id = $1, updated_at = CURRENT_TIMESTAMP WHERE status = 'Done' AND sprint_id IS NULL",
                [sprintId]
            );

            // 3. 全てのタスクがアーカイブされた親Storyをアーカイブする
            // - storyが未アーカイブであること
            // - そのstoryに紐づく未アーカイブ(sprint_id IS NULL)なタスクが存在しないこと
            await db.execute(
                `UPDATE stories 
                 SET sprint_id = $1, updated_at = CURRENT_TIMESTAMP 
                 WHERE sprint_id IS NULL 
                 AND NOT EXISTS (
                     SELECT 1 FROM tasks 
                     WHERE tasks.story_id = stories.id 
                     AND tasks.sprint_id IS NULL
                 )`,
                [sprintId]
            );

            return true;
        } catch (error) {
            console.error('Failed to archive sprint:', error);
            return false;
        } finally {
            setIsArchiving(false);
        }
    }, [db]);

    return {
        archiveSprint,
        isArchiving
    };
}
