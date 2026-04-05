# Epic 23 タスクリスト

- [ ] `docs/23_tech_debt_resolution/implementation_plan.md` と `task.md` の作成（作業完了・PO確認待ち）

## 1. ハードコード系の解消
- [ ] `src-tauri/src/rig_provider.rs` を改修し、AIモデル名をストアから取得するよう変更
- [ ] `src/context/WorkspaceContext.tsx` を改修し、`currentProjectId` の初期化とフォールバック処理を実装
- [ ] `src/context/WorkspaceContext.tsx` にプロジェクト削除用メソッド (`deleteProject`) を追加し、Tauri コマンドと連携させる

## 2. 揮発性の解消 (Inception Deck)
- [ ] `src/components/project/InceptionDeck.tsx` に `@tauri-apps/plugin-store` の読み書き処理を追加
- [ ] コンポーネントロード時に Store の `inception-chat-${projectId}` の状態を復元する
- [ ] メッセージ追加・フェーズ変更時に Store に状態を保存する

## 3. UI / UXのクリーンアップとアクセシビリティ改善
- [ ] `src/components/kanban/StorySwimlane.tsx` から「AIで自動生成」ボタン関連のコードを削除
- [ ] `src/components/kanban/BacklogView.tsx` から「アイデア」ボタン関連のコードを削除
- [ ] `src/components/ai/IdeaRefinementDrawer.tsx` の削除
- [ ] `src/components/ui/GlobalSettingsModal.tsx` を新規作成（AIモデル設定とプロジェクト削除機能を含む）
- [ ] `src/App.tsx` の Inception Deck ヘッダーを Kanban 側と共通のナビゲーション（設定アイコン等）を持つように統合・整理

## 4. 手動テスト・仕上げ
- [ ] ターミナルから `npm run tauri dev` でビルドが成功するか確認
- [ ] 自動選択フォールバック、AIモデル設定の適用、チャット履歴保持、ボタン群消滅を確認
- [ ] エラーが出ない（とくにAI呼び出し時のモデル名取得等）ことを目視確認
- [ ] `walkthrough.md` を作成しPOへ報告
