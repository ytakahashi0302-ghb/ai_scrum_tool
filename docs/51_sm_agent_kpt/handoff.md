# Vicara — 開発引き継ぎ書

> 作成日: 2026-04-16  
> 対象: 次の開発者・次セッションの Claude

---

## 1. プロジェクト概要

**Vicara** は Tauri 2 (Rust バックエンド + React/TypeScript フロントエンド) で構築された AI 駆動スクラム管理ツール。  
プロジェクト・スプリント・PBI・タスクを管理し、AI エージェント（Claude CLI / Gemini CLI / Codex CLI / API）が実際にタスクを自律実行する点が特徴。

### 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + TypeScript + Vite + TailwindCSS |
| バックエンド | Rust + Tauri 2 + tauri-plugin-sql (SQLite) |
| AI | Claude CLI / Gemini CLI / Codex CLI / OpenAI API / Anthropic API / Ollama |
| DB | SQLite（`vicara.db`）、マイグレーション 23 本 |

### 主要ディレクトリ

```
src/                        フロントエンド
  components/
    kanban/                 Board, BacklogView, RetrospectiveView, StorySwimlane
    ai/                     NotesPanel, TeamLeaderSidebar
    project/                InceptionDeck
    ui/settings/            設定画面
  context/                  ScrumContext, WorkspaceContext, SprintTimerContext
  hooks/                    useSprints, useStories, useTasks, useRetrospective, etc.
  types/index.ts             共通型定義

src-tauri/
  src/
    db.rs                   SQLite CRUD コマンド群
    ai.rs                   LLM 呼び出しコマンド群（レトロ・タスク生成・チームリーダー）
    ai_tools.rs             PO アシスタント用 AI Tool 定義
    claude_runner.rs        Claude CLI タスク実行エンジン
    agent_retro.rs          レトロ実行ログ capture/persist 機構
    llm_observability.rs    LLM 使用量記録
    worktree.rs             Git worktree 管理
    inception.rs            InceptionDeck AI 呼び出し
    lib.rs                  マイグレーション登録 + invoke_handler
  migrations/               001〜023 の SQL マイグレーション
```

---

## 2. 現在の実装状態（EPIC 51 完了時点）

### 完了済み主要機能

| Epic | 機能 |
|---|---|
| 47〜49 | レトロスペクティブ DB スキーマ・UI・プロジェクトノート |
| 50 | Claude CLI ストリーミング修正・`agent_retro_runs` 構造化ログ基盤 |
| **51** | **SM エージェント KPT 合成・バグ修正・PBI 用語統一** ← 最新完了 |

### 未実装（計画済み）

| Epic | 機能 | ドキュメント |
|---|---|---|
| 52 | PO アシスタント レトロ連携ツール（`AddProjectNoteTool` / `SuggestRetroItemTool`） | `docs/52_po_assistant_retro_tools/` |
| 53 | Try → ルール パイプライン（承認 Try をルール化 → DEV エージェントプロンプト注入） | `docs/53_try_to_rules/` |
| 未定 | DEV エージェントへのレトロコンテキスト注入 | — |

---

## 3. DB スキーマ（重要テーブル）

| テーブル | 用途 |
|---|---|
| `projects` | プロジェクト |
| `sprints` | スプリント（sequence_number, status: Planned/Active/Completed） |
| `stories` | PBI（バックログアイテム） |
| `tasks` | タスク（assigned_role_id, sprint_id, status: To Do/In Progress/Review/Done） |
| `retro_sessions` | レトロセッション（sprint_id, status: draft/in_progress/completed, summary） |
| `retro_items` | KPT アイテム（category: keep/problem/try, source: user/agent/sm/po, source_role_id, is_approved） |
| `retro_rules` | 承認 Try から変換したルール（EPIC53 で使用予定） |
| `agent_retro_runs` | DEV エージェント実行ログ（reasoning_log, final_answer, changed_files_json） |
| `project_notes` | POノート / ふせん（sprint_id で紐付け） |
| `llm_usage_events` | LLM 使用量（source_kind: idea_refine/task_generation/inception/team_leader/task_execution/scaffold_ai/retrospective） |
| `team_settings` / `team_roles` | チーム構成設定 |
| `worktrees` | Git worktree レコード |

### マイグレーション履歴（最新: 23）

```
1〜16: 初期スキーマ〜アバター画像
17: CLI タイプサポート
18: レトロノート
19: sequence_number 採番（stories / tasks / sprints）
20: agent_retro_logs
21: llm_usage_events source_kind に retrospective 追加
22: transport_kind に gemini_cli / codex_cli 追加
23: sprint sequence_number NULL 修復
```

---

## 4. 重要な設計判断・注意点

### tauri-plugin-sql のトランザクション
各マイグレーションは `tauri-plugin-sql` が自動でトランザクションに包む。**SQL 内に `BEGIN TRANSACTION` / `COMMIT` を書いてはいけない**（二重トランザクションエラーになる）。

### SQLite の CHECK 制約変更
`ALTER TABLE ... ADD CONSTRAINT` は SQLite では不可。変更が必要な場合は「テーブルリビルド方式」（新テーブル作成 → INSERT SELECT → DROP → RENAME → インデックス再作成）を使う。migration 21 / 22 が参考例。

### LLM トランスポート統一
`ai.rs` の `resolve_po_transport` で API / CLI を統一解決。CLI は `execute_po_cli_prompt<T>` 経由で呼び出す。LLM 計測は `record_llm_usage`（API）/ `record_cli_usage`（CLI）で行う。

