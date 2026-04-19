# EPIC 55: コンテキスト連動型 POアシスタント — ウォークスルー

> 実装完了版。2026-04-19 時点の確定仕様・実装内容・検証結果をまとめたクローズ用ドキュメント。

## 1. ユーザー視点の動線

### 1.1 カンバン上の Task カードから相談
1. ユーザーがカードにホバー → ツール群に **💡 (相談)** アイコンが出現
2. クリックすると右ペインの POアシスタントサイドバーが自動的に開く
3. ヘッダー直下に **`🎯 [TASK-42] ログイン画面のバリデーション について相談中`** というチップが表示される
4. ユーザーは主語を省略して「テスト観点が漏れていないか」「もっと小さく分割したい」と質問できる

### 1.2 提案の確認と反映
1. AI が `## 提案` ブロックを含む Markdown を返すと、吹き出し下に **📝 提案を確認** ボタンが出る
2. クリックで `SuggestionReviewModal` が開き、**左＝現状 / 右＝提案** が並んで表示される
   - タイトル: 一行差分
   - 説明: 行単位 diff（追加は緑背景、削除は赤背景、取り消し線）
   - 優先度: `P3 → P2` のようにバッジで前後表示
3. **「編集モーダルで最終確認」** を押すと既存の `TaskFormModal` が提案値で prefill された状態で開く
4. ユーザーは内容を微修正し、通常と同じフローで保存

### 1.3 非実行ガード
- 対象 Task が `In Progress` / `Review` / `Done` の場合、**📝 提案を確認** ボタンは描画されるが disabled
- ツールチップ: 「進行中 / レビュー中のタスクは安全のため反映できません」
- これにより、エージェントが作業中のアイテムを勝手に書き換えて競合や齟齬が起きるのを防ぐ

### 1.4 フォーカスの解除・切替
- チップの × ボタンで解除（focus = None に戻り、通常のプロジェクト全体相談モード）
- 別のカードの 💡 を押せば focus は即座に切替わる（チャット履歴は継続）
- 切替時は**境界システムメッセージ**が送信ペイロードに自動挿入され、AI に「ここから相談対象が変わった」ことを明示（履歴の混線を防ぐ）
- チップ横の **「🆕 新しい会話として相談する」** ボタンで、以降の送信から直前までの履歴を除外して真っさらに相談することも可能（DB 履歴は保持）

### 1.5 Story 相談時の制約（MVP）
- Story フォーカスでは AI は**テキストによるアドバイスのみ**を返す（分割案・観点の箇条書き等）
- `## 提案` フォーマット禁止をプロンプトで強制し、万一返っても**パーサ側ガード**で反映ボタンは出さない
- Story の構造化反映は将来の EPIC で専用フローを設計

## 2. 内部的なデータの流れ

```
User clicks 💡 on TaskCard
   └─ setFocus({ kind: 'task', id })
        └─ PoAssistantSidebar が open & チップ表示
            └─ ユーザーがメッセージ送信
                 └─ invoke('chat_with_team_leader', {
                      projectId, messagesHistory, focus: {kind, id}
                    })
                     └─ team_leader.rs
                          ├─ DB から Task 最新値取得
                          ├─ Story の場合は配下 Task 一覧も取得
                          └─ build_po_assistant_api_system_prompt(
                               context_md,
                               Some(focus_block)
                             )
                              └─ LLM 呼出 → Markdown 応答
                                   └─ parsePoAssistantSuggestion()
                                        └─ 検出できれば「📝 提案を確認」表示
                                             └─ SuggestionReviewModal
                                                  └─ TaskFormModal prefill
                                                       └─ update_task IPC
```

## 3. 主要ファイル（確定）

| 種別 | パス | 役割 |
|------|------|------|
| 新規 | `src/context/PoAssistantFocusContext.tsx` | フォーカス対象の共有 |
| 新規 | `src/context/poAssistantFocusState.ts` | focus 状態遷移の純粋関数と単体テスト対象 |
| 新規 | `src/components/ai/SuggestionReviewModal.tsx` | 差分比較 UI |
| 新規 | `src/components/ai/suggestionParser.ts` | AI 返答 Markdown → 構造化提案 |
| 改修 | `src/components/ai/PoAssistantSidebar.tsx` | focus 購読・チップ・確認ボタン描画 |
| 改修 | `src/components/kanban/BacklogView.tsx` | バックログ画面からの PBI / Task 相談導線 |
| 改修 | `src/components/kanban/TaskCard.tsx` | 💡 エントリーポイント追加 |
| 改修 | `src/components/kanban/StorySwimlane.tsx` | Story カードに 💡 追加 |
| 改修 | `src/components/board/TaskFormModal.tsx` | 編集モーダル内からも相談できる導線 |
| 改修 | `src/components/board/StoryFormModal.tsx` | PBI 編集モーダル内からも相談できる導線 |
| 改修 | `src/App.tsx` | Provider 追加 |
| 改修 | `src-tauri/src/lib.rs` | IPC 引数 `focus` |
| 改修 | `src-tauri/src/ai/team_leader.rs` | focus 取得 & system prompt 組み立て |
| 改修 | `src-tauri/src/ai/team_leader/prompts.rs` | focus_block を扱う prompt テンプレート |
| 新規 | `src-tauri/src/ai/snapshots/*` | focus 付き system prompt のスナップショット期待値 |
| 新規 | `tests/*.test.mjs` | parser / focus state の軽量 Node ベーステスト |

