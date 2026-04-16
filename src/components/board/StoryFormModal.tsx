import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';

export interface StoryFormData {
    title: string;
    description: string;
    acceptance_criteria: string;
    priority: number;
}

interface StoryFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: StoryFormData) => Promise<void>;
    onDelete?: () => Promise<void>;
    initialData?: Partial<StoryFormData>;
    title: string;
}

export const StoryFormModal: React.FC<StoryFormModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    initialData,
    title
}) => {
    const [formData, setFormData] = useState<StoryFormData>({
        title: '',
        description: '',
        acceptance_criteria: '',
        priority: 3
    });
    const [errors, setErrors] = useState<Partial<Record<keyof StoryFormData, string>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                title: initialData?.title || '',
                description: initialData?.description || '',
                acceptance_criteria: initialData?.acceptance_criteria || '',
                priority: initialData?.priority ?? 3
            });
            setErrors({});
        }
    }, [isOpen, initialData]);

    const validate = () => {
        const newErrors: Partial<Record<keyof StoryFormData, string>> = {};
        if (!formData.title.trim()) {
            newErrors.title = 'Title is required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) {
            toast.error('タイトルを入力してください (Title is required)');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Failed to save story:', error);
            // In a real app, handle global error state here
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} width="lg" title={title}>
            <form
                onSubmit={handleSubmit}
                onKeyDownCapture={(e) => e.stopPropagation()}
                className="flex flex-col gap-4"
            >
                <Input
                    label="タイトル"
                    value={formData.title}
                    onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                    error={errors.title}
                    placeholder="ユーザーとして、〇〇を達成したい..."
                    autoFocus
                />

                <Textarea
                    label="詳細説明"
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                    placeholder="PBIの詳細な背景や説明..."
                    rows={4}
                />

                <Textarea
                    label="受け入れ条件 (Acceptance Criteria)"
                    value={formData.acceptance_criteria}
                    onChange={(e) => setFormData(p => ({ ...p, acceptance_criteria: e.target.value }))}
                    placeholder="- ユーザーが〇〇できること&#10;- 〇〇のデータが保存されること..."
                    rows={4}
                />

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">優先度 (Priority)</label>
                    <select
                        value={formData.priority}
                        onChange={(e) => setFormData(p => ({ ...p, priority: Number(e.target.value) }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value={1}>1（最重要）</option>
                        <option value={2}>2（高）</option>
                        <option value={3}>3（中・デフォルト）</option>
                        <option value={4}>4（低）</option>
                        <option value={5}>5（最低）</option>
                    </select>
                </div>

                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                    <div>
                        {onDelete && (
                            <Button
                                type="button"
                                variant="danger"
                                onClick={async () => {
                                    if (window.confirm("このPBIを削除してもよろしいですか？（紐づくタスクも削除されます）")) {
                                        await onDelete();
                                        onClose();
                                    }
                                }}
                            >
                                削除
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                            キャンセル
                        </Button>
                        <Button type="submit" variant="primary" disabled={isSubmitting}>
                            {isSubmitting ? '保存中...' : '保存'}
                        </Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};
