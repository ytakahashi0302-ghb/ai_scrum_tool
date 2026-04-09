import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface CliDetectionResult {
    name: string;
    display_name: string;
    installed: boolean;
    version: string | null;
}

interface UseCliDetectionResult {
    results: CliDetectionResult[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

let cachedResults: CliDetectionResult[] | null = null;
let inFlightRequest: Promise<CliDetectionResult[]> | null = null;

async function fetchCliDetectionResults(forceRefresh = false): Promise<CliDetectionResult[]> {
    if (!forceRefresh && cachedResults !== null) {
        return cachedResults;
    }

    if (!forceRefresh && inFlightRequest !== null) {
        return inFlightRequest;
    }

    const request = invoke<CliDetectionResult[]>('detect_installed_clis')
        .then((results) => {
            cachedResults = results;
            return results;
        })
        .finally(() => {
            inFlightRequest = null;
        });

    inFlightRequest = request;
    return request;
}

export function useCliDetection(): UseCliDetectionResult {
    const [results, setResults] = useState<CliDetectionResult[]>(() => cachedResults ?? []);
    const [loading, setLoading] = useState(cachedResults === null);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const nextResults = await fetchCliDetectionResults(true);
            setResults(nextResults);
            setError(null);
        } catch (err) {
            const message = String(err);
            console.error('Failed to refresh CLI detection results', err);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (cachedResults !== null) {
                setResults(cachedResults);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const nextResults = await fetchCliDetectionResults();
                if (!cancelled) {
                    setResults(nextResults);
                    setError(null);
                }
            } catch (err) {
                const message = String(err);
                console.error('Failed to detect installed CLIs', err);
                if (!cancelled) {
                    setError(message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, []);

    return {
        results,
        loading,
        error,
        refresh,
    };
}
