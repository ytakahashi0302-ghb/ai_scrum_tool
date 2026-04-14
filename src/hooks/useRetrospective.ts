import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';
import { useWorkspace } from '../context/WorkspaceContext';
import { RetroCategory, RetroItem, RetroSession } from '../types';

interface AddRetroItemOptions {
    source?: RetroItem['source'];
    sourceRoleId?: string | null;
    sortOrder?: number;
}

interface UpdateRetroItemOptions extends AddRetroItemOptions {}

export function useRetrospective(projectId?: string | null) {
    const { currentProjectId } = useWorkspace();
    const resolvedProjectId = projectId ?? currentProjectId;
    const [sessions, setSessions] = useState<RetroSession[]>([]);
    const [items, setItems] = useState<RetroItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const fetchSessions = useCallback(async () => {
        setLoading(true);
        try {
            const result = await invoke<RetroSession[]>('get_retro_sessions', {
                projectId: resolvedProjectId,
            });
            setSessions(result);
            return result;
        } catch (err) {
            console.error('Failed to fetch retrospective sessions', err);
            toast.error(`レトロセッション一覧の取得に失敗しました: ${err}`);
            return [];
        } finally {
            setLoading(false);
        }
    }, [resolvedProjectId]);

    const fetchItems = useCallback(async (sessionId: string | null) => {
        setActiveSessionId(sessionId);
        if (!sessionId) {
            setItems([]);
            return [];
        }

        setLoading(true);
        try {
            const result = await invoke<RetroItem[]>('get_retro_items', {
                retroSessionId: sessionId,
            });
            setItems(result);
            return result;
        } catch (err) {
            console.error('Failed to fetch retrospective items', err);
            toast.error(`レトロアイテムの取得に失敗しました: ${err}`);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const createSession = useCallback(async (
        sprintId: string,
        options?: { status?: RetroSession['status']; summary?: string | null },
    ) => {
        try {
            const session = await invoke<RetroSession>('create_retro_session', {
                projectId: resolvedProjectId,
                sprintId,
                status: options?.status ?? 'draft',
                summary: options?.summary ?? null,
            });
            await fetchSessions();
            return session;
        } catch (err) {
            console.error('Failed to create retrospective session', err);
            toast.error(`レトロセッションの作成に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchSessions, resolvedProjectId]);

    const updateSessionStatus = useCallback(async (
        id: string,
        status: RetroSession['status'],
        summary?: string | null,
    ) => {
        try {
            const currentSession = sessions.find((session) => session.id === id);
            await invoke('update_retro_session', {
                id,
                status,
                summary: summary === undefined ? currentSession?.summary ?? null : summary,
            });
            await fetchSessions();
        } catch (err) {
            console.error('Failed to update retrospective session', err);
            toast.error(`レトロセッションの更新に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchSessions, sessions]);

    const addItem = useCallback(async (
        sessionId: string,
        category: RetroCategory,
        content: string,
        options?: AddRetroItemOptions,
    ) => {
        try {
            const nextSortOrder = options?.sortOrder ?? items.filter((item) => item.category === category).length;
            const item = await invoke<RetroItem>('add_retro_item', {
                retroSessionId: sessionId,
                category,
                content,
                source: options?.source ?? 'user',
                sourceRoleId: options?.sourceRoleId ?? null,
                sortOrder: nextSortOrder,
            });
            if (activeSessionId === sessionId) {
                await fetchItems(sessionId);
            }
            return item;
        } catch (err) {
            console.error('Failed to add retrospective item', err);
            toast.error(`レトロアイテムの追加に失敗しました: ${err}`);
            throw err;
        }
    }, [activeSessionId, fetchItems, items]);

    const updateItem = useCallback(async (
        id: string,
        content: string,
        category: RetroCategory,
        options?: UpdateRetroItemOptions,
    ) => {
        try {
            const currentItem = items.find((item) => item.id === id);
            await invoke('update_retro_item', {
                id,
                category,
                content,
                source: options?.source ?? currentItem?.source ?? 'user',
                sourceRoleId: options?.sourceRoleId ?? currentItem?.source_role_id ?? null,
                sortOrder: options?.sortOrder ?? currentItem?.sort_order ?? 0,
            });
            if (activeSessionId) {
                await fetchItems(activeSessionId);
            }
        } catch (err) {
            console.error('Failed to update retrospective item', err);
            toast.error(`レトロアイテムの更新に失敗しました: ${err}`);
            throw err;
        }
    }, [activeSessionId, fetchItems, items]);

    const deleteItem = useCallback(async (id: string) => {
        try {
            await invoke('delete_retro_item', { id });
            if (activeSessionId) {
                await fetchItems(activeSessionId);
            }
        } catch (err) {
            console.error('Failed to delete retrospective item', err);
            toast.error(`レトロアイテムの削除に失敗しました: ${err}`);
            throw err;
        }
    }, [activeSessionId, fetchItems]);

    const approveItem = useCallback(async (id: string) => {
        try {
            await invoke('approve_retro_item', { id });
            if (activeSessionId) {
                await fetchItems(activeSessionId);
            }
        } catch (err) {
            console.error('Failed to approve retrospective item', err);
            toast.error(`レトロアイテムの承認に失敗しました: ${err}`);
            throw err;
        }
    }, [activeSessionId, fetchItems]);

    return {
        sessions,
        items,
        loading,
        activeSessionId,
        fetchSessions,
        fetchItems,
        createSession,
        updateSessionStatus,
        addItem,
        updateItem,
        deleteItem,
        approveItem,
    };
}
