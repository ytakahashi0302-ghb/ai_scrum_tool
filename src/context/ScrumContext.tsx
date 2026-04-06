import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useStories } from '../hooks/useStories';
import { useTasks } from '../hooks/useTasks';
import { useSprints } from '../hooks/useSprints';
import { useTaskDependencies } from '../hooks/useTaskDependencies';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Story, Task, Sprint, TaskDependency } from '../types';

interface ScrumContextType {
    stories: Story[];
    tasks: Task[];
    sprints: Sprint[];
    dependencies: TaskDependency[];
    loading: boolean;
    addStory: (story: Omit<Story, 'created_at' | 'updated_at' | 'project_id'>) => Promise<void>;
    updateStory: (story: Story) => Promise<void>;
    deleteStory: (id: string) => Promise<void>;
    addTask: (task: Omit<Task, 'created_at' | 'updated_at' | 'project_id'>) => Promise<void>;
    updateTaskStatus: (taskId: string, status: Task['status']) => Promise<void>;
    updateTask: (task: Task) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    createPlannedSprint: () => Promise<Sprint>;
    startSprint: (sprintId: string, durationMs: number) => Promise<void>;
    completeSprint: (sprintId: string, completedAt: number) => Promise<void>;
    assignStoryToSprint: (storyId: string, sprintId: string | null) => Promise<void>;
    assignTaskToSprint: (taskId: string, sprintId: string | null) => Promise<void>;
    setTaskDependencies: (taskId: string, blockedByIds: string[]) => Promise<void>;
    isTaskBlocked: (taskId: string) => boolean;
    getTaskBlockers: (taskId: string) => Task[];
    getBlockerIds: (taskId: string) => string[];
    refresh: () => Promise<void>;
}

const ScrumContext = createContext<ScrumContextType | undefined>(undefined);

export function ScrumProvider({ children }: { children: ReactNode }) {
    const {
        stories,
        loading: storiesLoading,
        fetchStories,
        addStory,
        updateStory,
        deleteStory
    } = useStories();

    const {
        tasks,
        loading: tasksLoading,
        fetchTasks,
        addTask,
        updateTaskStatus,
        updateTask,
        deleteTask
    } = useTasks();

    const {
        sprints,
        loading: sprintsLoading,
        fetchSprints,
        createPlannedSprint,
        startSprint,
        completeSprint
    } = useSprints();

    const {
        dependencies,
        fetchDependencies,
        setTaskDependencies,
        isTaskBlocked: isTaskBlockedRaw,
        getTaskBlockers: getTaskBlockersRaw,
        getBlockerIds,
    } = useTaskDependencies();

    useEffect(() => {
        fetchStories();
        fetchTasks();
        fetchSprints();
        fetchDependencies();

        const unlistenPromise = listen('kanban-updated', () => {
            fetchStories();
            fetchTasks();
            fetchSprints();
            fetchDependencies();
        });

        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    }, [fetchStories, fetchTasks, fetchSprints, fetchDependencies]);

    const refresh = async () => {
        await Promise.all([fetchStories(), fetchTasks(), fetchSprints(), fetchDependencies()]);
    };

    const isTaskBlocked = (taskId: string) => isTaskBlockedRaw(taskId, tasks);
    const getTaskBlockers = (taskId: string) => getTaskBlockersRaw(taskId, tasks);

    const assignStoryToSprint = async (storyId: string, sprintId: string | null) => {
        await invoke('assign_story_to_sprint', { storyId, sprintId });
        await refresh();
    };

    const assignTaskToSprint = async (taskId: string, sprintId: string | null) => {
        await invoke('assign_task_to_sprint', { taskId, sprintId });
        await refresh();
    };

    const value = {
        stories,
        tasks,
        sprints,
        dependencies,
        loading: storiesLoading || tasksLoading || sprintsLoading,
        addStory,
        updateStory,
        deleteStory,
        addTask,
        updateTaskStatus,
        updateTask,
        deleteTask,
        createPlannedSprint,
        startSprint,
        completeSprint,
        assignStoryToSprint,
        assignTaskToSprint,
        setTaskDependencies,
        isTaskBlocked,
        getTaskBlockers,
        getBlockerIds,
        refresh
    };

    return <ScrumContext.Provider value={value}>{children}</ScrumContext.Provider>;
}

export function useScrum() {
    const context = useContext(ScrumContext);
    if (context === undefined) {
        throw new Error('useScrum must be used within a ScrumProvider');
    }
    return context;
}
