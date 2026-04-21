import { useState } from 'react';
import { Board } from './Board';
import { BacklogView } from './BacklogView';
import { RetrospectiveView } from './RetrospectiveView';
import { Kanban, ListTodo, RotateCcw } from 'lucide-react';
import { useScrum } from '../../context/ScrumContext';

interface ScrumDashboardProps {
    currentProjectId: string;
    onOpenHistory: () => void;
}

export function ScrumDashboard({ currentProjectId, onOpenHistory }: ScrumDashboardProps) {
    const { loading } = useScrum();
    const [activeTab, setActiveTab] = useState<'backlog' | 'board' | 'retrospective'>('backlog');

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 h-full min-h-[50vh]">
                <div className="animate-pulse text-slate-500">データを読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-slate-100">
            {/* Tab navigation */}
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 pt-3 shadow-sm">
                <nav className="flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('backlog')}
                        className={`flex items-center pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'backlog'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                    >
                        <ListTodo size={18} className="mr-2" />
                        プロダクトバックログ
                    </button>
                    <button
                        onClick={() => setActiveTab('board')}
                        className={`flex items-center pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'board'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                    >
                        <Kanban size={18} className="mr-2" />
                        アクティブスプリント
                    </button>
                    <button
                        onClick={() => setActiveTab('retrospective')}
                        className={`flex items-center pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'retrospective'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                    >
                        <RotateCcw size={18} className="mr-2" />
                        レトロスペクティブ
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'backlog' ? (
                    <BacklogView />
                ) : activeTab === 'board' ? (
                    <Board currentProjectId={currentProjectId} onOpenHistory={onOpenHistory} />
                ) : (
                    <RetrospectiveView />
                )}
            </div>
        </div>
    );
}
