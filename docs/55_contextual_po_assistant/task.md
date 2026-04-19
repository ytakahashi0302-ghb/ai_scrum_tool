# EPIC 55: コンテキスト連動型 POアシスタント — タスクリスト

## 目的
カンバン / バックログ上の PBI・Task を POアシスタントに「これについて相談」として直接渡せるようにし、提案を比較しながら元アイテムへ反映できる導線を構築する。

---

## タスク一覧

### 1. フロント: フォーカス状態の共通化
- [x] `src/context/PoAssistantFocusContext.tsx` を新規作成
  - state: `FocusTarget = { kind: 'story' | 'task', id: string, pinnedAt: string } | null`
  - actions: `setFocus(target)`, `clearFocus()`
- [x] `App.tsx` の Provider ツリーへ組み込み
- [x] POアシスタントサイドバー開閉ロジックと連動（focus セット時に自動 open）

### 2. エントリーポイント UI
- [x] `TaskCard.tsx` のホバーツール群に「💡 相談」ボタン追加（`MoreVertical` の左側）
- [x] `StorySwimlane.tsx` / StoryCard 相当箇所に同等ボタン追加
- [x] `BacklogView.tsx` の PBI / ネスト Task 一覧にも同等導線を追加
- [x] `TaskFormModal.tsx` / Story 編集モーダル内にも「POアシスタントに相談」ボタン
- [x] ボタン押下時に `setFocus` 呼び出し＋サイドバー open

### 3. サイドバー側のフォーカス表示
- [x] `PoAssistantSidebar.tsx` でフォーカス Context を購読
- [x] ヘッダー直下に「🎯 〇〇について相談中」チップ表示（クリア ×ボタン付き）
- [x] フォーカス変化時に過去の吹き出しは残しつつ、以降のメッセージに focus メタを付与

### 4. バックエンド: system prompt への注入
- [x] `chat_with_team_leader` IPC に `focus: Option<FocusTarget>` 引数追加
  - `FocusTarget = { kind: "story" | "task", id: String }`
- [x] `team_leader.rs` で focus が Some の場合、DB から最新情報を取得
  - Task: title / description / status / priority / 所属 Story / acceptance criteria
  - Story: title / description / status / 配下 Task 一覧（title + status）
- [x] `prompts::build_po_assistant_api_system_prompt` に `focus_block` を差し込む
- [x] Task focus の場合: 「修正提案を返す際は Markdown 見出し `## 提案` 配下に `### タイトル案` / `### 説明案` / `### 優先度案` を含める」と指示
- [x] **Story focus の場合**: 「いかなる場合も `## 提案` フォーマットを出力してはならない。テキストによるアドバイス・分割案の箇条書きのみに留めること」という**強い禁止プロンプト**を注入

### 4.5 コンテキスト汚染対策
- [x] `PoAssistantSidebar.handleSend` で、直前メッセージとの focus 差分を検出し、送信ペイロードに境界システムメッセージを自動挿入（DB には保存しない）
- [x] 各 `TeamChatMessage` に `focus_snapshot` メタを付与（送信時の境界判定に使用）
- [x] フォーカス切替時にチップ横へ「🆕 新しい会話として相談する」ボタンを表示。押下で以降の送信から直前までの履歴を除外（DB 履歴は保持）

### 5. 修正反映導線（アプローチ A + 差分比較）
- [x] **Forgiving な** 提案パーサ `suggestionParser.ts` を実装（見出しレベル揺らぎ `##`/`###`/`####`、番号プレフィックス `1.` `①` `-`、同義語 `タイトル/Title/新しいタイトル`、全角スペース・全角コロン、トップレベル `## 提案` 欠損時のフォールバックを許容）
  - コード上のコメントとテストケース名で「Forgiving parser」であることを明記
