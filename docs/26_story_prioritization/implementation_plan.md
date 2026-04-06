# Epic 26: ユーザーストーリーとタスクの優先度・依存関係管理機能 - 実装計画

## 背景と目的

現在、AIアシスタント（Team Leader）がストーリーやタスクを自動生成するが、**優先度**と**依存関係**が設定されないため、AI実行エージェントがどのタスクから着手すべきか判断できない。

本Epicでは以下の3層を横断的に拡張し、この課題を解消する:
1. **データモデル** (Rust / SQLite) — 優先度・依存関係フィールドの追加
2. **フロントエンドUI** (React) — 入力・表示・ソート・ブロック表現
3. **AIプロンプト** (Team Leader / Task Decomposer) — 自動割当ロジック

### スコープ決定事項
- ストーリー間の依存関係（story_dependencies）は**スコープ外**
- ストーリーには優先度のみ追加、タスクには優先度＋依存関係を追加
- frontend-core（types, hooks, context）の変更は許可済み

---

## Phase 1: DBマイグレーション + バックエンド基盤

### 1-1. マイグレーション

**ファイル:** `src-tauri/migrations/9_priority_dependencies.sql`, `10_priority_integer.sql`, `11_priority_column_to_integer.sql`

```sql
-- ストーリーに優先度カラムを追加
ALTER TABLE stories ADD COLUMN priority TEXT DEFAULT 'Medium';

-- タスクに優先度カラムを追加
ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'Medium';

-- タスク依存関係テーブル（多対多）
CREATE TABLE task_dependencies (
    task_id TEXT NOT NULL,
    blocked_by_task_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, blocked_by_task_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_by_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

**設計意図:**
- migration 9 では互換性優先で `priority` を TEXT (`'Medium'`) として追加
- migration 10 で `High/Medium/Low` を整数優先度へ変換し、migration 11 で `INTEGER NOT NULL DEFAULT 3` に統一
- 現在の優先度表現は **整数 1〜5（小さいほど高優先）**
- `task_dependencies` は結合テーブルで多対多関係を表現。CASCADE削除により参照整合性を自動維持
- ストーリー間の依存関係テーブルは今回作成しない

**`lib.rs` への登録:**
```rust
Migration {
    version: 9,
    description: "priority_dependencies",
    sql: include_str!("../migrations/9_priority_dependencies.sql"),
    kind: MigrationKind::Up,
}
```

### 1-2. Rust構造体の更新

**ファイル:** `src-tauri/src/db.rs`

| 構造体 | 追加フィールド | 備考 |
|--------|---------------|------|
| `Story` | `pub priority: i32` | SELECT * で自動取得 |
| `Task` | `pub priority: i32` | SELECT * で自動取得 |
| `TaskDraft` | `pub priority: Option<i32>`, `pub blocked_by_indices: Option<Vec<usize>>` | AI生成用 |
| `StoryDraftInput` | `pub priority: Option<i32>` | AI生成用 |
| **新規** `TaskDependency` | `task_id: String`, `blocked_by_task_id: String` | FromRow derive |

### 1-3. CRUDコマンド更新

**変更対象:**
- `add_story`: priority パラメータ追加、INSERT文に反映
- `update_story`: priority パラメータ追加、UPDATE文に反映
- `add_task`: priority パラメータ追加、INSERT文に反映
- `update_task`: priority パラメータ追加、UPDATE文に反映
- `insert_story_with_tasks`:
  - ストーリーINSERTにpriority バインド追加
  - タスクINSERTにpriority バインド追加
  - `blocked_by_indices` → 実UUID変換ロジック:
    1. 各タスクのUUIDを `Vec<String>` に収集
    2. 全タスクINSERT後、`blocked_by_indices` を実IDにマッピング
    3. `task_dependencies` テーブルにINSERT

### 1-4. 新規コマンド

```rust
#[tauri::command]
pub async fn get_all_task_dependencies(app: AppHandle, project_id: String) -> Result<Vec<TaskDependency>, String>
// tasks テーブルと JOIN し、指定プロジェクト内の全依存関係を返す

#[tauri::command]
pub async fn set_task_dependencies(app: AppHandle, task_id: String, blocked_by_ids: Vec<String>) -> Result<(), String>
// トランザクション内で: 既存の依存関係をDELETE → 新しい依存関係をINSERT
```

### 1-5. build_project_context 更新

コンテキスト出力にストーリー/タスクの優先度情報を含める:
```
- Story [P1][ID: ...]: タイトル
  - Task [P2]: タイトル (blocked by: タスク0)
  - Task [P3]: タイトル
