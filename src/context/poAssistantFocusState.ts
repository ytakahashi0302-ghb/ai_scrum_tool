export type FocusKind = 'story' | 'task';

export interface FocusTarget {
    kind: FocusKind;
    id: string;
    pinnedAt: string;
}

export type SetFocusInput = Omit<FocusTarget, 'pinnedAt'> & {
    pinnedAt?: string;
};

export type FocusStateAction =
    | {
          type: 'set';
          target: SetFocusInput;
          now?: () => string;
      }
    | {
          type: 'clear';
      }
    | {
          type: 'project_changed';
      };

export function buildFocusTarget(
    target: SetFocusInput,
    now: () => string = () => new Date().toISOString(),
): FocusTarget {
    return {
        kind: target.kind,
        id: target.id,
        pinnedAt: target.pinnedAt ?? now(),
    };
}

export function poAssistantFocusReducer(
    _state: FocusTarget | null,
    action: FocusStateAction,
): FocusTarget | null {
    if (action.type === 'set') {
        return buildFocusTarget(action.target, action.now);
    }

    return null;
}
