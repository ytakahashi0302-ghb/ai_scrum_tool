# EPIC48 Handoff

## Epic 48 で完了したこと

- `ScrumDashboard` にレトロスペクティブタブが統合され、KPT 3 カラムの振り返り UI 基盤が完成した。
- `RetrospectiveView` では、完了済みスプリント選択、KPT カードの追加・編集・削除・承認、source 別のアバター/バッジ表示、SM サマリ表示まで実装済み。
- `useRetrospective.ts`, `useRetroRules.ts`, `useProjectNotes.ts` が追加済みで、Tauri バックエンドのレトロ/ルール/ノート CRUD をフロントエンドから利用できる。

## 採番とラベル表示の前提

- `stories`, `tasks`, `sprints` には `sequence_number` が導入済みで、既存データは migration 19 で backfill 済み。
- `Story`, `Task`, `Sprint` の型と CRUD はすでに `sequence_number` 対応済みのため、今後の UI 実装でもこの値を前提にしてよい。
- 表示ラベルは `src/hooks/useProjectLabels.ts` に集約されている。
  - Story: `UserStory-<sequence_number>`
  - Task: `Task-<sequence_number>`
  - Sprint / Retro: `<プロジェクト名> / スプリント <sequence_number>`
- 今後の UI 実装でも、Story / Task / Sprint / Retro のラベルを新規に組み立てず、`useProjectLabels.ts` を再利用すること。

## Epic 49 への引き継ぎ

- 次の Epic 49 は、振り返りの中で PO が残す「プロジェクトノート」の UI を構築するフェーズ。
- バックエンドと Hook は `useProjectNotes.ts` まで整っているため、主作業はノート一覧/編集/削除/作成 UI の構築と、既存レトロ画面との導線設計になる。
- Epic 48 の UI パターン:
  - `ScrumDashboard` のタブ追加パターン
  - `RetrospectiveView` の空状態、ヘッダー、カード操作
  - `useProjectLabels.ts` による表示統一
  これらを踏襲すると実装が素直に進む。

## 推奨の参照ファイル

- `src/components/kanban/ScrumDashboard.tsx`
- `src/components/kanban/RetrospectiveView.tsx`
- `src/hooks/useProjectNotes.ts`
- `src/hooks/useProjectLabels.ts`
- `src/types/index.ts`
- `docs/48_retro_ui/implementation_plan.md`
- `docs/48_retro_ui/walkthrough.md`
