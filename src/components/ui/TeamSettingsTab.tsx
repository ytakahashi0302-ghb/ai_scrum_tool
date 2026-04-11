import { Bot, Cpu, Plus, RefreshCw, TerminalSquare, Trash2, Users } from 'lucide-react';
import { Button } from './Button';
import { AvatarImageField } from './AvatarImageField';
import { TeamConfiguration, TeamRoleSetting } from '../../types';
import type { CliDetectionResult } from '../../hooks/useCliDetection';

interface TeamSettingsTabProps {
    config: TeamConfiguration;
    validationMessages: string[];
    isLoading: boolean;
    anthropicModelsList: string[];
    geminiModelsList: string[];
    cliResults: CliDetectionResult[];
    installedCliMap: Record<SupportedCliType, boolean>;
    isCliDetectionLoading: boolean;
    isFetchingAnthropicModels: boolean;
    isFetchingGeminiModels: boolean;
    canFetchAnthropicModels: boolean;
    canFetchGeminiModels: boolean;
    onChange: (config: TeamConfiguration) => void;
    onFetchAnthropicModels: () => void;
    onFetchGeminiModels: () => void;
}

type SupportedCliType = 'claude' | 'gemini' | 'codex';

const CLI_OPTIONS: Array<{
    value: SupportedCliType;
    label: string;
    description: string;
}> = [
    {
        value: 'claude',
        label: 'Claude Code',
        description: 'Anthropic CLI',
    },
    {
        value: 'gemini',
        label: 'Gemini CLI',
        description: 'Google CLI',
    },
    {
        value: 'codex',
        label: 'Codex CLI',
        description: 'OpenAI CLI',
    },
];

const DEFAULT_MODELS: Record<SupportedCliType, string> = {
    claude: 'claude-haiku-4-5',
    gemini: 'gemini-3-flash-preview',
    codex: 'gpt-5.4-mini',
};

function normalizeCliType(value: string): SupportedCliType {
    switch (value) {
        case 'gemini':
            return 'gemini';
        case 'codex':
            return 'codex';
        default:
            return 'claude';
    }
}

function getDefaultModel(cliType: SupportedCliType): string {
    return DEFAULT_MODELS[cliType];
}

function getCliDetectionResult(
    cliType: SupportedCliType,
    cliResults: CliDetectionResult[],
): CliDetectionResult | undefined {
    return cliResults.find((result) => result.name === cliType);
}

function getCliOptionMeta(
    cliType: SupportedCliType,
    cliResults: CliDetectionResult[],
    isCliDetectionLoading: boolean,
): {
    label: string;
    detail: string;
    isInstalled: boolean;
} {
    const option = CLI_OPTIONS.find((candidate) => candidate.value === cliType);
    const detection = getCliDetectionResult(cliType, cliResults);
    const baseLabel = option?.label ?? cliType;
    const baseDescription = option?.description ?? cliType;

    if (isCliDetectionLoading) {
        return {
            label: baseLabel,
            detail: `${baseDescription} / 検出状況を確認中`,
            isInstalled: true,
        };
    }

    if (!detection?.installed) {
        return {
            label: baseLabel,
            detail: `${baseDescription} / 未検出`,
            isInstalled: false,
        };
    }

    return {
        label: baseLabel,
        detail: detection.version
            ? `${baseDescription} / 検出済み: ${detection.version}`
            : `${baseDescription} / 検出済み`,
        isInstalled: true,
    };
}

function getModelLabel(cliType: SupportedCliType): string {
    switch (cliType) {
        case 'gemini':
            return 'Gemini モデル';
        case 'codex':
            return 'Codex モデル';
        default:
            return 'Claude モデル';
    }
}

function getModelPlaceholder(cliType: SupportedCliType): string {
    switch (cliType) {
        case 'gemini':
            return '例: gemini-3-flash-preview';
        case 'codex':
            return '例: gpt-5.4-mini';
        default:
            return '例: claude-haiku-4-5';
    }
}

function getModelHint(cliType: SupportedCliType): string {
    switch (cliType) {
        case 'gemini':
            return 'Gemini CLI はプロジェクトや認証方法によって利用可能モデルが変わるため、必要に応じて API カタログまたは公式ドキュメントを参考に入力してください。';
        case 'codex':
            return 'Codex CLI は CLI から安定したモデル一覧取得を提供していないため、推奨既定値 `gpt-5.4-mini` を起点に手動で指定してください。';
        default:
            return 'Claude Code CLI では Anthropic API カタログを参考にできます。未取得時はモデル名を手動入力してください。';
    }
}

