# Epic 40 Handoff

## Epic 40 の到達点

Epic 40 は完了済み。最終的に、Epic 39 で先行実装されていた Multi-CLI 基盤に対して、設定画面側の不足分と仕上げを完了した。

- Team Settings でロールごとの `Claude Code / Gemini CLI / Codex CLI` 割り当て UX を完成
- CLI 変更時のデフォルトモデル切り替えを UI として整理
- 未検出 CLI でも保存可能とし、警告表示に切り替え
- CLI の検出状態とバージョン表示を Team Settings に反映
- Setup Status の文言を `検出済み / 未検出` に統一
- Setup Status の表組みを調整し、配置ずれを軽減
- POアシスタント設定タブを他設定タブと同じデザイン言語へリファイン

## 重要な実装ポイント

### 1. Epic 40 の本質は「新規 backend 実装」ではなく「UI の完了」

Epic 39 の時点で、以下はすでに実装済みだった。

- `team_roles.cli_type` カラム
- `get_team_configuration` / `save_team_configuration`
- CLI Runner 切り替え
- 5 ロール seed と avatar 補完

そのため Epic 40 では backend を広く触っていない。次 Epic で Team Settings を拡張する場合も、まず UI 要件か backend 要件かを切り分けるとよい。

### 2. CLI の状態表現は「導入」ではなく「検出」

今回、セットアップ状況タブと Team Settings では、CLI / Git に対して次の表現へ統一した。

- 検出済み
- 未検出

理由は、実際にこの画面で見ている事実が「インストール済みかどうか」ではなく「この環境で実行可能として検出できたかどうか」だからである。

API キーは意味が異なるため、引き続き以下を使う。

- 設定済み
- 未設定

次 Epic で文言変更を検討する場合も、この意味の差は崩さないこと。

### 3. 未検出 CLI は保存をブロックしない

当初計画どおり、未検出 CLI のロールがあっても保存はできる。理由は、CLI 導入が後から行われるケースを許容するため。

現状の方針は以下。

- Team Settings 内で未検出を明示
- 保存ボタン付近で警告表示
- 実行前に Setup Status で確認を促す

もし次 Epic でガードを強めるなら、「完全ブロック」より「実行時のみブロック」の方が UX を壊しにくい。

### 4. POアシスタント設定のリファインは機能不変

POアシスタント設定タブは見た目を大きく変えたが、機能は増やしていない。

- 保存キーはそのまま
- プロバイダー切り替え挙動もそのまま
- モデル取得もそのまま
- 画像設定もそのまま

次 Epic でこのタブを拡張する場合は、レイアウト刷新と機能変更を混ぜずに扱うとレビューしやすい。

## 主要ファイル

- `src/components/ui/TeamSettingsTab.tsx`
- `src/components/ui/SetupStatusTab.tsx`
- `src/components/ui/GlobalSettingsModal.tsx`
- `src/hooks/useCliDetection.ts`
- `src-tauri/src/db.rs`
- `src-tauri/src/claude_runner.rs`
- `docs/40_team_settings_cli_support/task.md`
- `docs/40_team_settings_cli_support/walkthrough.md`

## 次 Epic で確認するとよいこと

### 1. Team Settings の運用改善

- モデル ID の妥当性チェックをどこまで行うか
- role ごとの推奨モデル候補を出すか
- CLI 未検出時の「保存は可、実行時にどう扱うか」をさらに明確化するか

### 2. Setup Status の情報設計

- 追加で表示すべき環境情報があるか
- 導入手順リンクの出し分けが必要か
- Git / CLI / API Key 以外の依存関係をここへ集約するか

### 3. POアシスタント設定の拡張余地

- プロバイダーごとの補足説明や推奨用途をもっと明示するか
- モデル一覧取得の失敗時 UX を改善するか
- 将来的に Codex / OpenAI 系を POアシスタント設定へ加えるか

## 検証コマンド

最低限、以下は成功済み。

- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml`

見た目の調整を続ける場合は、今後も build だけでなく実機の目視確認を併用した方がよい。

## 運用メモ

- EPIC40 の実装記録は `docs/40_team_settings_cli_support/walkthrough.md` を参照すること。
- 既存ワークツリーには Epic 40 と無関係な差分がありうるため、次回コミット時も対象ファイルを明示して扱うこと。
- 以前の handoff に `Workthrough.md` という表記ゆれがあったが、実ファイル名は `walkthrough.md` を使う運用に揃える。
