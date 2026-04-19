import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const focusStateSourcePath = join(
    process.cwd(),
    'src',
    'context',
    'poAssistantFocusState.ts',
);
const tempDir = mkdtempSync(join(tmpdir(), 'vicara-po-focus-state-'));
const tempModulePath = join(tempDir, 'poAssistantFocusState.mjs');

try {
    const source = readFileSync(focusStateSourcePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2020,
        },
    });
    writeFileSync(tempModulePath, transpiled.outputText, 'utf8');

    const { buildFocusTarget, poAssistantFocusReducer } = await import(
        pathToFileURL(tempModulePath).href
    );

    const firstPinnedAt = '2026-04-19T10:00:00.000Z';
    const secondPinnedAt = '2026-04-19T10:05:00.000Z';

    const initialSetState = poAssistantFocusReducer(null, {
        type: 'set',
        target: { kind: 'task', id: 'task-1' },
        now: () => firstPinnedAt,
    });
    assert.deepEqual(initialSetState, {
        kind: 'task',
        id: 'task-1',
        pinnedAt: firstPinnedAt,
    });

    assert.deepEqual(
        buildFocusTarget(
            { kind: 'story', id: 'story-1', pinnedAt: secondPinnedAt },
            () => firstPinnedAt,
        ),
        {
            kind: 'story',
            id: 'story-1',
            pinnedAt: secondPinnedAt,
        },
    );

    const refocusedState = poAssistantFocusReducer(initialSetState, {
        type: 'set',
        target: { kind: 'story', id: 'story-9' },
        now: () => secondPinnedAt,
    });
    assert.deepEqual(refocusedState, {
        kind: 'story',
        id: 'story-9',
        pinnedAt: secondPinnedAt,
    });

    assert.equal(
        poAssistantFocusReducer(refocusedState, {
            type: 'clear',
        }),
        null,
    );

    assert.equal(
        poAssistantFocusReducer(refocusedState, {
            type: 'project_changed',
        }),
        null,
    );

    console.log('PoAssistantFocusContext tests passed');
} finally {
    rmSync(tempDir, { recursive: true, force: true });
}
