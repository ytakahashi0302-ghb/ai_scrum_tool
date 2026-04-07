import { useState, useEffect, useCallback, useRef } from 'react';
import { load, Store } from '@tauri-apps/plugin-store';

export type SprintStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'TIME_UP';
export type SprintTimerStartReason = 'MANUAL' | 'SPRINT_STARTED' | 'AI_TASK_LAUNCHED';

export interface SprintState {
    status: SprintStatus;
    remainingTimeMs: number;
    durationMs: number; // 動的に設定されたスプリントの総時間
    startedAt: number | null;
    hasNotifiedHalfway: boolean; // 50%経過通知のフラグ
    linkedSprintId: string | null;
    lastStartedReason: SprintTimerStartReason | null;
}

const DEFAULT_SPRINT_TIME_MS = 1 * 60 * 60 * 1000; // 1 hour default

function buildIdleState(durationMs: number): SprintState {
    return {
        status: 'NOT_STARTED',
        remainingTimeMs: durationMs,
        durationMs,
        startedAt: null,
        hasNotifiedHalfway: false,
        linkedSprintId: null,
        lastStartedReason: null,
    };
}

function normalizeSprintState(savedState: Partial<SprintState>, durationMs: number): SprintState {
    return {
        ...buildIdleState(durationMs),
        ...savedState,
        status: savedState.status ?? 'NOT_STARTED',
        remainingTimeMs:
            typeof savedState.remainingTimeMs === 'number'
                ? savedState.remainingTimeMs
                : durationMs,
        durationMs:
            typeof savedState.durationMs === 'number' ? savedState.durationMs : durationMs,
        startedAt: typeof savedState.startedAt === 'number' ? savedState.startedAt : null,
        hasNotifiedHalfway: savedState.hasNotifiedHalfway ?? false,
        linkedSprintId:
            typeof savedState.linkedSprintId === 'string' ? savedState.linkedSprintId : null,
        lastStartedReason: savedState.lastStartedReason ?? null,
    };
}

