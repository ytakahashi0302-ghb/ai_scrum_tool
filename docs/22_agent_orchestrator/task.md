- `[x]` 1. Phase 1: AI Agent Orchestratorのバックエンド設計 (Rust / Rig Tool)
  - `[x]` `rig-core` の `Tool` トレイトを実装した `CreateStoryAndTasksTool` 構造体を定義する。
  - `[x]` 既存の `chat_with_team_leader` で `AgentBuilder` を使用し、Toolを持たせたエージェントを構築する。
  - `[x]` プロンプトを調整し、タスク分解とDB起票をTool経由で自律的に行わせる。

- `[x]` 2. Phase 2: DB操作とのトランザクション統合 (Rust)
  - `[x]` `src-tauri/src/db.rs` に `insert_story_with_tasks` などの新規関数を追加し、引数で渡されたStoryとTask一覧をDBへ保存する。
  - `[x]` `CreateStoryAndTasksTool::call` の内部から `insert_story_with_tasks` を呼び出し、エラーハンドリングを実装する。

- `[x]` 3. Phase 3: フロントエンドとAI連携強化 (React)
  - `[x]` `TeamLeaderSidebar.tsx` のチャット送信処理を改修し、アクション付きレスポンスを受け取れるようにする。
  - `[x]` Eventを用いたカンバンの再フェッチを行うため、`ScrumContext.tsx` に `listen("kanban-updated")` を追加し、データのフワッとした再描画を実現する。

- `[x]` 4. 統合テストとバグフィックス
  - `[x]` UIから曖昧なシステム要件を入力し、期待通りタスク一覧がカンバンに即時反映されるかテストする。(PO手動確認)
  - `[x]` バックエンドでJSONが正しくパースされ、DBにStoryとTaskが登録されるか確認する。(PO手動確認)
  - `[x]` フロントエンドのカンバンUIにデータが即座に同期されるか確認する。(PO手動確認)
  - `[x]` `walkthrough.md` および `handoff.md` を作成して引継ぎを完了する。
