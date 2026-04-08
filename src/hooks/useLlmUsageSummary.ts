import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ProjectLlmUsageSummary } from '../types';

interface UsageUpdatedPayload {
    project_id: string;
    task_id?: string | null;
}

interface UseLlmUsageSummaryResult {
    summary: ProjectLlmUsageSummary | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useLlmUsageSummary(projectId: string): UseLlmUsageSummaryResult {
    const [summary, setSummary] = useState<ProjectLlmUsageSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!projectId) {
            setSummary(null);
            setError(null);
            return;
        }

        setLoading(true);
        try {
            const result = await invoke<ProjectLlmUsageSummary>('get_project_llm_usage_summary', {
                projectId,
            });
            setSummary(result);
            setError(null);
        } catch (err) {
            const message = String(err);
            console.error('Failed to fetch LLM usage summary', err);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        let isDisposed = false;

        const setup = async () => {
            const unlisten = await listen<UsageUpdatedPayload>('llm_usage_updated', (event) => {
                if (isDisposed) return;
                if (event.payload.project_id === projectId) {
                    void refresh();
                }
            });

            if (isDisposed) {
                unlisten();
            }

            return unlisten;
        };

        const unlistenPromise = setup();

        return () => {
            isDisposed = true;
            void unlistenPromise.then((unlisten) => unlisten?.());
        };
    }, [projectId, refresh]);

    return {
        summary,
        loading,
        error,
        refresh,
    };
}
