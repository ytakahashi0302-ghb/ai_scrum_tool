# EPIC 55: コンテキスト連動型 POアシスタント — 実装計画

## 1. 背景と目的
現在の POアシスタントはプロジェクト全体の文脈しか持たず、特定の PBI / Task について相談するには、ユーザーがタイトルや内容を手でコピペするか冗長に説明する必要がある。
EPIC 55 では **カンバン上のカードから直接 POアシスタントに「これについて相談」** できる導線を作り、相談結果を **差分比較 UI を介して安全に元アイテムへ反映** できるようにする。

## 2. スコープ

### In Scope
- カードおよび編集モーダルからの「POアシスタントに相談」導線
- フォーカス対象を保持するフロント Context
- バックエンドでのフォーカス情報注入（最新 DB 値）
- アプローチ A（ユーザー確認ベース）の反映フロー
- 修正前 / 修正後を並べた差分比較モーダル
- 非実行ステータスガード

### Out of Scope
- 構造化提案モード（JSON / tool-calling 経由の自動反映）
- 複数アイテムの一括相談
- 提案の履歴保存（過去の提案を再度開くなど）

## 3. アーキテクチャ概要

```
[TaskCard / StoryCard / 編集Modal]
        │ setFocus({ type, id })
        ▼
[PoAssistantFocusContext] ─── subscribe ──► [PoAssistantSidebar]
        │                                          │
        │                                          ▼
        │                                  chat_with_team_leader(
        │                                    messagesHistory,
        │                                    focus: {kind, id}   ◄── NEW
        │                                  )
        ▼                                          │
   (Sidebar auto-open)                             ▼
                                       [team_leader.rs]
                                         ├─ DB から最新 PBI/Task 再取得
                                         └─ system prompt に focus_block 注入

         AI 返答（Markdown）
               │ パース
               ▼
      [SuggestionReviewModal] ──► 差分表示 ──► [TaskFormModal prefilled]
                                                       │
                                                       ▼
                                                  update_task
```

## 4. 主要コンポーネントと変更点

### 4.1 Frontend Core（※ 参照のみ、修正なし）
- `src/context/WorkspaceContext`, `src/context/ScrumContext` を参照して現在の Story / Task を取得。

### 4.2 Frontend 新規
- `src/context/PoAssistantFocusContext.tsx`
  - `FocusTarget = { kind: 'story' | 'task'; id: string; pinnedAt: string }`
  - `useFocus()` フックを提供
- `src/components/ai/SuggestionReviewModal.tsx`
  - props: `current: {title, description, priority, ...}` / `suggested: 同型` / `onApply(prefill) / onCancel`
  - 行単位差分（`diff` パッケージの `diffLines`）で表示
- `src/components/ai/suggestionParser.ts`
  - `parsePoAssistantSuggestion(markdown): Suggestion | null`
  - `## 提案` / `### タイトル案` / `### 説明案` / `### 優先度案` を解釈

### 4.3 Frontend 既存改修
- `src/components/kanban/TaskCard.tsx`: ホバーツールに💡ボタン追加
- `src/components/kanban/StorySwimlane.tsx`（または Story カード）: 同様
- `src/components/board/TaskFormModal.tsx`: フッターに「POアシスタントに相談」ボタン
- `src/components/ai/PoAssistantSidebar.tsx`:
  - `useFocus()` を購読しヘッダーにチップ描画
  - `chat_with_team_leader` 呼び出し時に focus を渡す
  - 返信 Markdown をパースし、`SuggestionReviewModal` 起動ボタンを付与
- `src/App.tsx`: Provider 追加

### 4.4 Backend 改修
- `src-tauri/src/lib.rs`: IPC 引数追加
- `src-tauri/src/ai/team_leader.rs`:
  - `chat_with_team_leader(..., focus: Option<FocusTarget>)`
  - focus が Some の場合、`stories` / `tasks` テーブルから最新レコードを取得
  - Story の場合は配下 Task の `title + status` 一覧も取得
