import React, { ButtonHTMLAttributes } from 'react';
import { cn } from './Modal';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
                    {
                        'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500': variant === 'primary',
                        'bg-slate-200 text-slate-900 hover:bg-slate-300 focus:ring-blue-500': variant === 'secondary',
                        'bg-red-600 text-white hover:bg-red-700 focus:ring-blue-500': variant === 'danger',
                        'bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-blue-500': variant === 'ghost',
                        'h-8 px-3 text-xs': size === 'sm',
                        'h-10 px-4 py-2 text-sm': size === 'md',
                        'h-12 px-6 py-3 text-base': size === 'lg',
                    },
                    className
                )}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';
