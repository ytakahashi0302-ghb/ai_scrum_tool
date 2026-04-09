import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface WarningBannerProps {
    message: ReactNode;
    details?: ReactNode;
    children?: ReactNode;
}

export function WarningBanner({ message, details, children }: WarningBannerProps) {
    return (
        <div
            role="alert"
            className="rounded-2xl border border-amber-300 bg-amber-50/95 px-4 py-3 text-amber-950 shadow-sm"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <AlertTriangle size={18} />
                    </div>
                    <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold leading-6">{message}</p>
                        {details && (
                            <div className="text-sm leading-6 text-amber-900/80">
                                {details}
                            </div>
                        )}
                    </div>
                </div>

                {children && (
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
