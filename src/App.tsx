import "./App.css";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "react-hot-toast";
import {
    Bot,
    LayoutDashboard,
    Lightbulb,
    RefreshCcw,
    Settings as SettingsIcon,
    TerminalSquare,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ScrumProvider } from "./context/ScrumContext";
import { PoAssistantFocusProvider, useFocus } from "./context/PoAssistantFocusContext";
import { WorkspaceProvider, useWorkspace } from "./context/WorkspaceContext";
import { SprintTimerProvider } from "./context/SprintTimerContext";
import { usePoAssistantAvatarImage } from "./hooks/usePoAssistantAvatarImage";
import { ProjectSelector } from "./components/ui/ProjectSelector";
import { ProjectSettings } from "./components/ui/ProjectSettings";
import { WarningBanner } from "./components/ui/WarningBanner";
import { EdgeTabHandle } from "./components/ui/EdgeTabHandle";
import { LlmUsagePill } from "./components/ui/LlmUsagePill";
import { InceptionDeck } from "./components/project/InceptionDeck";
import { ScrumDashboard } from "./components/kanban/ScrumDashboard";
import { PoAssistantSidebar } from "./components/ai/PoAssistantSidebar";
import { HistoryModal } from "./components/HistoryModal";
import { SprintTimer } from "./components/SprintTimer";
import { TerminalDock } from "./components/terminal/TerminalDock";
import { SettingsPage } from "./components/ui/settings/SettingsPage";

type AppView = "kanban" | "inception" | "settings";
type PrimaryView = Exclude<AppView, "settings">;
type ResizeHandle = "sidebar" | "terminal" | null;

const SIDEBAR_RATIO_STORAGE_KEY = "vicara.layout.sidebarRatio";
const TERMINAL_RATIO_STORAGE_KEY = "vicara.layout.terminalRatio";
const DEFAULT_SIDEBAR_RATIO = 0.7;
const DEFAULT_TERMINAL_RATIO = 0.38;
const MIN_MAIN_PANE_WIDTH = 420;
const MIN_SIDEBAR_WIDTH = 320;
const MIN_DASHBOARD_HEIGHT = 260;
const MIN_TERMINAL_HEIGHT = 180;
const SPLITTER_SIZE_PX = 10;
const TERMINAL_MINIMIZED_HEIGHT_PX = 34;

interface AppHeaderProps {
    currentView: AppView;
    currentProjectId: string;
    showProjectSettings: boolean;
    onSetView: (view: AppView) => void;
}

const APP_VIEW_ITEMS: Array<{
    view: AppView;
    label: string;
    icon: typeof LayoutDashboard;
}> = [
    { view: "inception", label: "Inception Deck", icon: Lightbulb },
    { view: "kanban", label: "Kanban", icon: LayoutDashboard },
    { view: "settings", label: "Settings", icon: SettingsIcon },
];

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function readStoredRatio(key: string, fallback: number) {
    if (typeof window === "undefined") {
        return fallback;
    }

    const stored = Number.parseFloat(window.localStorage.getItem(key) ?? "");
    return Number.isFinite(stored) ? stored : fallback;
}

/**
 * AppHeader (EPIC45 v2)
 * - 中央に Inception Deck / Kanban / Settings のセグメント切替
 * - ヘッダー右クラスターは Project / Folder 設定のみに整理
 */
