import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Sprint, Story, Task } from '../types';
import toast from 'react-hot-toast';
import { useWorkspace } from '../context/WorkspaceContext';

export interface SprintHistoryData {
    sprint: Sprint;
    stories: Story[];
    tasks: Task[];
}

export function useSprintHistory() {
    const { currentProjectId } = useWorkspace();
    const [historyData, setHistoryData] = useState<SprintHistoryData[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            // 1. 全スプリントを新しい順に取得
            const sprints = await invoke<Sprint[]>('get_sprints', { projectId: currentProjectId });

            // 2. アーカイブされた全Storyを取得
            const archivedStories = await invoke<Story[]>('get_archived_stories', { projectId: currentProjectId });

            // 3. アーカイブされた全Taskを取得
            const archivedTasks = await invoke<Task[]>('get_archived_tasks', { projectId: currentProjectId });

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
            toast.error(`スプリント履歴の取得に失敗しました: ${error}`);
        } finally {
            setLoading(false);
        }
    }, [currentProjectId]);

    return {
        historyData,
        loading,
        fetchHistory
    };
}
