# Epic 37: CLI Runner 抽象化レイヤー + DB 拡張 Workthrough

## 概要

Epic 37 では、これまで `claude_runner.rs` に直書きされていた Claude Code CLI 前提の実行ロジックを、複数 CLI に拡張できる共通レイヤーへ再構成した。目的は「既存の Claude 実行を壊さずに抽象化を導入すること」と「次の Epic で Gemini CLI / Codex CLI を安全に差し込めるよう、DB と実行経路の両方を先に整えること」の 2 点だった。

## 実装の軌跡

### 1. CliRunner trait の導入

まず `src-tauri/src/cli_runner/mod.rs` を新設し、CLI ごとの差分を閉じ込める `CliRunner` trait と `CliType` enum、ファクトリ関数 `create_runner()` を定義した。

技術的な判断:

- `CliType` は `claude` / `gemini` / `codex` の文字列表現と相互変換できるようにし、DB の `cli_type` カラムと直接つながる形にした
- `CliRunner` は最小限の責務として `command_name`, `build_args`, `env_vars`, `parse_version` を持たせ、プロセス起動やイベントストリーミングは既存実行基盤側に残した
- `create_runner()` は現時点で Claude のみを返し、Gemini / Codex は未実装エラーにすることで Epic 38 での追加ポイントを明確にした

### 2. Claude 固有ロジックの分離

次に `src-tauri/src/cli_runner/claude.rs` を追加し、Claude Code CLI 固有のコマンド引数構築を `ClaudeRunner` に集約した。これにより、`claude_runner.rs` 本体から「CLI 固有の引数組み立て」を剥がし、共通の起動パイプラインに専念できる構造へ移行した。

技術的な判断:

- Claude 固有の `--permission-mode bypassPermissions` や `--add-dir` などは `ClaudeRunner::build_args()` に閉じ込めた
- Unix / Windows の分岐は CLI 差分ではなくプロセス起動差分として残し、後続 CLI でも再利用できるようにした

### 3. 既存実行ロジックの安全な汎用化

`src-tauri/src/claude_runner.rs` は、フロントエンドとの互換性を守るため Tauri コマンド名 `execute_claude_task` を維持しつつ、内部状態と実行関数を CLI 非依存へ寄せた。

実施内容:

- `ClaudeState` / `ClaudeSession` を `AgentState` / `AgentSession` に改名
- `execute_prompt_request()` が `CliRunner` を受け取る構造へ変更
- `spawn_claude_process()` を `spawn_agent_process()` に置き換え、実際のコマンド名・引数は Runner から取得する方式に変更
- 出力ストリーミング、タイムアウト処理、終了時の `claude_cli_*` イベント名は互換性維持のため据え置き

安全性の観点:

- UI と IPC 契約を壊さないため、イベント名と Tauri コマンド名は変更しなかった
- 実行の成否や task status 更新、worktree 連携など既存の副作用はそのまま保持した
- Scaffold AI 側も `AgentState` を参照するように追従し、内部命名変更による崩れを防いだ

### 4. DB スキーマと型の拡張

複数 CLI をロール単位で選択できるようにするため、`team_roles` テーブルへ `cli_type` カラムを追加した。マイグレーションは `src-tauri/migrations/17_cli_type_support.sql` として追加し、既存レコードがそのまま Claude 扱いになるよう `DEFAULT 'claude'` を採用した。

合わせて以下も更新した。

- `src-tauri/src/db.rs` の `TeamRole` / `TeamRoleInput`
- `get_team_role_by_id`, `get_team_configuration`, `save_team_configuration`
- `src/types/index.ts` の `TeamRoleSetting`

技術的な判断:

- 既存データ移行を最小コストにするため、nullable ではなく `NOT NULL DEFAULT 'claude'` とした
- フロントエンド側はまだ CLI 選択 UI を持たないため、新規ロールのデフォルト値は `claude` を設定してビルド互換だけ先に担保した

### 5. 実行フローの結合

`execute_claude_task()` の冒頭で担当ロールを取得したあと、`role.cli_type` を `CliType` に変換し、`create_runner()` から対応 Runner を取得するよう接続した。これにより、現在は Claude のみ実行可能だが、後続 Epic では DB 値を増やすだけで起動先 CLI を切り替えられる土台が整った。

## 検証

以下を実行し、いずれも成功した。

- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run build`

加えて、PO により既存の Claude Code CLI が新しい抽象化レイヤー経由でも問題なく動作することが手動確認された。

## 結果

Epic 37 の完了により、Vicara の Dev エージェント実行基盤は「Claude 固定の実装」から「CLI 種別を差し替え可能な実装」へ移行した。既存の Claude 実行互換は維持されたまま、次の Epic 38 では `CliRunner` 実装と CLI 別引数設計を追加することに集中できる状態になった。
