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
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="ワークスペースを切り替える"
            >
                <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="max-w-[170px] truncate">
                    {currentProject ? currentProject.name : 'ワークスペース読込中...'}
                </span>
                <svg className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.45)]">
                    <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        ワークスペースを選択
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {projects.map(project => (
                            <button
                                key={project.id}
                                onClick={() => handleSelectProject(project.id)}
                                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${currentProjectId === project.id
                                    ? 'bg-sky-50 font-medium text-sky-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                <span className="truncate">{project.name}</span>
                                {currentProjectId === project.id && (
                                    <svg className="h-4 w-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="mt-1 border-t border-slate-100 pt-1">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                setIsCreateModalOpen(true);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-sky-700 hover:bg-sky-50"
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
