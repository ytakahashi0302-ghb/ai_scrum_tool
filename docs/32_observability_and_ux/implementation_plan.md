# Epic 32: LLM Observability & UX Refinement 実装計画

## 1. 目的
- LLM 実行コストをプロジェクト運営で確認できる形にする
- カンバン / ターミナル / AI Leader の操作性を高める
- スプリント進行の計測漏れを防ぐ

## 2. PO 決定事項
- Claude CLI の厳密 usage が取得不能な場合は、文字列パースなどのハックは行わず `measurement_status='unavailable'` で記録する
- ヘッダーの主表示は「プロジェクト累計」と「スプリント累計」の概算コスト + token 数とする
- 「今日の消費」はホバー表示に集約する
- Task ランキング UI は今回スコープ外とし、DB / API 基盤のみ先行整備する

## 3. Mission 1: LLM Observability

### 3.1 バックエンド方針
- `src-tauri/migrations/15_llm_observability.sql` で `llm_usage_events` を追加する
- usage は「1 リクエスト = 1 event」として保存し、履歴テーブルの総和で集計する
- provider API と Claude CLI を同一スキーマへ正規化する
- 概算コストは保存時に計算し、単価スナップショットも event に残す

### 3.2 DB スキーマ
- テーブル: `llm_usage_events`
- 主な列
  - `project_id`
  - `task_id`
  - `sprint_id`
  - `source_kind`
  - `transport_kind`
  - `provider`
  - `model`
  - `input_tokens`
  - `output_tokens`
  - `cache_creation_input_tokens`
  - `cache_read_input_tokens`
  - `total_tokens`
  - `estimated_cost_usd`
  - `measurement_status`
  - `raw_usage_json`
  - `request_started_at`
  - `request_completed_at`
  - `latency_ms`
  - `success`
  - `error_message`
- index
  - `project_id + created_at`
  - `task_id + created_at`
  - `source_kind`

### 3.3 記録対象
- `idea_refine`
- `task_generation`
- `inception`
- `team_leader`
- `task_execution`
- `scaffold_ai`

### 3.4 集計 API
- `get_project_llm_usage_summary(project_id)`
  - project 累計
  - active sprint 累計
  - today 累計
  - source 別内訳
  - model 別内訳
- `get_task_llm_usage_summary(task_id)`
- `list_project_task_llm_usage(project_id)`
- usage 記録後は `llm_usage_updated` を emit して UI を再取得させる

### 3.5 フロントエンド方針
- `useLlmUsageSummary(currentProjectId)` を追加する
- ヘッダーは compact な usage ピルを表示する
  - Project 累計
  - Sprint 累計
  - title / tooltip に Today と unavailable 件数
- プロジェクト設定画面は observability カードを表示する
  - Project Total
  - Active Sprint
  - Today
  - Source別内訳
  - Model別内訳
- Task ランキング UI は実装しない

## 4. Mission 2: ペインのリサイズ

### 4.1 設計方針
- 依存追加を避けるため `react-split` ではなく lightweight な custom split を採用する
- `App.tsx` にドラッグ可能な separator を配置する
- 2 系統の分割を扱う
  - 左右: Scrum エリア / AI Leader
  - 上下: ScrumDashboard / TerminalDock

### 4.2 UX 要件
- 左右ペイン最小幅
  - main pane: 420px
  - sidebar: 320px
- 上下ペイン最小高さ
  - dashboard: 260px
  - terminal: 180px
- terminal 最小化時は 34px bar を維持する
- hover 時に separator を強調表示する

### 4.3 永続化
- `localStorage` へ保存する
  - `microscrum.layout.sidebarRatio`
  - `microscrum.layout.terminalRatio`
- 再表示時は前回比率を復元する

### 4.4 Terminal 追従
- `TerminalDock` 既存の `ResizeObserver` を活用して `fit()` を追従させる
- ドラッグ中 / 展開時 / 最小化解除時に描画が崩れないことを優先する

## 5. Mission 3: タイマー自動開始

### 5.1 状態管理方針
- タイマー状態の責務は `useSprintTimer` に集約する
- UI 側は「開始トリガが成功した」ことだけを通知する
- 自動開始 API は冪等にする

### 5.2 追加 state / API
- `SprintState` に追加
  - `linkedSprintId`
  - `lastStartedReason`
- 追加 API
  - `getConfiguredDurationMs()`
  - `ensureTimerRunning(reason, linkedSprintId?)`

### 5.3 自動開始ルール
- ケース A: スプリント開始成功後
  - `BacklogView` で `start_sprint` 成功後に `ensureTimerRunning('SPRINT_STARTED', sprintId)` を呼ぶ
- ケース B: AI 開発起動成功後
  - `TaskCard` で `execute_claude_task` 成功後に `ensureTimerRunning('AI_TASK_LAUNCHED', task.sprint_id ?? null)` を呼ぶ

### 5.4 冪等性ルール
- `RUNNING`
  - タイマーはリセットしない
  - 必要なら `linkedSprintId` と `lastStartedReason` だけ更新する
- `PAUSED`
  - `RUNNING` へ復帰する
- `NOT_STARTED` / `COMPLETED` / `TIME_UP`
  - 最新設定 duration で新規開始する

### 5.5 duration の単一化
- `BacklogView` の仮 `7日` duration は廃止する
- `settings.json` の sprint duration を `useSprintTimer` 経由で取得し、DB 側 `duration_ms` と UI timer を一致させる

## 6. 実装結果

### 6.1 Mission 1
- `llm_usage_events` を追加済み
- provider API / Claude CLI への usage 記録フックを追加済み
- `today_totals` を含む project summary API を追加済み
- ヘッダー usage ピルと設定画面 observability カードを追加済み

### 6.2 Mission 2
- 左右 / 上下ペインの custom split を実装済み
- separator UI と比率永続化を実装済み
- `TerminalDock` の追従は既存 `ResizeObserver` を利用済み

### 6.3 Mission 3
- `ensureTimerRunning` を追加済み
- スプリント開始時と AI 起動時の自動 RUNNING 化を実装済み
- state の後方互換を保ったまま `linkedSprintId` / `lastStartedReason` を保存済み

## 7. テスト方針

### 7.1 バックエンド
- migration が通ること
- usage 保存 / 集計が期待通りであること
- CLI usage fallback が `unavailable` で扱われること

### 7.2 フロントエンド
- usage ヘッダーが project 切替 / event 受信で更新されること
- 設定画面の Source別 / Model別内訳が表示されること
- 左右 / 上下 split がドラッグで変更できること
- スプリント開始 / AI 起動で timer が自動 RUNNING になること
- 既存 `RUNNING` 時に timer がリセットされないこと

### 7.3 ビルド確認
- `npm run build`
- `cargo test`

## 8. 残メモ
- Claude CLI の厳密 usage は将来改善候補として `BACKLOG.md` へ記載済み
- Task ランキング UI は次フェーズで追加可能なように `task_id` 集計基盤のみ先行済み
