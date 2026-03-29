# Task List: Epic 5 AI開発チーム (Pivot: AI Team Leader)

※ アーキテクチャのブロッカー（スクラム基盤の未分離）が発見されたため、本Epicは一時凍結中（Paused）です。

## Phase 1: DB再設計とBackendの更新
- [ ] 1.1 `src-tauri/migrations/7_ai_team_leader.sql` を作成（追記マイグレーション方針の場合）
  - [ ] `task_messages` テーブルの `DROP TABLE IF EXISTS` 追加。
  - [ ] `team_chat_messages` テーブルの `CREATE TABLE` 追加（`id`, `project_id`, `role`, `content`, `created_at`）。
- [ ] 1.2 CRUD関数のリファクタリング（`db.rs`, `lib.rs`）
  - [ ] 古いタスクチャット系の処理を削除し、`add_team_chat_message`, `get_team_chat_messages`, `clear_team_chat_messages` 等を実装。
- [ ] 1.3 `ai.rs` に `chat_with_team_leader` コマンドの実装
  - [ ] 新しいペルソナ「スクラムマスター 兼 リードエンジニア」を持つシステムプロンプトを使用。
  - [ ] `build_project_context` を利用し、現在のプロジェクト（未アーカイブの全体タスク一覧）をコンテキストに含めて返答するロジックを実装。
  - [ ] frontend用型情報の更新 (`index.ts`) と古い `TaskMessage` 型の削除・置換。

## Phase 2: UI/UXロールバックとサイドパネル実装
- [ ] 2.1 UIロールバック
  - [ ] `TaskFormModal.tsx` から 2カラム表示とアサインセレクトボックスを削除し、元のレイアウトに戻す。
  - [ ] `TaskChatPane.tsx` の削除と依存関係の整理。
- [ ] 2.2 `kanban/TeamChatDrawer.tsx` の新規作成
  - [ ] Boardの右側からスライドインするサイドパネル（Drawer）のUI実装。
  - [ ] メッセージリスト表示（Markdown対応）と下部入力フォームの配置。
  - [ ] LocalPath未設定時のバリデーションやスペースキーのイベント伝播防止（バグ修正済みの内容）を引き継ぐ。
- [ ] 2.3 `kanban/Board.tsx` の拡張
  - [ ] AIリーダー・サイドパネルを表示/非表示に切り替えるためのトリガーボタン（Toggle）をヘッダー付近に配置。
  - [ ] `TeamChatDrawer` を埋め込む。

## Phase 3: テストと検証
- [ ] サイドパネルの表示アニメーションとレスポンシブな幅の調整。（メインのカンバンボード領域が潰れないようにするか、上に覆い被さるようにするか調整）。
- [ ] プロジェクト変更時のチャット履歴切り替えが正常に機能することを確認。
- [ ] POによる手動テスト・ウォークスルーの作成。
