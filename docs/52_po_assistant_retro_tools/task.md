# EPIC52: POアシスタント レトロ連携ツール

## 背景

POアシスタントとの会話の中で、レトロスペクティブに関連するアイデアや気づきが生まれることがある。POアシスタントがこれらを検知し、「レトロに追加しますか？」と提案したり、直接ノートを作成したりできる機能を追加する。既存の `CreateStoryAndTasksTool` パターンに倣い、AI Toolとして実装する。

## ゴール

- POアシスタントがプロジェクトノートを自動作成できるAI Toolを追加する
- POアシスタントがレトロアイテムの追加を提案できるAI Toolを追加する
- POアシスタントのシステムプロンプトにレトロ関連の指示を追加する

## スコープ

### 含む

- `src-tauri/src/ai_tools.rs` に `AddProjectNoteTool` 追加
- `src-tauri/src/ai_tools.rs` に `SuggestRetroItemTool` 追加
- `src-tauri/src/ai.rs` のPOアシスタントツールレジストリへの登録
- POアシスタントシステムプロンプトへのレトロ関連指示追加

### 含まない

- SMエージェント機能（EPIC51で実装済み前提）
- NotesPanel UI（EPIC49で実装済み前提）
- RetrospectiveView UI（EPIC48で実装済み前提）

## タスクリスト

### Story 1: AddProjectNoteTool

- [ ] `AddProjectNoteArgs` struct定義（title, content, sprint_id）
- [ ] `AddProjectNoteTool` struct定義（app: AppHandle, project_id: String）
- [ ] `Tool` trait実装（definition, call）
- [ ] ノート追加成功時のフロントエンドイベント通知（`kanban-updated` 等）

### Story 2: SuggestRetroItemTool

- [ ] `SuggestRetroItemArgs` struct定義（category, content, retro_session_id）
- [ ] `SuggestRetroItemTool` struct定義（app: AppHandle, project_id: String）
- [ ] `Tool` trait実装（definition, call）
- [ ] アクティブなレトロセッションが存在しない場合のエラーハンドリング

### Story 3: ツール登録 + プロンプト更新

- [ ] `ai.rs` のPOアシスタントツールレジストリに2つのToolを追加
- [ ] POアシスタントのシステムプロンプトにレトロ関連の指示を追加:
  - 会話中にプロセス改善や問題点に気づいたらノート作成を提案する
  - レトロセッションがアクティブな場合はKPTアイテム追加を提案する
  - 改善提案はTry、良かった点はKeep、問題点はProblemとして分類する

## 完了条件

- [ ] POアシスタントが会話中にノートを自動作成できる
- [ ] POアシスタントがレトロアイテムの追加を提案・実行できる
- [ ] ノート/レトロアイテム作成時にUIが自動更新される
- [ ] `cargo test` が通る
- [ ] `cargo build` がエラーなく完了する
