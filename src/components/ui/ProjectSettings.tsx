import { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Folder, FolderOpen, AlertCircle, Hammer } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProjectSettingsProps {
    onOpenScaffolding?: () => void;
}

export function ProjectSettings({ onOpenScaffolding }: ProjectSettingsProps) {
    const { projects, currentProjectId, updateProjectPath } = useWorkspace();
    const currentProject = projects.find(p => p.id === currentProjectId);
    const [isSelecting, setIsSelecting] = useState(false);

    if (!currentProject) return null;

    const handleScaffolding = async () => {
        if (!currentProject.local_path) {
            toast.error('先にローカルディレクトリを設定してください');
            return;
        }
        if (onOpenScaffolding) {
            onOpenScaffolding();
        } else {
            // フォールバック: AGENT.md + .claude/settings.json のみ生成
            try {
                await Promise.all([
                    invoke<string>('generate_agent_md', {
                        localPath: currentProject.local_path,
                        projectName: currentProject.name,
                    }),
                    invoke<void>('generate_claude_settings', {
                        localPath: currentProject.local_path,
                    }),
                ]);
                toast.success('AGENT.md と .claude/settings.json を生成しました');
            } catch (error) {
                toast.error(`生成失敗: ${error}`);
            }
        }
    };

    const handleSelectFolder = async () => {
        setIsSelecting(true);
        try {
            const selectedPath = await open({
                directory: true,
                multiple: false,
                title: 'プロジェクトのディレクトリを選択してください'
            });

            if (selectedPath && typeof selectedPath === 'string') {
                const result = await updateProjectPath(currentProjectId, selectedPath);
                if (result.success) {
                    toast.success('ワークスペースのディレクトリを設定しました');
                    if (result.has_product_context || result.has_architecture || result.has_rule) {
                        toast('既存のInception Deckファイルが見つかりました', { icon: 'ℹ️' });
                    }
                }
            }
        } catch (error) {
            console.error('Failed to select directory:', error);
            toast.error('ディレクトリの選択に失敗しました');
        } finally {
            setIsSelecting(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={handleSelectFolder}
                disabled={isSelecting}
                className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium shadow-sm transition-colors ${
                    currentProject.local_path
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
                title="ローカルディレクトリ設定"
            >
                {currentProject.local_path ? (
                    <>
                        <FolderOpen size={16} />
                        <span className="max-w-[120px] truncate" title={currentProject.local_path}>
                            {currentProject.local_path.split(/[\\/]/).pop()}
                        </span>
                    </>
                ) : (
                    <>
                        <Folder size={16} />
                        <span>フォルダ未設定</span>
                        <AlertCircle size={14} className="text-amber-500" />
                    </>
                )}
            </button>
            {currentProject.local_path && (
                <button
                    onClick={handleScaffolding}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100"
                    title="Scaffold: AGENT.md と .claude/settings.json を生成します"
                >
                    <Hammer size={15} />
                    <span>Scaffold</span>
                </button>
            )}
        </div>
    );
}
