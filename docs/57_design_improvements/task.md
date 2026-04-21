# EPIC57 タスクリスト — デザインブラッシュアップ

## 概要
機能を損なわずUIのデザイン統一・動線改善を行う。

---

## Phase 1: デザイントークン定義
- [x] `tailwind.config.js` にカスタムカラー・角丸・シャドウを定義
- [x] `gray-*` → `slate-*` の統一方針を確定

## Phase 2: カラー統一
- [x] `src/App.tsx` — `bg-gray-100` → `bg-slate-100` 等の置換
- [x] `src/components/kanban/TaskCard.tsx` — gray/slate 混在を解消
- [x] `src/components/kanban/StorySwimlane.tsx` — ヘッダー背景色統一
- [x] `src/components/kanban/StatusColumn.tsx` — カラー統一
- [x] `src/components/kanban/BacklogView.tsx` — リストアイテム背景統一
- [x] `src/components/ui/Button.tsx` — Secondary の gray → slate 統一

## Phase 3: カードデザイン統一
- [x] `TaskCard.tsx` — `rounded-md` → `rounded-xl` に統一
- [x] `StorySwimlane.tsx` — `rounded-lg` → `rounded-xl` に統一
- [x] `StatusColumn.tsx` — shadow・border 統一
- [x] `BacklogView.tsx` — カードスタイル統一

## Phase 4: テキストオーバーフロー対応
- [x] `StorySwimlane.tsx` — ストーリータイトルに `truncate` + `title` 属性追加
- [x] `BacklogView.tsx` — アイテムタイトルに `line-clamp-2` 適用
- [x] ステータスバッジに `whitespace-nowrap` 追加

## Phase 5: ヘッダーリファイン
- [x] `LlmUsagePill`（コスト表示）をヘッダーから `ScrumDashboard` または `Board` ヘッダー行へ移動
- [x] `履歴ボタン` を Kanban 画面内（Board ヘッダー行）へ移動
- [x] ヘッダー右クラスターをプロジェクト名 + フォルダ設定のみに整理
- [x] プロジェクトフォルダ設定（ProjectSettings）は今回の EPIC ではヘッダー導線を維持し、Settings 画面への一本化は見送り

## Phase 6: 動作確認ボタン（Board プレビュー）の整理
- [x] `Board.tsx` のプレビューボタンを標準ボタン1個に整理
  - 3行テキスト → 1行テキスト
  - `sky-*` → `blue-*` / `slate-*` に統一
  - `rounded-2xl` → `rounded-xl` に統一
  - URL表示をホバー tooltip へ移動
- [x] 起動中は同じボタンが「停止」に切り替わる2状態設計に変更
- [x] 別途出現する「停止ボタン」を廃止

## Phase 7: Dev Agent / PO アシスタント 動線改善
- [x] ターミナル最小化バー（34px）をクリック可能な帯に改修
  - アイコン + "Dev Agent" ラベル + 展開ボタンを配置
  - バー全体がクリックでトグル
- [x] `EdgeTabHandle`（下部フロート）のラベルを `チームの稼働状況` → `Dev Agent` に変更
- [x] `EdgeTabHandle`（右端）のラベルを `PO アシスタント / ふせん` → `PO` に短縮
- [x] Dev エージェント稼働中に下部ハンドルへバッジドット（●）を表示
- [x] PO アシスタントに未読メッセージがある場合に右ハンドルへバッジドット表示

## Phase 8: フォーカスリング・インタラクション状態の統一
- [x] `Button.tsx`, `Input.tsx`, `Textarea.tsx`, `Modal.tsx` で `focus:ring-offset-2` を統一追加

## Phase 9: バッジ・ステータス表示の統一
- [x] `src/components/ui/Badge.tsx` を新規作成（優先度・ステータス共通）
- [x] `TaskCard.tsx`, `StorySwimlane.tsx` の優先度バッジを `Badge` コンポーネントに置換

## Phase 10: PO レビュー後の追加調整
- [x] `src/components/project/InceptionDeck.tsx` — Inspection Deck の入力欄をアバターより前面に出し、文字被りのみを解消
- [x] `src/components/ai/PoAssistantSidebar.tsx` — 調査時に入れた一時的な余白・アバター位置調整を撤回し、変更前デザインへ復帰
- [x] `src/components/ui/EdgeTabHandle.tsx` — Dev Agent / PO ハンドルのバッジを小さなドットに簡素化し、輪郭をやや強調
- [x] `src/components/terminal/TerminalDock.tsx`, `src/App.tsx` — ターミナル最小化バーとドック上端の境界線を微調整
- [x] `src/components/kanban/TaskCard.tsx` — Review カードのアクションボタン幅を統一
- [x] `src/components/kanban/TaskCard.tsx` — `コメントを付けて再開発` を青アウトライン化し、`プレビュー起動` / `承認してマージ` と役割分離
- [x] `src/components/kanban/TaskCard.tsx` — タスク番号チップを上段メタ情報へ移動
- [x] `src/components/kanban/TaskCard.tsx` — Review カード内の `Review` 状態バッジを撤去し、状態表示を列ヘッダー側へ統一
- [x] `src/components/kanban/TaskCard.tsx` — 未起動時のプレビュー補助ボックスを廃止し、起動中のみコンパクトな状態行を表示

## Phase 11: ヘッダー・設定画面の最終導線整理
- [x] `src/App.tsx` — `LlmUsagePill` をヘッダー右端へ戻し、ProjectSettings はローカルパス未設定時のみ表示
- [x] `src/components/kanban/Board.tsx` — `履歴` ボタンをスプリント名の横へ移動し、右側アクションを `動作確認` のみに整理
- [x] `src/components/ui/settings/SettingsSidebar.tsx`, `src/components/ui/settings/SettingsShell.tsx` — 設定サイドバー幅と説明文を見直し、2行折り返しが起きにくいナビゲーションへ調整
- [x] `src/components/ui/settings/SettingsShell.tsx` — 設定画面表示後に数秒後の再判定で `AIプロバイダー設定` へ勝手に遷移する不具合を修正
- [x] `src/components/ui/SetupStatusTab.tsx` — `現在のセットアップ状況を確認しています` を補足文から外し、`今すぐ再検出` ボタン左の進行表示へ移動
