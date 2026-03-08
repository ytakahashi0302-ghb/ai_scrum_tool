export interface Sprint {
    id: string;
    started_at: number;
    completed_at: number;
    duration_ms: number;
}

export interface Story {
    id: string;
    title: string;
    description: string | null;
    acceptance_criteria: string | null;
    status: 'Backlog' | 'Ready' | 'In Progress' | 'Done';
    sprint_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface Task {
    id: string;
    story_id: string;
    title: string;
    description: string | null;
    status: 'To Do' | 'In Progress' | 'Done';
    sprint_id?: string | null;
    created_at: string;
    updated_at: string;
}
