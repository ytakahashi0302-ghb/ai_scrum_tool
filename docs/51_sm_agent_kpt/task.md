# EPIC51: SMエージェントKPT合成 + バグ修正・UX改善

## 背景

レトロスペクティブでは、各エージェントの振り返りとPOの振り返りをSMエージェント（POアシスタントの1ロールとして想定）が取りまとめ、KPTを合成する。エージェントの実行ログもレトロの入力として活用する。

> **軌道修正メモ (2026-04-15)**: Story 3 で予定していた `tasks.execution_log_summary` への末尾4KBバッファ蓄積は、Epic 50 で導入された `agent_retro_runs` / `agent_retro_tool_events` テーブルが上位互換となるため、本Epicではスキップ。Story 1 のコンテキスト収集で Epic 50 の構造化ログ（`reasoning_log` / `final_answer` / `changed_files_json`）を直接参照する設計にアップグレードした。

## ゴール

- 各エージェントの視点からKPTアイテムを自動生成する機能を実装する
- SM（Scrum Master）としてKPTを合成・要約する機能を実装する
- ~~エージェント実行ログの末尾4KBをタスクに保存する仕組みを追加する~~ → Epic 50 で対応済み
- RetrospectiveView UIに「レトロ開始」「レトロを締める」ボタンを接続する
- 同セッション内で発見されたバグの修正とUX改善

## スコープ

### 含む

- `src-tauri/src/ai.rs` に `generate_agent_retro_review` コマンド追加
- `src-tauri/src/ai.rs` に `synthesize_retro_kpt` コマンド追加
- RetrospectiveViewのバックエンド接続 + UX改善
- LLM使用量の記録（`llm_usage_events` に `source_kind='retrospective'` 追加、マイグレーション21）
- スプリントボード・履歴・用語に関するバグ修正

### 含まない

- エージェント実行ログの raw バッファ蓄積（Epic 50 の `agent_retro_runs` 基盤で代替）
- POアシスタントからのレトロアイテム提案（EPIC52で実装）
- Try→ルール変換（EPIC53で実装）
- DEVエージェントへのレトロコンテキスト注入（将来のEpicで実装）
- RetrospectiveView UIの基本構造（EPIC48で作成済み前提）

## タスクリスト

### Story 1: エージェント振り返り生成

- [x] `generate_agent_retro_review` Tauriコマンド実装
  - 入力: project_id, sprint_id, retro_session_id, role_id, skip_inactive
  - 処理: タスク + agent_retro_runs (reasoning_log / final_answer / changed_files) + POノート + LLM使用量を収集 → LLMにそのロールの視点でKPT生成指示
  - 出力: RetroItem候補リスト（retro_itemsに自動保存、source='agent'、source_role_id=role_id）
- [x] `skip_inactive` パラメータ追加 — タスク・実行ログが両方ゼロのロールをスキップ（デフォルトON、UIトグルで制御）
- [x] エージェント振り返り用のシステムプロンプト設計（`build_retro_review_prompt`、長大ログのトリミング付き）
- [x] LLM使用量記録の `source_kind` CHECK制約に `retrospective` を追加（マイグレーション **21**）
- [x] マイグレーション21の二重トランザクションエラー修正（`tauri-plugin-sql` が自動でトランザクションを張るため SQL内の `BEGIN TRANSACTION` / `COMMIT` を削除）

### Story 2: SM KPT合成

- [x] `synthesize_retro_kpt` Tauriコマンド実装
  - 入力: project_id, sprint_id, retro_session_id
  - 処理: 全retro_items（source別グルーピング） + スプリント統計 → SMとしてKPT合成
  - 出力: retro_sessions.summary に Markdown 保存 + 統合retro_items（source='sm'）作成
- [x] SM合成用のシステムプロンプト設計（`build_retro_kpt_synthesis_prompt`）— ロール横断パターン抽出・根本原因分析・verbatim禁止を明示
- [x] 再実行時に前回のSMアイテムを削除（`delete_retro_items_by_source`）して重複を防ぐ
- [x] retro_session の status を `completed` に更新

