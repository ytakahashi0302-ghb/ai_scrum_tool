# MicroScrum AI v1.1.0 Release Notes

## 概要
v1.1.0 は、Epic 31 と Epic 32 を通じて MicroScrum AI を「AI が走るだけのツール」から「安全にレビューでき、コストも見え、日常的に使いやすい AI スクラム環境」へ前進させたリリースです。

## ハイライト
- Git Worktree による task 単位の安全な開発隔離
- `Review` 列、プレビュー起動、承認マージ、競合対応を含む 1-Click レビュー導線
- LLM usage / token / 概算コストの可視化
- 左右 / 上下ペインのドラッグリサイズ
- スプリント開始時 / AI 起動時のタイマー自動開始

## Epic 31: Git Worktree Isolation & 1-Click Review

### 追加された価値
- AI 実装を `main` 直下ではなく Git Worktree 上で実行するようになり、複数タスクの並行実行時でも変更衝突を抑えやすくなりました。
- タスク完了後は `Review` 列へ自動遷移し、ユーザーはプレビュー確認から承認マージまでを UI 上で進められます。
- コンフリクト時には「AI 再実行」「手動解決」「ワークツリー破棄」を選べるため、破綻しにくいレビュー体験になりました。

### 主な機能
- Worktree 作成 / 削除 / diff / merge 管理
- `Review` ステータスと Review 専用カード UI
- 開発サーバー型 / 静的サイト型の簡易プレビュー
- orphaned worktree のクリーンアップ
- Git 未インストール時のブロッキング UI
- ゼロ構成 `ensure_git_repo` による自動初期化

## Epic 32: LLM Observability & UX Refinement

### 追加された価値
- AI 利用量が見えなかった問題に対し、project / sprint 単位で token と概算コストを把握できるようになりました。
- 3ペイン UI の固定幅をやめ、作業スタイルに合わせて Kanban / Terminal / AI Leader の比率を調整できるようになりました。
- スプリント開始や AI 実行の瞬間にタイマーが自動で RUNNING へ遷移するため、計測漏れが起きにくくなりました。

### 主な機能
- `llm_usage_events` テーブルによる usage event 永続化
- provider API 経由の usage 計測
- Claude CLI 実行分の fallback 記録
  - 厳密 usage が取れない場合は `measurement_status='unavailable'`
- ヘッダー usage ピル
  - Project 累計
  - Sprint 累計
  - Today はホバー表示
- 設定画面の observability カード
  - Project Total
  - Active Sprint
  - Today
  - Source別内訳
  - Model別内訳
- 左右 / 上下 split のドラッグリサイズ
- timer の `ensureTimerRunning()` による冪等な自動開始

## 改善・修正
- タスク編集時に担当ロールが未設定へ戻る不具合を修正
- Terminal Dock は split 後も `ResizeObserver` により `fit()` が追従
- sprint duration は設定値と UI timer / DB 保存値が一致するよう整理

## 検証
- `npm run build` 成功
- `cargo test --manifest-path C:\Users\green\Documents\workspaces\ai-scrum-tool\src-tauri\Cargo.toml` 成功
  - 21 tests passed

## 既知の今後課題
- Claude CLI 実行分の厳密 usage 計測
- task 単位ランキング UI
- Review フローの E2E / クロスプラットフォーム手動検証の拡充

## 一言でいうと
v1.1.0 は、MicroScrum AI を「AI が実装してくれる」段階から、「安全にレビューでき、コストも把握でき、毎日触りやすい」段階へ引き上げるアップデートです。
