import type { ComponentType, ReactNode } from 'react';
import { cn } from './Modal';

/**
 * EdgeTabHandle (EPIC45 v2)
 *
 * 画面端に貼り付く統一デザインのタブハンドル。設定ドロワー (左端)、
 * POアシスタント (右端)、チームの稼働状況 (下端) の開閉トリガを
 * 共通パターンとして提供する。
 *
 * スタイルルール:
 *  - base: bg-slate-50 / text-slate-600 / border-slate-200 / shadow-md
 *  - active: ring-2 ring-blue-500 + border-slate-300
 *  - hover: text-blue-600
 *  - radius: rounded-xl 統一
 */

type EdgeSide = 'left' | 'right' | 'bottom';

interface EdgeTabHandleProps {
    side: EdgeSide;
    label: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    active?: boolean;
    onClick: () => void;
    title?: string;
    badge?: ReactNode;
    className?: string;
}

function sideContainerClasses(side: EdgeSide, active: boolean): string {
    // 画面端に固定する絶対配置 + 角丸の向きを 1 箇所に集約
    const base =
        'pointer-events-auto bg-white/95 text-slate-700 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.55)] backdrop-blur-sm transition-[border-color,box-shadow,color,background-color] duration-200';
    const radius =
        side === 'left'
            ? 'rounded-r-xl'
            : side === 'right'
              ? 'rounded-l-xl'
              : 'rounded-t-xl';
    const border =
        side === 'left'
            ? 'border border-l-0 border-slate-300'
            : side === 'right'
              ? 'border border-r-0 border-slate-300'
              : 'border border-b-0 border-slate-300';
    const activeState = active
        ? 'bg-white text-slate-900 border-slate-400 ring-1 ring-blue-500/55 shadow-[0_14px_30px_-20px_rgba(37,99,235,0.5)]'
        : 'hover:border-slate-400 hover:bg-white hover:text-slate-900';
    return cn(base, radius, border, activeState);
}

function sideLayoutClasses(side: EdgeSide): string {
    if (side === 'bottom') {
        return 'flex h-9 items-center gap-2 px-4 text-xs font-semibold';
    }
    // left / right: 縦書き。高さを稼ぎ、文字は縦方向に並べる
    return 'flex w-9 flex-col items-center justify-center gap-2 py-4 text-xs font-semibold';
}

export function EdgeTabHandle({
    side,
    label,
    icon: Icon,
    active = false,
    onClick,
    title,
    badge,
    className,
}: EdgeTabHandleProps) {
    const isVertical = side === 'left' || side === 'right';
    const isDotBadge = badge === '●';

    return (
        <button
            type="button"
            onClick={onClick}
            title={title ?? label}
            aria-pressed={active}
            className={cn(
                sideContainerClasses(side, active),
                sideLayoutClasses(side),
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                className,
            )}
        >
            <Icon size={16} className="shrink-0" />
            <span
                className={cn(
                    'whitespace-nowrap tracking-[0.12em] uppercase',
                    isVertical && '[writing-mode:vertical-rl] [text-orientation:mixed]',
                )}
            >
                {label}
            </span>
            {badge && (
                isDotBadge ? (
                    <span
                        aria-hidden="true"
                        className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_0_2px_rgba(255,255,255,0.92)]"
                    />
                ) : (
                    <span className="inline-flex min-w-[18px] items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        {badge}
                    </span>
                )
            )}
        </button>
    );
}
