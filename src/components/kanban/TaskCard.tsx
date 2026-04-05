import { useState, memo, useCallback, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '../../types';
import { MoreVertical, TerminalSquare } from 'lucide-react';
import { TaskFormModal, TaskFormData } from '../board/TaskFormModal';
import { useScrum } from '../../context/ScrumContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { invoke } from '@tauri-apps/api/core';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TaskCardProps {
    task: Task;
}

export const TaskCard = memo(function TaskCard({ task }: TaskCardProps) {
    const { updateTaskStatus, updateTask, deleteTask } = useScrum();
    const { projects, currentProjectId } = useWorkspace();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: task.id,
        data: {
            type: 'Task',
            task
        }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleLaunchClaude = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentProject = projects.find(p => p.id === currentProjectId);
        if (!currentProject?.local_path) {
            toast.error("ワークスペースのローカルパスが設定されていません。Settingsから設定してください。");
            return;
        }

        try {
            await invoke('execute_claude_task', {
                taskId: task.id,
                prompt: `以下のタスクを実装してください。タスクのゴールを達成するためのファイル変更を行ってください。\n\n# タスク名\n${task.title}\n\n# 詳細\n${task.description || '特になし'}\n\n作業を終える前にかならず変更点が意図通りか自己検証し、完了したら終了してください。`,
                cwd: currentProject.local_path
            });
            await updateTaskStatus(task.id, 'In Progress');
            toast.success("Claudeでの開発を開始しました (ターミナルをご確認ください)");
        } catch (err: any) {
            toast.error(`プロセス起動失敗: ${err}`);
            window.dispatchEvent(new CustomEvent('claude_error', { detail: String(err) }));
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => setIsEditModalOpen(true)}
            className={`bg-white p-3 rounded-md shadow-sm border cursor-grab active:cursor-grabbing ${isDragging ? 'border-blue-500 opacity-50' : 'border-gray-200 hover:border-blue-300'
                } flex flex-col gap-1 mb-2 group relative transition-colors`}
        >
            <div className="flex-1 min-w-0 pr-6">
                <h4 className="text-sm font-medium text-gray-900 truncate" title={task.title}>{task.title}</h4>
                {task.description && (
                    <div
                        className="text-xs text-gray-500 mt-1 prose prose-sm prose-slate max-w-none prose-p:leading-snug prose-li:my-0 max-h-64 overflow-hidden relative"
                        title="Click to edit and see full description"
                    >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {task.description}
                        </ReactMarkdown>
                        {/* Optional: Add a faded bottom edge to indicate truncation if it gets too long */}
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                    </div>
                )}
            </div>

            <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10 bg-white/80 rounded backdrop-blur-sm p-0.5 shadow-sm">
                <button
                    onClick={handleLaunchClaude}
                    className="p-1 text-blue-500 hover:text-white hover:bg-blue-500 rounded transition-colors"
                    title="開発を実行 (Launch Claude)"
                >
                    <TerminalSquare size={16} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); setIsEditModalOpen(true); }}
                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                    <MoreVertical size={16} />
                </button>
            </div>

            <TaskFormModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={useCallback(async (data) => {
                    const statusMap: Record<TaskFormData['status'], Task['status']> = {
                        'TODO': 'To Do',
                        'IN_PROGRESS': 'In Progress',
                        'DONE': 'Done'
                    };
                    await updateTask({
                        ...task,
                        title: data.title,
                        description: data.description,
                        status: statusMap[data.status],
                    });
                }, [task, updateTask])}
                onDelete={useCallback(async () => {
                    await deleteTask(task.id);
                }, [task.id, deleteTask])}
                initialData={useMemo(() => ({
                    title: task.title,
                    description: task.description || '',
                    status: Object.entries({
                        'TODO': 'To Do',
                        'IN_PROGRESS': 'In Progress',
                        'DONE': 'Done'
                    }).find(([_, v]) => v === task.status)?.[0] as TaskFormData['status'] || 'TODO',
                }), [task.title, task.description, task.status])}
                title="タスクを編集"
            />
        </div>
    );
});
