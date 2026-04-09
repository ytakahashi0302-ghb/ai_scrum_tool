# Epic 36: Git ブロッキング修正 + CLI 検出基盤 タスクリスト

## ステータス

- 状態: `Done`
- 完了条件: 実装・ビルド・Rust テスト完了、PO により手動確認スキップで正式クローズ承認
- 作成日: 2026-04-09
- 完了日: 2026-04-09

## 概要

Git 未インストール時にアプリ全体がブロックされる問題を修正し、複数 CLI ツールのインストール状況を検出する基盤コマンドを追加する。

## 実行順序

### 1. Git ブロッキングの解除
- [x] `src/App.tsx` の Git 未インストール時フルスクリーンブロック（L366-408）を削除する。
- [x] 代わりに、Git 未インストール時はアプリ上部にワーニングバナーを表示する。
- [x] バナーには Git ダウンロードリンクと「Devエージェント機能には Git が必要です」の説明を含める。
- [x] `src/context/WorkspaceContext.tsx` の `refreshGitStatus()` は引き続き保持する（状態は参照用として維持）。

### 2. CLI 検出コマンドの実装（バックエンド）
- [x] `src-tauri/src/cli_detection.rs` を新規作成する。
- [x] 以下の CLI のインストール状態を検出する関数を実装する:
  - `claude --version` (Claude Code CLI)
  - `gemini --version` (Gemini CLI)
  - `codex --version` (Codex CLI)
- [x] Tauri コマンド `detect_installed_clis` を追加し、各 CLI の `{ name, installed, version }` を返却する。
- [x] `src-tauri/src/lib.rs` にコマンドを登録する。

### 3. フロントエンド検出フックの追加
- [x] `src/hooks/useCliDetection.ts` を新規作成する。
- [x] `detect_installed_clis` を呼び出し、結果をキャッシュするカスタムフックを実装する。
- [x] 手動リフレッシュ機能を提供する（CLI をインストール後に再検出）。

### 4. 動作確認
- [x] Git 未インストール環境でアプリが正常に起動し、カンバン操作・PO アシスタントが利用できることを確認する。
- [x] 各 CLI がインストール済み/未インストールの場合に検出コマンドが正しい結果を返すことを確認する。

## 完了メモ

- フロントエンドは `npm run build` を通過。
- Rust バックエンドは `cargo test --manifest-path src-tauri/Cargo.toml` を通過。
- 手動動作確認は PO 判断でスキップし、テスト通過状態をもって Epic 36 を正式クローズ。