### スプリントのロールオーバー
`complete_sprint` は：
1. 完了タスクをアーカイブ
2. 未完了タスク・PBI を次のスプリントに移動（`sprint_id` を更新）
3. 全タスクがアーカイブ済みの PBI をアーカイブ
4. 次スプリント（Planned）が存在しなければ新規作成（`sequence_number` はサブクエリで採番）

### Board のタスク表示ロジック
`Board.tsx` の `activeTasks` は以下の両方を含む：
- `sprint_id === activeSprint.id` なタスク
- `activeStories`（`sprint_id` で紐付いた PBI）に属するタスク

PO アシスタントがスプリント中に追加したタスクは `sprint_id` が未設定の場合があるため、この両方フィルタが必要。

### `ScrumContext.startSprint`
`startSprint` は内部で `refresh()`（stories + tasks + sprints + dependencies の全再取得）を呼ぶ。`useSprints.startSprintRaw` は `fetchSprints()` しか呼ばないため、`ScrumContext` でラップして `refresh()` を追加している。

### InceptionDeck のフェーズ検出
`detectPhaseMarker` は `/Phase\s*([1-5])/i` でアシスタントメッセージのフェーズ番号を検出する。フェーズ遷移メッセージに「Phase X を開始します」を含めないとフェーズループが発生するので、`PHASE_GUIDE_MESSAGES` に必ず含めること。

### PBI 用語
UI テキストは「ストーリー」ではなく「PBI（プロダクトバックログアイテム）」で統一済み。バッジラベルは `PBI-N` 形式（`useProjectLabels.ts` の `formatStoryLabel` で定義）。内部コード（変数名・関数名・DB カラム名）は引き続き `story` のままで変更なし。

---

## 5. EPIC 52 実装ガイド（次のタスク）

### 概要
PO アシスタントがチャット中にノートとレトロアイテムを自動作成できるようにする。

### 実装対象ファイル
- `src-tauri/src/ai_tools.rs` — `AddProjectNoteTool` / `SuggestRetroItemTool` を追加
- `src-tauri/src/ai.rs` — PO アシスタントのツールレジストリに登録、システムプロンプトにレトロ指示追加

### 参考実装
既存の `CreateStoryAndTasksTool`（`ai_tools.rs`）が同パターンで実装済み。struct 定義 → `Tool` trait 実装（`definition()` + `call()` + フロントへの `tauri::Emitter::emit`）の順で実装する。

### 注意点
- レトロセッションが存在しない場合のエラーハンドリングが必要（`get_retro_sessions` で確認）
- `SuggestRetroItemTool` はアクティブセッション（`status='in_progress'` or `'draft'`）を前提とする
- ノート追加後は `kanban-updated` イベントを emit して UI を自動更新する

---

## 6. EPIC 53 実装ガイド（EPIC 52 の次）

### 概要
承認済み Try アイテムを「ルール」として永続化し、DEV エージェントのタスク実行プロンプトに自動注入する。

### 実装対象ファイル
- `src/components/kanban/RetrospectiveView.tsx` — Tryカラムに「ルール化」ボタン追加
- `src-tauri/src/claude_runner.rs` — `build_task_prompt` にルール注入セクション追加
- `src/components/ui/settings/` — ルール管理 UI 追加

### DB
`retro_rules` テーブルはマイグレーション 7 (`7_scrum_foundation.sql`) で既に定義済み。`db::get_retro_rules` / `add_retro_rule` / `update_retro_rule` / `delete_retro_rule` コマンドも実装済み。

---

## 7. 開発コマンド

```bash
# フロントエンドビルド（型チェック + Vite）
npm run build

# Rust ユニットテスト
cd src-tauri && cargo test

# Rust ビルド
cd src-tauri && cargo build

# 開発起動（Tauri dev モード）
npm run tauri dev
```

### ターミナルの文字化け対策
PowerShell で日本語が文字化けする場合、コマンド冒頭に以下を付与：
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
```

---

## 8. よくあるエラーと対処

| エラー | 原因 | 対処 |
|---|---|---|
| `cannot start a transaction within a transaction` | マイグレーション SQL に `BEGIN TRANSACTION` が含まれている | SQL から削除する（`tauri-plugin-sql` が自動でトランザクションを張る） |
| `r#"..."#` 文字列が途中で終わる | 文字列内に `"#` が含まれている | `r##"..."##` に変更する |
| Tauri コマンドのパラメータに `///` doc コメント | コンパイルエラー | doc コメントを削除する |
| Board にタスクが表示されない | `sprint_id` が未設定のタスクが存在 | PBI の `story_id` 経由でフィルタするロジックを確認 |
| スプリント番号が 0 | `sequence_number=NULL` のレコードが存在 | マイグレーション 23 で修復済み（再発の場合は `complete_sprint` の INSERT を確認） |

---

## 9. 未解決のTODO

| 場所 | 内容 |
|---|---|
| `db.rs` `get_agent_retro_runs_by_sprint_and_role` | `role_name` 文字列フィルタ → 将来 `role_id` ベースに移行 |
| レトロコンテキスト注入 | 承認済み KPT を次スプリントの DEV エージェントプロンプトに注入（EPIC52/53 後） |
| チャンクサイズ警告 | `npm run build` で 987KB チャンク警告。動作には影響なし。将来的に dynamic import で分割を検討 |