function AppHeader({
    currentView,
    currentProjectId,
    showProjectSettings,
    onSetView,
}: AppHeaderProps) {
    return (
        <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="w-full px-4 sm:px-6 lg:px-8">
                <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
                    {/* Brand */}
                    <div className="flex min-w-0 items-center">
                        <img
                            src="/logos/banner.png"
                            alt="Vicara"
                            className="h-10 w-auto object-contain sm:h-12 lg:h-[52px]"
                        />
                    </div>

                    {/* Inception Deck / Kanban / Settings segmented toggle */}
                    <div
                        role="tablist"
                        aria-label="表示ビューの切替"
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm"
                    >
                        {APP_VIEW_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const selected = currentView === item.view;
                            return (
                                <button
                                    key={item.view}
                                    type="button"
                                    role="tab"
                                    aria-selected={selected}
                                    onClick={() => onSetView(item.view)}
                                    className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                                        selected
                                            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                                            : "text-slate-500 hover:text-slate-900"
                                    }`}
                                >
                                    <Icon size={15} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right utility cluster */}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <ProjectSelector />
                        {showProjectSettings && <ProjectSettings />}
                        <LlmUsagePill projectId={currentProjectId} />
                    </div>
                </div>
            </div>

            {currentView === "kanban" && <SprintTimer />}
        </header>
    );
}

function AppContent() {
    const { projects, currentProjectId, gitStatus, refreshGitStatus } = useWorkspace();
    const { focus } = useFocus();
    const poAssistantAvatarImage = usePoAssistantAvatarImage();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [currentView, setCurrentView] = useState<AppView>("kanban");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isTerminalMinimized, setIsTerminalMinimized] = useState(true);
    const [isAgentRunning, setIsAgentRunning] = useState(false);
    const [hasUnreadPoMessage, setHasUnreadPoMessage] = useState(false);
    const [sidebarRatio, setSidebarRatio] = useState(() =>
        readStoredRatio(SIDEBAR_RATIO_STORAGE_KEY, DEFAULT_SIDEBAR_RATIO),
    );
    const [terminalRatio, setTerminalRatio] = useState(() =>
        readStoredRatio(TERMINAL_RATIO_STORAGE_KEY, DEFAULT_TERMINAL_RATIO),
    );
    const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle>(null);
    const kanbanContainerRef = useRef<HTMLDivElement | null>(null);
    const mainPaneRef = useRef<HTMLDivElement | null>(null);
    const lastPrimaryViewRef = useRef<PrimaryView>("kanban");
    const currentProject = projects.find((project) => project.id === currentProjectId) ?? null;

    // Suppress unused warning (avatar image is still used internally by the PO assistant sidebar via hook)
    void poAssistantAvatarImage;

    useEffect(() => {
        window.localStorage.setItem(SIDEBAR_RATIO_STORAGE_KEY, sidebarRatio.toString());
    }, [sidebarRatio]);

    useEffect(() => {
        window.localStorage.setItem(TERMINAL_RATIO_STORAGE_KEY, terminalRatio.toString());
    }, [terminalRatio]);

    useEffect(() => {
        if (
            !(
                (!isSidebarOpen && activeResizeHandle === "sidebar") ||
                (isTerminalMinimized && activeResizeHandle === "terminal")
            )
        ) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setActiveResizeHandle(null);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [activeResizeHandle, isSidebarOpen, isTerminalMinimized]);

    useEffect(() => {
        if (currentView === "kanban" || activeResizeHandle === null) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setActiveResizeHandle(null);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [activeResizeHandle, currentView]);

    useEffect(() => {
        if (!focus || currentView !== "kanban") {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setIsSidebarOpen(true);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [currentView, focus]);

    useEffect(() => {
        if (activeResizeHandle === null) {
            document.body.style.removeProperty("cursor");
            document.body.style.removeProperty("user-select");
            return;
        }

        document.body.style.cursor =
            activeResizeHandle === "sidebar" ? "col-resize" : "row-resize";
        document.body.style.userSelect = "none";

        const handlePointerMove = (event: PointerEvent) => {
            if (activeResizeHandle === "sidebar" && kanbanContainerRef.current && isSidebarOpen) {
                const rect = kanbanContainerRef.current.getBoundingClientRect();
                const maxLeft = rect.width - MIN_SIDEBAR_WIDTH;
                const minRatio = MIN_MAIN_PANE_WIDTH / rect.width;
                const maxRatio = maxLeft / rect.width;

                if (rect.width <= MIN_MAIN_PANE_WIDTH + MIN_SIDEBAR_WIDTH || maxRatio <= minRatio) {
                    return;
                }

                const rawRatio = (event.clientX - rect.left) / rect.width;
                setSidebarRatio(clamp(rawRatio, minRatio, maxRatio));
                return;
            }

            if (
                activeResizeHandle === "terminal" &&
                mainPaneRef.current &&
                !isTerminalMinimized
            ) {
                const rect = mainPaneRef.current.getBoundingClientRect();
                const availableHeight = rect.height - SPLITTER_SIZE_PX;
                const maxTerminalHeight = availableHeight - MIN_DASHBOARD_HEIGHT;

                if (availableHeight <= MIN_DASHBOARD_HEIGHT + MIN_TERMINAL_HEIGHT) {
                    return;
                }

                const terminalHeight = rect.bottom - event.clientY;
                const minRatio = MIN_TERMINAL_HEIGHT / availableHeight;
                const maxRatio = maxTerminalHeight / availableHeight;
                const rawRatio = terminalHeight / availableHeight;
                setTerminalRatio(clamp(rawRatio, minRatio, maxRatio));
            }
        };

        const handlePointerUp = () => {
            setActiveResizeHandle(null);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            document.body.style.removeProperty("cursor");
            document.body.style.removeProperty("user-select");
        };
    }, [activeResizeHandle, isSidebarOpen, isTerminalMinimized]);

    const isDraggingSidebar = activeResizeHandle === "sidebar";
    const isDraggingTerminal = activeResizeHandle === "terminal";
    const mainPaneWidthStyle = isSidebarOpen
        ? { width: `calc(${(sidebarRatio * 100).toFixed(4)}% - ${SPLITTER_SIZE_PX / 2}px)` }
        : { width: "100%" };
    const sidebarWidthStyle = isSidebarOpen
        ? { width: `calc(${((1 - sidebarRatio) * 100).toFixed(4)}% - ${SPLITTER_SIZE_PX / 2}px)` }
        : { width: "0px" };
    const dashboardHeightStyle = isTerminalMinimized
        ? undefined
        : {
              height: `calc((100% - ${SPLITTER_SIZE_PX}px) * ${(1 - terminalRatio).toFixed(4)})`,
          };
    const terminalHeightStyle = isTerminalMinimized
        ? { height: `${TERMINAL_MINIMIZED_HEIGHT_PX}px` }
        : {
              height: `calc((100% - ${SPLITTER_SIZE_PX}px) * ${terminalRatio.toFixed(4)})`,
          };

    // Dev edge tab floats just above the terminal dock
    const devEdgeTabBottomStyle = isTerminalMinimized
        ? { bottom: `${TERMINAL_MINIMIZED_HEIGHT_PX}px` }
        : {
              bottom: `calc((100% - ${SPLITTER_SIZE_PX}px) * ${terminalRatio.toFixed(4)})`,
          };

    const handleSetView = (view: AppView) => {
        if (view !== "settings") {
            lastPrimaryViewRef.current = view;
        }
        setCurrentView(view);
    };

    return (
        <div className="relative flex h-screen flex-col overflow-hidden bg-slate-100 font-sans">
            <AppHeader
                currentView={currentView}
                currentProjectId={currentProjectId}
                showProjectSettings={!currentProject?.local_path}
                onSetView={handleSetView}
            />

            {gitStatus.checked && !gitStatus.installed && (
                <div className="shrink-0 px-4 pt-4 sm:px-6 lg:px-8">
                    <WarningBanner
                        message="Git が検出されません。Dev エージェント機能を使用するには Git のインストールが必要です。"
                        details={
                            gitStatus.message ??
                            "Git をインストール後に再チェックすると Dev エージェント機能を利用できます。"
                        }
                    >
                        <button
                            type="button"
                            onClick={() => void openUrl("https://git-scm.com/downloads")}
                            className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
                        >
                            Git をダウンロード
                        </button>
                        <button
                            type="button"
                            onClick={() => void refreshGitStatus()}
                            className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition-colors hover:bg-amber-100"
                        >
                            <RefreshCcw size={15} className="mr-2" />
                            再チェック
                        </button>
                    </WarningBanner>
                </div>
            )}

            {currentView === "settings" ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                    <SettingsPage onClose={() => setCurrentView(lastPrimaryViewRef.current)} />
                </div>
            ) : currentView === "inception" ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                    <InceptionDeck />
                </div>
            ) : (
                <div
                    ref={kanbanContainerRef}
                    className="relative flex min-h-0 flex-1 flex-row overflow-hidden bg-slate-50/50 backdrop-blur-sm"
                >
                    <div
                        ref={mainPaneRef}
                        style={mainPaneWidthStyle}
                        className={`relative z-10 flex min-h-0 flex-col overflow-hidden ${
                            isSidebarOpen ? "border-r border-slate-200/60" : ""
                        } ${
                            isDraggingSidebar || isDraggingTerminal
                                ? "transition-none"
                                : "transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                        }`}
                    >
                        <div
                            style={dashboardHeightStyle}
                            className={`min-h-0 overflow-hidden bg-transparent ${
                                isTerminalMinimized ? "flex-1" : ""
                            }`}
                        >
                            <ScrumDashboard
                                currentProjectId={currentProjectId}
                                onOpenHistory={() => setIsHistoryOpen(true)}
                            />
                        </div>

                        {!isTerminalMinimized && (
                            <div
                                role="separator"
                                aria-orientation="horizontal"
                                aria-label="terminal height resize handle"
                                className="app-splitter app-splitter-y"
                                onPointerDown={(event) => {
                                    event.preventDefault();
                                    setActiveResizeHandle("terminal");
                                }}
                            />
                        )}

                        <div
                            style={terminalHeightStyle}
                            className={`z-20 flex flex-col border-t border-zinc-700/90 bg-[#111318] text-slate-300 shadow-[0_-12px_40px_-15px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/5 ${
                                isDraggingTerminal
                                    ? "transition-none"
                                    : "transition-[height] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                            }`}
                        >
                            <TerminalDock
                                isMinimized={isTerminalMinimized}
                                onToggleMinimize={() => setIsTerminalMinimized((prev) => !prev)}
                                onRunningStateChange={setIsAgentRunning}
                            />
                        </div>

                        {/* チームの稼働状況 edge tab (hovers above the dock) */}
                        <div
                            className="pointer-events-none absolute inset-x-0 z-30 flex justify-center"
                            style={devEdgeTabBottomStyle}
                        >
                            <div className="pointer-events-auto">
                                <EdgeTabHandle
                                    side="bottom"
                                    label="Dev Agent"
                                    icon={TerminalSquare}
                                    active={!isTerminalMinimized}
                                    badge={isAgentRunning ? "●" : undefined}
                                    onClick={() => setIsTerminalMinimized((prev) => !prev)}
                                    title={
                                        isTerminalMinimized
                                            ? "Dev Agent を開く"
                                            : "Dev Agent を閉じる"
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {isSidebarOpen && (
                        <div
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="sidebar width resize handle"
                            className="app-splitter app-splitter-x"
                            onPointerDown={(event) => {
                                event.preventDefault();
                                setActiveResizeHandle("sidebar");
                            }}
                        />
                    )}

                    <div
                        style={sidebarWidthStyle}
                        className={`relative z-20 min-h-0 overflow-visible ${
                            isDraggingSidebar
                                ? "transition-none"
                                : "transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                        } ${
                            isSidebarOpen ? "min-w-[320px]" : "min-w-0"
                        }`}
                    >
                        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white/80 backdrop-blur-md shadow-[-12px_0_40px_-15px_rgba(0,0,0,0.15)]">
                            <PoAssistantSidebar
                                isOpen={isSidebarOpen}
                                onClose={() => setIsSidebarOpen(false)}
                                onUnreadChange={setHasUnreadPoMessage}
                            />
                        </div>

                        <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex items-center">
                            <div className="pointer-events-auto -translate-x-full">
                                <EdgeTabHandle
                                    side="right"
                                    label="PO"
                                    icon={Bot}
                                    active={isSidebarOpen}
                                    badge={hasUnreadPoMessage ? "●" : undefined}
                                    onClick={() => setIsSidebarOpen((prev) => !prev)}
                                    title={
                                        isSidebarOpen
                                            ? "POアシスタントを閉じる"
                                            : "POアシスタントを開く"
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
        </div>
    );
}

function App() {
    return (
        <WorkspaceProvider>
            <PoAssistantFocusProvider>
                <SprintTimerProvider>
                    <ScrumProvider>
                        <Toaster position="bottom-right" />
                        <AppContent />
                    </ScrumProvider>
                </SprintTimerProvider>
            </PoAssistantFocusProvider>
        </WorkspaceProvider>
    );
}

export default App;