- [x] focus.kind === 'story' のときパーサは**常に null を返す**ガード（プロンプト違反の保険）
- [x] AI 返答メッセージをパースし、`## 提案` ブロックを検出したら「📝 提案を編集モーダルで確認」ボタンを吹き出し下に表示
- [x] `SuggestionReviewModal`（新規）を作成
  - 左: 現状（DB 最新）
  - 右: 提案（AI 出力）
  - フィールド単位（title / description / priority など）で行ハイライト差分
  - 差分ライブラリは既存依存に無ければ `diff`（軽量）を追加、もしくは自前の行比較
- [x] 「この内容で編集モーダルを開く」→ 既存 `TaskFormModal` / Story モーダルに提案値を prefill
- [x] `task.status === 'In Progress'` の場合はボタン disabled + ツールチップで理由表示

### 6. 非実行ガード
- [x] `SuggestionReviewModal` 上部に現ステータスを表示
- [x] In Progress / Done のアイテムは「反映不可」状態にし、破壊的変更を防止

### 7. テスト
- [x] `PoAssistantFocusContext` の単体テスト（set/clear/再フォーカス）
- [x] `chat_with_team_leader` に focus 付与時の system prompt スナップショットテスト（Rust）
- [x] 提案パーサの単体テスト（正常 / 見出しレベル違い `####` / 番号付き `### 1. タイトル案` / 英語 `### Title` / 全角コロン `### タイトル案：` / `## 提案` 欠損フォールバック / 複数 `## 提案` / Story focus ガード）
- [ ] 手動 E2E: Task カード → 相談 → 提案生成 → 差分モーダル → 編集モーダル → 保存
- [ ] 手動 E2E: In Progress タスクでボタンが disabled になること

### 8. リリース準備
- [x] `CHANGELOG` 更新
- [x] `docs/55_contextual_po_assistant/walkthrough.md` を実装完了後に最終化

---

## 進捗ログ
- 2026-04-19: Task 1 完了。`PoAssistantFocusContext` を追加し、focus セット時に Kanban 画面で PO アシスタントサイドバーが自動展開することを `npm run build` で確認。
- 2026-04-19: Task 2 完了。Task / Story カードと既存編集モーダルから `setFocus` を呼べる導線を追加し、`npm run build` で型崩れがないことを確認。
- 2026-04-19: Task 3 完了。`PoAssistantSidebar` が focus を購読し、相談対象チップと focus メタ付きメッセージ管理を行うよう更新。
- 2026-04-19: Task 4 / 4.5 完了。backend に focus 注入経路を追加し、Task/Story ごとの prompt 制御、境界システムメッセージ、自動フォーカス解除、新しい会話リセットを実装。`npm run build` と `cargo test` で確認。
- 2026-04-19: Task 5 / 6 完了。Forgiving parser、提案確認ボタン、`SuggestionReviewModal`、既存 `TaskFormModal` 再利用、反映不可ガードを実装。`npm run build` と `node tests/suggestionParser.test.mjs` で確認。
- 2026-04-19: Task 7 の自動テスト完了。`poAssistantFocusState` へ遷移ロジックを切り出して set / clear / 再フォーカスを Node ベースの単体テストで確認し、Rust 側では task/story focus system prompt のスナップショットテストを追加して `cargo test` 129 件パスを確認。
- 2026-04-19: Task 8 の一部完了。リポジトリ直下に `CHANGELOG.md` を新設して EPIC 55 の追加点を記録。`npm run lint` は既存の unrelated error（`Avatar.tsx`, `TeamSettingsTab.tsx`, `WorkspaceContext.tsx`）により未グリーンだが、今回変更ファイル起因の lint error は解消済み。
- 2026-04-19: 追加対応。`BacklogView.tsx` に PBI カード用 `相談` ボタンとネスト Task 用相談アイコンを追加し、バックログ画面からも直接 focus 付き相談を開始できるようにした。`npm run build` で確認。
- 2026-04-19: クロージング更新。ユーザー実機確認でバックログ画面からの相談導線が動作することを確認済みとして `walkthrough.md` を最終化した。未消化の確認項目は task list 上に残し、現時点の到達点が追える状態に整理。