function getRoleSummary(cliType: SupportedCliType): string {
    switch (cliType) {
        case 'gemini':
            return 'Gemini CLI で実行されるテンプレートです。高速な探索や広い文脈を活かした役割に向いています。';
        case 'codex':
            return 'Codex CLI で実行されるテンプレートです。OpenAI 系モデルを使った実装・検証フロー向けです。';
        default:
            return 'Claude Code CLI で実行されるテンプレートです。既存の Dev-agent 体験と同じ流れで利用できます。';
    }
}

function getCatalogStatusMessage(
    providerName: string,
    models: string[],
    keyConfigured: boolean,
): string {
    if (models.length > 0) {
        return `${models.length} 件の ${providerName} モデルを取得済みです。該当 CLI のロール設定時に参考として利用できます。`;
    }

    if (!keyConfigured) {
        return `${providerName} API Key が未設定です。必要な場合のみ設定してモデルカタログを取得してください。`;
    }

    return `${providerName} モデルカタログは未取得です。必要に応じて取得してロール設定の参考にしてください。`;
}

function getCatalogClasses(models: string[]) {
    return models.length > 0
        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
        : 'border-slate-200 bg-slate-50 text-slate-600';
}

function getSelectableModels(
    cliType: SupportedCliType,
    anthropicModelsList: string[],
    geminiModelsList: string[],
): string[] {
    switch (cliType) {
        case 'gemini':
            return geminiModelsList;
        case 'claude':
            return anthropicModelsList;
        default:
            return [];
    }
}

function getDefaultNewRoleCliType(installedCliMap: Record<SupportedCliType, boolean>): SupportedCliType {
    if (installedCliMap.claude) return 'claude';
    if (installedCliMap.gemini) return 'gemini';
    if (installedCliMap.codex) return 'codex';
    return 'claude';
}

function createEmptyRole(cliType: SupportedCliType): TeamRoleSetting {
    return {
        id: crypto.randomUUID(),
        name: '',
        system_prompt: '',
        cli_type: cliType,
        model: getDefaultModel(cliType),
        avatar_image: null,
        sort_order: 0,
    };
}

function normalizeRoles(roles: TeamRoleSetting[]): TeamRoleSetting[] {
    return roles.map((role, index) => ({
        ...role,
        sort_order: index,
    }));
}

