import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const parserSourcePath = join(
    process.cwd(),
    'src',
    'components',
    'ai',
    'suggestionParser.ts',
);
const tempDir = mkdtempSync(join(tmpdir(), 'vicara-suggestion-parser-'));
const tempModulePath = join(tempDir, 'suggestionParser.mjs');

try {
    const parserSource = readFileSync(parserSourcePath, 'utf8');
    const transpiled = ts.transpileModule(parserSource, {
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2020,
        },
    });
    writeFileSync(tempModulePath, transpiled.outputText, 'utf8');

    const {
        looksLikePoAssistantSuggestionCandidate,
        parsePoAssistantSuggestion,
    } = await import(pathToFileURL(tempModulePath).href);

    const numberedHeading = parsePoAssistantSuggestion(`## 提案
### 1. タイトル案
改善したタイトル

### 説明案
改善した説明

### 優先度案
2`);
    assert.equal(numberedHeading?.title, '改善したタイトル');
    assert.equal(numberedHeading?.priority, 2);

    const differentHeadingLevel = parsePoAssistantSuggestion(`## 提案
#### タイトル案
別タイトル

#### 説明案
別説明

#### 優先度案
3`);
    assert.equal(differentHeadingLevel?.title, '別タイトル');
    assert.equal(differentHeadingLevel?.description, '別説明');

    const englishHeading = parsePoAssistantSuggestion(`## Proposal
### Title Suggestion
English title

### Description
English description

### Priority
4`);
    assert.equal(englishHeading?.title, 'English title');
    assert.equal(englishHeading?.priority, 4);

    const fullWidthColon = parsePoAssistantSuggestion(`## 提案
### タイトル案：
全角コロンタイトル

### 説明案：
全角コロン説明

### 優先度案：
5`);
    assert.equal(fullWidthColon?.title, '全角コロンタイトル');
    assert.equal(fullWidthColon?.priority, 5);

    const fallbackWithoutProposalHeading = parsePoAssistantSuggestion(`### タイトル案
フォールバックタイトル

### 説明案
フォールバック説明

### 優先度案
変更なし`);
    assert.equal(fallbackWithoutProposalHeading?.title, 'フォールバックタイトル');
    assert.equal(fallbackWithoutProposalHeading?.priority, null);

    let multipleProposalWarningCount = 0;
    const multipleProposals = parsePoAssistantSuggestion(
        `## 提案
### タイトル案
最初の提案

### 説明案
最初の説明

### 優先度案
2

## 提案
### タイトル案
二つ目の提案`,
        {
            onWarning: (warning) => {
                if (warning === 'multiple_proposals') {
                    multipleProposalWarningCount += 1;
                }
            },
        },
    );
    assert.equal(multipleProposalWarningCount, 1);
    assert.equal(multipleProposals?.title, '最初の提案');

    const storyFocusGuard = parsePoAssistantSuggestion(
        `## 提案
### タイトル案
Story では無効`,
        { focusKind: 'story' },
    );
    assert.equal(storyFocusGuard, null);

    assert.equal(
        looksLikePoAssistantSuggestionCandidate(`### タイトル案
候補

### 説明案
候補説明`),
        true,
    );

    console.log('suggestionParser tests passed');
} finally {
    rmSync(tempDir, { recursive: true, force: true });
}
