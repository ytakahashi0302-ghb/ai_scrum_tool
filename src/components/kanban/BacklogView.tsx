import { useState, useMemo } from 'react';
import { useScrum } from '../../context/ScrumContext';
import { Button } from '../ui/Button';
import { Plus, CalendarPlus, Play, ArrowRight, ArrowLeft, Lightbulb } from 'lucide-react';
import { StoryFormModal, StoryFormData } from '../board/StoryFormModal';
import { v4 as uuidv4 } from 'uuid';
import { Story, Task } from '../../types';
import toast from 'react-hot-toast';
import { useSprintTimer } from '../../context/SprintTimerContext';
import { useProjectLabels } from '../../hooks/useProjectLabels';
import { useFocus } from '../../context/PoAssistantFocusContext';

// 数値そのままでソート（小さいほど優先度が高い = 先頭に表示）

export function BacklogView() {
    const { stories, tasks, sprints, addStory, updateStory, deleteStory, createPlannedSprint, startSprint, assignStoryToSprint } = useScrum();
    const { ensureTimerRunning, getConfiguredDurationMs } = useSprintTimer();
    const { formatStoryLabel, formatTaskLabel, formatSprintLabel } = useProjectLabels();
    const { setFocus } = useFocus();
    const [isAddStoryModalOpen, setIsAddStoryModalOpen] = useState(false);
    const [storyFormInitialData, setStoryFormInitialData] = useState<Partial<StoryFormData> | undefined>();
    const [editingStory, setEditingStory] = useState<Story | null>(null);
    const [sortMode, setSortMode] = useState<'date' | 'priority'>('date');

    const backlogStories = useMemo(() => {
        const filtered = stories.filter(s => !s.sprint_id);
        if (sortMode === 'priority') {
            return [...filtered].sort((a, b) =>
                (a.priority ?? 3) - (b.priority ?? 3)
            );
        }
        return filtered;
    }, [stories, sortMode]);
    
    const plannedSprint = useMemo(() => sprints.find(s => s.status === 'Planned'), [sprints]);
    const activeSprint = useMemo(() => sprints.find(s => s.status === 'Active'), [sprints]);
    
    const plannedStories = useMemo(() => {
        if (!plannedSprint) return [];
        const filtered = stories.filter(s => s.sprint_id === plannedSprint.id);
        if (sortMode === 'priority') {
            return [...filtered].sort((a, b) =>
                (a.priority ?? 3) - (b.priority ?? 3)
            );
        }
        return filtered;
    }, [stories, plannedSprint, sortMode]);
    
    const plannedTasks = useMemo(() => {
        if (!plannedSprint) return [];
        return tasks.filter(t => t.sprint_id === plannedSprint.id);
    }, [tasks, plannedSprint]);

    // Handlers
    const handleAddStory = async (data: StoryFormData) => {
        await addStory({
            id: uuidv4(),
            title: data.title,
            description: data.description,
            acceptance_criteria: data.acceptance_criteria,
            status: 'Ready',
            priority: data.priority ?? 3,
            archived: false
        });
    };

    const handleCreateSprint = async () => {
        if (plannedSprint) return;
        try {
            await createPlannedSprint();
        } catch (e) {
            console.error(e);
        }
    };

    const handleStartSprint = async () => {
        if (!plannedSprint) return;
        if (activeSprint) {
            toast.error('既にアクティブなスプリントが存在します。先にそちらを完了してください。');
            return;
        }

        if (plannedStories.length === 0 && plannedTasks.length === 0) {
            toast.error('タスクが追加されていません。先にバックログから追加してください。');
            return;
        }
        
        try {
            const durationMs = await getConfiguredDurationMs();
            await startSprint(plannedSprint.id, durationMs);
            try {
                await ensureTimerRunning('SPRINT_STARTED', plannedSprint.id);
            } catch (timerError) {
                console.error('Failed to auto-start sprint timer after sprint start', timerError);
                toast.error('スプリントは開始しましたが、タイマーの自動開始に失敗しました。手動で開始してください。');
                return;
            }
            toast.success('スプリントを開始しました！Boardタブに移動してください。');
        } catch (e) {
            console.error(e);
        }
    };

    // Drag and Drop implementation has been removed due to WebView limitations. 
    // Button-based assignment is used exclusively.

    const openStoryEditor = (story: Story) => {
        setEditingStory(story);
        setStoryFormInitialData({
            title: story.title,
            description: story.description || '',
            acceptance_criteria: story.acceptance_criteria || '',
            priority: story.priority ?? 3
        });
        setIsAddStoryModalOpen(true);
    };

    const focusStoryForPoAssistant = (story: Story) => {
        setFocus({
            kind: 'story',
            id: story.id,
        });
    };

    const focusTaskForPoAssistant = (task: Task) => {
        setFocus({
            kind: 'task',
            id: task.id,
        });
    };

    const renderStoryItem = (story: Story, assignedTasks: Task[], isPlanned: boolean) => {
        const totalTasks = assignedTasks.length;
        const doneTasks = assignedTasks.filter(t => t.status === 'Done').length;
        const progressText = totalTasks > 0 ? `(${doneTasks}/${totalTasks} 完了)` : '';

        return (
            <div
                key={story.id}
                onClick={() => openStoryEditor(story)}
                className="group relative mb-3 cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-blue-400 hover:shadow-md"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`shrink-0 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium ${
                            (story.priority ?? 3) <= 1 ? 'bg-red-100 text-red-700 border-red-200' :
                            story.priority === 2 ? 'bg-orange-100 text-orange-700 border-orange-200' :
                            story.priority === 3 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                            story.priority === 4 ? 'bg-blue-100 text-blue-600 border-blue-200' :
                            'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>P{story.priority ?? 3}</span>
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {formatStoryLabel(story.sequence_number)}
                            </span>
                            {totalTasks > 0 && (
                                <span className="whitespace-nowrap rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                                    {progressText}
                                </span>
                            )}
                        </div>
                        <span className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">
                            {story.title}
                        </span>
                        <div className="mt-1 text-xs text-slate-500">{totalTasks} 個のタスク</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                focusStoryForPoAssistant(story);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 opacity-0 transition-all hover:bg-amber-100 group-hover:opacity-100"
                            title="このPBIをPOアシスタントに相談"
                        >
                            <Lightbulb size={14} />
                            相談
                        </button>
                        {plannedSprint && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    assignStoryToSprint(story.id, isPlanned ? null : plannedSprint.id);
                                }}
                                className="mb-1 shrink-0 rounded-xl bg-slate-50 p-2 text-slate-400 opacity-0 transition-opacity hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                                title={isPlanned ? "バックログに戻す" : "スプリントに追加"}
                            >
                                {isPlanned ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
                            </button>
                        )}
                    </div>
                </div>
                {assignedTasks.length > 0 && (
                    <div className="mt-3 space-y-2 border-l-2 border-slate-100 pl-3">
                        {assignedTasks.map(t => (
                            <div 
                                key={t.id} 
                                className={`group/task flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2 text-sm transition-colors ${t.status === 'Done' || t.archived ? 'cursor-default opacity-50 grayscale hover:border-slate-100 hover:bg-slate-50' : 'cursor-default hover:border-blue-300 hover:bg-slate-100'}`}
                            >
                                <div className={`flex min-w-0 items-center ${t.status === 'Done' || t.archived ? 'line-through text-slate-500' : 'text-slate-700'}`}>
                                    <span className={`mr-2 inline-block h-2 w-2 rounded-full ${t.status === 'Done' || t.archived ? 'bg-green-400' : 'bg-blue-300'}`}></span>
                                    <span className="mr-2 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                                        {formatTaskLabel(t.sequence_number)}
                                    </span>
                                    <span className="line-clamp-2">{t.title}</span>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        focusTaskForPoAssistant(t);
                                    }}
                                    className="opacity-0 group-hover/task:opacity-100 inline-flex items-center justify-center rounded p-1.5 text-amber-600 transition-opacity hover:bg-amber-100 hover:text-amber-700 shrink-0"
                                    title="このTaskをPOアシスタントに相談"
                                >
                                    <Lightbulb size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-full gap-6 px-6 py-4 overflow-hidden">
            {/* Left: Backlog */}
            <div 
                className="flex flex-[1.2] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
            >
                <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4">
                    <h2 className="flex items-center text-base font-bold text-slate-800">
                        プロダクトバックログ
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {backlogStories.length} {backlogStories.length > 0 ? `stories` : ''}
                        </span>
                    </h2>
                    <div className="flex gap-2 items-center">
                        <div className="flex rounded-xl bg-slate-100 p-0.5 text-xs">
                            <button
                                onClick={() => setSortMode('date')}
                                className={`rounded-lg px-2 py-1 transition-colors ${sortMode === 'date' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                作成日時
                            </button>
                            <button
                                onClick={() => setSortMode('priority')}
                                className={`rounded-lg px-2 py-1 transition-colors ${sortMode === 'priority' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                優先度
                            </button>
                        </div>
                        <Button size="sm" onClick={() => {
                            setStoryFormInitialData(undefined);
                            setIsAddStoryModalOpen(true);
                        }}>
                            <Plus size={16} className="sm:mr-1" />
                            <span className="hidden sm:inline">追加</span>
                        </Button>
                    </div>
                </div>
                
                <div 
                    className="overflow-y-auto flex-1 p-4 min-h-[300px] h-full"
                >
                    {backlogStories.length === 0 && tasks.filter(t => !t.sprint_id && !t.archived).length === 0 ? (
                        <div className="pointer-events-none flex h-full flex-col items-center justify-center p-4 text-center text-sm text-slate-400">
                            <p>バックログは空です。<br/>PBIを作成して、プロジェクトを計画しましょう。</p>
                        </div>
                    ) : (
                        backlogStories.map(story => {
                            const tasksForStory = tasks.filter(t => t.story_id === story.id);
                            return renderStoryItem(story, tasksForStory, false);
                        })
                    )}
                </div>
            </div>

            {/* Right: Planned Sprint */}
            <div 
                className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-xl border border-blue-200 bg-blue-50/30 shadow-sm"
            >
                <div className="flex justify-between items-center p-4 border-b border-blue-100 bg-white">
                    <div>
                        <h2 className="text-base font-bold text-blue-800 flex items-center">
                            {plannedSprint ? '次のスプリント (計画中)' : 'スプリント計画'}
                        </h2>
                        {plannedSprint && (
                            <p className="mt-1 text-xs font-semibold text-blue-600">
                                {formatSprintLabel(plannedSprint)}
                            </p>
                        )}
                    </div>
                    {!plannedSprint ? (
                        <Button size="sm" onClick={handleCreateSprint} variant="primary">
                            <CalendarPlus size={16} className="sm:mr-1" />
                            <span className="hidden sm:inline">スプリントを作成</span>
                        </Button>
                    ) : (
                        <Button size="sm" onClick={handleStartSprint} className="bg-green-600 hover:bg-green-700">
                            <Play size={16} className="sm:mr-1" />
                            <span className="hidden sm:inline">スプリントを開始</span>
                        </Button>
                    )}
                </div>

                <div 
                    className={ `overflow-y-auto flex-1 p-4 min-h-[300px] h-full ${!plannedSprint ? 'opacity-50 pointer-events-none' : ''}` }
                >
                    {!plannedSprint ? (
                        <div className="pointer-events-none flex h-full flex-col items-center justify-center p-4 text-center text-sm text-slate-400">
                            <CalendarPlus className="w-8 h-8 opacity-20 mb-2 text-blue-400" />
                            <p>スプリントを作成すると、<br/>バックログからPBIを割り当てられます。</p>
                        </div>
                    ) : plannedStories.length === 0 && tasks.filter(t => t.sprint_id === plannedSprint.id).length === 0 ? (
                        <div className="pointer-events-none flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-4 text-sm text-blue-400/80">
                            <p>左のバックログから<br/>矢印ボタンでPBIを追加してください</p>
                        </div>
                    ) : (
                        plannedStories.map(story => {
                            const tasksForStory = tasks.filter(t => t.story_id === story.id);
                            return renderStoryItem(story, tasksForStory, true);
                        })
                    )}
                </div>
            </div>

            <StoryFormModal
                isOpen={isAddStoryModalOpen}
                initialData={storyFormInitialData}
                onClose={() => {
                    setIsAddStoryModalOpen(false);
                    setStoryFormInitialData(undefined);
                    setEditingStory(null);
                }}
                onSave={async (data) => {
                    if (editingStory) {
                        await updateStory({
                            ...editingStory,
                            ...data
                        });
                    } else {
                        await handleAddStory(data);
                    }
                }}
                onDelete={editingStory ? async () => {
                    await deleteStory(editingStory.id);
                } : undefined}
                title={editingStory ? "PBIを編集" : "PBIを追加"}
                onConsultPoAssistant={editingStory ? () => {
                    setIsAddStoryModalOpen(false);
                    focusStoryForPoAssistant(editingStory);
                } : undefined}
            />
        </div>
    );
}
