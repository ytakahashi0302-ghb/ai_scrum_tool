import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Sprint } from '../types';
import toast from 'react-hot-toast';
import { useWorkspace } from '../context/WorkspaceContext';

export function useSprints() {
    const { currentProjectId } = useWorkspace();
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchSprints = useCallback(async () => {
        setLoading(true);
        try {
            const result = await invoke<Sprint[]>('get_sprints', { projectId: currentProjectId });
            setSprints(result);
        } catch (err) {
            console.error('Failed to fetch sprints', err);
            toast.error(`スプリント一覧の取得に失敗しました: ${err}`);
        } finally {
            setLoading(false);
        }
    }, [currentProjectId]);

    const createPlannedSprint = useCallback(async () => {
        try {
            const newSprint = await invoke<Sprint>('create_planned_sprint', { projectId: currentProjectId });
            await fetchSprints();
            return newSprint;
        } catch (err) {
            console.error('Failed to create planned sprint', err);
            toast.error(`スプリントの作成に失敗しました: ${err}`);
            throw err;
        }
    }, [currentProjectId, fetchSprints]);

    const startSprint = useCallback(async (sprintId: string, durationMs: number) => {
        try {
            await invoke('start_sprint', { sprintId, durationMs });
            await fetchSprints();
        } catch (err) {
            console.error('Failed to start sprint', err);
            toast.error(`スプリントの開始に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchSprints]);

    const completeSprint = useCallback(async (sprintId: string, completedAt: number) => {
        try {
            await invoke('complete_sprint', { sprintId, projectId: currentProjectId, completedAt });
            await fetchSprints();
        } catch (err) {
            console.error('Failed to complete sprint', err);
            toast.error(`スプリントのアーカイブ(完了)に失敗しました: ${err}`);
            throw err;
        }
    }, [currentProjectId, fetchSprints]);

    return {
        sprints,
        loading,
        fetchSprints,
        createPlannedSprint,
        startSprint,
        completeSprint
    };
}
