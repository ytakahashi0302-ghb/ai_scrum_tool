# EPIC48 実装計画

## 概要

EPIC47で作成したDBスキーマ・CRUDコマンドを利用し、フロントエンドにレトロスペクティブUIを構築する。既存のScrumDashboardタブパターン、`useSprints`等のHookパターン、`TaskFormModal`のMarkdownプレビューパターンに従う。

## 現状整理

### ScrumDashboard（現在の構造）

- ファイル: `src/components/kanban/ScrumDashboard.tsx`
- タブ: `'backlog' | 'board'` の2タブ（`useState`で管理）
- パターン: `border-b-2` のタブボタン + `lucide-react` アイコン
- コンテンツ: `activeTab === 'backlog' ? <BacklogView /> : <Board />`

### Hook パターン（useSprints.ts等）

```typescript
export function useSprints(projectId: string | null) {
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [loading, setLoading] = useState(true);
    // invoke('get_sprints', { projectId }) → setState
    // CRUD関数をreturn
}
```

### Markdown描画パターン（TaskFormModal, PoAssistantSidebar）

- `react-markdown` + `remark-gfm` でMarkdown描画
- `prose` クラスによるTailwindのtypographyスタイリング

## 実施ステップ

### Step 1: 型定義追加（`src/types/index.ts`）

既存の `Sprint`, `Story`, `Task` 等と同じファイルに追加。`frontend-core` モジュールに属するため、型定義のみを追加し、他のfrontend-coreファイルは変更しない。

```typescript
export interface RetroSession {
    id: string;
    project_id: string;
    sprint_id: string;
    status: 'draft' | 'in_progress' | 'completed';
    summary: string | null;
    created_at: string;
    updated_at: string;
}

export type RetroCategory = 'keep' | 'problem' | 'try';

export interface RetroItem {
    id: string;
    retro_session_id: string;
    category: RetroCategory;
    content: string;
    source: 'agent' | 'po' | 'sm' | 'user';
    source_role_id: string | null;
    is_approved: boolean;
    sort_order: number;
    created_at: string;
}

export interface RetroRule {
    id: string;
    project_id: string;
    retro_item_id: string | null;
    sprint_id: string | null;
    content: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ProjectNote {
    id: string;
    project_id: string;
    sprint_id: string | null;
    title: string;
    content: string;
    source: 'user' | 'po_assistant';
    created_at: string;
    updated_at: string;
}
```

### Step 2: Hooks作成

3つのHooksをそれぞれ独立ファイルで作成する。`useWorkspace` からの `currentProjectId` 取得パターンに従う。

**`src/hooks/useRetrospective.ts`**:
- `sessions: RetroSession[]` と `items: RetroItem[]` を管理
- `fetchSessions()` — 全セッション取得
- `fetchItems(sessionId)` — セッション内のアイテム取得
- `createSession(sprintId)` — 新規セッション作成
- `updateSessionStatus(id, status)` — ステータス更新
- `addItem(sessionId, category, content)` — アイテム追加（source='user'）
- `updateItem(id, content, category)` — アイテム編集
- `deleteItem(id)` — アイテム削除
- `approveItem(id)` — 承認トグル

**`src/hooks/useRetroRules.ts`**:
- `rules: RetroRule[]` を管理
- `fetchRules()`, `addRule(content, retroItemId?)`, `updateRule(id, content, isActive)`, `deleteRule(id)`

**`src/hooks/useProjectNotes.ts`**:
- `notes: ProjectNote[]` を管理
- `fetchNotes(sprintId?)`, `addNote(title, content, sprintId?)`, `updateNote(id, title, content)`, `deleteNote(id)`

### Step 3: ScrumDashboardタブ拡張

`src/components/kanban/ScrumDashboard.tsx` を修正:

1. import追加: `RotateCcw` from lucide-react, `RetrospectiveView` コンポーネント
2. `useState` の型を `'backlog' | 'board' | 'retrospective'` に変更
3. `<nav>` 内に3番目のタブボタンを追加
4. コンテンツ領域を3分岐の条件レンダリングに変更

### Step 4: RetrospectiveView コンポーネント

`src/components/kanban/RetrospectiveView.tsx` を新規作成:

**レイアウト構造:**
```
RetrospectiveView
├── ヘッダー
│   ├── スプリントセレクタ（完了済みスプリント選択）
│   └── ステータスバッジ（draft/in_progress/completed）
├── KPTボード（3カラム）
│   ├── Keepカラム（緑: bg-emerald-50, border-emerald-200）
│   │   ├── カラムヘッダー + カード数
│   │   ├── KPTカード一覧
│   │   └── 「+ 追加」ボタン
│   ├── Problemカラム（赤: bg-red-50, border-red-200）
│   │   └── 同上
│   └── Tryカラム（青: bg-blue-50, border-blue-200）
│       └── 同上
└── SM合成サマリパネル（折りたたみ）
    └── Markdown描画（react-markdown + remark-gfm）
```

