import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Story, Task, TeamChatMessage } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useScrum } from '../../context/ScrumContext';
import { useFocus, type FocusTarget } from '../../context/PoAssistantFocusContext';
import { useProjectLabels } from '../../hooks/useProjectLabels';
import { TaskFormData, TaskFormModal } from '../board/TaskFormModal';
import {
    FileText,
    Info,
    Loader2,
    MessageSquare,
    Send,
    Trash2,
    User,
    X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { Avatar } from './Avatar';
import {
    getAvatarDefinition,
    PO_ASSISTANT_ROLE_NAME,
    resolveAvatarImageSource,
} from './avatarRegistry';
import { usePoAssistantAvatarImage } from '../../hooks/usePoAssistantAvatarImage';
import { AiQuickSwitcher } from '../ui/settings/AiQuickSwitcher';
import { NotesPanel } from './NotesPanel';
import { SuggestionReviewModal } from './SuggestionReviewModal';
import {
    looksLikePoAssistantSuggestionCandidate,
    parsePoAssistantSuggestion,
    type PoAssistantSuggestion,
} from './suggestionParser';

type FocusSnapshot = Pick<FocusTarget, 'kind' | 'id' | 'pinnedAt'>;
type ReviewTaskSnapshot = {
    title: string;
    description: string;
    priority: number;
    status: Task['status'];
};
type SidebarChatMessage = TeamChatMessage & {
    focus_snapshot?: FocusSnapshot | null;
    suggestion?: PoAssistantSuggestion | null;
};
type ChatPayloadMessage = {
    role: string;
    content: string;
};

interface ChatWithTeamLeaderResponse {
    reply: string;
    focus_missing?: boolean;
}

interface PoAssistantSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

function mapTaskStatusToFormStatus(status: Task['status']): TaskFormData['status'] {
    if (status === 'In Progress') return 'IN_PROGRESS';
    if (status === 'Review') return 'REVIEW';
    if (status === 'Done') return 'DONE';
    return 'TODO';
}

function mapFormStatusToTaskStatus(status: TaskFormData['status']): Task['status'] {
    if (status === 'IN_PROGRESS') return 'In Progress';
    if (status === 'REVIEW') return 'Review';
    if (status === 'DONE') return 'Done';
    return 'To Do';
}

function getApplyDisabledReason(status: Task['status']) {
    if (status === 'In Progress' || status === 'Review' || status === 'Done') {
        return '進行中 / レビュー中のタスクは安全のため反映できません。To Do に戻してから再度お試しください。';
    }

    return null;
}

function buildReviewSnapshot(task: Task, suggestion: PoAssistantSuggestion): ReviewTaskSnapshot {
    return {
        title: suggestion.title?.trim() || task.title,
        description: suggestion.description ?? task.description ?? '',
        priority: suggestion.priority ?? task.priority,
        status: task.status,
    };
}

function normalizeFocusSnapshot(
    focus: FocusTarget | FocusSnapshot | null | undefined,
): FocusSnapshot | null {
    if (!focus) {
        return null;
    }

    return {
        kind: focus.kind,
        id: focus.id,
        pinnedAt: focus.pinnedAt,
    };
}

function isSameFocus(
    left: FocusSnapshot | null | undefined,
    right: FocusSnapshot | null | undefined,
) {
    if (!left && !right) {
        return true;
    }

    if (!left || !right) {
        return false;
    }

    return left.kind === right.kind && left.id === right.id;
}

function parseTimestamp(value: string) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function getActiveConversationMessages(
    messages: SidebarChatMessage[],
    historyStartAfterMessageId: string | null,
) {
    if (!historyStartAfterMessageId) {
        return messages;
    }

    const startIndex = messages.findIndex((message) => message.id === historyStartAfterMessageId);
    if (startIndex === -1) {
        return messages;
    }

    return messages.slice(startIndex + 1);
}

function getLatestFocusSnapshot(messages: SidebarChatMessage[]) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const snapshot = normalizeFocusSnapshot(messages[index].focus_snapshot);
        if (snapshot) {
            return snapshot;
        }
    }

    return null;
}

