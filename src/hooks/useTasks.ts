import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Task } from '../types';
import toast from 'react-hot-toast';

export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const result = await invoke<Task[]>('get_tasks', { projectId: 'default' });
            setTasks(result);
        } catch (err) {
            console.error('Failed to fetch tasks', err);
            toast.error(`タスクの取得に失敗しました: ${err}`);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTasksByStoryId = useCallback(async (storyId: string) => {
        try {
            return await invoke<Task[]>('get_tasks_by_story_id', { storyId, projectId: 'default' });
        } catch (err) {
            console.error('Failed to fetch tasks by story id', err);
            toast.error(`ストーリー別タスクの取得に失敗しました: ${err}`);
            return [];
        }
    }, []);

    const addTask = useCallback(async (task: Omit<Task, 'created_at' | 'updated_at'>) => {
        try {
            await invoke('add_task', {
                id: task.id,
                storyId: task.story_id,
                title: task.title,
                description: task.description,
                status: task.status,
                projectId: 'default'
            });
            await fetchTasks();
        } catch (err) {
            console.error('Failed to add task', err);
            toast.error(`タスクの作成に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchTasks]);

    const updateTaskStatus = useCallback(async (taskId: string, status: Task['status']) => {
        // 楽観的UIによるフロントエンドStateの先行更新
        let previousTask: Task | undefined;
        setTasks(prev => {
            previousTask = prev.find(t => t.id === taskId);
            return prev.map(t => t.id === taskId ? { ...t, status } : t);
        });

        try {
            await invoke('update_task_status', { id: taskId, status });
            // 成功時は再取得（fetchTasks）をスキップし、dnd-kitのフリッカー（チラつき）を防止する
        } catch (err) {
            console.error('Failed to update task status', err);
            // エラー発生時は元のStateにロールバックする
            setTasks(prev =>
                prev.map(t =>
                    t.id === taskId && previousTask ? { ...t, status: previousTask.status } : t
                )
            );
            toast.error('ステータスの更新に失敗しました。変更は元に戻されました。');
        }
    }, []);

    const updateTask = useCallback(async (task: Task) => {
        try {
            await invoke('update_task', {
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status
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