export function TeamSettingsTab({
    config,
    validationMessages,
    isLoading,
    anthropicModelsList,
    geminiModelsList,
    cliResults,
    installedCliMap,
    isCliDetectionLoading,
    isFetchingAnthropicModels,
    isFetchingGeminiModels,
    canFetchAnthropicModels,
    canFetchGeminiModels,
    onChange,
    onFetchAnthropicModels,
    onFetchGeminiModels,
}: TeamSettingsTabProps) {
    const roleCount = config.roles.length;

    const updateRole = (roleId: string, patch: Partial<TeamRoleSetting>) => {
        const nextRoles = normalizeRoles(
            config.roles.map((role) => (role.id === roleId ? { ...role, ...patch } : role))
        );
        onChange({ ...config, roles: nextRoles });
    };

    const updateRoleCliType = (roleId: string, cliType: SupportedCliType) => {
        updateRole(roleId, {
            cli_type: cliType,
            model: getDefaultModel(cliType),
        });
    };

    const handleAddRole = () => {
        const nextRoles = normalizeRoles([
            ...config.roles,
            createEmptyRole(getDefaultNewRoleCliType(installedCliMap)),
        ]);
        onChange({ ...config, roles: nextRoles });
    };

    const handleRemoveRole = (roleId: string) => {
        const nextRoles = normalizeRoles(config.roles.filter((role) => role.id !== roleId));
        onChange({ ...config, roles: nextRoles });
    };

    const handleConcurrencyChange = (value: number) => {
        onChange({
            ...config,
            max_concurrent_agents: value,
        });
    };

    if (isLoading) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                チーム設定を読み込んでいます...
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-5 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm">
                            <TerminalSquare size={14} />
                            Multi-CLI Agent Team
                        </div>

                        <div className="mt-4 flex items-start gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                                <Users size={22} />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-lg font-semibold text-slate-900">
                                    自律エージェントチームを編成する
                                </h3>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                    本システムは Claude Code CLI / Gemini CLI / Codex CLI を自律エージェントとして束ね、
                                    あなた専属の開発チームを編成・指揮するための心臓部です。ロール、CLI 種別、モデル、並行数を整えることで、
                                    複数の専門家が分担して走るような開発体験を再現できます。
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                                Parallel Team Simulation
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                                CLI-native Execution
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                                Role-driven Delivery
                            </span>
                        </div>
                    </div>

                    <div className="grid min-w-[220px] gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Templates
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-900">{roleCount}</div>
                            <div className="mt-1 text-sm text-slate-500">登録ロール数</div>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Throughput
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-900">
                                {config.max_concurrent_agents}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">最大並行稼働数</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-3xl">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                            01 Global Control
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-slate-900">最大並行稼働数</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            同時に動かせる Dev エージェント数の上限を 1〜5 の範囲で設定します。登録ロール数とは独立した、システム全体のスループット制御です。
                        </p>
                    </div>

                    <div className="rounded-xl bg-slate-100 px-4 py-3 text-lg font-semibold text-slate-800">
                        {config.max_concurrent_agents}
                    </div>
                </div>

                <div className="mt-5 space-y-4">
                    <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={config.max_concurrent_agents}
                        onChange={(e) => handleConcurrencyChange(Number(e.target.value))}
                        className="w-full accent-sky-600"
                    />

                    <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>1 agent</span>
                        <span>5 agents</span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[112px_minmax(0,1fr)] md:items-start">
                        <input
                            type="number"
                            min={1}
                            max={5}
                            value={config.max_concurrent_agents}
                            onChange={(e) => handleConcurrencyChange(Number(e.target.value))}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <p className="text-sm leading-6 text-slate-500">
                            ロールはテンプレートとして再利用され、同一ロールから複数エージェントを起動できます。並行数は「何人同時に走らせるか」を決めるスイッチです。
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                            02 Model References
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-slate-900">モデル参照情報</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            CLI ツールは利用可能モデル一覧を統一的に返さないため、Vicara では取得可能な API カタログを補助情報として表示します。
                            Claude / Gemini は API キーがある場合に候補一覧を参照でき、Codex は推奨既定値を起点に手動指定します。
                        </p>
                    </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
                                    Claude Catalog
                                </div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">Anthropic API</div>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={onFetchAnthropicModels}
                                disabled={isFetchingAnthropicModels || !canFetchAnthropicModels}
                                className="border border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                            >
                                <RefreshCw size={14} className={`mr-2 ${isFetchingAnthropicModels ? 'animate-spin' : ''}`} />
                                取得
                            </Button>
                        </div>
                        <div className={`mt-4 rounded-xl border px-3 py-3 text-sm ${getCatalogClasses(anthropicModelsList)}`}>
                            {getCatalogStatusMessage('Anthropic', anthropicModelsList, canFetchAnthropicModels)}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">
                                    Gemini Catalog
                                </div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">Gemini API</div>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={onFetchGeminiModels}
                                disabled={isFetchingGeminiModels || !canFetchGeminiModels}
                                className="border border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
                            >
                                <RefreshCw size={14} className={`mr-2 ${isFetchingGeminiModels ? 'animate-spin' : ''}`} />
                                取得
                            </Button>
                        </div>
                        <div className={`mt-4 rounded-xl border px-3 py-3 text-sm ${getCatalogClasses(geminiModelsList)}`}>
                            {getCatalogStatusMessage('Gemini', geminiModelsList, canFetchGeminiModels)}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Codex Guidance
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">CLI ベース設定</div>
                        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
                            Codex CLI は現時点で CLI から安定したモデル一覧を返さないため、既定値 `gpt-5.4-mini` を起点に手動入力で設定します。
                        </div>
                    </div>
                </div>
            </div>

            {validationMessages.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-medium text-amber-800">保存前に以下を確認してください。</p>
                    <ul className="mt-2 list-disc pl-5 text-sm text-amber-700">
                        {validationMessages.map((message) => (
                            <li key={message}>{message}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-3xl">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                            03 Role Templates
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-slate-900">テンプレート定義</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            役割ごとの責務、CLI 種別、モデル、システムプロンプトを定義します。ここで作成したテンプレートを基に、
                            実行時に複数エージェントが編成されます。
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleAddRole}
                        className="border border-dashed border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    >
                        <Plus size={16} className="mr-2" />
                        ロールを追加
                    </Button>
                </div>

                <div className="mt-5 space-y-4">
                    {config.roles.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                            まだロールは定義されていません。最初のテンプレートを追加して、チーム構成を組み立てましょう。
                        </div>
                    )}

                    {config.roles.map((role, index) => (
                        <div key={role.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            {(() => {
                                const cliType = normalizeCliType(role.cli_type);
                                const selectableModels = getSelectableModels(cliType, anthropicModelsList, geminiModelsList);
                                const hasSelectableModels = selectableModels.length > 0;
                                const modelSuggestionsId = `team-role-models-${role.id}`;

                                return (
                                    <>
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-600">
                                        Template {index + 1}
                                    </div>
                                    <h3 className="mt-1 text-base font-semibold text-slate-900">
                                        {role.name.trim() || '未設定のロール'}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {getRoleSummary(cliType)}
                                    </p>
                                </div>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveRole(role.id)}
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                    <Trash2 size={14} className="mr-1" />
                                    削除
                                </Button>
                            </div>

                            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px_280px]">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">役割名</label>
                                    <input
                                        type="text"
                                        value={role.name}
                                        onChange={(e) => updateRole(role.id, { name: e.target.value })}
                                        placeholder="例: Frontend Dev"
                                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <Bot size={14} />
                                        CLI 種別
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {CLI_OPTIONS.map((option) => {
                                            const selected = cliType === option.value;
                                            const optionMeta = getCliOptionMeta(option.value, cliResults, isCliDetectionLoading);
                                            const isUnavailable = !optionMeta.isInstalled;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => updateRoleCliType(role.id, option.value)}
                                                    className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                                                        selected
                                                            ? 'border-sky-400 bg-sky-50 text-sky-700'
                                                            : isUnavailable
                                                              ? 'border-amber-200 bg-amber-50/80 text-amber-700 hover:bg-amber-50'
                                                              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="font-semibold">{optionMeta.label}</div>
                                                    <div className="mt-1 text-[11px] leading-4 opacity-80">
                                                        {optionMeta.detail}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {!isCliDetectionLoading && !installedCliMap[cliType] && (
                                        <p className="mt-2 text-xs leading-5 text-amber-600">
                                            現在選択中の {CLI_OPTIONS.find((option) => option.value === cliType)?.label ?? cliType} はこの環境で未検出です。
                                            保存はできますが、実行前にセットアップ状況タブで利用可能か確認してください。
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <Cpu size={14} />
                                        {getModelLabel(cliType)}
                                    </label>
                                    {hasSelectableModels ? (
                                        <>
                                        <input
                                            list={modelSuggestionsId}
                                            value={role.model}
                                            onChange={(e) => updateRole(role.id, { model: e.target.value })}
                                            placeholder={getModelPlaceholder(cliType)}
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                        <datalist id={modelSuggestionsId}>
                                            {selectableModels.map((model) => (
                                                <option key={model} value={model} />
                                            ))}
                                        </datalist>
                                        </>
                                    ) : (
                                        <input
                                            type="text"
                                            value={role.model}
                                            onChange={(e) => updateRole(role.id, { model: e.target.value })}
                                            placeholder={getModelPlaceholder(cliType)}
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                    )}
                                    <p className="mt-2 text-xs leading-5 text-slate-500">
                                        {hasSelectableModels
                                            ? `候補から選択するか、モデル ID を直接入力できます。${getModelHint(cliType)}`
                                            : getModelHint(cliType)}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4">
                                <AvatarImageField
                                    label="Dev-agent アバター画像"
                                    description="このテンプレートから起動される Dev-agent の表示画像です。未設定時は標準の Dev-agent 画像を使用します。"
                                    value={role.avatar_image ?? null}
                                    fallbackKind="dev-agent"
                                    previewMode="avatar"
                                    onChange={(value) => updateRole(role.id, { avatar_image: value })}
                                />
                            </div>

                            <div className="mt-4">
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    システムプロンプト
                                </label>
                                <textarea
                                    value={role.system_prompt}
                                    onChange={(e) => updateRole(role.id, { system_prompt: e.target.value })}
                                    placeholder="このロールの責務、出力方針、レビュー観点を記述してください"
                                    rows={5}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                />
                            </div>
                                    </>
                                );
                            })()}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
