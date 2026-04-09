# Epic 40: 設定画面 - チーム設定 CLI 種別対応 タスクリスト

## ステータス

- 状態: `Done`
- 着手条件: Epic 37 完了（DB に cli_type カラムが存在すること）、Epic 38 完了（全 Runner が利用可能であること）
- 作成日: 2026-04-09
- 完了日: 2026-04-09

## 概要

チーム設定タブ（TeamSettingsTab）をリニューアルし、各ロールに CLI 種別（Claude / Gemini / Codex）を選択できるドロップダウンを追加する。CLI 種別に応じてモデル選択肢を動的に切り替える。

## 実行順序

### 1. TeamSettingsTab に CLI 種別セレクタを追加
- [x] `src/components/ui/TeamSettingsTab.tsx` の各ロールカードに CLI 種別セレクタを追加した。
- [x] 選択肢 `Claude Code` / `Gemini CLI` / `Codex CLI` を表示した。
- [x] 選択値を `TeamRoleSetting.cli_type` にバインドした。
- [x] 未検出 CLI でも選択可能とし、検出状態と警告を表示するようにした。

### 2. モデル選択の CLI 連動
- [x] CLI 種別の変更時にモデル選択肢をリセットするようにした。
- [x] 各 CLI のデフォルトモデルを適用した。
  - Claude: `claude-sonnet-4-20250514`
  - Gemini: `gemini-2.5-pro`
  - Codex: `o3`
- [x] CLI 種別変更時にデフォルトモデルを自動設定するようにした。
- [x] カスタムモデル入力（テキスト直接入力）を引き続きサポートした。

### 3. CLI 検出結果との連携
- [x] `useCliDetection()` フック（Epic 36）から検出状態を取得するようにした。
- [x] 検出済み CLI にはバージョン情報をサブテキストで表示するようにした。
- [x] 未検出 CLI を選択したロールが存在する場合、保存ボタン付近に警告メッセージを表示するようにした。

### 4. 保存処理の更新
- [x] `save_team_configuration` の呼び出しに `cli_type` が含まれる実装を確認し、UI 側の完了条件を満たした。
- [x] 既存ロールの CLI 種別が正しく保存・読み込みされることを確認した。

### 5. シードデータの更新
- [x] `db.rs` の初期ロール（seed-lead-engineer）に `cli_type = 'claude'` がすでに設定済みであることを確認した。

### 6. 動作確認
- [x] ロールの CLI 種別を変更して保存 → 再読み込みで値が維持されることを確認した。
- [x] CLI 種別変更時にモデルがデフォルト値にリセットされることを確認した。
- [x] 未検出 CLI 選択時に警告が表示されることを確認した。
- [x] 保存後にタスク実行で正しい CLI が使用される既存経路を確認した。

## 実施メモ

- Epic 39 時点で backend の `cli_type` 対応、seed 補完、Runner 切り替えの大半は実装済みだった。
- Epic 40 では主に Team Settings の UX 仕上げ、Setup Status との表現統一、POアシスタント設定タブのデザイン統一を完了した。
- 検証は `npm run build` と `cargo test --manifest-path src-tauri/Cargo.toml` を実行して成功した。
