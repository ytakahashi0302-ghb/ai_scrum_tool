import { openUrl } from '@tauri-apps/plugin-opener';
import {
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    KeyRound,
    Loader2,
    RefreshCw,
    Wrench,
    XCircle,
} from 'lucide-react';
import { Button } from './Button';
import { CliDetectionResult } from '../../hooks/useCliDetection';

export interface ApiKeyStatus {
    name: string;
    display_name: string;
    configured: boolean;
}

interface GitStatus {
    checked: boolean;
    installed: boolean;
    version: string | null;
    message: string | null;
}

interface SetupStatusTabProps {
    gitStatus: GitStatus;
    cliResults: CliDetectionResult[];
    cliLoading: boolean;
    cliError: string | null;
    apiKeyStatuses: ApiKeyStatus[];
    apiLoading: boolean;
    apiError: string | null;
    isRefreshing: boolean;
    onRefresh: () => Promise<void> | void;
}

type StatusTone = 'success' | 'warning' | 'error' | 'pending';

interface StatusRow {
    key: string;
    label: string;
    status: string;
    tone: StatusTone;
    actionLabel?: string;
    actionUrl?: string;
}

const INSTALL_LINKS: Record<string, string> = {
    git: 'https://git-scm.com/downloads',
    claude: 'https://docs.anthropic.com/en/docs/claude-code/quickstart',
    gemini: 'https://github.com/google-gemini/gemini-cli',
    codex: 'https://developers.openai.com/codex/cli',
};

function getStatusIcon(tone: StatusTone) {
    switch (tone) {
        case 'success':
            return <CheckCircle2 size={16} className="text-emerald-600" />;
        case 'warning':
            return <AlertTriangle size={16} className="text-amber-500" />;
        case 'error':
            return <XCircle size={16} className="text-rose-600" />;
        case 'pending':
            return <Loader2 size={16} className="animate-spin text-slate-400" />;
    }
}

function getStatusClasses(tone: StatusTone) {
    switch (tone) {
        case 'success':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        case 'warning':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        case 'error':
            return 'border-rose-200 bg-rose-50 text-rose-700';
        case 'pending':
            return 'border-slate-200 bg-slate-50 text-slate-500';
    }
}

function buildToolRows(gitStatus: GitStatus, cliResults: CliDetectionResult[]): StatusRow[] {
    const cliResultMap = new Map(cliResults.map((result) => [result.name, result]));

    const gitRow: StatusRow = !gitStatus.checked
        ? {
              key: 'git',
              label: 'Git',
              status: '確認中...',
              tone: 'pending',
          }
        : gitStatus.installed
          ? {
                key: 'git',
                label: 'Git',
                status: gitStatus.version ?? 'インストール済み',
                tone: 'success',
            }
          : {
                key: 'git',
                label: 'Git',
                status: '未検出',
                tone: 'error',
                actionLabel: '導入方法',
                actionUrl: INSTALL_LINKS.git,
            };

    const cliRows: StatusRow[] = [
        {
            key: 'claude',
            label: 'Claude Code CLI',
        },
        {
            key: 'gemini',
            label: 'Gemini CLI',
        },
        {
            key: 'codex',
            label: 'Codex CLI',
        },
    ].map((tool) => {
        const result = cliResultMap.get(tool.key);

        if (!result) {
            return {
                key: tool.key,
                label: tool.label,
                status: '確認中...',
                tone: 'pending',
            };
        }

        if (result.installed) {
            return {
                key: tool.key,
                label: tool.label,
                status: result.version ?? 'インストール済み',
                tone: 'success',
            };
        }

        return {
            key: tool.key,
            label: tool.label,
            status: '未検出',
            tone: 'error',
            actionLabel: '導入方法',
            actionUrl: INSTALL_LINKS[tool.key],
        };
    });

    return [gitRow, ...cliRows];
}

function buildApiKeyRows(apiKeyStatuses: ApiKeyStatus[]): StatusRow[] {
    const apiKeyStatusMap = new Map(apiKeyStatuses.map((status) => [status.name, status]));

    return [
        {
            key: 'anthropic',
            label: 'Anthropic',
        },
        {
            key: 'gemini',
            label: 'Gemini',
        },
    ].map((provider) => {
        const status = apiKeyStatusMap.get(provider.key);

        if (!status) {
            return {
                key: provider.key,
                label: provider.label,
                status: '確認中...',
                tone: 'pending',
            };
        }

        return {
            key: provider.key,
            label: provider.label,
            status: status.configured ? '設定済み' : '未設定',
            tone: status.configured ? 'success' : 'warning',
        };
    });
}

function StatusTable({ rows }: { rows: StatusRow[] }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {rows.map((row, index) => (
                <div
                    key={row.key}
                    className={`grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_minmax(180px,0.9fr)_auto] md:items-center ${
                        index !== rows.length - 1 ? 'border-b border-slate-100' : ''
                    }`}
                >
                    <div className="text-sm font-medium text-slate-800">{row.label}</div>
                    <div>
                        <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${getStatusClasses(row.tone)}`}
                        >
                            {getStatusIcon(row.tone)}
                            <span>{row.status}</span>
                        </span>
                    </div>
                    <div className="flex justify-start md:justify-end">
                        {row.actionLabel && row.actionUrl ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-700 hover:bg-slate-100"
                                onClick={() => void openUrl(row.actionUrl!)}
                            >
                                {row.actionLabel}
                                <ExternalLink size={14} className="ml-2" />
                            </Button>
                        ) : (
                            <span className="text-xs text-slate-400">-</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function SetupStatusTab({
    gitStatus,
    cliResults,
    cliLoading,
    cliError,
    apiKeyStatuses,
    apiLoading,
    apiError,
    isRefreshing,
    onRefresh,
}: SetupStatusTabProps) {
    const toolRows = buildToolRows(gitStatus, cliResults);
    const apiKeyRows = buildApiKeyRows(apiKeyStatuses);
    const isLoading = cliLoading || apiLoading || !gitStatus.checked;

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-3xl">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                            Setup Dashboard
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-slate-900">
                            セットアップ状況
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            Git、CLI ツール、API キーの準備状態をまとめて確認できます。未セットアップ項目はこの画面からすぐ導入手順へ移動できます。
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void onRefresh()}
                        disabled={isRefreshing}
                        className="shrink-0 whitespace-nowrap border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                        <RefreshCw size={16} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        今すぐ再検出
                    </Button>
                </div>
            </div>

            {cliError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    CLI 検出の再実行に失敗しました: {cliError}
                </div>
            )}

            {apiError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    API キー設定の確認に失敗しました: {apiError}
                </div>
            )}

            {gitStatus.checked && !gitStatus.installed && gitStatus.message && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Git の確認結果: {gitStatus.message}
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                        <Wrench size={18} />
                    </div>
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                            Development Tools
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">開発ツール</h4>
                    </div>
                </div>

                <div className="mt-4">
                    <StatusTable rows={toolRows} />
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <KeyRound size={18} />
                    </div>
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">
                            API Keys
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">API キー</h4>
                    </div>
                </div>

                <div className="mt-4">
                    <StatusTable rows={apiKeyRows} />
                </div>
            </div>

            <div className="grid gap-3">
                <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
                    Dev エージェント機能には、最低 1 つの CLI ツール + Git が必要です。
                </div>
                <div className="rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-900">
                    PO アシスタント機能には、API キー設定 または CLI ツールが必要です。
                </div>
                {isLoading && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        現在のセットアップ状況を確認しています...
                    </div>
                )}
            </div>
        </div>
    );
}
