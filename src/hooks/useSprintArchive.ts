import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';
import { useWorkspace } from '../context/WorkspaceContext';

export function useSprintArchive() {
    const { currentProjectId } = useWorkspace();
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
        setIsArchiving(true);
        try {
            await invoke('archive_sprint', {
                startedAt,
                completedAt,
                durationMs,
                projectId: currentProjectId
            });

            return true;
        } catch (error) {
            console.error('Failed to archive sprint:', error);
            toast.error(`スプリントのアーカイブに失敗しました: ${error}`);
            return false;
        } finally {
            setIsArchiving(false);
        }
    }, [currentProjectId]);

    return {
        archiveSprint,
        isArchiving
    };
}
