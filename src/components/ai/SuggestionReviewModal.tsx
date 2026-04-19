import { TaskStatus } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface ReviewTaskSnapshot {
    title: string;
    description: string;
    priority: number;
    status: TaskStatus;
}

interface SuggestionReviewModalProps {
    isOpen: boolean;
    current: ReviewTaskSnapshot;
    suggested: ReviewTaskSnapshot;
    onApply: () => void;
    onCancel: () => void;
    isApplyDisabled?: boolean;
    applyDisabledReason?: string;
}

interface DiffRow {
    before: string | null;
    beforeType: 'removed' | 'unchanged' | 'empty';
    after: string | null;
    afterType: 'added' | 'unchanged' | 'empty';
}

function getPriorityBadgeClass(priority: number) {
    if (priority <= 1) return 'border-red-200 bg-red-100 text-red-700';
    if (priority === 2) return 'border-orange-200 bg-orange-100 text-orange-700';
    if (priority === 3) return 'border-yellow-200 bg-yellow-100 text-yellow-700';
    if (priority === 4) return 'border-blue-200 bg-blue-100 text-blue-600';
    return 'border-gray-200 bg-gray-100 text-gray-500';
}

function getStatusBadgeClass(status: TaskStatus) {
    if (status === 'Done') return 'border-emerald-200 bg-emerald-100 text-emerald-700';
    if (status === 'Review') return 'border-amber-200 bg-amber-100 text-amber-700';
    if (status === 'In Progress') return 'border-blue-200 bg-blue-100 text-blue-700';
    return 'border-slate-200 bg-slate-100 text-slate-600';
}

function buildAlignedDiffRows(beforeText: string, afterText: string): DiffRow[] {
    const beforeLines = beforeText.split(/\r\n?|\n/);
    const afterLines = afterText.split(/\r\n?|\n/);
    const lcsLengths = Array.from({ length: beforeLines.length + 1 }, () =>
        Array(afterLines.length + 1).fill(0),
    );

    for (let beforeIndex = beforeLines.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
        for (let afterIndex = afterLines.length - 1; afterIndex >= 0; afterIndex -= 1) {
            if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
                lcsLengths[beforeIndex][afterIndex] = lcsLengths[beforeIndex + 1][afterIndex + 1] + 1;
            } else {
                lcsLengths[beforeIndex][afterIndex] = Math.max(
                    lcsLengths[beforeIndex + 1][afterIndex],
                    lcsLengths[beforeIndex][afterIndex + 1],
                );
            }
        }
    }

    const rows: DiffRow[] = [];
    let beforeIndex = 0;
    let afterIndex = 0;

    while (beforeIndex < beforeLines.length || afterIndex < afterLines.length) {
        if (
            beforeIndex < beforeLines.length &&
            afterIndex < afterLines.length &&
            beforeLines[beforeIndex] === afterLines[afterIndex]
        ) {
            rows.push({
                before: beforeLines[beforeIndex],
                beforeType: 'unchanged',
                after: afterLines[afterIndex],
                afterType: 'unchanged',
            });
            beforeIndex += 1;
            afterIndex += 1;
            continue;
        }

        if (
            afterIndex >= afterLines.length ||
            (beforeIndex < beforeLines.length &&
                lcsLengths[beforeIndex + 1][afterIndex] >= lcsLengths[beforeIndex][afterIndex + 1])
        ) {
            rows.push({
                before: beforeLines[beforeIndex],
                beforeType: 'removed',
                after: null,
                afterType: 'empty',
            });
            beforeIndex += 1;
            continue;
        }

        rows.push({
            before: null,
            beforeType: 'empty',
            after: afterLines[afterIndex],
            afterType: 'added',
        });
        afterIndex += 1;
    }

    return rows;
}

function renderDiffCell(content: string | null, type: DiffRow['beforeType' | 'afterType']) {
    if (type === 'empty') {
        return <div className="min-h-8 rounded-md border border-dashed border-slate-200 bg-slate-50" />;
    }

    const className =
        type === 'added'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : type === 'removed'
              ? 'border-rose-200 bg-rose-50 text-rose-900 line-through'
              : 'border-slate-200 bg-white text-slate-700';

    return (
        <div className={`min-h-8 rounded-md border px-3 py-2 text-sm whitespace-pre-wrap ${className}`}>
            {content || '\u00A0'}
        </div>
    );
}

export function SuggestionReviewModal({
    isOpen,
    current,
    suggested,
    onApply,
    onCancel,
    isApplyDisabled = false,
    applyDisabledReason,
}: SuggestionReviewModalProps) {
    const titleRows = buildAlignedDiffRows(current.title, suggested.title);
    const descriptionRows = buildAlignedDiffRows(current.description, suggested.description);

    return (
        <Modal isOpen={isOpen} onClose={onCancel} width="xl" title="AI 提案の確認">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-sm font-medium text-slate-600">現在のステータス</span>
                    <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(current.status)}`}
                    >
                        {current.status}
                    </span>
                    {isApplyDisabled && applyDisabledReason && (
                        <span className="text-xs text-amber-700">{applyDisabledReason}</span>
                    )}
                </div>

                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">タイトル差分</h3>
                        <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                            Current / Suggested
                        </div>
                    </div>
                    <div className="grid gap-2">
                        {titleRows.map((row, index) => (
                            <div key={`title-${index}`} className="grid gap-2 md:grid-cols-2">
                                {renderDiffCell(row.before, row.beforeType)}
                                {renderDiffCell(row.after, row.afterType)}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">説明差分</h3>
                        <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                            Current / Suggested
                        </div>
                    </div>
                    <div className="grid gap-2">
                        {descriptionRows.map((row, index) => (
                            <div
                                key={`description-${index}`}
                                className="grid gap-2 md:grid-cols-2"
                            >
                                {renderDiffCell(row.before, row.beforeType)}
                                {renderDiffCell(row.after, row.afterType)}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">優先度差分</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                                Current
                            </div>
                            <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getPriorityBadgeClass(current.priority)}`}
                            >
                                P{current.priority}
                            </span>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                            <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-emerald-500">
                                Suggested
                            </div>
                            <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getPriorityBadgeClass(suggested.priority)}`}
                            >
                                P{suggested.priority}
                            </span>
                        </div>
                    </div>
                </section>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        破棄
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={onApply}
                        disabled={isApplyDisabled}
                        title={applyDisabledReason}
                    >
                        この内容で編集モーダルを開く
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
