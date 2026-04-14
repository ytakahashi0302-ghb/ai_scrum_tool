import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Story } from '../types';
import toast from 'react-hot-toast';
import { useWorkspace } from '../context/WorkspaceContext';

export function useStories() {
    const { currentProjectId } = useWorkspace();
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchStories = useCallback(async () => {
        setLoading(true);
        try {
            const result = await invoke<Story[]>('get_stories', { projectId: currentProjectId });
            setStories(result);
        } catch (err) {
            console.error('Failed to fetch stories', err);
            toast.error(`ストーリーの取得に失敗しました: ${err}`);
        } finally {
            setLoading(false);
        }
    }, [currentProjectId]);

    const addStory = useCallback(async (story: Omit<Story, 'created_at' | 'updated_at' | 'project_id' | 'sequence_number'>) => {
        try {
            await invoke('add_story', {
                id: story.id,
                title: story.title,
                description: story.description,
                acceptanceCriteria: story.acceptance_criteria,
                status: story.status,
                priority: story.priority ?? 3,
                projectId: currentProjectId
            });
            await fetchStories();
        } catch (err) {
            console.error('Failed to add story', err);
            toast.error(`ストーリーの作成に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchStories, currentProjectId]);

    const updateStory = useCallback(async (story: Story) => {
        try {
            await invoke('update_story', {
                id: story.id,
                title: story.title,
                description: story.description,
                acceptanceCriteria: story.acceptance_criteria,
                status: story.status,
                priority: story.priority ?? 3
            });
            await fetchStories();
        } catch (err) {
            console.error('Failed to update story', err);
            toast.error(`ストーリーの更新に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchStories]);

    const deleteStory = useCallback(async (id: string) => {
        try {
            await invoke('delete_story', { id });
            await fetchStories();
        } catch (err) {
            console.error('Failed to delete story', err);
            toast.error(`ストーリーの削除に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchStories]);

    return {
        stories,
        loading,
        fetchStories,
        addStory,
        updateStory,
        deleteStory
    };
}
