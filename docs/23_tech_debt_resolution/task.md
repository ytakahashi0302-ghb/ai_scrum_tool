# Epic 23 タスクリスト

- [x] `docs/23_tech_debt_resolution/implementation_plan.md` と `task.md` の作成（完了）

## 1. ハードコード系の解消
- [x] `src-tauri/src/rig_provider.rs` または `src-tauri/src/ai.rs` にAPIからモデル一覧を取得する `get_available_models` コマンドを実装する
- [x] `src-tauri/src/rig_provider.rs` を改修し、AIモデル名をストアから取得するよう変更
- [x] `src-tauri/src/main.rs` に新コマンドを登録する
- [x] `src/context/WorkspaceContext.tsx` を改修し、`currentProjectId` の初期化とフォールバック処理を実装
- [x] `src/context/WorkspaceContext.tsx` にプロジェクト削除用メソッド (`deleteProject`) を追加し、Tauri コマンドと連携させる

## 2. 揮発性の解消 (Inception Deck)
- [x] `src/components/project/InceptionDeck.tsx` に `@tauri-apps/plugin-store` の読み書き処理を追加
- [x] プロジェクト切り替え時・リロード時に、プロジェクト毎に保存されたチャット履歴と状態フェーズ (`currentPhase`) が復元されるようにする

## 3. UIのクリーンアップと設定の統合
- [x] `src/components/ui/GlobalSettingsModal.tsx` を新規作成し、タブやセクションでプロジェクト削除とAI設定（モデル選択含む）を配置する
- [x] `Board.tsx` から旧設定モーダル関連の不要コードを削除
- [x] `SettingsModal.tsx` を削除

## 4. Inception Deck AI の振る舞い修正
- [x] `src-tauri/src/ai.rs` の `build_inception_system_prompt` 関数を新設し、フェーズ別指示・JSON出力フォーマットを厳命
- [x] AIレスポンスのMarkdownコードフェンス ( ```json...``` ) をストリップしてからパースする処理を追加
- [x] JSON構造を `generated_document` -> `patch_target + patch_content` 方式（差分追記）に移行
- [x] システムプロンプトを箇条書き・20行以内・差分のみ出力に刷新（トークン枯渇対策）
- [x] `InceptionDeck.tsx` の書き込みロジックを追記（Append）対応に変更
  - Phase 1/3: 上書き（新規作成）、Phase 2/4: 末尾追記

## 5. Team Leader の MaxTurnError 修正
- [x] `rig_provider.rs` の Anthropic / Gemini AgentBuilder に `.default_max_turns(5)` を追加

## 6. プロジェクト削除の非同期バグ修正（最終）
- [x] `GlobalSettingsModal.tsx`: `window.confirm()` を Tauri `dialog` plugin の `await confirm()` に置き換え
- [x] `WorkspaceContext.tsx`: `deleteProject` 内でフォールバック先IDを削除後の残存リストから明示的に計算

## 7. 最終確認
- [x] `npx tsc --noEmit` でビルドエラーなし
- [x] `cargo check` でコンパイルエラーなし
- [x] `walkthrough.md` を作成しPOへ報告
