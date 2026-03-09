import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useSprintTimer } from '../../context/SprintTimerContext';
import { CreateProjectModal } from '../CreateProjectModal';

export function ProjectSelector() {
    const { projects, currentProjectId, setCurrentProjectId } = useWorkspace();
    const { status: timerStatus, pauseSprint } = useSprintTimer();
    const [isOpen, setIsOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentProject = projects.find(p => p.id === currentProjectId) || projects.find(p => p.id === 'default') || projects[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelectProject = async (projectId: string) => {
        if (projectId === currentProjectId) {
            setIsOpen(false);
            return;
        }

        if (timerStatus === 'RUNNING') {
            const confirmChange = window.confirm('スプリントタイマーが実行中です。タイマーを一時停止してプロジェクトを切り替えますか？');
            if (!confirmChange) {
                setIsOpen(false);
                return;
            }
            await pauseSprint();
        }

        setCurrentProjectId(projectId);
        setIsOpen(false);
    };

    return (
        <div className="relative ml-4 mr-2 border-l border-gray-200 pl-4" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                title="ワークスペースを切り替える"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="truncate max-w-[150px]">
                    {currentProject ? currentProject.name : 'ワークスペース読込中...'}
                </span>
                <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
                    <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        ワークスペースを選択
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {projects.map(project => (
                            <button
                                key={project.id}
                                onClick={() => handleSelectProject(project.id)}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${currentProjectId === project.id
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="truncate">{project.name}</span>
                                {currentProjectId === project.id && (
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                setIsCreateModalOpen(true);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 font-medium"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            新規ワークスペース作成
                        </button>
                    </div>
                </div>
            )}

            <CreateProjectModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    );
}