## 4. 想定されるエッジケース

| ケース | 振る舞い |
|--------|---------|
| 提案ブロックが無い返答 | 通常会話として扱う。確認ボタンは出さない |
| 複数の `## 提案` | 最初のブロックを採用し、toast で「複数提案がありましたが最初のものを使用します」 |
| focus 対象が削除済み | バックエンドで検知 → focus を自動クリア・エラー通知 |
| description が巨大 | 差分モーダルは縦スクロール。10,000 文字超は警告表示 |
| フォーカス中にステータスが In Progress に変化 | 次にモーダル開いた時点で disabled 判定 |

## 5. 未確定・要討議事項
- 差分ライブラリ: `diff` を追加するか、軽量な自前実装にするか（パッケージ肥大化とのトレードオフ）
- Story 相談における「分割提案」はフォーマット A の単一提案では表現しづらい。初期リリースでは**テキスト返答のみ・反映ボタンなし**とし、将来の EPIC で専用フローを検討
- 提案履歴の保存: 将来ほしくなる可能性あり。初期は in-memory のみ

## 6. 完了条件
- 上記 1.1〜1.4 の動線がエラーなく動作する
- In Progress ガードが機能する
- `parsePoAssistantSuggestion` の単体テストがグリーン
- `build_po_assistant_api_system_prompt` のスナップショットテストがグリーン
- 手動 E2E シナリオ 1〜6（implementation_plan.md 9.2）全てパス

## 7. 実装ログ

### 7.1 Task 1: フォーカス状態の共通化
- `src/context/PoAssistantFocusContext.tsx` を新規追加し、`focus`, `setFocus`, `clearFocus` を提供する Context を実装した。
- focus のデータ構造は `implementation_plan.md` に合わせて `FocusTarget = { kind, id, pinnedAt }` を採用した。
- プロジェクト切替時に別プロジェクトの focus が残らないよう、自動クリアを入れた。
- `src/App.tsx` で Provider ツリーに組み込み、`AppContent` が focus を購読して Kanban 画面では PO アシスタントサイドバーを自動で開くようにした。

### 7.2 Task 1 の検証
- 2026-04-19: `npm run build` 実行成功
- TypeScript コンパイルと Vite 本番ビルドが通ることを確認
- chunk size warning は既存のビルド警告であり、本タスク起因の失敗ではないことを確認

### 7.3 次タスクへの引き継ぎ
- Task 2 では `useFocus()` を `TaskCard`, `StorySwimlane`, `TaskFormModal` から呼べる状態になっているため、各エントリーポイントから同一 API で focus をセットできる
- Task 3 で focus チップ表示とメッセージへの focus メタ付与を追加する前提条件は満たした

### 7.4 Task 2: エントリーポイント UI
- `TaskCard.tsx` のホバーツール群に `💡` ボタンを追加し、対象 Task の `id` で `setFocus({ kind: 'task', id })` を呼ぶようにした。
- `StorySwimlane.tsx` のヘッダーに `相談` ボタンを追加し、対象 Story の `id` で `setFocus({ kind: 'story', id })` を呼ぶようにした。
- `TaskFormModal.tsx` と `StoryFormModal.tsx` に任意 props `onConsultPoAssistant` を追加し、既存アイテムの編集モーダルからも相談開始できるようにした。
- 編集モーダルから相談する場合はモーダルを閉じたうえで focus をセットし、Task 1 で実装した自動 open と組み合わせてサイドバーへ遷移させる構成にした。

### 7.5 Task 2 の検証
- 2026-04-19: `npm run build` 実行成功
- `TaskCard`, `StorySwimlane`, `TaskFormModal`, `StoryFormModal` の props 変更を含めて TypeScript コンパイルが通ることを確認
- 本タスクでも chunk size warning は既存警告の継続であり、失敗要因ではないことを確認

### 7.6 次タスクへの引き継ぎ
- Task 3 では `PoAssistantSidebar.tsx` が focus を購読し、ヘッダー直下チップ表示とメッセージへの focus メタ付与を担う
- 既存 UI 側からの entry point はそろったため、以降はサイドバー内部の状態管理とバックエンド連携を進めればよい

