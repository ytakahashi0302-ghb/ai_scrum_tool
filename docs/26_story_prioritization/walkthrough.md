# Epic 26: 修正内容の確認

## 概要

ユーザーストーリーとタスクに優先度を持たせ、タスク間の依存関係を管理できるようにした。
あわせて AI Team Leader / Task Decomposer が優先度と依存関係を含む形でタスクを生成し、登録結果と実DBの整合性を検証するよう改善した。

## バックエンド

- `src-tauri/migrations/9_priority_dependencies.sql` で `stories` / `tasks` に priority カラムを追加し、`task_dependencies` テーブルを作成
- `src-tauri/migrations/10_priority_integer.sql` と `11_priority_column_to_integer.sql` で priority を整数 `1〜5` に統一
- `src-tauri/src/db.rs` で `Story` / `Task` / `TaskDraft` / `StoryDraftInput` を拡張
- `add_story` / `update_story` / `add_task` / `update_task` に priority を反映
- `insert_story_with_tasks` で priority と `blocked_by_indices` をDBへ保存
- `get_all_task_dependencies` / `set_task_dependencies` を追加
- `build_project_context` に priority / blocked_by 情報を出力するよう更新

## フロントエンド

- `src/types/index.ts` に priority と `TaskDependency` を追加
- `src/hooks/useStories.ts` / `src/hooks/useTasks.ts` に priority 引数を追加
- `src/hooks/useTaskDependencies.ts` を新規追加し、依存関係の取得・更新・ブロック判定を実装
- `src/context/ScrumContext.tsx` に依存関係の state / API を統合
- `src/components/board/StoryFormModal.tsx` / `TaskFormModal.tsx` に priority 入力UIを追加
- `src/components/board/TaskFormModal.tsx` に同一ストーリー内タスクの依存関係選択UIを追加
- `src/components/kanban/TaskCard.tsx` / `StorySwimlane.tsx` / `BacklogView.tsx` に priority バッジを追加
- `src/components/kanban/TaskCard.tsx` にブロック表示、`src/components/kanban/Board.tsx` にドラッグ警告を追加
- `src/components/kanban/BacklogView.tsx` に優先度ソートを追加

## AIまわり

- `src-tauri/src/ai.rs` の `GeneratedTask` を priority / `blocked_by_indices` 対応に更新
- Task Decomposer のプロンプトを、priority と依存関係を含む JSON 出力に変更
- Team Leader のプロンプトを、priority / dependency 付き登録を必須化する形に変更
- `src-tauri/src/ai_tools.rs` の `CreateStoryAndTasksArgs` とツールスキーマを拡張
- AI が tool を呼ばずに成功文面だけ返すケースに備え、登録件数チェックとフォールバック登録処理を追加

## 確認結果

- `cargo check` が通ることを確認
- `npm run tauri dev` で migration panic を解消し、起動できることを確認
- AI Team Leader 経由で backlog / task をDB登録できることを確認

## 未実施の確認

- 優先度の手動 CRUD 全パターン確認
- 依存関係の設定 / 表示 / 解除の画面確認
- backlog の優先度ソートとドラッグ警告の手動確認
