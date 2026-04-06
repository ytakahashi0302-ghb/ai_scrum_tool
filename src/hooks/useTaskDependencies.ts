import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Task, TaskDependency } from '../types';
import toast from 'react-hot-toast';
import { useWorkspace } from '../context/WorkspaceContext';

export function useTaskDependencies() {
    const { currentProjectId } = useWorkspace();
    const [dependencies, setDependencies] = useState<TaskDependency[]>([]);

    const fetchDependencies = useCallback(async () => {
        try {
            const result = await invoke<TaskDependency[]>('get_all_task_dependencies', {
                projectId: currentProjectId,
            });
            setDependencies(result);
        } catch (err) {
            console.error('Failed to fetch task dependencies', err);
        }
    }, [currentProjectId]);

    const setTaskDependencies = useCallback(async (taskId: string, blockedByIds: string[]) => {
        try {
            await invoke('set_task_dependencies', { taskId, blockedByIds });
            await fetchDependencies();
        } catch (err) {
            console.error('Failed to set task dependencies', err);
            toast.error(`依存関係の更新に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchDependencies]);

    // タスクがブロックされているか判定（ブロッカーが未完了なら true）
    const isTaskBlocked = useCallback((taskId: string, tasks: Task[]): boolean => {
        const blockerIds = dependencies
            .filter(d => d.task_id === taskId)
            .map(d => d.blocked_by_task_id);

        return blockerIds.some(blockerId => {
            const blocker = tasks.find(t => t.id === blockerId);
            return blocker && blocker.status !== 'Done';
        });
    }, [dependencies]);

    // タスクをブロックしているタスクの一覧を取得
    const getTaskBlockers = useCallback((taskId: string, tasks: Task[]): Task[] => {
        const blockerIds = dependencies
            .filter(d => d.task_id === taskId)
            .map(d => d.blocked_by_task_id);

        return tasks.filter(t => blockerIds.includes(t.id) && t.status !== 'Done');
    }, [dependencies]);

    // タスクIDのブロッカーIDリストを取得
    const getBlockerIds = useCallback((taskId: string): string[] => {
        return dependencies
            .filter(d => d.task_id === taskId)
            .map(d => d.blocked_by_task_id);
    }, [dependencies]);

    return {
        dependencies,
        fetchDependencies,
        setTaskDependencies,
        isTaskBlocked,
        getTaskBlockers,
        getBlockerIds,
    };
}
