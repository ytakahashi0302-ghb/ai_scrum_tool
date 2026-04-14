# EPIC48 実装ウォークスルー

## 実装ハイライト

- `src/types/index.ts` に `RetroSession` / `RetroCategory` / `RetroItem` / `RetroRule` / `ProjectNote` を追加し、EPIC47 の backend CRUD と対応する型をフロントエンドへ導入した。
- `src/hooks/useRetrospective.ts` / `useRetroRules.ts` / `useProjectNotes.ts` を新規作成し、レトロセッション・KPT アイテム・ルール・ノートを Tauri invoke 経由で扱える Hook 群を整備した。
- `src/components/kanban/ScrumDashboard.tsx` に `retrospective` タブを追加し、既存の backlog / board パターンを崩さず 3 タブ切り替えに拡張した。
- `src/components/kanban/RetrospectiveView.tsx` を新規作成し、完了済みスプリント選択、KPT 3 カラム、カード追加・編集・削除・承認、source ごとのアバター／バッジ表示、SM サマリパネルをまとめて実装した。

## 実装上の判断

- Retro 系 Hook は既存 Hook パターンに合わせつつ、必要に応じて `projectId` を明示渡しできるようにし、未指定時は `WorkspaceContext` の `currentProjectId` を使う構成にした。
- レトロセッションが存在しない完了済みスプリント向けに、UI から手動作成できるフォールバックを持たせた。
- エージェント由来カードは既存の `Avatar` / `resolveAvatarForRoleName` / Team Configuration を再利用し、ロール別アバター画像がそのまま反映されるようにした。
- 承認 UI は checkbox 表現にしたが、backend 側の `approve_retro_item` が one-way update のため、一度承認したカードは承認済み表示で固定する実装にしている。

## 検証結果

- `npm run build` 実行済み。
- 結果: `tsc && vite build` が成功し、production bundle 生成まで完了した。
- 出力ログ上は `dist/assets/index-ecZX1hoF.js` が 500 kB を超える Vite 警告が出ているが、ビルド自体は成功している。
- 今回はブラウザ起動による手動 UI 操作までは未実施。タブ遷移や CRUD の体感確認は別途アプリ起動確認があるとより確実。

## 追加要件: プロジェクト名 + 採番表示

- `src-tauri/migrations/19_entity_sequence_numbers.sql` を追加し、`stories` / `tasks` / `sprints` に `sequence_number` カラムを導入した。
- 既存データは `ROW_NUMBER() OVER (PARTITION BY project_id ...)` で backfill し、プロジェクト単位で一意になるようユニークインデックスを追加した。
- `src-tauri/src/db.rs` の `Story` / `Task` / `Sprint` 構造体と CRUD を `sequence_number` 対応に更新し、新規作成時は `MAX(sequence_number) + 1` で採番するようにした。
- `src/types/index.ts` と `src/context/ScrumContext.tsx`、`src/hooks/useStories.ts`、`src/hooks/useTasks.ts` を更新し、フロントエンド側でも `sequence_number` を扱えるようにした。
- `src/hooks/useProjectLabels.ts` を新規作成し、`プロジェクト名-番号` と `プロジェクト名 / スプリント N` を一元的に生成する helper を追加した。
- `BacklogView` / `Board` / `StorySwimlane` / `TaskCard` / `RetrospectiveView` で helper を利用し、Story / Task / Sprint / Retro の表示ラベルをプロジェクト名ベースに統一した。
- `CreateProjectModal` の文言を「ワークスペース」主体から「プロジェクト名」主体に調整し、作成した名前が各ラベル表示に使われることを UI 上でも伝えるようにした。

## データ消失に見えた症状について

- 既存データベース `C:\Users\green\AppData\Roaming\com.vicara.app\vicara.db` を直接確認し、`projects=2`, `stories=15`, `tasks=75`, `sprints=10` の行が残っていることを確認した。
- 同 DB には migration 19 (`entity_sequence_numbers`) が適用済みで、`stories` / `tasks` / `sprints` の `sequence_number` はすべて `NULL` なしで backfill されていた。
- そのため、今回の「消えた」症状はデータ削除ではなく、`sequence_number` 追加前後のアプリ再起動タイミングによる読み込み不整合だった可能性が高い。
- 特に `src-tauri/src/db.rs` では `Story` / `Task` / `Sprint` 構造体に `sequence_number` を追加しているため、migration 未反映のプロセスが動いたままだと一覧取得が失敗しうる。
- 回復手順としては、Tauri アプリを再起動して migration 19 を反映した最新バイナリで DB を開き直すのが第一手になる。

## 追加検証

- `cargo test --manifest-path src-tauri/Cargo.toml` を実行し、77 件すべて成功した。
- 実 DB に対して `sequence_number IS NULL` 件数も確認し、`stories=0`, `tasks=0`, `sprints=0` を確認した。

## 表示調整: Story / Task ラベル簡素化

- `src/hooks/useProjectLabels.ts` の helper を見直し、Story は `UserStory-<sequence_number>`、Task は `Task-<sequence_number>` を返すように変更した。
- 既存 UI は `BacklogView` / `StorySwimlane` / `TaskCard` ですでに helper 経由だったため、コンポーネント個別の分岐を増やさず表示方針を統一できた。
- Sprint は引き続き `プロジェクト名 / スプリント N` の形式を維持している。
- 変更後に `npm run build` を再実行し、型エラーなく成功した。Vite の chunk size warning のみ継続しているが、ビルド自体は正常終了。

## 最終確認

- PO による全画面の動作確認と UI レビューが完了し、KPT 3 カラム、カード操作、アバター表示、採番表示、ラベル簡素化の統合が承認された。
- `task.md` の完了条件は PO 手動確認完了をもってすべて `[x]` に更新した。
- Epic 48 は、レトロスペクティブ UI 基盤と採番付きエンティティ表示基盤を備えた状態でクローズ可能と判断した。