- `src-tauri/src/ai/prompts.rs`:
  - `build_po_assistant_api_system_prompt` に `focus_block: Option<String>` 引数追加
  - 「修正提案を返すときは必ず次のフォーマットを使え」と指示するテンプレート追加

## 5. コンテキスト汚染対策（履歴とフォーカスの整合）

### 5.1 フォーカス境界メッセージの自動挿入
`messagesHistory` 送信時、**直前メッセージの focus と現在の focus が異なる場合**、境界を表すシステムメッセージをフロント側で差し込む。

```
(role: system / user-hidden)
※ ここからユーザーの相談対象が [TASK-B: ログイン画面のバリデーション] に切り替わりました。
以降の質問は TASK-B についてのものとして解釈してください。TASK-A の内容を混入させないでください。
```

- この境界メッセージは**DB には保存しない**（表示とも紐づけない）。送信ペイロードのみに含める。
- 実装箇所: `PoAssistantSidebar.tsx` の `handleSend` 内で `messages` を組み立てる際、各メッセージに紐づく `focus_snapshot` を見て diff を検出し挿入。

### 5.2 UI 側のクリア提案
フォーカス切替時、チップ横に **「🆕 新しい会話として相談する」** サブボタンを表示。押下で当該会話スレッドを論理的にリセット（履歴送信時に直前までの messages を除外。DB 履歴は残す）。
- デフォルト挙動は境界メッセージ方式。クリアは任意のユーザー操作。

### 5.3 Story 相談時の提案禁止（MVP 制約）
Story フォーカスでは `## 提案` フォーマットでの単一提案を確実にブロックする。
- `prompts.rs` の `build_po_assistant_api_system_prompt` で focus が Story の場合、以下の**強い禁止プロンプト**を追加:
  ```
  【重要な制約】現在の相談対象は Story です。いかなる場合も `## 提案` 見出しを含むフォーマットを出力してはいけません。
  タイトル案・説明案・優先度案といった単一アイテム書き換えの提案ブロックも禁止です。
  テキストによるアドバイス・分割案の箇条書き・トレードオフの説明のみで回答してください。
  ```
- フロント側 `parsePoAssistantSuggestion` でも**保険**として focus.kind === 'story' の場合は常に null を返すガードを入れる（プロンプト違反で `## 提案` が返ってきても反映ボタンを出さない）。

## 6. 提案 Markdown フォーマット（プロンプトで強制）

```markdown
## 提案
### タイトル案
<新しいタイトル>

### 説明案
<新しい description（複数行可、Markdown 可）>

### 優先度案
<1〜5 の整数。変更不要なら "変更なし">
```

フリーフォームの解説は `## 提案` の外（前後の地の文）に置くよう指示する。

## 7. Forgiving な提案パーサ

LLM はプロンプト遵守率が 100% ではなく、見出しが微妙に揺らぐ（`### 1. タイトル案`, `### タイトル`, `### Title`, 全角スペース混入など）。
`suggestionParser.ts` は以下の耐性を持つこと:

- 見出しレベル `###` に限らず `##` / `####` も許容
- 番号プレフィックス `1.` `①` `- ` などを許容
- 「タイトル案」「タイトル」「Title」「新しいタイトル」などの**同義語リスト**を用意しマッチ
- 前後の全角/半角スペース、コロン（`:` / `：`）トリム
- `## 提案` が無くても、トップレベル見出しの下に「タイトル案」相当が 2 つ以上見つかれば提案とみなすフォールバック
- 実装時は**「Forgiving（寛容）なパーサーにすること」**をコード上のコメントで明記し、テストケースで揺らぎパターンを網羅

