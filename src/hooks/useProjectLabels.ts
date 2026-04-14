import { useWorkspace } from '../context/WorkspaceContext';

type WithSequenceNumber = {
    sequence_number: number;
};

function formatSequenceLabel(prefix: string, sequenceNumber: number | null | undefined) {
    if (!sequenceNumber) {
        return prefix;
    }

    return `${prefix}-${sequenceNumber}`;
}

function normalizeProjectName(name: string | null | undefined) {
    const trimmed = name?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : 'PROJECT';
}

export function formatStoryLabel(
    sequenceNumber: number | null | undefined,
) {
    return formatSequenceLabel('UserStory', sequenceNumber);
}

export function formatTaskLabel(
    sequenceNumber: number | null | undefined,
) {
    return formatSequenceLabel('Task', sequenceNumber);
}

export function formatSprintLabel(
    projectName: string | null | undefined,
    sprint: WithSequenceNumber,
) {
    return `${normalizeProjectName(projectName)} / スプリント ${sprint.sequence_number}`;
}

export function useProjectLabels(projectId?: string | null) {
    const { projects, currentProjectId } = useWorkspace();
    const resolvedProjectId = projectId ?? currentProjectId;
    const currentProject = projects.find((project) => project.id === resolvedProjectId) ?? null;
    const projectName = normalizeProjectName(currentProject?.name);

    return {
        currentProject,
        projectName,
        formatStoryLabel,
        formatTaskLabel,
        formatSprintLabel: (sprint: WithSequenceNumber) => formatSprintLabel(projectName, sprint),
    };
}
