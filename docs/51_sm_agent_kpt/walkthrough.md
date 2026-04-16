# EPIC51: SMエージェントKPT合成 — 実装ウォークスルー

## 概要

Epic 51 では、Epic 50 で導入された `agent_retro_runs` / `agent_retro_tool_events` の構造化実行ログと、Epic 49 のふせん／POノートを材料に、各ロールの KPT を自動抽出し、さらに SM エージェントが全体を統合サマリする機能を実装した。  
同セッション内でユーザーフィードバックに基づく多数の UX 改善・バグ修正・用語統一も実施した。

---

## 変更詳細

### バックエンド

#### マイグレーション

| # | ファイル | 内容 |
|---|---|---|
| 21 | `21_retro_llm_source.sql` | `llm_usage_events.source_kind` CHECK に `retrospective` 追加。テーブルリビルド方式。`BEGIN TRANSACTION` / `COMMIT` を削除（`tauri-plugin-sql` の自動トランザクションと二重にならないよう） |
| 22 | `22_cli_transport_kinds.sql` | `transport_kind` CHECK に `gemini_cli` / `codex_cli` 追加。同リビルド方式 |
| 23 | `23_fix_sprint_sequence_numbers.sql` | `complete_sprint` のロールオーバー時に `sequence_number=NULL` となっていた既存 Sprint 行を一括修正 |

#### `src-tauri/src/db.rs`

- `SprintLlmUsageSummary` 構造体（総イベント数・入出力トークン・総コスト・失敗数）
- `get_agent_retro_runs_by_sprint_and_role(sprint_id, role_name)` — Epic 50 が `role_name` 文字列で保存しているため文字列フィルタ（TODO: 将来 role_id ベースへ移行）
- `get_tasks_by_sprint_and_role(sprint_id, role_id)`
- `get_llm_usage_summary_by_sprint(sprint_id)` — 単一集約クエリ
- `delete_retro_items_by_source(app, session_id, source)` — 内部ヘルパー（再実行時の SM アイテム重複防止）
- `get_approved_try_items(project_id)` — Tauri コマンド、プロジェクト横断で承認済み Try を取得
- `complete_sprint` のロールオーバー新規 Sprint 作成時に `sequence_number` をサブクエリで採番するよう修正

#### `src-tauri/src/ai.rs`

**`generate_agent_retro_review`**
- パラメータ: `project_id, sprint_id, retro_session_id, role_id, skip_inactive`
- `skip_inactive=true` かつタスク・実行ログが両方ゼロのロールは早期 `Ok(vec![])` を返す
- `build_retro_review_prompt` でプロンプト構築（最新 10 runs、reasoning_log 末尾 1500 字、final_answer 先頭 2000 字、changed_files 1000 字、全体 20,000 字キャップ、超過時 `log::warn!`）
- API / CLI 両トランスポート対応、応答を `RetroReviewItem[]` にパース（失敗時は単一 fallback アイテム）
- `add_retro_item` で `source='agent'`・`source_role_id=role_id` として永続化
- `record_llm_usage` / `record_cli_usage` で `source_kind='retrospective'` として計測

**`synthesize_retro_kpt`**
- `delete_retro_items_by_source(session_id, "sm")` で前回 SM アイテムを削除してから実行（再実行累積防止）
- `source != "sm"` のアイテムのみを素材にする（自身の前回出力を再合成しない）
- `build_retro_kpt_synthesis_prompt` でプロンプト構築（ロール横断パターン抽出・根本原因分析・verbatim 禁止・SM の物語としてのサマリを要求）
- 応答を `RetroSynthesisResponse { summary_markdown, items[] }` にパース（失敗時は生テキストを 4KB キャップして summary に格納）
- 統合アイテムを `source='sm'` で永続化
- `update_retro_session` でステータスを `completed` に遷移、summary を保存

**単体テスト 12 件追加**（`#[cfg(test)] mod tests`）
- プロンプト生成: ロール名包含 / 長大 reasoning の truncation / 最新 N runs 制限 / ノートセクション
- JSON パース: 正常 / 無効 JSON fallback / ノイズ混じり応答
- 合成応答: 正常 / items 欠落 / プレーンテキスト fallback
- カテゴリ未知値 → `"problem"` への coercion
- KPT 合成プロンプトのカテゴリグルーピング確認

#### `src-tauri/src/llm_observability.rs`
- `record_claude_cli_usage` → `record_cli_usage` にリネーム（Gemini CLI / Codex CLI などに対応するジェネリック化）
- skip ログ・JSON reason のメッセージを CLI 種別を含む形に更新

#### `src-tauri/src/claude_runner.rs`
- `record_claude_cli_usage_event` → `record_cli_usage_event` にリネーム、全参照箇所を更新

#### `src-tauri/src/lib.rs`
- マイグレーション 21 / 22 / 23 を migrations vec に追加
- `ai::generate_agent_retro_review` / `ai::synthesize_retro_kpt` / `db::get_approved_try_items` を `invoke_handler` に追加

---

### フロントエンド

#### `src/components/kanban/RetrospectiveView.tsx`

- **新規 state**: `agentLoading`, `kptLoading`, `skipInactiveRoles`（default: true）, `summaryOpen`（default: false）, `approvedTryItems`, `approvedTryOpen`
- **`handleStartRetro`**: teamRoles を逐次ループで `generate_agent_retro_review` 呼び出し。`(n/total)` toast 進捗表示。ロール単位の失敗は継続。完了後 `fetchItems` でリフレッシュ
- **`handleSynthesizeKpt`**: `synthesize_retro_kpt` 呼び出し後、`fetchSessions` + `fetchItems` を並列実行、`setSummaryOpen(true)` でサマリ自動展開
- **ボタン文言**: 「KPT合成」→「レトロを締める」、合成中は「まとめ中...」
- **SM サマリパネル**: KPT グリッド上部に移動、初期折りたたみ
- **「稼働なしのロールをスキップ」トグル**: チェックボックス、OFF 時は警告 toast
- **承認済み Try 一覧パネル**: `get_approved_try_items` でプロジェクト横断取得、スプリントラベル・内容・日付付きでカード表示

