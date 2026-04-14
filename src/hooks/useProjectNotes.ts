import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';
import { useWorkspace } from '../context/WorkspaceContext';
import { ProjectNote } from '../types';

interface AddProjectNoteOptions {
    source?: ProjectNote['source'];
}

export function useProjectNotes(projectId?: string | null) {
    const { currentProjectId } = useWorkspace();
    const resolvedProjectId = projectId ?? currentProjectId;
    const [notes, setNotes] = useState<ProjectNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeSprintId, setActiveSprintId] = useState<string | null>(null);

    const fetchNotes = useCallback(async (sprintId?: string | null) => {
        const nextSprintId = sprintId ?? null;
        setActiveSprintId(nextSprintId);
        setLoading(true);
        try {
            const result = await invoke<ProjectNote[]>('get_project_notes', {
                projectId: resolvedProjectId,
            });
            const filtered = nextSprintId
                ? result.filter((note) => note.sprint_id === nextSprintId)
                : result;
            setNotes(filtered);
            return filtered;
        } catch (err) {
            console.error('Failed to fetch project notes', err);
            toast.error(`プロジェクトノートの取得に失敗しました: ${err}`);
            return [];
        } finally {
            setLoading(false);
        }
    }, [resolvedProjectId]);

    const addNote = useCallback(async (
        title: string,
        content: string,
        sprintId?: string | null,
        options?: AddProjectNoteOptions,
    ) => {
        try {
            const note = await invoke<ProjectNote>('add_project_note', {
                projectId: resolvedProjectId,
                sprintId: sprintId ?? activeSprintId,
                title,
                content,
                source: options?.source ?? 'user',
            });
            await fetchNotes(sprintId ?? activeSprintId);
            return note;
        } catch (err) {
            console.error('Failed to add project note', err);
            toast.error(`プロジェクトノートの追加に失敗しました: ${err}`);
            throw err;
        }
    }, [activeSprintId, fetchNotes, resolvedProjectId]);

    const updateNote = useCallback(async (
        id: string,
        title: string,
        content: string,
    ) => {
        try {
            const currentNote = notes.find((note) => note.id === id);
            await invoke('update_project_note', {
                id,
                sprintId: currentNote?.sprint_id ?? null,
                title,
                content,
                source: currentNote?.source ?? 'user',
            });
            await fetchNotes(activeSprintId);
        } catch (err) {
            console.error('Failed to update project note', err);
            toast.error(`プロジェクトノートの更新に失敗しました: ${err}`);
            throw err;
        }
    }, [activeSprintId, fetchNotes, notes]);

    const deleteNote = useCallback(async (id: string) => {
        try {
            await invoke('delete_project_note', { id });
            await fetchNotes(activeSprintId);
        } catch (err) {
            console.error('Failed to delete project note', err);
            toast.error(`プロジェクトノートの削除に失敗しました: ${err}`);
            throw err;
        }
    }, [activeSprintId, fetchNotes]);

    return {
        notes,
        loading,
        activeSprintId,
        fetchNotes,
        addNote,
        updateNote,
        deleteNote,
    };
}
