import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '../../types';
import { TaskCard } from './TaskCard';

interface StatusColumnProps {
    storyId: string;
    status: Task['status'];
    tasks: Task[];
}

export function StatusColumn({ storyId, status, tasks }: StatusColumnProps) {
    // 制約案A: ドロップ領域のIDに storyId を含めることで、同一Story内のみの判定に利用する
    const columnId = `${storyId}-${status}`;

    const { setNodeRef, isOver } = useDroppable({
        id: columnId,
        data: {
            type: 'Column',
            storyId,
            status
        }
    });

    const bgClasses = {
        'To Do': 'bg-slate-50 border-slate-200',
        'In Progress': 'bg-blue-50 border-blue-200',
        'Done': 'bg-emerald-50 border-emerald-200'
    };

    const displayStatus = {
        'To Do': '未着手',
        'In Progress': '進行中',
        'Done': '完了'
    };

    return (
        <div
            ref={setNodeRef}
            className={`flex-1 min-h-[150px] p-3 rounded-xl border ${bgClasses[status]} transition-colors ${isOver ? 'ring-2 ring-blue-400 ring-inset opacity-80' : ''
                }`}
        >
            <h3 className="text-xs font-semibold text-gray-500 tracking-wider mb-3 px-1">
                {displayStatus[status]} <span className="text-gray-400 font-normal ml-1">({tasks.length})</span>
            </h3>

            <SortableContext
                items={tasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="min-h-[100px]">
                    {tasks.map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
            </SortableContext>
        </div>
    );
}
