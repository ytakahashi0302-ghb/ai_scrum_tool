# Epic 37 Handoff

## この Epic で確定したこと

- `src-tauri/src/cli_runner/mod.rs` に `CliRunner` trait、`CliType` enum、`create_runner()` が追加され、CLI 抽象化レイヤーが完成した。
- `src-tauri/src/cli_runner/claude.rs` に `ClaudeRunner` が実装され、既存の Claude Code CLI 実行はこの抽象化レイヤー経由に移行済みである。
- `src-tauri/src/claude_runner.rs` の内部状態は `AgentState` / `AgentSession` に汎用化されたが、Tauri コマンド名 `execute_claude_task` と `claude_cli_*` イベント名は互換性維持のため据え置いている。
- `team_roles` テーブルに `cli_type TEXT NOT NULL DEFAULT 'claude'` が追加され、既存ロールは自動的に Claude 扱いになっている。

## 利用可能になったバックエンド前提

- Runner 抽象化入口: `src-tauri/src/cli_runner/mod.rs`
- Claude 実装: `src-tauri/src/cli_runner/claude.rs`
- 実行フロー結合点: `src-tauri/src/claude_runner.rs`
- DB カラム: `team_roles.cli_type`
- マイグレーション: `src-tauri/migrations/17_cli_type_support.sql`

現在の `CliRunner` trait の責務:

- `command_name()`
- `build_args(prompt, model, cwd)`
- `env_vars()`
- `parse_version()`

`create_runner()` の現状:

- `CliType::Claude` は `ClaudeRunner` を返す
- `CliType::Gemini` / `CliType::Codex` は未実装エラーを返す

## Epic 38 でまず見るべきポイント

- `role.cli_type` はすでに `execute_claude_task()` 冒頭で読み込まれているため、Epic 38 では `create_runner()` と各 CLI Runner 実装を増やせば結合点の追加は最小限で済む
- Windows/Unix のプロセス起動差分は `spawn_agent_process()` 側に残してあるため、CLI ごとの差分は可能な限り Runner 側へ閉じ込めること
- フロントエンドのチーム設定 UI はまだ CLI 選択 UI を持っていない。型と DB は先に拡張済みだが、現状の新規ロール既定値は `claude`
- 既存の Claude 実行互換は PO が手動確認済みなので、Epic 38 では Gemini/Codex を足しても Claude 回帰を必ず再確認すること

## 注意点

- `execute_claude_task` というコマンド名は現時点でフロントエンド契約になっている。名称変更は互換性影響が大きいため、別Epicで明示的に扱うこと
- `claude_cli_started` / `claude_cli_output` / `claude_cli_exit` のイベント名も現状は維持している。CLI 名とイベント名の再設計をする場合は、UI 側の追従範囲を先に整理すること
- `cli_type` は DB に入ったが、検出済み CLI 一覧との突合や選択 UI はまだ未実装である

## 検証状況

- `cargo test --manifest-path src-tauri/Cargo.toml` 成功
- `npm run build` 成功
- PO による既存 Claude Code CLI の手動動作確認 成功

【厳格運用ルール】今後のすべてのEpicにおいて、タスクを1つ消化するたびに `task.md` のチェックボックスを小まめに更新し、常に最新の進捗を可視化すること。
