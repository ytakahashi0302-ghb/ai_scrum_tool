# 13_workspace_db タスクリスト

## フェーズ1: 既存DB処理のRust（Tauriコマンド）全面移行
- [x] 1. Rust側DBモジュールのセットアップ
    - [x] `src-tauri/src/db.rs` （または関連用ファイル）を作成し、SQLite接続・操作用の共通関数を定義する準備をする。
    - [x] `lib.rs` でモジュール宣言を追加。
- [x] 2. StoriesのCRUD実装（Rust）
    - [x] `get_stories`, `add_story`, `update_story`, `delete_story` Tauriコマンドを実装。
- [x] 3. TasksのCRUD実装（Rust）
    - [x] `get_tasks`, `get_tasks_by_story_id`, `add_task`, `update_task_status`, `update_task`, `delete_task` Tauriコマンドを実装。
- [x] 4. SprintsのCRUD実装（Rust）
    - [x] 既存のSQLに対応する `get_sprints`, `create_sprint`, `update_sprint` 関連のTauriコマンドを実装。
- [x] 5. Frontend Hooksの書き換え
    - [x] `useStories.ts`, `useTasks.ts`, `useSprintHistory.ts`, `useSprintTimer.ts` などのSQL直書き（`@tauri-apps/plugin-sql`直叩き）を `invoke` に置き換える。
    - [x] フェーズ1完了後の動作確認（退行テスト）を実施する。

## フェーズ2: マルチプロジェクト（ワークスペース）スキーマ追加と対応
- [x] 6. データベース拡張（Rust / SQlite）
    - [x] `src-tauri/migrations/3_add_projects.sql` を作成（projectsテーブル追加、デフォルトレコード挿入、既存テーブルにproject_idを追加）。
    - [x] `src-tauri/src/lib.rs` マイグレーション配列に設定を追加。
- [x] 7. ProjectsのCRUD実装（Rust）
    - [x] `create_project`, `get_projects`, `update_project`, `delete_project` Tauriコマンドを実装。
- [x] 8. フェーズ1で作成したRustコマンドへの project_id 組み込み
    - [x] 各CRUDコマンドの引数等に `project_id` を追加し、SQLの抽出条件やINSERT対象に組み込む。
- [x] 9. TypeScript型の更新（Frontend）
    - [x] `src/types/index.ts` の型に `Project` インターフェースを追加。
    - [x] 既存の `Story`, `Task`, `Sprint` に `project_id` を追加。
- [x] 10. テストと動作確認
    - [x] Rust側のビルドチェック (`cargo check`) を通過させる。
    - [ ] Frontendでエラーなく（defaultプロジェクトのものとして）データ取得・表示ができることを確認する。
