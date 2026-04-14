import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Task } from '../types';
import toast from 'react-hot-toast';
import { useWorkspace } from '../context/WorkspaceContext';

export function useTasks() {
    const { currentProjectId } = useWorkspace();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const result = await invoke<Task[]>('get_tasks', { projectId: currentProjectId });
            setTasks(result);
        } catch (err) {
            console.error('Failed to fetch tasks', err);
            toast.error(`タスクの取得に失敗しました: ${err}`);
        } finally {
            setLoading(false);
        }
    }, [currentProjectId]);

    const fetchTasksByStoryId = useCallback(async (storyId: string) => {
        try {
            return await invoke<Task[]>('get_tasks_by_story_id', { storyId, projectId: currentProjectId });
        } catch (err) {
            console.error('Failed to fetch tasks by story id', err);
            toast.error(`ストーリー別タスクの取得に失敗しました: ${err}`);
            return [];
        }
    }, [currentProjectId]);

    const addTask = useCallback(async (task: Omit<Task, 'created_at' | 'updated_at' | 'project_id' | 'sequence_number'>) => {
        try {
            await invoke('add_task', {
                id: task.id,
                storyId: task.story_id,
                title: task.title,
                description: task.description,
                status: task.status,
                assigneeType: task.assignee_type,
                priority: task.priority ?? 3,
                projectId: currentProjectId
            });
            await fetchTasks();
        } catch (err) {
            console.error('Failed to add task', err);
            toast.error(`タスクの作成に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchTasks, currentProjectId]);

    const updateTaskStatus = useCallback(async (taskId: string, status: Task['status']) => {
        try {
            await invoke('update_task_status', { id: taskId, status });
            await fetchTasks();
        } catch (err) {
            console.error('Failed to update task status', err);
            toast.error('ステータスの更新に失敗しました。');
        }
    }, [fetchTasks]);

    const updateTask = useCallback(async (task: Task) => {
        try {
            await invoke('update_task', {
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                assigneeType: task.assignee_type,
                assignedRoleId: task.assigned_role_id ?? null,
                priority: task.priority ?? 3
            });
            await fetchTasks();
        } catch (err) {
            console.error('Failed to update task', err);
            toast.error(`タスクの更新に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchTasks]);

    const deleteTask = useCallback(async (id: string) => {
        try {
            await invoke('delete_task', { id });
            await fetchTasks();
        } catch (err) {
            console.error('Failed to delete task', err);
            toast.error(`タスクの削除に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchTasks]);

    return {
        tasks,
        loading,
        fetchTasks,
        fetchTasksByStoryId,
        addTask,
        updateTaskStatus,
        updateTask,
        deleteTask
    };
}
