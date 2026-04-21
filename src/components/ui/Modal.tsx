import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    width?: 'sm' | 'md' | 'lg' | 'xl' | '5xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, width = 'md' }) => {
    if (!isOpen) return null;

    const widthClass = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        '5xl': 'max-w-5xl',
    }[width];

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div
                className={cn("bg-white rounded-xl shadow-xl w-full flex flex-col max-h-[90vh]", widthClass)}
                onClick={(e) => e.stopPropagation()}
                onKeyDownCapture={(e) => e.stopPropagation()}
                onPointerDownCapture={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 p-4">
                    <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