#### `src/components/ai/NotesPanel.tsx`
- `activeRetroSession` の判定に `completed` ステータスを追加 — 完了済みセッションでもふせん追加可能

#### `src/components/project/InceptionDeck.tsx`
- フェーズ遷移メッセージ（Phase 2〜5）に `"Phase X を開始します"` を追加
- `detectPhaseMarker` が `/Phase\s*([1-5])/i` で番号を検出するため、これがないとフェーズループが発生していた

#### `src/context/ScrumContext.tsx`
- `startSprint` を `useSprints.startSprintRaw` のラッパーとして定義し直し、内部で `refresh()` を呼び出すよう変更
- 修正前: `fetchSprints()` のみ呼び出し → Board が stories/tasks を古いデータでフィルタしタスクが見えなかった

#### `src/components/kanban/Board.tsx`
- `activeTasks` に `sprint_id === activeSprint.id` に加えて `activeStories` に属するタスクも含めるよう変更
- PO アシスタントがスプリント中に追加したタスクなど、`sprint_id` が未設定でも story 経由でアクティブスプリントに属するタスクを正しく表示

#### `src/hooks/useSprintHistory.ts`
- スプリント一覧を `status === 'Completed'` でフィルタ — 計画中・アクティブスプリントが履歴に混入しなくなった

#### `src/components/HistoryModal.tsx`
- `useProjectLabels` を import し、各スプリントヘッダーに `formatSprintLabel(data.sprint)` でスプリント番号を表示
- 完了日時はスプリント番号の下にサブテキストとして表示

#### `src/hooks/useProjectLabels.ts`
- `formatStoryLabel` の prefix を `'UserStory'` → `'PBI'` に変更（バッジ表示が全体で `PBI-N` 形式になる）

#### PBI 用語統一（UI テキスト）

| ファイル | 変更箇所 |
|---|---|
| `HistoryModal.tsx` | 「完了したストーリー」→「完了したPBI」、「Nストーリー完了」→「NPBI完了」、「アクティブなストーリーの一部」→「アクティブなPBIの一部」 |
| `BacklogView.tsx` | 空状態メッセージ・モーダルタイトルを PBI に統一 |
| `StoryFormModal.tsx` | placeholder・削除確認ダイアログを PBI に統一 |
| `StorySwimlane.tsx` | 編集ボタンの tooltip を PBI に変更 |
| `useStories.ts` | 取得・作成・更新・削除の toast エラーメッセージを PBI に統一 |
| `useTasks.ts` | 「ストーリー別タスクの取得」→「PBI別タスクの取得」 |

---

## 検証結果

### `cargo test`（2026-04-16）

```
test result: ok. 92 passed; 0 failed; 0 ignored
```

新規追加の retro 関連テスト 12 件を含め全てパス。

### `cargo build` / `npm run build`

```
✓ 2093 modules transformed.
✓ built in ~6s
```

TypeScript 型チェック + Vite 本番ビルドが警告 1 件（チャンクサイズのみ）で完了。

### 未実施の検証

- 手動 E2E（アプリ起動 → 実スプリント → レトロ開始 → KPT合成 → DB 確認）はセッション内では未実施。  
  マイグレーション 21〜23 の適用確認・`llm_usage_events` への `retrospective` 行挿入・`retro_sessions.status='completed'` 遷移はユーザー側での実機検証が必要。

---

## 既知の制約／TODO

1. **ロールフィルタが文字列**: `agent_retro_runs` は `role_name` 文字列で保存。ロール改名で過去 run がヒットしなくなる。`db.rs` に `// TODO(epic51):` コメントを残した
2. **プロンプトサイズキャップ**: 実行ログ抜粋全体が 20,000 字を超えると `log::warn!` + `…(truncated)` で切り詰め。極端に長いセッションでは情報落ちの可能性
3. **teamRoles の鮮度**: RetrospectiveView マウント時に 1 回ロード。セッション進行中のチーム構成変更は反映されない（v1 許容）
4. **DEV エージェントへのレトロコンテキスト注入**: 将来の Epic で実装予定（EPIC52/53 スコープ）

---

## 主要変更ファイル一覧

### バックエンド
- `src-tauri/migrations/21_retro_llm_source.sql` (新規)
- `src-tauri/migrations/22_cli_transport_kinds.sql` (新規)
- `src-tauri/migrations/23_fix_sprint_sequence_numbers.sql` (新規)
- `src-tauri/src/db.rs`
- `src-tauri/src/ai.rs`
- `src-tauri/src/llm_observability.rs`
- `src-tauri/src/claude_runner.rs`
- `src-tauri/src/lib.rs`

### フロントエンド
- `src/components/kanban/RetrospectiveView.tsx`
- `src/components/kanban/Board.tsx`
- `src/components/kanban/BacklogView.tsx`
- `src/components/kanban/StorySwimlane.tsx`
- `src/components/board/StoryFormModal.tsx`
- `src/components/ai/NotesPanel.tsx`
- `src/components/project/InceptionDeck.tsx`
- `src/components/HistoryModal.tsx`
- `src/context/ScrumContext.tsx`
- `src/hooks/useProjectLabels.ts`
- `src/hooks/useSprintHistory.ts`
- `src/hooks/useStories.ts`
- `src/hooks/useTasks.ts`