```

---

## Phase 2: フロントエンド型 + Hooks

### 2-1. 型定義の拡張

**ファイル:** `src/types/index.ts`

```typescript
export interface Story {
    // 既存フィールド...
    priority: number;  // 追加（1〜5、小さいほど高優先）
}

export interface Task {
    // 既存フィールド...
    priority: number;  // 追加（1〜5、小さいほど高優先）
}

export interface TaskDependency {  // 新規
    task_id: string;
    blocked_by_task_id: string;
}
```

### 2-2. Hooks更新

**`src/hooks/useStories.ts`:** addStory/updateStory の invoke に `priority` 引数追加
**`src/hooks/useTasks.ts`:** addTask/updateTask の invoke に `priority` 引数追加

**新規 `src/hooks/useTaskDependencies.ts`:**
```typescript
// fetchDependencies(projectId) — get_all_task_dependencies を呼出
// setDependencies(taskId, blockedByIds) — set_task_dependencies を呼出
// isBlocked(taskId, tasks) — blockerのstatusが'Done'でなければtrue
// getBlockers(taskId) — ブロッカーのtask_idリストを返す
```

### 2-3. ScrumContext 統合

**ファイル:** `src/context/ScrumContext.tsx`

- `useTaskDependencies` を統合
- 公開する新プロパティ: `dependencies`, `setTaskDependencies`, `isTaskBlocked`, `getTaskBlockers`
- `refresh` と `kanban-updated` イベントリスナーで依存関係も再取得

---

## Phase 3: フロントエンドUI - モーダル

### 3-1. StoryFormModal

**ファイル:** `src/components/board/StoryFormModal.tsx`

- 受け入れ条件テキストエリアの下に優先度セレクトドロップダウンを追加
- 選択肢: `1`〜`5`（`1` が最優先、`3` が標準）
- デフォルト値: `3`
- 編集時は既存の値をプリセット

### 3-2. TaskFormModal

**ファイル:** `src/components/board/TaskFormModal.tsx`

- **優先度セレクト:** ステータスドロップダウンの隣に配置
- **依存関係セレクタ:**
  - 同一ストーリー内のタスクをチェックボックスリストで表示
  - 自分自身は除外
  - 選択されたタスクをチップ/タグ形式で表示
  - props に `availableTasks?: Task[]` を追加（親コンポーネントから同一ストーリー内タスクを渡す）

### UIモック（テキスト版）

```
┌──────────────────────────────────┐
│ タスク編集                        │
├──────────────────────────────────┤
│ タイトル: [________________]      │
│ 説明:    [________________]      │
│                                  │
│ ステータス: [未着手 ▼]            │
│ 優先度:    [3 ▼]                 │
│                                  │
│ ▼ 依存関係（先行タスク）          │
│ ☐ タスクA - APIエンドポイント実装 │
│ ☑ タスクB - DB設計               │
│ ☐ タスクC - テスト作成            │
│                                  │
│        [削除] [キャンセル] [保存]  │
└──────────────────────────────────┘
```

---

## Phase 4: フロントエンドUI - 表示・インタラクション

### 4-1. TaskCard（カンバンボード）

**ファイル:** `src/components/kanban/TaskCard.tsx`

- **優先度バッジ:** タイトル左側に小さなラベル表示
  - P1: `bg-red-100 text-red-700 border-red-200`
  - P2: `bg-orange-100 text-orange-700 border-orange-200`
  - P3: `bg-yellow-100 text-yellow-700 border-yellow-200`
  - P4: `bg-blue-100 text-blue-600 border-blue-200`
  - P5: `bg-gray-100 text-gray-600 border-gray-200`
- **ブロック表示:** ブロッカーが未完了の場合
  - ロックアイコン（lucide-react の Lock）を表示
  - カード全体を半透明（opacity-60）に
  - ツールチップでブロッカーのタスク名を表示

### 4-2. StorySwimlane

**ファイル:** `src/components/kanban/StorySwimlane.tsx`

- ストーリーヘッダーのタイトル横に優先度バッジを追加
- タスク追加/編集モーダルに `availableTasks` を渡す

### 4-3. BacklogView

**ファイル:** `src/components/kanban/BacklogView.tsx`

- ストーリー項目に優先度バッジを追加（タイトルとタスクカウントの間）
- ソートコントロール: 「作成日時 / 優先度」切替ボタン
  - 優先度ソート: `1 → 2 → 3 → 4 → 5` の順
  - `useMemo` でソートロジックを最適化

### 4-4. Board.tsx（ドラッグ警告）

**ファイル:** `src/components/kanban/Board.tsx`

- `handleDragEnd` でブロック中タスクを「In Progress」に移動した場合、トースト警告を表示
- ソフト制約: 移動は許可するが、注意喚起のみ

---

## Phase 5: AIプロンプト改修

### 5-1. GeneratedTask 構造体の拡張

**ファイル:** `src-tauri/src/ai.rs`

```rust
pub struct GeneratedTask {
    pub title: String,
    pub description: String,
    pub priority: Option<i32>,                 // 追加
    pub blocked_by_indices: Option<Vec<usize>>, // 追加
}
```

### 5-2. Task Decomposer プロンプト改修

**ファイル:** `src-tauri/src/ai.rs` (generate_tasks_from_story)

```
You are a task decomposition expert. Generate a JSON array of tasks.
Each task must include:
- "title": string
- "description": string
- "priority": integer 1-5 (lower number = higher priority)
- "blocked_by_indices": number[] (zero-based indices of prerequisite tasks)

