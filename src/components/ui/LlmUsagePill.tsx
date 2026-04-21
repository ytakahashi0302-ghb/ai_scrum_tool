import { useState } from 'react';
import { Coins } from 'lucide-react';
import { useLlmUsageSummary } from '../../hooks/useLlmUsageSummary';

function formatTokenCount(value: number) {
    return new Intl.NumberFormat('ja-JP').format(value);
}

function formatEstimatedCost(value: number) {
    return `~$${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : value >= 1 ? 2 : 3)}`;
}

export function LlmUsagePill({ projectId }: { projectId: string }) {
    const { summary, loading, error } = useLlmUsageSummary(projectId);
    const [isTooltipOpen, setIsTooltipOpen] = useState(false);

    if (!projectId) {
        return null;
    }

    const projectTokens = summary?.project_totals.total_tokens ?? 0;
    const projectCost = summary?.project_totals.estimated_cost_usd ?? 0;
    const sprintTokens = summary?.active_sprint_totals.total_tokens ?? 0;
    const sprintCost = summary?.active_sprint_totals.estimated_cost_usd ?? 0;

    const primaryLabel =
        loading && !summary
            ? '読み込み中...'
            : `${formatTokenCount(projectTokens)} token / ${formatEstimatedCost(projectCost)}`;

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsTooltipOpen(true)}
            onMouseLeave={() => setIsTooltipOpen(false)}
            onFocus={() => setIsTooltipOpen(true)}
            onBlur={() => setIsTooltipOpen(false)}
        >
            <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={error ? `LLM usage の取得に失敗しました: ${error}` : undefined}
            >
                <Coins size={15} className="text-slate-500" />
                <span className="tabular-nums text-slate-900">{primaryLabel}</span>
            </button>

            {isTooltipOpen && !error && (
                <div
                    role="tooltip"
                    className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg"
                >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        LLM 利用量
                    </div>
                    <div className="mt-2 space-y-2">
                        <div>
                            <div className="text-[11px] font-semibold text-slate-500">Project</div>
                            <div className="tabular-nums text-slate-900">
                                {formatTokenCount(projectTokens)} token / {formatEstimatedCost(projectCost)}
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] font-semibold text-slate-500">
                                Active Sprint
                            </div>
                            <div className="tabular-nums text-slate-900">
                                {formatTokenCount(sprintTokens)} token / {formatEstimatedCost(sprintCost)}
                            </div>
                        </div>
                        {summary && summary.project_totals.unavailable_event_count > 0 && (
                            <div className="text-[11px] text-amber-600">
                                未計測イベント: {summary.project_totals.unavailable_event_count} 件
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
