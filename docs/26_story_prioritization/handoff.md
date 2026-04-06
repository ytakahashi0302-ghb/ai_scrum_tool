# Epic 26: 引き継ぎ書

## 現在の状態

- 実装フェーズ 1〜5 は完了
- 検証は一部完了
- `task.md` の検証項目では `6-1` と `6-4` を完了済みとして反映済み

## 重要な変更点

- priority は最終的に文字列ではなく整数 `1〜5` で管理している
- migration は `9_priority_dependencies.sql`、`10_priority_integer.sql`、`11_priority_column_to_integer.sql` の3段構成
- 開発DBの migration 11 不整合は、既存DBをバックアップのうえ整合性を復旧済み
- バックアップは `docs/26_story_prioritization/ai-scrum.db.backup.20260406_205128` に保存

## AI登録フローについて

- 以前は Team Leader が `create_story_and_tasks` を呼ばずに成功メッセージだけ返すケースがあった
- 現在は以下の二重ガードを追加済み
- tool 実行後に `stories / tasks / dependencies` の件数差分を確認
- 差分が出ない場合は、JSON 実行計画を生成して Rust 側で直接 `insert_story_with_tasks()` を実行するフォールバックを実施

## 次に確認してほしいこと

- ストーリー編集で priority が正しく保存・再表示されるか
- タスク編集で priority / dependency の設定解除まで正しく反映されるか
- ブロック中タスクのグレーアウトとロック表示が期待通りか
- backlog の優先度ソートが `1 → 5` で安定しているか
- ブロック中タスクを `In Progress` に移動したとき警告トーストが出るか

## 主な関連ファイル

- `src-tauri/src/db.rs`
- `src-tauri/src/ai.rs`
- `src-tauri/src/ai_tools.rs`
- `src-tauri/src/lib.rs`
- `src/hooks/useTaskDependencies.ts`
- `src/context/ScrumContext.tsx`
- `src/components/board/StoryFormModal.tsx`
- `src/components/board/TaskFormModal.tsx`
- `src/components/kanban/TaskCard.tsx`
- `src/components/kanban/StorySwimlane.tsx`
- `src/components/kanban/BacklogView.tsx`
- `src/components/kanban/Board.tsx`

## 推奨確認コマンド

- `cargo check`
- `npm run tauri dev`

## 補足

- `implementation_plan.md` は整数 priority 前提に修正済み
- 現在の未完了は「未実装」ではなく、主に手動検証の残り
