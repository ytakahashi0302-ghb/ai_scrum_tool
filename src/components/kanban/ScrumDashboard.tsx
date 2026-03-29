import { useState } from 'react';
import { Board } from './Board';
import { BacklogView } from './BacklogView';
import { Kanban, ListTodo } from 'lucide-react';
import { useScrum } from '../../context/ScrumContext';

export function ScrumDashboard() {
    const { loading } = useScrum();
    const [activeTab, setActiveTab] = useState<'backlog' | 'board'>('backlog');

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 h-full min-h-[50vh]">
                <div className="text-gray-500 animate-pulse">データを読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-100">
            {/* Tab navigation */}
            <div className="bg-white border-b border-gray-200 px-6 pt-3 shadow-sm sticky top-0 z-10">
                <nav className="flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('backlog')}
                        className={`flex items-center pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'backlog'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <Kanban size={18} className="mr-2" />
                        アクティブスプリント
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'backlog' ? <BacklogView /> : <Board />}
            </div>
        </div>
    );
}
