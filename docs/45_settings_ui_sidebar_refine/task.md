# EPIC45: 設定画面 UI/UX リファイン（サイドバー型ナビゲーション）

## 目的
肥大化した設定画面（`GlobalSettingsModal.tsx` 1536行 / 5タブ）を、左サイドバー型のマスターディテールUIに再構築し、情報の発見性・保守性・視覚的一貫性を向上させる。

## 背景
- Epic39〜43 で設定項目（CLI検出、Team設定、追加APIプロバイダー、POアシスタントCLIサポート、Transport統一）が段階的に追加され、設定画面が肥大化。
- 現状の水平タブバー構成では、ヘッダーが散らばり設定項目の階層が把握しづらい。
- POアシスタントタブだけで約1150行あり、単一コンポーネントとして保守性が低下。

## タスクリスト

### Phase 1: 基盤整備
- [ ] `src/components/ui/settings/` ディレクトリを新設
- [ ] `SettingsContext.tsx` を作成（state/save/reset を集約）
- [ ] `SettingsShell.tsx` を作成（マスターディテールレイアウト）
- [ ] `SettingsSidebar.tsx` を作成（カテゴリ＆セクションナビ）
- [ ] `SettingsSection.tsx` を作成（右ペイン共通ラッパー）
- [ ] `SettingsField.tsx` を作成（ラベル/説明/入力統一）

### Phase 2: セクション実装
- [ ] `sections/ProjectSection.tsx` — プロジェクト設定（パス、Danger Zone）
- [ ] `sections/PoAssistantSection.tsx` — Visual Identity / Execution Mode
- [ ] `sections/AiProviderSection.tsx` — Provider/APIキー/モデル選択
- [ ] `TeamSettingsTab.tsx` を `SettingsSection` ラッパー内で利用可能に調整
- [ ] `SetupStatusTab.tsx` を同様に調整
- [ ] `AnalyticsTab.tsx` を同様に調整

### Phase 3: 統合
- [ ] `GlobalSettingsModal.tsx` を `SettingsShell` を呼ぶ薄いラッパーへ縮小
- [ ] 情報アーキテクチャを 3カテゴリ / 6セクション に再編
  - 一般: プロジェクト
  - AI & モデル: POアシスタント / AIプロバイダー / チーム設定
  - システム: セットアップ状況 / アナリティクス
- [ ] レスポンシブ折りたたみ対応（`md:` 以下でドロワー化）

### Phase 4: 検証
- [ ] 既存設定項目すべてが新UIから到達可能か
- [ ] 保存・永続化の動作確認（Tauri Store）
- [ ] 各プロバイダー切替・モデル取得動作確認
- [ ] Team設定のCRUD動作確認
- [ ] レスポンシブ切替確認
- [ ] `frontend-core` 配下に差分がないことを `git diff` で確認
- [ ] walkthrough.md に結果記録

## 完了条件
- 設定画面が左サイドバー構成で動作する
- 既存の全設定項目・保存挙動が維持されている
- `src/context/**`, `src/hooks/**`, `src/types/**` に変更が入っていない
- `npm run tauri dev` でエラーなく起動する

## スコープ外
- 設定項目の追加・削除・リネーム
- バックエンド (Rust) 変更
- Tauri Store キー名・スキーマ変更
- 検索バー / 未保存バッジ / キーボードナビ（ユーザー確認済みで今回スコープ外）
