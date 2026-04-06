# Epic 26: タスク一覧

## Phase 1: DBマイグレーション + バックエンド基盤

- [x] 1-1. マイグレーションファイル `9_priority_dependencies.sql` を作成
  - stories に priority カラム追加（DEFAULT 'Medium'）
  - tasks に priority カラム追加（DEFAULT 'Medium'）
  - task_dependencies テーブル作成（CASCADE削除付き）

- [x] 1-2. `lib.rs` に Migration version 9 を登録

- [x] 1-3. `db.rs` — 構造体更新
  - Story 構造体に `priority: i32` 追加
  - Task 構造体に `priority: i32` 追加
  - TaskDraft に `priority: Option<i32>` と `blocked_by_indices: Option<Vec<usize>>` 追加
  - StoryDraftInput に `priority: Option<i32>` 追加
  - 新規 TaskDependency 構造体作成

- [x] 1-4. `db.rs` — 既存CRUDコマンド更新
  - `add_story` に priority パラメータ追加
  - `update_story` に priority パラメータ追加
  - `add_task` に priority パラメータ追加
  - `update_task` に priority パラメータ追加

- [x] 1-5. `db.rs` — `insert_story_with_tasks` 更新
  - ストーリーINSERTに priority バインド
  - タスクINSERTに priority バインド
  - blocked_by_indices → 実ID変換 + task_dependencies INSERT

- [x] 1-6. `db.rs` — 新規コマンド追加
  - `get_all_task_dependencies(project_id)` 実装
  - `set_task_dependencies(task_id, blocked_by_ids)` 実装

- [x] 1-7. `lib.rs` — 新規コマンドを `generate_handler!` に登録

- [x] 1-8. `db.rs` — `build_project_context` に優先度・依存関係情報を追加

## Phase 2: フロントエンド型 + Hooks

- [x] 2-1. `src/types/index.ts` — Story/Task に priority 追加、TaskDependency 新規追加

- [x] 2-2. `src/hooks/useStories.ts` — addStory/updateStory に priority 引数追加

- [x] 2-3. `src/hooks/useTasks.ts` — addTask/updateTask に priority 引数追加

- [x] 2-4. `src/hooks/useTaskDependencies.ts` — 新規作成
  - fetchDependencies, setDependencies, isBlocked, getBlockers

- [x] 2-5. `src/context/ScrumContext.tsx` — useTaskDependencies 統合
  - dependencies, setTaskDependencies, isTaskBlocked, getTaskBlockers を公開
  - refresh / kanban-updated リスナーに依存関係取得を追加

## Phase 3: フロントエンドUI - モーダル

- [x] 3-1. `StoryFormModal.tsx` — 優先度セレクトドロップダウン追加

- [x] 3-2. `TaskFormModal.tsx` — 優先度セレクトドロップダウン追加

- [x] 3-3. `TaskFormModal.tsx` — 依存関係チェックボックスリスト追加
  - availableTasks props 追加
  - 同一ストーリー内タスクの選択UI

## Phase 4: フロントエンドUI - 表示・インタラクション

- [x] 4-1. `TaskCard.tsx` — 優先度バッジ表示（色分け: 赤/黄/青）

- [x] 4-2. `TaskCard.tsx` — ブロック中インジケータ（ロックアイコン + 半透明）

- [x] 4-3. `StorySwimlane.tsx` — ストーリーヘッダーに優先度バッジ追加

- [x] 4-4. `StorySwimlane.tsx` — TaskFormModal に availableTasks を渡す

- [x] 4-5. `BacklogView.tsx` — ストーリー項目に優先度バッジ追加

- [x] 4-6. `BacklogView.tsx` — ソートコントロール追加（作成日時 / 優先度）

- [x] 4-7. `Board.tsx` — ブロック中タスクのドラッグ警告トースト

## Phase 5: AIプロンプト改修

- [x] 5-1. `ai.rs` — GeneratedTask に priority と blocked_by_indices 追加

- [x] 5-2. `ai.rs` — generate_tasks_from_story のシステムプロンプト改修

- [x] 5-3. `ai.rs` — chat_with_team_leader のシステムプロンプト改修

- [x] 5-4. `ai_tools.rs` — CreateStoryAndTasksArgs に story_priority 追加

- [x] 5-5. `ai_tools.rs` — ツール定義JSONスキーマに priority, blocked_by_indices 追加

- [x] 5-6. `ai_tools.rs` — call() メソッドで priority と依存関係を伝播

## 検証

- [x] 6-1. アプリ起動 → マイグレーション適用 → 既存データの後方互換性確認
- [ ] 6-2. ストーリー/タスクの優先度CRUD動作確認
- [ ] 6-3. 依存関係の設定・表示・解除の動作確認
- [x] 6-4. AI生成タスクに優先度・依存関係が含まれることを確認
- [ ] 6-5. バックログソート・ドラッグ警告の動作確認