### 7.7 Task 3: サイドバー側のフォーカス表示
- `PoAssistantSidebar.tsx` が `useFocus()` を購読し、ヘッダー直下に `🎯 ... について相談中` チップを表示するようにした。
- チップには focus 解除ボタンを付け、現在の相談対象を即座に `focus = null` へ戻せるようにした。
- サイドバー内のメッセージ状態を `focus_snapshot` 付きで扱うよう変更し、以降の送信ごとに「その時点の focus」を履歴メタとして保持する構成にした。

### 7.8 Task 4 / 4.5: backend 注入とコンテキスト汚染対策
- `chat_with_team_leader` IPC に `focus` 引数を追加し、Task / Story focus 時に backend が最新 DB 値を再取得して `focus_block` を prompt へ差し込むようにした。
- Task focus では `## 提案` / `### タイトル案` / `### 説明案` / `### 優先度案` を `reply` 内 Markdown で返すように誘導し、Story focus では `## 提案` 禁止の強い制約を prompt へ注入した。
- focus 付き相談では API/CLI ともに「非 mutation モード」に切り替え、既存の tool / execution plan を適用せず、返答だけを返すようにした。これにより本 EPIC の「AI による直接 DB 更新禁止」を守る。
- `PoAssistantSidebar.handleSend` では、送信 payload を組み立てる際に `focus_snapshot` の差分を見て境界システムメッセージを自動挿入するようにした。
- その境界メッセージは DB 保存せず、送信 payload のみに含める。
- focus 切替直後にはチップ横に `🆕 新しい会話として相談する` ボタンを表示し、押下すると以降の送信から直前までの履歴を除外するようにした。
- backend 側で focus 対象が見つからなかった場合は `focus_missing` を返し、frontend が focus を自動クリアするようにした。

### 7.9 Task 3 / 4 / 4.5 の検証
- 2026-04-19: `npm run build` 実行成功
- 2026-04-19: `cargo test --manifest-path src-tauri/Cargo.toml` 実行成功
- Rust 側では Task focus 用提案フォーマット、Story focus 禁止ルール、focus 付き prompt の非 mutation モード切替に対する単体テストを追加し、全 127 件パス
- frontend 側では `PoAssistantSidebar` を含む型チェックと本番ビルドが通ることを確認

### 7.10 次タスクへの引き継ぎ
- 次は Task 5 の提案パーサ / 差分反映導線。特に Story focus 時の parser 側 null ガードと、見出し揺らぎを吸収する Forgiving parser の実装が最重要
- 送信 payload と prompt 側の Story guard は入ったため、残る二段目ガードは `suggestionParser.ts` 側で実装する

### 7.11 Task 5 / 6: 提案パーサと安全な反映導線
- `src/components/ai/suggestionParser.ts` を新規追加し、見出しレベル揺らぎ、番号プレフィックス、英語見出し、全角コロン、`## 提案` 欠損フォールバックを吸収する Forgiving parser を実装した。
- parser は `focusKind === 'story'` の場合に常に `null` を返すようにし、prompt 違反時の二段目ガードを担うようにした。
- `PoAssistantSidebar.tsx` では assistant 返答受信時に parser を一度だけ実行し、提案を検出できた場合だけ `📝 提案を編集モーダルで確認` ボタンを吹き出し下へ出すようにした。
- 複数 `## 提案` を検出した場合は最初の提案だけ採用し、toast で警告するようにした。
- `src/components/ai/SuggestionReviewModal.tsx` を新規追加し、タイトル・説明・優先度の差分を左右比較できる UI を実装した。
- 行差分ライブラリは追加せず、自前の LCS ベース行比較で before / after を並べる構成にした。
- `SuggestionReviewModal` からは既存 `TaskFormModal` を提案値 prefill で開くようにし、最終保存は既存の validation / update フローを通す形にした。

### 7.12 非実行ガードの具体化
- `SuggestionReviewModal` 上部に現在の Task ステータスを表示するようにした。
- `In Progress` / `Review` / `Done` の Task では、吹き出し下の確認ボタンと review modal 内の適用ボタンを disabled にし、理由を tooltip / 補足テキストで示すようにした。
- これにより、進行中タスクへ AI 提案を誤って反映する経路を UI 側で遮断した。

### 7.13 Task 5 / 6 の検証
- 2026-04-19: `npm run build` 実行成功
- 2026-04-19: `node tests/suggestionParser.test.mjs` 実行成功
- parser テストでは、番号付き見出し、`####`、英語表記、全角コロン、`## 提案` 欠損フォールバック、複数提案 warning、Story focus null guard を確認
- browser 上での手動 E2E は未実施のため、Task 7 の手動検証項目は引き続き未完了

