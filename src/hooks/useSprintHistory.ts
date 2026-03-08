import { useCallback, useState } from 'react';
import { useDatabase } from './useDatabase';
import { Sprint, Story, Task } from '../types';

export interface SprintHistoryData {
    sprint: Sprint;
    stories: Story[];
    tasks: Task[];
}

export function useSprintHistory() {
    const { db } = useDatabase();
    const [historyData, setHistoryData] = useState<SprintHistoryData[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = useCallback(async () => {
        if (!db) return;
        setLoading(true);
        try {
            // 1. 全スプリントを新しい順に取得
            const sprints = await db.select<Sprint[]>('SELECT * FROM sprints ORDER BY started_at DESC');

            // 2. アーカイブされた全Storyを取得
            const archivedStories = await db.select<Story[]>('SELECT * FROM stories WHERE sprint_id IS NOT NULL');

            // 3. アーカイブされた全Taskを取得
            const archivedTasks = await db.select<Task[]>('SELECT * FROM tasks WHERE sprint_id IS NOT NULL');

            // 4. スプリントごとにデータをまとめる
            const aggregatedData: SprintHistoryData[] = sprints.map(sprint => {
                const sprintStories = archivedStories.filter(story => story.sprint_id === sprint.id);
                const sprintTasks = archivedTasks.filter(task => task.sprint_id === sprint.id);
                return {
                    sprint,
                    stories: sprintStories,
                    tasks: sprintTasks
                };
            });

            setHistoryData(aggregatedData);
        } catch (error) {
            console.error('Failed to fetch sprint history:', error);
        } finally {
            setLoading(false);
        }
    }, [db]);

    return {
        historyData,
        loading,
        fetchHistory
    };
}
