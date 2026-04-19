import type { FocusKind } from '../../context/PoAssistantFocusContext';

export interface PoAssistantSuggestion {
    title: string | null;
    description: string | null;
    priority: number | null;
}

export interface ParsePoAssistantSuggestionOptions {
    focusKind?: FocusKind | null;
    onWarning?: (warning: 'multiple_proposals') => void;
}

interface HeadingEntry {
    level: number;
    lineIndex: number;
    text: string;
}

const PROPOSAL_SYNONYMS = ['提案', 'suggestion', 'proposal'];
const TITLE_SYNONYMS = ['タイトル案', 'タイトル', 'title', 'title suggestion', 'new title', '新しいタイトル'];
const DESCRIPTION_SYNONYMS = [
    '説明案',
    '説明',
    'description',
    'description suggestion',
    'new description',
    '新しい説明',
];
const PRIORITY_SYNONYMS = ['優先度案', '優先度', 'priority', 'priority suggestion', 'new priority'];

function normalizeHeadingText(rawText: string) {
    let normalized = rawText
        .replace(/\u3000/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    normalized = normalized.replace(/^[-*+・]\s*/, '');
    normalized = normalized.replace(/^[0-9０-９]+[.)．、:-]\s*/, '');
    normalized = normalized.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]+\s*/, '');
    normalized = normalized.replace(/^\(?[0-9０-９]+\)?\s*/, '');
    normalized = normalized.replace(/^第?[一二三四五六七八九十0-9０-９]+[章項節]\s*/, '');
    normalized = normalized.replace(/[:：]\s*$/, '');

    return normalized.trim().toLowerCase();
}

function matchesHeading(text: string, synonyms: string[]) {
    return synonyms.some((synonym) => text === synonym);
}

function extractHeadings(lines: string[]) {
    const headings: HeadingEntry[] = [];

    lines.forEach((line, lineIndex) => {
        const match = line.match(/^\s{0,3}(#{2,4})\s*(.+?)\s*#*\s*$/);
        if (!match) {
            return;
        }

        headings.push({
            level: match[1].length,
            lineIndex,
            text: normalizeHeadingText(match[2]),
        });
    });

    return headings;
}

function parsePriority(rawValue: string) {
    const trimmed = rawValue.replace(/\u3000/g, ' ').trim();
    if (!trimmed) {
        return null;
    }

    if (/^(変更なし|no changes?|unchanged)$/i.test(trimmed)) {
        return null;
    }

    const match = trimmed.match(/(^|[^0-9])([1-5])(?![0-9])/);
    return match ? Number(match[2]) : null;
}

function readSectionContent(
    lines: string[],
    startLineIndex: number,
    endLineIndex: number,
) {
    return lines
        .slice(startLineIndex, endLineIndex)
        .join('\n')
        .trim();
}

function findSectionEntries(
    lines: string[],
    headings: HeadingEntry[],
    blockStartLineIndex: number,
    blockEndLineIndex: number,
) {
    const blockHeadings = headings.filter(
        (heading) =>
            heading.lineIndex >= blockStartLineIndex && heading.lineIndex < blockEndLineIndex,
    );
    const suggestion: PoAssistantSuggestion = {
        title: null,
        description: null,
        priority: null,
    };
    let recognizedCount = 0;

    for (let index = 0; index < blockHeadings.length; index += 1) {
        const currentHeading = blockHeadings[index];
        const nextHeading = blockHeadings[index + 1];
        const contentStartLine = currentHeading.lineIndex + 1;
        const contentEndLine = nextHeading?.lineIndex ?? blockEndLineIndex;
        const content = readSectionContent(lines, contentStartLine, contentEndLine);

        if (!content) {
            continue;
        }

        if (!suggestion.title && matchesHeading(currentHeading.text, TITLE_SYNONYMS)) {
            suggestion.title = content;
            recognizedCount += 1;
            continue;
        }

        if (
            !suggestion.description &&
            matchesHeading(currentHeading.text, DESCRIPTION_SYNONYMS)
        ) {
            suggestion.description = content;
            recognizedCount += 1;
            continue;
        }

        if (!matchesHeading(currentHeading.text, PRIORITY_SYNONYMS)) {
            continue;
        }

        suggestion.priority = parsePriority(content);
        recognizedCount += 1;
    }

    return { recognizedCount, suggestion };
}

export function looksLikePoAssistantSuggestionCandidate(markdown: string) {
    const normalized = markdown.replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    const headings = extractHeadings(lines);
    const proposalHeadings = headings.filter((heading) =>
        matchesHeading(heading.text, PROPOSAL_SYNONYMS),
    );

    if (proposalHeadings.length > 0) {
        return true;
    }

    const { recognizedCount } = findSectionEntries(lines, headings, 0, lines.length);
    return recognizedCount >= 2;
}

export function parsePoAssistantSuggestion(
    markdown: string,
    options: ParsePoAssistantSuggestionOptions = {},
) {
    if (options.focusKind === 'story') {
        return null;
    }

    const normalized = markdown.replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    const headings = extractHeadings(lines);
    const proposalHeadings = headings.filter((heading) =>
        matchesHeading(heading.text, PROPOSAL_SYNONYMS),
    );

    let blockStartLineIndex = 0;
    let blockEndLineIndex = lines.length;

    if (proposalHeadings.length > 0) {
        if (proposalHeadings.length > 1) {
            options.onWarning?.('multiple_proposals');
        }

        const firstProposal = proposalHeadings[0];
        const nextSiblingProposal = headings.find(
            (heading) =>
                heading.lineIndex > firstProposal.lineIndex &&
                heading.level <= firstProposal.level,
        );

        blockStartLineIndex = firstProposal.lineIndex + 1;
        blockEndLineIndex = nextSiblingProposal?.lineIndex ?? lines.length;
    }

    // Forgiving parser: heading level, numbering, colon style, and synonyms can all wobble.
    const { recognizedCount, suggestion } = findSectionEntries(
        lines,
        headings,
        blockStartLineIndex,
        blockEndLineIndex,
    );

    if (proposalHeadings.length === 0 && recognizedCount < 2) {
        return null;
    }

    if (
        suggestion.title === null &&
        suggestion.description === null &&
        suggestion.priority === null
    ) {
        return null;
    }

    return suggestion;
}
