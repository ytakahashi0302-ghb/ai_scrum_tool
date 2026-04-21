import { useState, useMemo, useCallback, memo } from 'react';
import { Story, Task, TeamRoleSetting } from '../../types';
import { StatusColumn } from './StatusColumn';
import { Lightbulb, Plus, MoreVertical } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { TaskFormModal, TaskFormData } from '../board/TaskFormModal';
import { StoryFormModal, StoryFormData } from '../board/StoryFormModal';
import { useFocus } from '../../context/PoAssistantFocusContext';
import { useScrum } from '../../context/ScrumContext';
import { useProjectLabels } from '../../hooks/useProjectLabels';
import { v4 as uuidv4 } from 'uuid';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';

interface StorySwimlaneProps {
    story: Story;
    tasks: Task[];
    roleLookup: Record<string, TeamRoleSetting>;
}

const STATUSES: Task['status'][] = ['To Do', 'In Progress', 'Review', 'Done'];

export const StorySwimlane = memo(function StorySwimlane({ story, tasks, roleLookup }: StorySwimlaneProps) {
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
    const [isEditStoryModalOpen, setIsEditStoryModalOpen] = useState(false);
    const { setFocus } = useFocus();
    const { refresh, updateStory, deleteStory, setTaskDependencies } = useScrum();
    const { formatStoryLabel } = useProjectLabels(story.project_id);

    const focusStoryForPoAssistant = useCallback(() => {
        setFocus({
            kind: 'story',
            id: story.id,
        });
    }, [setFocus, story.id]);

    const handleAddTask = useCallback(async (data: TaskFormData) => {
        const statusMap: Record<TaskFormData['status'], Task['status']> = {
            'TODO': 'To Do',
            'IN_PROGRESS': 'In Progress',
            'REVIEW': 'Review',
            'DONE': 'Done'
        };
        const newId = uuidv4();
        try {
            await invoke('add_task', {
                id: newId,
                projectId: story.project_id,
                storyId: story.id,
                title: data.title,
                description: data.description,
                status: statusMap[data.status],
                assigneeType: null,
                assignedRoleId: data.assigned_role_id || null,
                priority: data.priority ?? 3
            });
            await refresh();
        } catch (error) {
            console.error('Failed to add task with role assignment', error);
            toast.error(`タスクの作成に失敗しました: ${error}`);
            throw error;
        }
        if (data.blocked_by_task_ids.length > 0) {
            await setTaskDependencies(newId, data.blocked_by_task_ids);
        }
    }, [refresh, setTaskDependencies, story.id, story.project_id]);

    const handleEditStory = useCallback(async (data: StoryFormData) => {
        await updateStory({
            ...story,
            title: data.title,
            description: data.description,
            acceptance_criteria: data.acceptance_criteria,
            priority: data.priority ?? 3
        });
    }, [updateStory, story]);

    const handleDeleteStory = useCallback(async () => {
        await deleteStory(story.id);
    }, [deleteStory, story.id]);

    const groupedTasks = useMemo(() => {
        const groups: Record<string, Task[]> = {
            'To Do': [],
            'In Progress': [],
            'Review': [],
            'Done': []
        };
        for (const t of tasks) {
            if (groups[t.status]) {
                groups[t.status].push(t);
            }
        }
        return groups;
    }, [tasks]);

    return (
        <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm">
            {/* Story Header */}
            <div className="group flex items-start justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex-1 pr-4">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                            {formatStoryLabel(story.sequence_number)}
                        </span>
                        <h2 className="truncate text-lg font-semibold text-slate-900" title={story.title}>
                            {story.title}
                        </h2>
                        <Badge variant="priority" level={story.priority ?? 3} className="shrink-0" />
                    </div>
                    {story.description && (
                        <p className="mt-1 text-sm text-slate-500">{story.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="status" status={story.status} />
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={focusStoryForPoAssistant}
                        className="bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 hover:text-amber-800 focus:ring-amber-500"
                        title="このPBIをPOアシスタントに相談"
                    >
                        <Lightbulb size={16} className="mr-1" />
                        相談
                    </Button>
                    <Button size="sm" onClick={() => setIsAddTaskModalOpen(true)}>
                        <Plus size={16} className="mr-1" />
                        タスクを追加
                    </Button>
                    <button
                        onClick={() => setIsEditStoryModalOpen(true)}
                        className="rounded-md p-1.5 text-slate-400 opacity-0 transition-all hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
                    >
                        <MoreVertical size={16} />
                    </button>
                </div>
            </div>

            {/* Task Columns */}
            <div className="p-4 bg-white">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                    {STATUSES.map(status => (
                        <StatusColumn
                            key={`${story.id}-${status}`}
                            storyId={story.id}
                            status={status}
                            tasks={groupedTasks[status]}
                            allStoryTasks={tasks}
                            roleLookup={roleLookup}
                        />
                    ))}
                </div>
            </div>

            <TaskFormModal
                isOpen={isAddTaskModalOpen}
                onClose={() => setIsAddTaskModalOpen(false)}
                onSave={handleAddTask}
                title={`「${formatStoryLabel(story.sequence_number)} ${story.title}」にタスクを追加`}
                availableTasks={tasks}
            />

            <StoryFormModal
                isOpen={isEditStoryModalOpen}
                onClose={() => setIsEditStoryModalOpen(false)}
                onSave={handleEditStory}
                onDelete={handleDeleteStory}
                initialData={{
                    title: story.title,
                    description: story.description || '',
                    acceptance_criteria: story.acceptance_criteria || '',
                    priority: story.priority ?? 3
                }}
                title="PBIを編集"
                onConsultPoAssistant={() => {
                    setIsEditStoryModalOpen(false);
                    focusStoryForPoAssistant();
                }}
            />
        </div>
    );
});
