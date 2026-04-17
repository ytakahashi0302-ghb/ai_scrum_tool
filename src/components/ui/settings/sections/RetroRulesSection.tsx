import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Shield, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRetroRules } from '../../../../hooks/useRetroRules';
import { RetroRule } from '../../../../types';

/**
 * RetroRulesSection — レトロルール管理セクション (Epic 53)
 *
 * 設定画面でレトロスペクティブのルールを管理する。
 * - ルール一覧表示（内容、ON/OFF、作成日時）
 * - 有効/無効トグル
 * - ルール内容のインライン編集
 * - ルール削除（確認付き）
 * - 手動での新規ルール追加
 */
export function RetroRulesSection() {
    const { rules, loading, fetchRules, addRule, updateRule, deleteRule } = useRetroRules();
    const [newRuleContent, setNewRuleContent] = useState('');
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [workingId, setWorkingId] = useState<string | null>(null);
    const editRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        void fetchRules();
    }, [fetchRules]);

    useEffect(() => {
        if (editingId && editRef.current) {
            editRef.current.focus();
        }
    }, [editingId]);

    const handleAdd = async () => {
        const content = newRuleContent.trim();
        if (!content) {
            toast.error('ルール内容を入力してください。');
            return;
        }
        setAdding(true);
        try {
            await addRule(content);
            setNewRuleContent('');
        } finally {
            setAdding(false);
        }
    };

    const beginEdit = (rule: RetroRule) => {
        setEditingId(rule.id);
        setEditingContent(rule.content);
    };

    const handleSaveEdit = async (rule: RetroRule) => {
        const content = editingContent.trim();
        if (!content) {
            toast.error('ルール内容を入力してください。');
            return;
        }
        setWorkingId(rule.id);
        try {
            await updateRule(rule.id, content, rule.is_active);
            setEditingId(null);
        } finally {
            setWorkingId(null);
        }
    };

    const handleToggle = async (rule: RetroRule) => {
        setWorkingId(rule.id);
        try {
            await updateRule(rule.id, rule.content, !rule.is_active);
        } finally {
            setWorkingId(null);
        }
    };

    const handleDelete = async (rule: RetroRule) => {
        if (!window.confirm(`このルールを削除しますか？\n\n${rule.content}`)) return;
        setWorkingId(rule.id);
        try {
            await deleteRule(rule.id);
        } finally {
            setWorkingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* 手動追加フォーム */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">新規ルールを手動追加</h3>
                <textarea
                    value={newRuleContent}
                    onChange={(e) => setNewRuleContent(e.target.value)}
                    placeholder="エージェントに守らせたいルールを入力してください"
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-3 flex justify-end">
                    <button
                        type="button"
                        onClick={() => void handleAdd()}
                        disabled={adding || !newRuleContent.trim()}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                        {adding ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Plus size={14} />
                        )}
                        ルールを追加
                    </button>
                </div>
            </div>

            {/* ルール一覧 */}
            <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900">ルール一覧</h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                            ON のルールはエージェントのタスク実行プロンプトに自動注入されます
                        </p>
                    </div>
                    {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
                </div>

                {rules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <Shield size={18} />
                        </div>
                        <p className="text-sm text-slate-500">
                            ルールがまだありません。<br />
                            レトロの「承認済み Try 一覧」でトグルをONにするか、上のフォームから手動追加できます。
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {rules.map((rule) => {
                            const isEditing = editingId === rule.id;
                            const isWorking = workingId === rule.id;

                            return (
                                <div key={rule.id} className="flex items-start gap-4 px-5 py-4">
                                    {/* ON/OFF トグル */}
                                    <button
                                        type="button"
                                        onClick={() => void handleToggle(rule)}
                                        disabled={isWorking || isEditing}
                                        title={rule.is_active ? 'クリックで無効化' : 'クリックで有効化'}
                                        className={`mt-0.5 shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                            isWorking
                                                ? 'border-slate-200 bg-slate-50 text-slate-400'
                                                : rule.is_active
                                                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                  : 'border-slate-200 bg-white text-slate-400 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                                        }`}
                                    >
                                        {isWorking ? (
                                            <Loader2 size={10} className="animate-spin" />
                                        ) : (
                                            <Shield size={10} />
                                        )}
                                        {rule.is_active ? 'ON' : 'OFF'}
                                    </button>

                                    {/* ルール内容 */}
                                    <div className="min-w-0 flex-1">
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <textarea
                                                    ref={editRef}
                                                    value={editingContent}
                                                    onChange={(e) => setEditingContent(e.target.value)}
                                                    rows={3}
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleSaveEdit(rule)}
                                                        disabled={isWorking}
                                                        className="rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                                    >
                                                        {isWorking ? '保存中...' : '保存'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingId(null)}
                                                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                                    >
                                                        キャンセル
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className="w-full text-left text-sm leading-6 text-slate-800 hover:text-blue-700"
                                                onClick={() => beginEdit(rule)}
                                                title="クリックして編集"
                                            >
                                                {rule.content}
                                            </button>
                                        )}
                                        <div className="mt-1 text-[11px] text-slate-400">
                                            {new Date(rule.created_at).toLocaleDateString('ja-JP')}
                                            {rule.retro_item_id && (
                                                <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                                                    レトロ由来
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 削除ボタン */}
                                    <button
                                        type="button"
                                        onClick={() => void handleDelete(rule)}
                                        disabled={isWorking || isEditing}
                                        title="ルールを削除"
                                        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                                    >
                                        {isWorking ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={14} />
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