### Story 3: 実行ログ蓄積

- [x] **Epic 50 に統合済み**: `agent_retro_runs` / `agent_retro_tool_events` テーブルが raw バッファより上位互換のデータを保存しており、Story 1 の収集ロジックから直接参照する設計に変更。本 Story の個別実装はスキップ。

### Story 4: フロントエンド接続・UX改善

- [x] 「レトロ開始」ボタン → 全ロールに対して `generate_agent_retro_review` を順次呼び出し（CLI transport の単一プロセス前提で逐次）
- [x] 「レトロを締める」ボタン（旧「KPT合成」）→ `synthesize_retro_kpt` 呼び出し + サマリパネル更新・自動展開
- [x] ローディング状態の表示（`agentLoading` / `kptLoading`、toast.loading で `(n/total)` 進捗表示）
- [x] エラーハンドリング（toast.error で通知、失敗後もボタン再活性化）
- [x] SMサマリパネルをKPTグリッドより上部に移動、初期状態は折りたたみ
- [x] 「稼働なしのロールをスキップ」トグル（デフォルトON）
- [x] 承認済みTry一覧パネル（プロジェクト横断、スプリントラベル・内容・日付付き）
- [x] ふせん（NotesPanel）— 完了済みセッションにも追加可能に（`completed` ステータスも対象化）

### Story 5: 関連バグ修正

- [x] **CLIトランスポートDB制約エラー** — マイグレーション22: `gemini_cli` / `codex_cli` を `transport_kind` CHECK制約に追加
- [x] **LLM観測ログのジェネリック化** — `record_claude_cli_usage` → `record_cli_usage` にリネーム（`llm_observability.rs` / `claude_runner.rs`）
- [x] **InceptionDeckフェーズループ** — フェーズ遷移メッセージに `"Phase X を開始します"` を追加し、`detectPhaseMarker` が正しく検出できるよう修正
- [x] **スプリント開始後にBoardタスクが表示されない** — `ScrumContext.startSprint` に `refresh()` を追加（`fetchSprints()` のみだったのを全データ再取得に変更）
- [x] **スプリント開始後にPOアシスタント追加タスクが表示されない** — `Board.tsx`: `activeTasks` に `activeStories` に属するタスクも含めるよう変更
- [x] **スプリント番号が0と表示される** — `complete_sprint` のロールオーバー新規Sprint作成時に `sequence_number` を採番するよう修正
- [x] **既存NULL sequence_number の修復** — マイグレーション23で既存の NULL 行を一括修正
- [x] **スプリント履歴に未完了スプリントが混入** — `useSprintHistory` に `status === 'Completed'` フィルタを追加
- [x] **スプリント履歴にスプリント番号が表示されない** — `HistoryModal` に `formatSprintLabel` を適用

### Story 6: PBI用語統一

- [x] バッジラベル: `UserStory` → `PBI`（`useProjectLabels.ts`）
- [x] UIテキスト全体を「ストーリー」→「PBI」に統一（BacklogView / StoryFormModal / StorySwimlane / HistoryModal / useStories / useTasks）

## 完了条件

- [x] 「レトロ開始」で各エージェントのKPTアイテムが自動生成される
- [x] 「レトロを締める」でSMによる統合サマリが生成・表示される
- [x] エージェント実行ログが Epic 50 の `agent_retro_runs` 経由で参照される
- [x] LLM使用量が `source_kind='retrospective'` で記録される
- [x] スプリント開始後、Boardタブに正しくタスクが表示される
- [x] スプリント番号が正しくインクリメントされる
- [x] スプリント履歴が完了スプリントのみ・番号付きで表示される
- [x] UI全体でPBI表記が統一されている
- [x] `cargo test` が通る（92 tests passed）
- [x] `cargo build` / `npm run build` がエラーなく完了する
