import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    type ReactNode,
} from 'react';
import { useWorkspace } from './WorkspaceContext';
import {
    poAssistantFocusReducer,
    type FocusTarget,
    type SetFocusInput,
} from './poAssistantFocusState';

export type {
    FocusKind,
    FocusTarget,
    SetFocusInput,
} from './poAssistantFocusState';

interface PoAssistantFocusContextValue {
    focus: FocusTarget | null;
    setFocus: (target: SetFocusInput) => void;
    clearFocus: () => void;
}

const PoAssistantFocusContext = createContext<PoAssistantFocusContextValue | undefined>(undefined);

export function PoAssistantFocusProvider({ children }: { children: ReactNode }) {
    const { currentProjectId } = useWorkspace();
    const [focus, dispatch] = useReducer(poAssistantFocusReducer, null as FocusTarget | null);
    const previousProjectIdRef = useRef(currentProjectId);

    useEffect(() => {
        if (previousProjectIdRef.current === currentProjectId) {
            return;
        }

        previousProjectIdRef.current = currentProjectId;
        dispatch({ type: 'project_changed' });
    }, [currentProjectId]);

    const setFocus = useCallback((target: SetFocusInput) => {
        dispatch({ type: 'set', target });
    }, []);

    const clearFocus = useCallback(() => {
        dispatch({ type: 'clear' });
    }, []);

    const value = useMemo(
        () => ({
            focus,
            setFocus,
            clearFocus,
        }),
        [clearFocus, focus, setFocus],
    );

    return (
        <PoAssistantFocusContext.Provider value={value}>
            {children}
        </PoAssistantFocusContext.Provider>
    );
}

export function useFocus() {
    const context = useContext(PoAssistantFocusContext);
    if (context === undefined) {
        throw new Error('useFocus must be used within a PoAssistantFocusProvider');
    }
    return context;
}