**KPTカードコンポーネント:**
- source='agent' の場合: Avatarアイコン + ロール名表示
- source='user' / 'po' の場合: 対応アイコン表示
- source='sm' の場合: SMバッジ表示
- 編集ボタン（インライン編集切替）
- 削除ボタン（確認ダイアログ）
- 承認チェックボックス（Tryカラムのみ）

**空状態:**
- スプリント未完了時: 「完了済みスプリントがありません」メッセージ
- セッション未作成時: 「レトロセッションがまだ作成されていません」メッセージ

## 実装途中で追加された要件と最終設計

### 追加要件 1: エンティティ採番 (`sequence_number`)

レトロ画面のスプリント選択を人間に分かりやすくするため、当初のフロントエンドUI実装だけではなく、`stories` / `tasks` / `sprints` に対するプロジェクト単位の採番を追加した。

- バックエンド:
  - `src-tauri/migrations/19_entity_sequence_numbers.sql` を追加
  - `ROW_NUMBER() OVER (PARTITION BY project_id ...)` で既存データを backfill
  - `stories(project_id, sequence_number)` / `tasks(...)` / `sprints(...)` にユニークインデックスを追加
  - `src-tauri/src/db.rs` に `next_project_sequence_number()` を追加し、新規作成時は `MAX(sequence_number) + 1` で採番
- フロントエンド:
  - `src/types/index.ts` の `Story` / `Task` / `Sprint` に `sequence_number` を追加
  - `src/hooks/useStories.ts`, `src/hooks/useTasks.ts`, `src/context/ScrumContext.tsx` を更新し、作成APIの型を `sequence_number` 非入力前提へ揃えた
- 表示:
  - Sprint / Retro セレクタでは `sequence_number` を使って「何回目のスプリントか」を表示する

### 追加要件 2: ラベル表示の簡素化

実装途中で、Story / Task はプロジェクト名を毎回含めるより、エンティティ種別を明示した短いラベルのほうが読みやすいという判断になった。そのため、表示ルールを helper に集約した。

- `src/hooks/useProjectLabels.ts` を追加し、UI からラベル生成ロジックを分離した
- 最終的な表示仕様:
  - Story: `UserStory-<sequence_number>`
  - Task: `Task-<sequence_number>`
  - Sprint / Retro: `<プロジェクト名> / スプリント <sequence_number>`
- `BacklogView`, `Board`, `StorySwimlane`, `TaskCard`, `RetrospectiveView` は helper を使って表示する前提とし、今後の UI 実装でも同 helper を再利用する

### 当初計画からの更新点

当初は `frontend-core` への変更を `src/types/index.ts` のみに抑える想定だったが、採番対応に伴って `useStories.ts`, `useTasks.ts`, `ScrumContext.tsx` まで更新対象が広がった。これは `sequence_number` をバックエンド管理に寄せつつ、フロントエンドの型安全性を保つための変更である。

## リスクと対策

### リスク 1: frontend-core の変更範囲

- `src/types/index.ts` への型追加のみ。Context/Hooks/UIコンポーネントは変更しない
- CLAUDE.mdの指示に従い、frontend-core配下は型定義の追加のみとする

### リスク 2: タブが増えることによるレイアウト崩れ

- 既存の2タブとまったく同じスタイルパターンを使用する
- 狭い画面でのタブ折り返しを確認する

## テスト方針

### 手動確認

- 3タブの切り替えが正常に動作する
- KPTカードの追加・編集・削除が正しくDBに反映される
- スプリントセレクタで異なるスプリントのレトロが表示される
- Markdown形式のサマリが正しく描画される
- Story / Task / Sprint / Retro のラベルが最終仕様どおりに表示される
- 型エラーなく `npm run build` が通る

### 自動確認

- `cargo test --manifest-path src-tauri/Cargo.toml` を実行し、migration と DB ロジックの回帰がないことを確認する
- `npm run build` を実行し、型エラーとビルドエラーがないことを確認する
- 既存DBに対して `sequence_number` の backfill が完了し、`NULL` が残っていないことを確認する

## 成果物

- `src/types/index.ts`（型定義追加）
- `src/hooks/useRetrospective.ts`（新規）
- `src/hooks/useRetroRules.ts`（新規）
- `src/hooks/useProjectNotes.ts`（新規）
- `src/hooks/useProjectLabels.ts`（新規）
- `src/components/kanban/ScrumDashboard.tsx`（タブ拡張）
- `src/components/kanban/RetrospectiveView.tsx`（新規）
- `src/components/kanban/BacklogView.tsx`（採番表示）
- `src/components/kanban/Board.tsx`（スプリント表示）
- `src/components/kanban/StorySwimlane.tsx`（採番表示）
- `src/components/kanban/TaskCard.tsx`（採番表示）
- `src/components/CreateProjectModal.tsx`（プロジェクト名表示の文言調整）
- `src/context/ScrumContext.tsx`（採番対応の型調整）
- `src/hooks/useStories.ts`（採番対応の型調整）
- `src/hooks/useTasks.ts`（採番対応の型調整）
- `src-tauri/migrations/19_entity_sequence_numbers.sql`（新規）
- `src-tauri/src/db.rs`（採番・CRUD更新）
- `src-tauri/src/lib.rs`（migration登録）
