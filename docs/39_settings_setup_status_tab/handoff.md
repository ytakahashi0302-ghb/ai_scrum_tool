# Epic 39 Handoff

## Epic 39 の到達点

Epic 39 は完了済み。最終的に、当初計画の「セットアップ状況タブ」だけでなく、次の土台まで整備した。

- 設定画面に `セットアップ状況` タブを追加
- API キー有無のみを返す安全な backend コマンドを追加
- `GlobalSettingsModal` のタブ順を再編
- `Analytics` タブを新設し、LLM Observability を分離
- Team Settings でロールごとの `Claude / Gemini / Codex` 選択を実装
- 未導入 CLI の選択禁止
- 5 ロールテンプレートの backend 補完
- Gemini CLI の Windows / workspace / 現行引数仕様への対応
- Dev エージェント 5 テンプレートに対する既定アバター割り当て

## 重要な実装ポイント

### 1. Gemini CLI は「検出できる」だけでなく「完走できる」状態にした

以下の 3 課題を解消済み。

- 実体パス解決
  - npm グローバルの `gemini.cmd` を検出だけでなく実行にも利用する。
- workspace 内 prompt ファイル配置
  - prompt ファイルは `%TEMP%` ではなく worktree 配下 `.vicara-agent/` へ置く。
- 引数衝突回避
  - `--sandbox permissive` は廃止し、現行 CLI に合わせて `--approval-mode yolo` を使用。

次の Epic で Gemini 周辺を触る場合は、この 3 点を崩さないこと。

### 2. CLI usage の transport/provider は分離済み

Observability 側では今後の CLI usage を以下で保存する。

- `claude_cli`
- `gemini_cli`
- `codex_cli`

ただし、過去の DB には修正前の `claude_cli` 表記が残る可能性がある。UI では `gemini-*` モデルなどを見て表示補正しているが、DB 自体の backfill はまだ行っていない。

もし次 Epic で分析精度をさらに上げるなら、

- 既存 `llm_usage_events` の legacy row を backfill する migration / maintenance command

を検討するとよい。

### 3. テンプレート 5 件と avatar 補完は backend 保証

テンプレート標準構成は backend の `ensure_default_team_templates()` で保証している。

- 0 件なら 5 件投入
- 1 件ならその 1 件を Lead Engineer として残し、残り 4 件を追加
- 新規プロジェクト作成時にも 5 件補完

さらに avatar も backend で補完する。

- Lead Engineer → `/avatars/dev-agent-1.png`
- Security & System Architect → `/avatars/dev-agent-2.png`
- UI/UX Designer & Multimedia Specialist → `/avatars/dev-agent-3.png`
- QA Engineer → `/avatars/dev-agent-4.png`
- PMO & Document Manager → `/avatars/dev-agent-5.png`

`avatar_image` が空なら `sort_order` を元に既定値が再注入されるため、frontend だけで avatar を管理しようとしないこと。

## 主要ファイル

- `src/components/ui/SetupStatusTab.tsx`
- `src/components/ui/AnalyticsTab.tsx`
- `src/components/ui/GlobalSettingsModal.tsx`
- `src/components/ui/TeamSettingsTab.tsx`
- `src/components/kanban/TaskCard.tsx`
- `src/components/terminal/TerminalDock.tsx`
- `src/components/ai/avatarRegistry.ts`
- `src/hooks/useCliDetection.ts`
- `src/hooks/useLlmUsageSummary.ts`
- `src-tauri/src/cli_detection.rs`
- `src-tauri/src/cli_runner/gemini.rs`
- `src-tauri/src/claude_runner.rs`
- `src-tauri/src/db.rs`
- `src-tauri/src/llm_observability.rs`
- `src-tauri/src/rig_provider.rs`

## 命名上の注意

互換性維持のため、以下の命名はそのまま残している。

- Tauri コマンド名 `execute_claude_task`
- イベント名 `claude_cli_started / claude_cli_output / claude_cli_exit / claude_error`

実際には Gemini / Codex / Claude を切り替えているため、名称だけ見て Claude 専用と誤認しないこと。

## 次 Epic で確認するとよいこと

### 1. Analytics の強化

- 既存 legacy usage row の provider backfill 要否
- `~$0.000` を非表示にした現方針で十分か
- task 単位 / role 単位の usage drill-down の必要性

### 2. Team Settings の UX 強化

- role ごとの推奨モデル候補の自動補完
- モデル ID のバリデーション
- CLI インストール状況と role 保存可否のさらなるガード

### 3. Avatar 運用

- `po-assistant-2.png` 以降をどう使い分けるか
- role ごとの avatar プリセット選択 UI を作るか
- 既定 avatar の見直しを backend seed / save 両方に反映する運用にするか

## 検証コマンド

変更時は最低限以下を回すこと。

- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml`

Gemini/Codex/Claude の CLI 変更を触る場合は、必ず実機で role 実行まで確認すること。

## 運用メモ

- Epic 38 からの運用ルールどおり、作業中は `task.md` を小まめに更新した。
- 次 Epic でも、1 ステップ完了ごとに `task.md` を更新して進捗の可視性を保つこと。
- `Workthrough.md` に今回の拡張経緯を残しているので、背景把握が必要なら先に読むとよい。
