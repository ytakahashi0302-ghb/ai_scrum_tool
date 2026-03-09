import { createContext, useContext, ReactNode } from 'react';
import { useSprintTimer as useSprintTimerHook } from '../hooks/useSprintTimer';
import { useWorkspace } from './WorkspaceContext';

type SprintTimerType = ReturnType<typeof useSprintTimerHook>;

const SprintTimerContext = createContext<SprintTimerType | undefined>(undefined);

export function SprintTimerProvider({ children }: { children: ReactNode }) {
    const { currentProjectId } = useWorkspace();
    const timer = useSprintTimerHook(currentProjectId);
    return <SprintTimerContext.Provider value={timer}>{children}</SprintTimerContext.Provider>;
}

export function useSprintTimer() {
    const context = useContext(SprintTimerContext);
    if (context === undefined) {
        throw new Error('useSprintTimer must be used within a SprintTimerProvider');
    }
    return context;
}
