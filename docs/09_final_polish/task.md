# 最終ポーリッシュ (Final Polish)

## フルHD最適化とレイアウト調整
- [x] `src-tauri/tauri.conf.json` で初期ウィンドウサイズを 1920 x 1080 に変更
- [x] カンバンボード全体の最大幅制限を解除し、各カラムが均等に広がるようレイアウト調整
- [x] モーダル群 (`TaskFormModal`, `HistoryModal` 等) の最大幅拡大とバランス調整

## 開発用ツールの整理
- [x] `DeveloperTools` 等の開発用コンポーネントを環境変数 (`import.meta.env.DEV`) で本番非表示にする対応

## UIデザインの統一と微調整
- [x] 全体のボタンのカラー、ホバーエフェクトの統一（Tailwindクラス整理）
- [x] モーダルの角丸（rounded）とパディングの統一
- [x] 余白（gap, padding, margin）のスケール統一
- [x] カンバンボードの列背景色（TO DO, IN PROGRESS, DONE）の洗練
- [x] カンバンボード内のスクロールバーデザインの改善（非表示化またはカスタムスクロールバー）

## エラーハンドリングとバリデーション
- [x] Storyフォーム：タイトル空文字保存のブロック＆トーストエラー通知実装
- [x] Taskフォーム：必須項目保存のブロック＆トーストエラー通知実装
- [x] 全体：DB予期せぬエラー発生時の `react-hot-toast` 通知の網羅確認・補完

## UIの日本語化 (Localization)
- [x] タイマートップバー（`SprintTimer.tsx`, `App.tsx`）の文言・通知を日本語化
- [x] カンバンボード（`Board.tsx`, `StatusColumn.tsx` 等）のヘッダー・カラム名・ボタンを日本語化
  - ※ カラム名等の表示用マッピング関数の実装（DBの値は英語のまま）
- [x] アイテム作成および履歴モーダル（`TaskFormModal.tsx`, `StoryFormModal.tsx`, `HistoryModal.tsx`）の文言を日本語化
- [x] `react-hot-toast` の通知メッセージを日本語に統一

## ドラッグ＆ドロップUX改善
- [x] `Board.tsx` の `PointerSensor` に `activationConstraint` を追加し、クリックとドラッグを分離
- [x] `TaskCard.tsx` で `listeners` と `attributes` をルート要素に適用
- [x] `TaskCard.tsx` のドラッグハンドルアイコンを削除し、全体の余白を整える
- [x] クリックでモーダルが開く挙動とドラッグが正しく両立することをテスト
