# Epic 32: LLM Observability & UX Refinement - Task List

## 目的
- Mission 1 の usage 計測基盤と可視化 UI を実装する
- Mission 2 のリサイズ可能な 2 段ペインを導入する
- Mission 3 のタイマー自動開始ロジックを導入する

## Phase 1: 設計確定
- [x] `implementation_plan.md` の承認を得る
- [x] Claude CLI usage の取得経路を確認し、厳密取得困難時は `measurement_status='unavailable'` を許容する方針を確定する
- [x] ヘッダー usage 表示は「プロジェクト累計 + スプリント累計」を主表示とし、今日の消費はホバー表示にする方針を確定する
- [x] Task ランキング UI は今回スコープ外とし、集計基盤のみ先行実装する方針を確定する

## Phase 2: Mission 1 バックエンド基盤

### Task 2.1: DB マイグレーション
- [x] `src-tauri/migrations/15_llm_observability.sql` を追加する
- [x] `llm_usage_events` テーブルと index を作成する
- [x] `src-tauri/src/lib.rs` に migration v15 を登録する

### Task 2.2: observability モジュール追加
- [x] `src-tauri/src/llm_observability.rs` を新設する
- [x] `LlmUsageEvent`, `NormalizedUsage`, summary DTO を定義する
- [x] `record_llm_usage`, `calculate_estimated_cost` を実装する
- [x] project / task 集計クエリを実装する

### Task 2.3: provider API 呼び出しの usage 取得
- [x] `src-tauri/src/rig_provider.rs` の戻り値を usage を含む DTO に変更する
- [x] `refine_idea` の usage 記録を追加する
- [x] `generate_tasks_from_story` の usage 記録を追加する
- [x] `chat_inception` の usage 記録を追加する
- [x] `chat_with_team_leader` の usage 記録を追加する

### Task 2.4: Claude CLI usage 取得
- [x] `src-tauri/src/claude_runner.rs` で usage 抽出ポイントを実装する
- [x] `execute_claude_task` 実行分を task 単位で保存する
- [x] `execute_claude_prompt_task` / `execute_scaffold_ai` 実行分を保存する
- [x] usage 取得不能時は `measurement_status='unavailable'` を保存する

### Task 2.5: Tauri command 公開
- [x] `get_project_llm_usage_summary` を追加する
- [x] `get_task_llm_usage_summary` を追加する
- [x] `list_project_task_llm_usage` を追加する
- [x] `llm_usage_updated` イベント送出を追加する

## Phase 3: Mission 1 フロントエンド可視化

### Task 3.1: usage 取得フック
- [x] usage summary 用フックを追加する
- [x] `currentProjectId` と `llm_usage_updated` に追従して再取得する

### Task 3.2: ヘッダー表示
- [x] `src/App.tsx` に compact usage ピルを追加する
- [x] tokens / cost / today delta を表示する
- [x] ローディング / empty / unavailable 状態を定義する

### Task 3.3: プロジェクト設定画面
- [x] `src/components/ui/GlobalSettingsModal.tsx` の「プロジェクト設定」タブに observability カードを追加する
- [x] source_kind 別内訳を表示する
- [x] model 別内訳を表示する
- [x] task ランキング UI は実装せず、将来拡張のために backend 集計 API のみ維持する

## Phase 4: Mission 2 リサイズ機能

### Task 4.1: Split 導入
- [x] 軽量な custom split 実装を導入する
- [x] `src/App.tsx` の固定幅レイアウトを split ベースへ置換する
- [x] 右ペイン開閉時の split 表示条件を整理する

### Task 4.2: Split UX
- [x] `src/App.css` に gutter スタイルを追加する
- [x] 左右・上下それぞれの最小サイズを定義する
- [x] pane サイズを永続化して復元する

### Task 4.3: ターミナル追従
- [x] `src/components/terminal/TerminalDock.tsx` の `ResizeObserver` により split 後の `fit()` 再計算を利用する
- [x] 最小化時 / 展開時 / ドラッグ終了時の挙動を安定化する

## Phase 5: Mission 3 タイマー自動開始

### Task 5.1: タイマー API 改修
- [x] `src/hooks/useSprintTimer.ts` に `ensureTimerRunning(reason)` を追加する
- [x] `lastStartedReason`, `linkedSprintId` を後方互換つきで保存できるようにする
- [x] duration 取得ロジックを共通化する

### Task 5.2: スプリント開始との連動
- [x] `src/components/kanban/BacklogView.tsx` で `start_sprint` 成功後に `ensureTimerRunning('SPRINT_STARTED')` を呼ぶ
- [x] 仮の `7日` duration を廃止する
- [x] sprint DB duration と timer duration を一致させる

### Task 5.3: AI 開発起動との連動
- [x] `src/components/kanban/TaskCard.tsx` で Claude 起動成功後に `ensureTimerRunning('AI_TASK_LAUNCHED')` を呼ぶ
- [x] 起動失敗時は timer を開始しないようにする
- [x] 既存 `RUNNING` のときは no-op にする

## Phase 6: テスト

### Task 6.1: バックエンド
- [x] migration テスト
- [x] usage 保存 / 集計テスト
- [x] CLI usage fallback テスト

### Task 6.2: フロントエンド
- [x] usage ヘッダー表示確認
- [x] 設定画面内訳表示確認
- [x] split リサイズ確認
- [x] timer 自動開始確認

### Task 6.3: ビルド / 手動検証
- [x] `npm run build`
- [x] `cargo test`
- [ ] スプリント開始時の timer 自動起動を手動確認
- [ ] AI 起動時の timer 自動起動を手動確認
- [ ] usage がヘッダーと設定画面へ反映されることを手動確認

## 実装順序
1. Mission 1 のスキーマと backend API を先に固める
2. usage をヘッダーと設定画面へ出す
3. Split レイアウトへ置換する
4. timer 自動開始を最後に接続して回帰確認する

## 完了条件
- [x] usage event が DB に保存される
- [x] project / task 単位の token と概算 cost を表示できる
- [x] 左右 / 上下ペインがドラッグでリサイズできる
- [x] スプリント開始時に timer が自動 RUNNING になる
- [x] AI 開発起動時に timer が自動 RUNNING になる
- [x] `npm run build` と `cargo test` を通過する