function resolveFocusLabel(
    snapshot: FocusSnapshot,
    stories: Story[],
    tasks: Task[],
    formatStoryLabel: (sequenceNumber: number | null | undefined) => string,
    formatTaskLabel: (sequenceNumber: number | null | undefined) => string,
) {
    if (snapshot.kind === 'task') {
        const task = tasks.find((candidate) => candidate.id === snapshot.id);
        if (task) {
            return `${formatTaskLabel(task.sequence_number)}: ${task.title}`;
        }

        return `Task: ${snapshot.id}`;
    }

    const story = stories.find((candidate) => candidate.id === snapshot.id);
    if (story) {
        return `${formatStoryLabel(story.sequence_number)}: ${story.title}`;
    }

    return `PBI: ${snapshot.id}`;
}

function buildFocusBoundaryMessage(
    nextFocus: FocusSnapshot | null,
    stories: Story[],
    tasks: Task[],
    formatStoryLabel: (sequenceNumber: number | null | undefined) => string,
    formatTaskLabel: (sequenceNumber: number | null | undefined) => string,
): ChatPayloadMessage {
    if (!nextFocus) {
        return {
            role: 'system',
            content: [
                '※ ここからユーザーの相談対象はプロジェクト全体に切り替わりました。',
                '以降の質問は特定の PBI / Task に固定せず、プロジェクト全体の相談として解釈してください。',
            ].join('\n'),
        };
    }

    const label = resolveFocusLabel(
        nextFocus,
        stories,
        tasks,
        formatStoryLabel,
        formatTaskLabel,
    );

    return {
        role: 'system',
        content: [
            `※ ここからユーザーの相談対象が [${label}] に切り替わりました。`,
            `以降の質問は ${label} についてのものとして解釈してください。前の対象の内容を混入させないでください。`,
        ].join('\n'),
    };
}

function buildMessagesForAI(
    messages: SidebarChatMessage[],
    pendingUserMessage: SidebarChatMessage,
    historyStartAfterMessageId: string | null,
    stories: Story[],
    tasks: Task[],
    formatStoryLabel: (sequenceNumber: number | null | undefined) => string,
    formatTaskLabel: (sequenceNumber: number | null | undefined) => string,
) {
    const activeConversation = [
        ...getActiveConversationMessages(messages, historyStartAfterMessageId),
        pendingUserMessage,
    ];
    const payload: ChatPayloadMessage[] = [];
    let previousFocus: FocusSnapshot | null = null;

    for (const message of activeConversation) {
        const currentFocus = normalizeFocusSnapshot(message.focus_snapshot);
        if (!isSameFocus(previousFocus, currentFocus)) {
            payload.push(
                buildFocusBoundaryMessage(
                    currentFocus,
                    stories,
                    tasks,
                    formatStoryLabel,
                    formatTaskLabel,
                ),
            );
        }

        payload.push({
            role: message.role === 'model' ? 'assistant' : message.role,
            content: message.content,
        });
        previousFocus = currentFocus;
    }

    return payload;
}