Priority: 1=architecture foundation, 2=critical path, 3=default implementation, 4=support/testing, 5=polish/docs.
Dependencies: set when a task logically depends on another's output.
Output ONLY the JSON array.
```

### 5-3. Team Leader プロンプト改修

**ファイル:** `src-tauri/src/ai.rs` (chat_with_team_leader)

システムプロンプトに以下を追加:
```
【優先度ルール】ストーリーとタスクを作成する際は、以下のフィールドを必ず設定してください：
- story_priority: 整数 1〜5（小さいほど高優先）
- 各タスクの priority: 整数 1〜5（小さいほど高優先）
- 各タスクの blocked_by_indices: 先行タスクの配列インデックス（0始まり）

判断基準: 1=アーキテクチャの根幹、2=クリティカルパス、3=通常の機能実装、4=サポート/テスト、5=UI微調整やドキュメント
```

### 5-4. AI Tool スキーマ拡張

**ファイル:** `src-tauri/src/ai_tools.rs`

- `CreateStoryAndTasksArgs` に `story_priority: Option<i32>` 追加
- ツール定義JSONの properties に以下を追加:
  - `story_priority`: `{"type": "integer", "minimum": 1, "maximum": 5}`
  - tasks の items に `priority` と `blocked_by_indices` を追加
- `call()` メソッドで `StoryDraftInput` に priority を渡す

---

## テスト方針

### DB層テスト
- migration 9 → 10 → 11 の順に適用後、既存データの priority が `INTEGER` として保持されること
- タスク削除時に task_dependencies のCASCADE削除が動作すること
- 循環依存（A→B→A）が作成可能だが、アプリケーション層で検出すること

### バックエンドテスト
- 優先度付きでストーリー/タスクのCRUDが正常動作すること
- `set_task_dependencies` / `get_all_task_dependencies` の正常系・異常系
- `insert_story_with_tasks` で `blocked_by_indices` → 実ID変換が正しく動作すること
- `build_project_context` 出力に優先度・依存関係情報が含まれること

### フロントエンドテスト
- モーダルで優先度選択・依存関係設定が保存されること
- カンバンボードで優先度バッジが正しく表示されること
- ブロック中タスクの視覚表現（半透明 + ロックアイコン）が正しく動作すること
- バックログのソート機能（優先度順）が正しく動作すること
- 既存のDnD機能が影響を受けないこと

### AI統合テスト
- Task Decomposer が priority と blocked_by_indices を含むJSONを出力すること
- Team Leader がストーリー生成時に優先度を設定すること
- 不正なAI出力（存在しないインデックス、循環依存等）がグレースフルに処理されること

### E2E検証手順
1. `cargo tauri dev` でアプリ起動 → マイグレーション自動適用を確認
2. 既存ストーリー/タスクが問題なく表示されることを確認（後方互換性）
3. 新規ストーリー作成 → 優先度 `1` または `2` を選択 → バッジ表示確認
4. タスク作成 → 依存関係設定 → ブロック表示確認
5. ブロッカータスクを Done に移動 → ブロック表示が解除されることを確認
6. Team Leader でストーリー生成を依頼 → 優先度・依存関係が自動設定されることを確認
7. バックログでソート切替 → `1 → 2 → 3 → 4 → 5` の順序確認
8. ブロック中タスクをドラッグ → 警告トースト表示確認