### パーサ単体テストで必ずカバーする揺らぎケース
| ケース | 入力例 |
|--------|--------|
| 番号付き見出し | `### 1. タイトル案` |
| 見出しレベル違い | `#### タイトル案` |
| 英語表記 | `### Title Suggestion` |
| 全角コロン | `### タイトル案：` |
| `## 提案` 欠損だが配下構造あり | 直接 `### タイトル案` から始まる |
| 複数 `## 提案` | 最初のみ採用（警告 toast） |
| Story focus で `## 提案` 混入 | null を返す（ガード動作） |

## 8. 差分表示の設計
- ライブラリ: `diff` (既存に無ければ追加)
- タイトル: 1 行 diff
- 説明: `diffLines` による行単位 diff（追加緑 / 削除赤）
- 優先度: before / after のバッジ並置
- ユーザー操作:
  - 「編集モーダルで最終確認して保存」→ 既存 `TaskFormModal` を提案値 prefilled で開く
  - 「破棄」→ モーダルを閉じる（反映しない）
- **直接 DB 更新はしない**。必ず既存編集モーダル経由で保存 → 既存 validation を通す。

## 9. 非実行ガード
- `task.status` が `In Progress` もしくは `Review` / `Done` のとき
  - 吹き出しの「📝 提案を確認」ボタンは描画するが disabled
  - ツールチップ: 「進行中 / レビュー中のタスクは安全のため反映できません。To Do に戻してから再度お試しください」
- Story についてはステータス概念が緩いので、配下に `In Progress` Task が 1 件以上ある場合に警告のみ表示（反映は許可）

## 10. エラー処理
- AI 返答に `## 提案` ブロックが無い → ボタンを描画しない（通常の会話として扱う）
- パース失敗 → `console.warn` + toast「提案を検出できませんでした」
- DB 側で焦点アイテムが削除済み → バックエンドで `None` を返し、フロントは focus を自動クリア

## 11. テスト方針

### 11.1 単体テスト
- **Rust**: `build_po_assistant_api_system_prompt` のスナップショットテスト
  - focus = None / focus = Task / focus = Story（配下 Task 有り）の 3 ケース
- **TS**: `parsePoAssistantSuggestion` のユニットテスト
  - 正常ケース / 見出し欠損 / 複数 `## 提案` / 優先度「変更なし」

### 11.2 統合テスト（手動）
| # | シナリオ | 期待結果 |
|---|---------|---------|
| 1 | To Do Task カード → 💡 → 相談 → 提案生成 | サイドバー自動展開、チップ表示、提案ブロック検出 |
| 2 | 提案を確認モーダル → 編集モーダル prefill → 保存 | DB 更新、カード表示に反映 |
| 3 | In Progress Task カード → 💡 → 提案生成 | 「確認」ボタン disabled、tooltip 表示 |
| 4 | Story カードから相談 → 分割提案 | 配下 Task 一覧が system prompt に含まれる（ログ確認） |
| 5 | 相談中にフォーカスを別アイテムに切替 | チップ更新、次メッセージから新 focus で送信 |
| 6 | 相談対象 Task を削除 → 同じ会話で追送信 | focus が自動クリアされる、エラーにならない |
| 7 | Task A で会話後、Task B にフォーカス切替して送信 | 境界メッセージが送信ペイロードに含まれる（ログ確認）、AI 返答が Task B の情報のみを参照 |
| 8 | フォーカス切替時に「新しい会話として相談」ボタン押下 | 直前までの履歴が送信対象から除外される |
| 9 | Story フォーカスで相談 → AI が誤って `## 提案` を返した | 反映ボタンが一切描画されない（パーサ側ガード） |

### 11.3 リグレッション確認
- 既存のフリーチャット（focus = None）動作が変わらないこと
- ふせん機能 / 履歴クリア機能が影響を受けないこと

## 12. ロールアウト
1. Backend（IPC 引数追加、focus = None の後方互換維持）
2. Frontend Focus Context + エントリーポイント
3. サイドバー表示改修 + IPC 呼び出し
4. 提案パーサ + `SuggestionReviewModal`
5. ガード条件 + E2E 確認
6. CHANGELOG 更新