export function useSprintTimer(projectId: string) {
    const [state, setState] = useState<SprintState>({
        ...buildIdleState(DEFAULT_SPRINT_TIME_MS),
    });
    const [isLoaded, setIsLoaded] = useState(false);
    const [actualRemainingTime, setActualRemainingTime] = useState(DEFAULT_SPRINT_TIME_MS);
    const storeRef = useRef<Store | null>(null);

    // 共通の最新設定読み込み処理
    const getLatestDurationMs = useCallback(async (): Promise<number> => {
        let durationHours = 1;
        try {
            const settingsStore = await load('settings.json');
            const savedDuration = await settingsStore.get<{ value: number }>('sprint-duration-hours');
            if (savedDuration && typeof savedDuration === 'object' && 'value' in savedDuration) {
                durationHours = Number(savedDuration.value);
            } else if (typeof savedDuration === 'number') {
                durationHours = savedDuration;
            }
        } catch (e) {
            console.error('Failed to read sprint duration from store', e);
        }
        if (!Number.isFinite(durationHours) || durationHours <= 0) {
            durationHours = 1;
        }
        return durationHours * 60 * 60 * 1000;
    }, []);

    const saveState = useCallback(async (newState: SprintState) => {
        if (storeRef.current) {
            const key = `sprintState_${projectId}`;
            await storeRef.current.set(key, newState);
            await storeRef.current.save();
        }
        setState(newState);
    }, [projectId]);

    // storeからの初期ロードおよびプロジェクト切り替え時のロード
    useEffect(() => {
        let mounted = true;
        async function initStore() {
            try {
                const store = await load('sprint.json');
                storeRef.current = store;
                const key = `sprintState_${projectId}`;
                const latestDurationMs = await getLatestDurationMs();
                const savedState = await store.get<Partial<SprintState>>(key);

                if (savedState && mounted) {
                    const normalizedState = normalizeSprintState(savedState, latestDurationMs);
                    if (normalizedState.status === 'RUNNING' && normalizedState.startedAt) {
                        const elapsed = Date.now() - normalizedState.startedAt;
                        let newRemaining = normalizedState.remainingTimeMs - elapsed;
                        if (newRemaining <= 0) {
                            normalizedState.status = 'TIME_UP';
                            normalizedState.remainingTimeMs = 0;
                            normalizedState.startedAt = null;
                            newRemaining = 0;
                        }
                        setState(normalizedState);
                        setActualRemainingTime(newRemaining);
                    } else {
                        // NOT_STARTED時は古いsprint.jsonの時間ではなく、最新のsettings.jsonの時間を優先する
                        if (normalizedState.status === 'NOT_STARTED') {
                            normalizedState.durationMs = latestDurationMs;
                            normalizedState.remainingTimeMs = latestDurationMs;
                        }
                        setState(normalizedState);
                        setActualRemainingTime(normalizedState.remainingTimeMs);
                    }
                } else if (mounted) {
                    // 対象プロジェクトの状態が存在しない場合は初期化
                    const initState = buildIdleState(latestDurationMs);
                    setState(initState);
                    setActualRemainingTime(latestDurationMs);
                }
                if (mounted) setIsLoaded(true);
            } catch (err) {
                console.error('Failed to load sprint state:', err);
                if (mounted) setIsLoaded(true);
            }
        }
        initStore();
        return () => { mounted = false; };
    }, [getLatestDurationMs, projectId]);

    // 設定変更イベントの監視（NOT_STARTED時に即時反映する）
    useEffect(() => {
        const handleSettingsUpdated = async () => {
            if (state.status === 'NOT_STARTED') {
                const latestDurationMs = await getLatestDurationMs();
                const updatedState = {
                    ...state,
                    durationMs: latestDurationMs,
                    remainingTimeMs: latestDurationMs,
                };
                setState(updatedState);
                setActualRemainingTime(latestDurationMs);
                void saveState(updatedState);
            }
        };

        window.addEventListener('settings-updated', handleSettingsUpdated);
        return () => window.removeEventListener('settings-updated', handleSettingsUpdated);
    }, [state, saveState, getLatestDurationMs]);

    // タイマーの更新と通知ロジック
    useEffect(() => {
        let intervalId: number | undefined;

        if (isLoaded && state.status === 'RUNNING' && state.startedAt) {
            intervalId = window.setInterval(() => {
                const elapsed = Date.now() - state.startedAt!;
                const newRemaining = Math.max(0, state.remainingTimeMs - elapsed);
                setActualRemainingTime(newRemaining);

                if (newRemaining <= 0) {
                    saveState({
                        ...state,
                        status: 'TIME_UP',
                        remainingTimeMs: 0,
                        startedAt: null
                    });
                } else {
                    // 折り返し地点通知（50%経過）判定
                    const halfDuration = state.durationMs / 2;
                    if (newRemaining <= halfDuration && !state.hasNotifiedHalfway) {
                        // 発火（コンポーネント側で受け取れるようイベント発行）
                        window.dispatchEvent(new CustomEvent('sprint-halfway-notification'));

                        saveState({
                            ...state,
                            hasNotifiedHalfway: true
                        });
                    }
                }
            }, 1000);
        }

        return () => clearInterval(intervalId);
    }, [isLoaded, state, saveState]);

    const getConfiguredDurationMs = useCallback(async () => {
        return getLatestDurationMs();
    }, [getLatestDurationMs]);

    const startSprint = async (options?: {
        linkedSprintId?: string | null;
        reason?: SprintTimerStartReason;
    }) => {
        const durationMs = await getLatestDurationMs();
        const nextState: SprintState = {
            status: 'RUNNING',
            remainingTimeMs: durationMs,
            durationMs,
            startedAt: Date.now(),
            hasNotifiedHalfway: false,
            linkedSprintId: options?.linkedSprintId ?? state.linkedSprintId ?? null,
            lastStartedReason: options?.reason ?? 'MANUAL',
        };

        setActualRemainingTime(durationMs);
        await saveState(nextState);
    };

    const pauseSprint = async () => {
        if (state.status === 'RUNNING') {
            await saveState({
                ...state,
                status: 'PAUSED',
                remainingTimeMs: actualRemainingTime,
                startedAt: null
            });
        }
    };

    const resumeSprint = async () => {
        if (state.status === 'PAUSED') {
            await saveState({
                ...state,
                status: 'RUNNING',
                startedAt: Date.now(),
                lastStartedReason: state.lastStartedReason ?? 'MANUAL',
            });
        }
    };

    const ensureTimerRunning = async (
        reason: SprintTimerStartReason,
        linkedSprintId: string | null = null,
    ) => {
        const nextLinkedSprintId = linkedSprintId ?? state.linkedSprintId ?? null;

        if (state.status === 'RUNNING') {
            if (
                state.linkedSprintId === nextLinkedSprintId &&
                state.lastStartedReason === reason
            ) {
                return false;
            }

            await saveState({
                ...state,
                linkedSprintId: nextLinkedSprintId,
                lastStartedReason: reason,
            });
            return false;
        }

        if (state.status === 'PAUSED') {
            await saveState({
                ...state,
                status: 'RUNNING',
                startedAt: Date.now(),
                linkedSprintId: nextLinkedSprintId,
                lastStartedReason: reason,
            });
            return true;
        }

        const durationMs = await getLatestDurationMs();
        setActualRemainingTime(durationMs);
        await saveState({
            status: 'RUNNING',
            remainingTimeMs: durationMs,
            durationMs,
            startedAt: Date.now(),
            hasNotifiedHalfway: false,
            linkedSprintId: nextLinkedSprintId,
            lastStartedReason: reason,
        });
        return true;
    };

    const completeSprint = async () => {
        await saveState({
            ...state,
            status: 'COMPLETED',
            remainingTimeMs: actualRemainingTime,
            startedAt: null,
        });
    };

    const resetSprint = async () => {
        const latestDurationMs = await getLatestDurationMs();
        setActualRemainingTime(latestDurationMs);
        await saveState(buildIdleState(latestDurationMs));
    };

    return {
        status: state.status,
        remainingTimeMs: state.status === 'RUNNING' ? actualRemainingTime : state.remainingTimeMs,
        durationMs: state.durationMs,
        linkedSprintId: state.linkedSprintId,
        lastStartedReason: state.lastStartedReason,
        isLoaded,
        getConfiguredDurationMs,
        startSprint,
        ensureTimerRunning,
        pauseSprint,
        resumeSprint,
        completeSprint,
        resetSprint
    };
}