export const PoAssistantSidebar: React.FC<PoAssistantSidebarProps> = ({ isOpen, onClose }) => {
    const { currentProjectId, projects } = useWorkspace();
    const { stories, tasks, dependencies, updateTask, setTaskDependencies } = useScrum();
    const { focus, clearFocus } = useFocus();
    const { formatStoryLabel, formatTaskLabel } = useProjectLabels(currentProjectId);
    const poAssistantAvatarImage = usePoAssistantAvatarImage();
    const [messages, setMessages] = useState<SidebarChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFigureHidden, setIsFigureHidden] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat');
    const [reviewTarget, setReviewTarget] = useState<{
        taskId: string;
        current: ReviewTaskSnapshot;
        suggested: ReviewTaskSnapshot;
    } | null>(null);
    const [editTarget, setEditTarget] = useState<{
        taskId: string;
        initialData: Partial<TaskFormData>;
    } | null>(null);
    const [historyStartAfterMessageId, setHistoryStartAfterMessageId] = useState<string | null>(
        null,
    );
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const poAssistantFigure = getAvatarDefinition('po-assistant');
    const poAssistantFigureSrc =
        resolveAvatarImageSource(poAssistantAvatarImage) ?? poAssistantFigure.src;
    const focusSummary = useMemo(() => {
        if (!focus) {
            return null;
        }

        if (focus.kind === 'task') {
            const task = tasks.find((candidate) => candidate.id === focus.id);
            return {
                label: task
                    ? `${formatTaskLabel(task.sequence_number)} ${task.title}`
                    : `Task ${focus.id}`,
            };
        }

        const story = stories.find((candidate) => candidate.id === focus.id);
        return {
            label: story
                ? `${formatStoryLabel(story.sequence_number)} ${story.title}`
                : `PBI ${focus.id}`,
        };
    }, [focus, formatStoryLabel, formatTaskLabel, stories, tasks]);
    const activeConversationMessages = useMemo(
        () => getActiveConversationMessages(messages, historyStartAfterMessageId),
        [historyStartAfterMessageId, messages],
    );
    const latestConversationFocus = useMemo(
        () => getLatestFocusSnapshot(activeConversationMessages),
        [activeConversationMessages],
    );
    const hasCurrentFocusConversation = useMemo(() => {
        if (!focus) {
            return false;
        }

        const pinnedAt = parseTimestamp(focus.pinnedAt);
        return activeConversationMessages.some(
            (message) => parseTimestamp(message.created_at) >= pinnedAt,
        );
    }, [activeConversationMessages, focus]);
    const showStartFreshButton = Boolean(
        focus &&
            activeConversationMessages.length > 0 &&
            !hasCurrentFocusConversation &&
            !isSameFocus(latestConversationFocus, focus),
    );
    const editTask = editTarget ? tasks.find((task) => task.id === editTarget.taskId) ?? null : null;

    useEffect(() => {
        if (isOpen && currentProjectId) {
            void loadMessages();
        }
    }, [isOpen, currentProjectId]);

    useEffect(() => {
        const scrollToBottom = () => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        };
        setTimeout(scrollToBottom, 50);
    }, [messages, isLoading]);

    useEffect(() => {
        if (isOpen && activeTab === 'chat') {
            setTimeout(() => textareaRef.current?.focus(), 300);
        }
    }, [activeTab, isOpen]);

    useEffect(() => {
        setIsFigureHidden(false);
    }, [isOpen, poAssistantFigureSrc]);

    useEffect(() => {
        if (editTarget && !editTask) {
            setEditTarget(null);
        }
    }, [editTarget, editTask]);

    const loadMessages = async () => {
        try {
            const data = await invoke<TeamChatMessage[]>('get_team_chat_messages', {
                projectId: currentProjectId,
            });
            setMessages(
                data.map((message) => ({
                    ...message,
                    focus_snapshot: null,
                    suggestion: null,
                })),
            );
            setHistoryStartAfterMessageId(null);
        } catch (error) {
            console.error('Failed to load team chat messages:', error);
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const currentProject = projects.find((project) => project.id === currentProjectId);
        if (!currentProject?.local_path) {
            toast.error(
                'AIチャットを利用するには、設定からプロジェクトのローカルパスを設定してください。',
            );
            return;
        }

        const userContent = input.trim();
        const focusSnapshot = normalizeFocusSnapshot(focus);
        setInput('');

        const userMsgId = uuidv4();
        const userMsg: SidebarChatMessage = {
            id: userMsgId,
            project_id: currentProjectId,
            role: 'user',
            content: userContent,
            created_at: new Date().toISOString(),
            focus_snapshot: focusSnapshot,
        };

        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        try {
            await invoke('add_team_chat_message', {
                id: userMsgId,
                projectId: currentProjectId,
                role: 'user',
                content: userContent,
            });

            const messagesForAI = buildMessagesForAI(
                messages,
                userMsg,
                historyStartAfterMessageId,
                stories,
                tasks,
                formatStoryLabel,
                formatTaskLabel,
            );

            const aiResponse = await invoke<ChatWithTeamLeaderResponse>('chat_with_team_leader', {
                projectId: currentProjectId,
                messagesHistory: messagesForAI,
                focus: focusSnapshot
                    ? {
                          kind: focusSnapshot.kind,
                          id: focusSnapshot.id,
                      }
                    : null,
            });

            if (aiResponse.focus_missing) {
                clearFocus();
                toast.error('相談対象が見つからなかったため、フォーカスを解除しました。');
            }

            const replyContent = aiResponse.reply;
            const parsedSuggestion = parsePoAssistantSuggestion(replyContent, {
                focusKind: focusSnapshot?.kind,
                onWarning: (warning) => {
                    if (warning === 'multiple_proposals') {
                        toast('複数提案がありましたが最初のものを使用します', {
                            icon: '⚠️',
                        });
                    }
                },
            });

            if (
                !parsedSuggestion &&
                focusSnapshot?.kind === 'task' &&
                looksLikePoAssistantSuggestionCandidate(replyContent)
            ) {
                console.warn('PO assistant suggestion parsing failed', {
                    replyContent,
                    focusSnapshot,
                });
                toast.error('提案を検出できませんでした');
            }

            const aiMsgId = uuidv4();
            const aiMsg: SidebarChatMessage = {
                id: aiMsgId,
                project_id: currentProjectId,
                role: 'assistant',
                content: replyContent,
                created_at: new Date().toISOString(),
                focus_snapshot: aiResponse.focus_missing ? null : focusSnapshot,
                suggestion: aiResponse.focus_missing ? null : parsedSuggestion,
            };

            await invoke('add_team_chat_message', {
                id: aiMsgId,
                projectId: currentProjectId,
                role: 'assistant',
                content: replyContent,
            });

            setMessages((prev) => [...prev, aiMsg]);
        } catch (error) {
            console.error('PO assistant chat failed:', error);
            toast.error(`推論に失敗しました: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearHistory = async () => {
        if (!window.confirm('チャット履歴を全て削除してもよろしいですか？')) return;
        try {
            await invoke('clear_team_chat_messages', { projectId: currentProjectId });
            setMessages([]);
            setHistoryStartAfterMessageId(null);
            toast.success('チャット履歴を削除しました');
        } catch (error) {
            console.error('Failed to clear chat history:', error);
            toast.error('履歴の削除に失敗しました');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSend();
        }
    };

    const handleOpenSuggestionReview = (task: Task, suggestion: PoAssistantSuggestion) => {
        setReviewTarget({
            taskId: task.id,
            current: {
                title: task.title,
                description: task.description ?? '',
                priority: task.priority,
                status: task.status,
            },
            suggested: buildReviewSnapshot(task, suggestion),
        });
    };

    const tabButtonClass = (tab: 'chat' | 'notes') =>
        `inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
            activeTab === tab
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
        }`;

    return (
        <div
            className={`relative flex h-full w-full flex-col overflow-hidden border-none bg-white transition-opacity duration-300 ease-in-out ${
                isOpen ? 'opacity-100' : 'hidden opacity-0'
            }`}
        >
            {isOpen && (
                <>
                    <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 shrink-0">
                        <div className="flex items-center gap-2.5">
                            <Avatar kind="po-assistant" size="md" imageSrc={poAssistantAvatarImage} />
                            <div>
                                <div className="flex items-center gap-1">
                                    <h2 className="text-sm font-bold leading-tight text-gray-800">
                                        {PO_ASSISTANT_ROLE_NAME}
                                    </h2>
                                    <div className="group relative">
                                        <Info
                                            size={12}
                                            className="cursor-help text-gray-400 transition-colors hover:text-indigo-500"
                                        />
                                        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-[11px] leading-relaxed text-gray-600 shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
                                            <p className="mb-1.5 font-semibold text-gray-800">
                                                POアシスタントでできること
                                            </p>
                                            <ul className="list-none space-y-1">
                                                <li>💬 バックログへのPBI・タスク追加</li>
                                                <li>📌 気づきをふせんとしてボードに記録</li>
                                                <li>🔄 レトロボードへのKPT提案（Keep / Problem / Try）</li>
                                                <li>🎯 優先順位づけや要件整理の相談</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] leading-tight text-gray-500">
                                    意思決定サポート・バックログ整理・レトロスペクティブ連携を担当
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {activeTab === 'chat' && messages.length > 0 && (
                                <button
                                    onClick={handleClearHistory}
                                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                    title="チャット履歴を削除"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                                title="パネルを閉じる"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {focusSummary && (
                        <div className="flex flex-wrap items-center gap-2 border-b border-indigo-100 bg-indigo-50/70 px-3 py-2 shrink-0">
                            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700">
                                <span>🎯</span>
                                <span>{focusSummary.label} について相談中</span>
                            </div>
                            {showStartFreshButton && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setHistoryStartAfterMessageId(
                                            activeConversationMessages[
                                                activeConversationMessages.length - 1
                                            ]?.id ?? null,
                                        )
                                    }
                                    className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                                >
                                    🆕 新しい会話として相談する
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={clearFocus}
                                className="rounded-full border border-transparent bg-white/80 px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:border-gray-200 hover:text-gray-700"
                                title="相談対象を解除"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <div className="hidden" aria-hidden="true">
                        <AiQuickSwitcher compact />
                    </div>

                    <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-3 shrink-0">
                        <button
                            type="button"
                            onClick={() => setActiveTab('chat')}
                            className={tabButtonClass('chat')}
                        >
                            <MessageSquare size={14} />
                            チャット
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('notes')}
                            className={tabButtonClass('notes')}
                        >
                            <FileText size={14} />
                            ふせん
                            <div
                                className="group relative ml-0.5"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <Info
                                    size={11}
                                    className="cursor-help text-gray-400 transition-colors hover:text-indigo-500"
                                />
                                <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-[11px] leading-relaxed text-gray-600 shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
                                    <p className="mb-1.5 font-semibold text-gray-800">ふせんとは</p>
                                    <ul className="list-none space-y-1">
                                        <li>📌 会話中の気づきやメモを記録</li>
                                        <li>🔄 レトロボードへKPTとして転記可能</li>
                                        <li>✏️ 自分でも自由に追加・編集できます</li>
                                    </ul>
                                </div>
                            </div>
                        </button>
                    </div>

                    <div className="relative flex-1 min-h-0">
                        <div className={activeTab === 'chat' ? 'flex h-full flex-col' : 'hidden'}>
                            <div className="relative flex-1 overflow-y-auto bg-gray-50/50">
                                <div className="relative z-10 space-y-3 px-3 py-4 pr-6 xl:pr-[7.5rem]">
                                    {messages.length === 0 && !isLoading && (
                                        <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
                                            <Avatar
                                                kind="po-assistant"
                                                size="lg"
                                                imageSrc={poAssistantAvatarImage}
                                                className="mb-4 shadow-sm"
                                            />
                                            <p className="mb-2 text-sm font-medium text-gray-600">
                                                {PO_ASSISTANT_ROLE_NAME}
                                            </p>
                                            <p className="text-xs leading-relaxed text-gray-400">
                                                {focusSummary
                                                    ? `${focusSummary.label} を中心に、優先順位や分割方針、要件の整理を相談できます。`
                                                    : 'プロジェクト全体を俯瞰しながら、優先順位づけや判断整理を支援します。バックログの優先順位、スプリントの進め方、要件の切り分けなどを気軽に相談してください。'}
                                            </p>
                                        </div>
                                    )}

                                    {messages.map((msg) => {
                                        const suggestionTask =
                                            msg.focus_snapshot?.kind === 'task'
                                                ? tasks.find(
                                                      (task) => task.id === msg.focus_snapshot?.id,
                                                  ) ?? null
                                                : null;
                                        const applyDisabledReason = suggestionTask
                                            ? getApplyDisabledReason(suggestionTask.status)
                                            : null;

                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div
                                                    className={`flex gap-3 ${
                                                        msg.role === 'user'
                                                            ? 'max-w-[88%] flex-row-reverse'
                                                            : 'max-w-full flex-row'
                                                    } `}
                                                >
                                                    {msg.role === 'user' ? (
                                                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                                                            <User size={14} />
                                                        </div>
                                                    ) : (
                                                        <Avatar
                                                            kind="po-assistant"
                                                            size="md"
                                                            imageSrc={poAssistantAvatarImage}
                                                            className="mt-0.5 shadow-sm"
                                                        />
                                                    )}
                                                    <div className="flex max-w-full flex-col gap-2">
                                                        <div
                                                            className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                                                                msg.role === 'user'
                                                                    ? 'rounded-tr-md bg-indigo-600 text-white'
                                                                    : 'rounded-tl-md border border-gray-200 bg-white text-gray-800 shadow-sm'
                                                            }`}
                                                        >
                                                            {msg.role === 'user' ? (
                                                                <span className="whitespace-pre-wrap">
                                                                    {msg.content}
                                                                </span>
                                                            ) : (
                                                                <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-[12px] prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-headings:mt-3 prose-headings:mb-1 prose-headings:text-sm">
                                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                        {msg.content}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {msg.role !== 'user' &&
                                                            msg.suggestion &&
                                                            suggestionTask && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleOpenSuggestionReview(
                                                                            suggestionTask,
                                                                            msg.suggestion!,
                                                                        )
                                                                    }
                                                                    disabled={Boolean(
                                                                        applyDisabledReason,
                                                                    )}
                                                                    title={
                                                                        applyDisabledReason ??
                                                                        'AI 提案を確認'
                                                                    }
                                                                    className="self-start rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
                                                                >
                                                                    📝 提案を編集モーダルで確認
                                                                </button>
                                                            )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="flex max-w-full gap-3">
                                                <Avatar
                                                    kind="po-assistant"
                                                    size="md"
                                                    imageSrc={poAssistantAvatarImage}
                                                    className="mt-0.5 shadow-sm"
                                                />
                                                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-gray-200 bg-white px-4 py-3 shadow-sm">
                                                    <Loader2
                                                        size={14}
                                                        className="animate-spin text-indigo-500"
                                                    />
                                                    <span className="text-xs text-gray-400">
                                                        判断材料を整理しています...
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            <div className="relative z-20 shrink-0 border-t border-gray-200 bg-white p-3">
                                <form onSubmit={handleSend} className="relative">
                                    <textarea
                                        ref={textareaRef}
                                        value={input}
                                        onChange={(event) => setInput(event.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="メッセージを入力... (Ctrl+Enter で送信)"
                                        className="min-h-[44px] max-h-[120px] w-full resize-none rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-3 pr-11 text-[13px] placeholder:text-gray-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        disabled={isLoading}
                                        rows={1}
                                        onInput={(event) => {
                                            const target = event.target as HTMLTextAreaElement;
                                            target.style.height = 'auto';
                                            target.style.height =
                                                Math.min(target.scrollHeight, 120) + 'px';
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isLoading}
                                        className="absolute bottom-2 right-2 rounded-lg bg-indigo-600 p-1.5 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600"
                                    >
                                        <Send size={14} />
                                    </button>
                                </form>
                            </div>

                            {!isFigureHidden && (
                                <div className="pointer-events-none absolute bottom-[84px] right-[-34px] z-[1] hidden xl:block">
                                    <div className="absolute inset-x-6 bottom-10 top-14 rounded-full bg-emerald-300/14 blur-3xl" />
                                    <img
                                        src={poAssistantFigureSrc}
                                        alt={PO_ASSISTANT_ROLE_NAME}
                                        className="relative h-[365px] w-[210px] origin-bottom-right object-contain opacity-95 drop-shadow-[0_24px_30px_rgba(16,185,129,0.16)]"
                                        onError={() => setIsFigureHidden(true)}
                                    />
                                </div>
                            )}
                        </div>

                        <div
                            className={activeTab === 'notes' ? 'flex h-full min-h-0 flex-col' : 'hidden'}
                        >
                            <NotesPanel />
                        </div>
                    </div>

                    {reviewTarget && (
                        <SuggestionReviewModal
                            isOpen
                            current={reviewTarget.current}
                            suggested={reviewTarget.suggested}
                            isApplyDisabled={Boolean(
                                getApplyDisabledReason(reviewTarget.current.status),
                            )}
                            applyDisabledReason={getApplyDisabledReason(
                                reviewTarget.current.status,
                            ) ?? undefined}
                            onCancel={() => setReviewTarget(null)}
                            onApply={() => {
                                const task = tasks.find(
                                    (candidate) => candidate.id === reviewTarget.taskId,
                                );
                                if (!task) {
                                    toast.error(
                                        '対象タスクが見つからなかったため、編集モーダルを開けませんでした。',
                                    );
                                    setReviewTarget(null);
                                    return;
                                }

                                const blockedByTaskIds = dependencies
                                    .filter((dependency) => dependency.task_id === task.id)
                                    .map((dependency) => dependency.blocked_by_task_id);

                                setEditTarget({
                                    taskId: task.id,
                                    initialData: {
                                        title: reviewTarget.suggested.title,
                                        description: reviewTarget.suggested.description,
                                        status: mapTaskStatusToFormStatus(task.status),
                                        priority: reviewTarget.suggested.priority,
                                        assigned_role_id: task.assigned_role_id ?? '',
                                        blocked_by_task_ids: blockedByTaskIds,
                                    },
                                });
                                setReviewTarget(null);
                            }}
                        />
                    )}

                    {editTarget && editTask && (
                        <TaskFormModal
                            isOpen
                            onClose={() => setEditTarget(null)}
                            onSave={async (data) => {
                                await updateTask({
                                    ...editTask,
                                    title: data.title,
                                    description: data.description.trim() ? data.description : null,
                                    status: mapFormStatusToTaskStatus(data.status),
                                    assigned_role_id: data.assigned_role_id || null,
                                    priority: data.priority,
                                });
                                await setTaskDependencies(editTask.id, data.blocked_by_task_ids);
                            }}
                            initialData={editTarget.initialData}
                            title="AI 提案を確認してタスクを編集"
                            availableTasks={tasks.filter(
                                (task) =>
                                    task.story_id === editTask.story_id && task.id !== editTask.id,
                            )}
                        />
                    )}
                </>
            )}
        </div>
    );
};