### 7.14 次タスクへの引き継ぎ
- 残タスクは主に手動 E2E、`PoAssistantFocusContext` 単体テスト、Rust prompt スナップショット相当の整理、CHANGELOG 更新
- parser / prompt / sidebar / modal の機能線は通ったため、次は実アプリ上で Task A → Task B 切替や In Progress ガードの挙動を確認するフェーズ

### 7.15 Task 7: フォーカス状態テストと prompt スナップショット
- `src/context/PoAssistantFocusContext.tsx` の状態遷移ロジックを `src/context/poAssistantFocusState.ts` へ切り出し、React 非依存の純粋関数として `buildFocusTarget` と `poAssistantFocusReducer` を定義した。
- `tests/poAssistantFocusState.test.mjs` を追加し、TypeScript をその場で transpile して `set` / `clear` / `再フォーカス` / `project_changed` を検証できる軽量テストを実装した。
- Rust 側では `src-tauri/src/ai/team_leader.rs` に task focus / story focus の API system prompt スナップショットテストを追加し、期待値は `src-tauri/src/ai/snapshots/` 配下の固定ファイルとして保持するようにした。
- これにより、「非 mutation モード」「Task の `## 提案` フォーマット要求」「Story の `## 提案` 禁止」が prompt 全文レベルで将来の変更から守られる状態になった。

### 7.16 Task 7 の検証
- 2026-04-19: `node tests/poAssistantFocusState.test.mjs` 実行成功
- 2026-04-19: `cargo test --manifest-path src-tauri/Cargo.toml` 実行成功（129 件パス）
- 2026-04-19: `npm run build` 実行成功
- Task 7 の自動テスト項目はすべて完了

### 7.17 Task 8: CHANGELOG 更新
- プロジェクト直下に既存 `CHANGELOG` が存在しなかったため、`CHANGELOG.md` を新規作成した。
- `Unreleased` セクションに Epic 55 の主要追加点を記載し、Task / Story からの相談導線、focus 境界、Forgiving parser、編集モーダル確認フロー、非 mutation ガードを要約した。
- 検証コマンドとして `npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、`node tests/suggestionParser.test.mjs`、`node tests/poAssistantFocusState.test.mjs` も記録した。

### 7.18 補足検証と残課題
- 2026-04-19: `npm run lint` 実行。今回の変更で追加した lint error は解消済み。
- ただし、リポジトリ既存の unrelated error として `src/components/ai/Avatar.tsx`, `src/components/ui/TeamSettingsTab.tsx`, `src/context/WorkspaceContext.tsx` に `react-hooks/set-state-in-effect` error が残っているため、lint 全体は未グリーン。
- 手動 E2E（Task カード → 相談 → 提案生成 → 差分モーダル → 編集モーダル → 保存、および In Progress disabled 確認）は、このチャット環境では GUI 操作まで自動化していないため未実施。次の作業でアプリを立ち上げて実画面で確認する。

### 7.19 追加対応: バックログ画面からの直接相談導線
- ユーザー確認を受けて、`src/components/kanban/BacklogView.tsx` にも focus 連携を追加した。
- PBI カード右上に `相談` ボタンを追加し、クリック時に `setFocus({ kind: 'story', id })` を呼ぶようにした。
- PBI 配下に並ぶネスト Task 行にも軽量な電球アイコンボタンを追加し、`setFocus({ kind: 'task', id })` で直接相談を開始できるようにした。
- 既存の PBI 編集モーダルについても、BacklogView から開いた場合に `onConsultPoAssistant` を渡し、モーダル内ボタンから同じ PBI を focus できるように接続した。
- これにより、Kanban ボードだけでなくプロダクトバックログ画面でも PBI / Task を起点に PO アシスタントへ文脈付き相談を開始できる状態になった。

### 7.20 追加対応の検証
- 2026-04-19: `npm run build` 実行成功
- `BacklogView.tsx` の `useFocus` 追加、相談ボタン、StoryFormModal 連携を含めて TypeScript コンパイルと Vite 本番ビルドが通ることを確認

### 7.21 ユーザー実機確認
- 2026-04-19: ユーザーより、プロダクトバックログ画面で追加した相談導線の動作確認が完了した旨を受領。
- 少なくとも `BacklogView` 上の PBI / Task から focus 付きで PO アシスタントへ遷移できることは実機で確認済みとして記録する。

## 8. クローズ時点の整理
- 自動検証は `npm run build`、`cargo test --manifest-path src-tauri/Cargo.toml`、`node tests/suggestionParser.test.mjs`、`node tests/poAssistantFocusState.test.mjs` を通過済み。
- `walkthrough.md` / `task.md` / `CHANGELOG.md` は 2026-04-19 時点の状態へ更新済み。
- `npm run lint` は既存 unrelated error により未グリーンのまま。
- task list に残っている手動 E2E 項目は、本ドキュメント上でも未完了として維持している。
