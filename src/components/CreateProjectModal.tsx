import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { Button } from './ui/Button';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
    const { addProject } = useWorkspace();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            const id = crypto.randomUUID();
            await addProject(id, name.trim(), description.trim() || null);
            setName('');
            setDescription('');
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ヘッダー内の ProjectSelector からレンダリングされるため、祖先の overflow/transform
    // によって fixed 配置が閉じ込められる。document.body 直下に Portal で逃がすことで
    // 常にビューポート全体を覆うモーダルとして正しく表示させる。
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-900">新規プロジェクト作成</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    プロジェクト名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="例: Vicara"
                                    required
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    ここで登録した名前が、Story / Task / Sprint の表示ラベルに使われます。
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    説明 (任意)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="プロジェクトの概要や目標を入力してください"
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 bg-white px-6 py-4">
                        <Button type="button" variant="secondary" onClick={onClose}>
                            キャンセル
                        </Button>
                        <Button type="submit" disabled={!name.trim() || isSubmitting}>
                            作成
                        </Button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}
