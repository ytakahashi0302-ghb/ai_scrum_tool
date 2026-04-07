# Epic 32: LLM Observability & UX Refinement Walkthrough

## 1. 概要
Epic 32 では、LLM 実行コストの可視化、3ペイン UI の操作性改善、タイマー自動開始を実装した。加えて、クローズ前の確認で見つかった「タスク編集時の担当ロールが未設定へ戻る」不具合も修正した。

## 2. 主要変更

### 2.1 Mission 1: LLM Observability
- `src-tauri/migrations/15_llm_observability.sql`
  - `llm_usage_events` テーブルを追加
- `src-tauri/src/llm_observability.rs`
  - usage 正規化
  - 概算コスト計算
  - event 保存
  - project / task summary 集計 API
- `src-tauri/src/rig_provider.rs`
  - provider API の戻り値を usage 付き DTO へ拡張
- `src-tauri/src/ai.rs`
  - `idea_refine`
  - `task_generation`
  - `inception`
  - `team_leader`
  - 上記フローで usage 記録を実施
- `src-tauri/src/claude_runner.rs`
  - task execution / scaffold 実行の usage 記録フックを追加
  - usage 取得不能時は `measurement_status='unavailable'` で保存
- `src/App.tsx`
  - ヘッダーに project / sprint usage ピルを追加
- `src/components/ui/GlobalSettingsModal.tsx`
  - プロジェクト設定タブに observability カードを追加
- `src/hooks/useLlmUsageSummary.ts`
  - summary 取得と `llm_usage_updated` 追従を追加

### 2.2 Mission 2: ペインリサイズ
- `src/App.tsx`
  - 左右ペインと上下ペインの custom split を追加
  - 最小サイズ制御
  - localStorage 永続化
- `src/App.css`
  - draggable separator の見た目を追加
- `src/components/terminal/TerminalDock.tsx`
  - 既存 `ResizeObserver` により split 後も `fit()` が追従

### 2.3 Mission 3: タイマー自動開始
- `src/hooks/useSprintTimer.ts`
  - `ensureTimerRunning(reason, linkedSprintId?)`
  - `getConfiguredDurationMs()`
  - `linkedSprintId`
  - `lastStartedReason`
  - 上記を追加
- `src/components/kanban/BacklogView.tsx`
  - スプリント開始成功後に timer 自動開始
  - 仮 `7日` duration を廃止
- `src/components/kanban/TaskCard.tsx`
  - Claude 起動成功後に timer 自動開始
- `src/components/SprintTimer.tsx`
  - duration 表示文言を動的化

### 2.4 クローズ前不具合修正
- `src/components/board/TaskFormModal.tsx`
  - モーダル表示中の `initialData` 再適用でフォームが巻き戻る問題を修正
- `src/hooks/useTasks.ts`
  - `update_task` 時にも `assignedRoleId` を明示送信するよう補強

## 3. UI の見え方

### 3.1 ヘッダー
- Project 累計 usage
- Active Sprint 累計 usage
- Today と unavailable 件数はホバー表示

### 3.2 プロジェクト設定
- Project Total
- Active Sprint
- Today
- Source別内訳
- Model別内訳

### 3.3 レイアウト
- Scrum エリアと AI Leader の境界を左右ドラッグ可能
- ScrumDashboard と TerminalDock の境界を上下ドラッグ可能
- 前回サイズを復元

### 3.4 タイマー
- スプリント開始で自動 RUNNING
- AI 開発起動で自動 RUNNING
- 既に RUNNING の場合はリセットしない

## 4. 検証結果

### 4.1 自動テスト / ビルド
- `npm run build` 成功
- `cargo test --manifest-path C:\Users\green\Documents\workspaces\ai-scrum-tool\src-tauri\Cargo.toml` 成功
  - 21 tests passed

### 4.2 手動確認
- タスク編集画面の担当ロール保存不具合は修正後に再確認済み
- split UI / timer auto-start / usage UI は実装済みで、必要な手動確認項目を `task.md` に残している

## 5. 既知の今後候補
- Claude CLI の厳密 usage 取得強化
- task 単位ランキング UI
- usage の予算アラートや履歴グラフ

## 6. 関連ドキュメント
- `implementation_plan.md`
- `task.md`
- `BACKLOG.md`
