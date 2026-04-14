import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';
import { useWorkspace } from '../context/WorkspaceContext';
import { RetroRule } from '../types';

interface AddRetroRuleOptions {
    retroItemId?: string | null;
    sprintId?: string | null;
    isActive?: boolean;
}

interface UpdateRetroRuleOptions {
    retroItemId?: string | null;
    sprintId?: string | null;
}

export function useRetroRules(projectId?: string | null) {
    const { currentProjectId } = useWorkspace();
    const resolvedProjectId = projectId ?? currentProjectId;
    const [rules, setRules] = useState<RetroRule[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchRules = useCallback(async () => {
        setLoading(true);
        try {
            const result = await invoke<RetroRule[]>('get_retro_rules', {
                projectId: resolvedProjectId,
            });
            setRules(result);
            return result;
        } catch (err) {
            console.error('Failed to fetch retro rules', err);
            toast.error(`レトロルールの取得に失敗しました: ${err}`);
            return [];
        } finally {
            setLoading(false);
        }
    }, [resolvedProjectId]);

    const addRule = useCallback(async (
        content: string,
        retroItemId?: string | null,
        options?: Omit<AddRetroRuleOptions, 'retroItemId'>,
    ) => {
        try {
            const rule = await invoke<RetroRule>('add_retro_rule', {
                projectId: resolvedProjectId,
                retroItemId: retroItemId ?? null,
                sprintId: options?.sprintId ?? null,
                content,
                isActive: options?.isActive ?? true,
            });
            await fetchRules();
            return rule;
        } catch (err) {
            console.error('Failed to add retro rule', err);
            toast.error(`レトロルールの追加に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchRules, resolvedProjectId]);

    const updateRule = useCallback(async (
        id: string,
        content: string,
        isActive: boolean,
        options?: UpdateRetroRuleOptions,
    ) => {
        try {
            const currentRule = rules.find((rule) => rule.id === id);
            await invoke('update_retro_rule', {
                id,
                retroItemId: options?.retroItemId ?? currentRule?.retro_item_id ?? null,
                sprintId: options?.sprintId ?? currentRule?.sprint_id ?? null,
                content,
                isActive,
            });
            await fetchRules();
        } catch (err) {
            console.error('Failed to update retro rule', err);
            toast.error(`レトロルールの更新に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchRules, rules]);

    const deleteRule = useCallback(async (id: string) => {
        try {
            await invoke('delete_retro_rule', { id });
            await fetchRules();
        } catch (err) {
            console.error('Failed to delete retro rule', err);
            toast.error(`レトロルールの削除に失敗しました: ${err}`);
            throw err;
        }
    }, [fetchRules]);

    return {
        rules,
        loading,
        fetchRules,
        addRule,
        updateRule,
        deleteRule,
    };
}
