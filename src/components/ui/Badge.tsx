import { Story, Task } from '../../types';
import { cn } from './Modal';

type BadgePriorityLevel = 1 | 2 | 3 | 4 | 5;
type BadgeStatus = Task['status'] | Story['status'];

interface BadgeProps {
    variant: 'priority' | 'status';
    level?: BadgePriorityLevel | number;
    status?: BadgeStatus;
    className?: string;
}

const PRIORITY_STYLES: Record<BadgePriorityLevel, string> = {
    1: 'border-red-200 bg-red-100 text-red-700',
    2: 'border-orange-200 bg-orange-100 text-orange-700',
    3: 'border-yellow-200 bg-yellow-100 text-yellow-700',
    4: 'border-blue-200 bg-blue-100 text-blue-600',
    5: 'border-slate-200 bg-slate-100 text-slate-500',
};

const STATUS_STYLES: Record<BadgeStatus, { label: string; className: string }> = {
    Backlog: {
        label: 'バックログ',
        className: 'border-slate-200 bg-slate-100 text-slate-700',
    },
    Ready: {
        label: '準備完了',
        className: 'border-slate-200 bg-slate-100 text-slate-700',
    },
    'To Do': {
        label: '未着手',
        className: 'border-slate-200 bg-slate-100 text-slate-700',
    },
    'In Progress': {
        label: '進行中',
        className: 'border-blue-200 bg-blue-100 text-blue-700',
    },
    Review: {
        label: 'レビュー',
        className: 'border-amber-200 bg-amber-100 text-amber-800',
    },
    Done: {
        label: '完了',
        className: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    },
};

function normalizePriorityLevel(level?: BadgePriorityLevel | number): BadgePriorityLevel {
    if (!level || level <= 1) return 1;
    if (level === 2) return 2;
    if (level === 3) return 3;
    if (level === 4) return 4;
    return 5;
}

export function Badge({ variant, level = 3, status, className }: BadgeProps) {
    if (variant === 'priority') {
        const normalizedLevel = normalizePriorityLevel(level);
        return (
            <span
                className={cn(
                    'inline-flex items-center whitespace-nowrap rounded-badge border px-1.5 py-0.5 text-xs font-medium',
                    PRIORITY_STYLES[normalizedLevel],
                    className,
                )}
            >
                P{normalizedLevel}
            </span>
        );
    }

    if (!status) {
        return null;
    }

    return (
        <span
            className={cn(
                'inline-flex items-center whitespace-nowrap rounded-badge border px-1.5 py-0.5 text-xs font-medium',
                STATUS_STYLES[status].className,
                className,
            )}
        >
            {STATUS_STYLES[status].label}
        </span>
    );
}
