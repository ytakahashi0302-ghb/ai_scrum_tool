import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TaskMessage } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface TaskChatPaneProps {
    taskId: string;
    assigneeType: string;
}

export const TaskChatPane: React.FC<TaskChatPaneProps> = ({ taskId, assigneeType }) => {
    const { currentProjectId, projects } = useWorkspace();
    const [messages, setMessages] = useState<TaskMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadMessages();
    }, [taskId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const loadMessages = async () => {
        try {
            const data = await invoke<TaskMessage[]>('get_task_messages', { taskId });
            setMessages(data);
        } catch (error) {
            console.error('Failed to load messages:', error);
            toast.error('チャット履歴の読み込みに失敗しました');
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const currentProject = projects.find(p => p.id === currentProjectId);
        if (!currentProject?.local_path) {
            toast.error('AIチャットを利用するには、設定からプロジェクトのフォルダ（ローカルパス）を設定してください');
            return;
        }

        const userContent = input.trim();
        setInput('');
        
        const userMsgId = uuidv4();
        const userMsg: TaskMessage = {
            id: userMsgId,
            task_id: taskId,
            role: 'user',
            content: userContent,
            created_at: new Date().toISOString()
        };

        // UI Optimistic Update
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            // 1. Save User Message
            await invoke('add_task_message', {
                id: userMsgId,
                taskId: taskId,
                role: 'user',
                content: userContent,
            });

            // 2. Call AI
            const aiResponse = await invoke<{ reply: string }>('chat_with_task_ai', {
                projectId: currentProjectId,
                taskId: taskId,
                assigneeType: assigneeType,
                messagesHistory: messages,
            });

            const replyContent = aiResponse.reply;

            // 3. Save AI Message
            const aiMsgId = uuidv4();
            const aiMsg: TaskMessage = {
                id: aiMsgId,
                task_id: taskId,
                role: 'assistant',
                content: replyContent,
                created_at: new Date().toISOString()
            };

            await invoke('add_task_message', {
                id: aiMsgId,
                taskId: taskId,
                role: 'assistant',
                content: replyContent,
            });

            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error('AI chat failed:', error);
            toast.error(`推論に失敗しました: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        e.stopPropagation(); // 変換中のスペースキー暴発を防ぐ
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSend();
        }
    };

    const stopPropagation = (e: React.KeyboardEvent | React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div className="flex flex-col h-full border-l border-gray-200 bg-gray-50/50">
            <div className="flex items-center gap-2 p-3 border-b border-gray-200 bg-white">
                <Bot className="text-blue-500" size={18} />
                <span className="font-medium text-sm text-gray-700">AI {assigneeType}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px]">
                {messages.length === 0 && !isLoading && (
                    <div className="text-center text-sm text-gray-400 my-8">
                        <Bot size={32} className="mx-auto mb-2 opacity-20" />
                        <p>メッセージを送信して、AI壁打ちを開始しましょう。<br />ルールやドキュメントの文脈は自動的に共有されます。</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={`rounded-xl p-3 text-sm prose prose-sm max-w-none ${
                                msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white prose-p:text-white prose-a:text-indigo-200' 
                                    : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                            }`}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="flex gap-2 max-w-[85%]">
                            <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                                <Bot size={16} />
                            </div>
                            <div className="rounded-xl p-4 bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                                <Loader2 size={16} className="animate-spin text-gray-400" />
                            </div>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t border-gray-200">
                <form onSubmit={handleSend} className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onKeyUp={stopPropagation}
                        onKeyPress={stopPropagation}
                        placeholder="AIにメッセージを送信... (Cmd/Ctrl + Enter)"
                        className="w-full pl-3 pr-12 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none min-h-[60px] max-h-[120px] text-sm bg-white"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 bottom-3 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
};
