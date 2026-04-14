# EPIC48: レトロスペクティブUI + 型定義 + Hooks

## 背景

EPIC47でDBスキーマとバックエンドCRUDが整備された前提で、フロントエンドにレトロスペクティブ画面を構築する。ScrumDashboardに3番目のタブとしてレトロビューを追加し、KPT（Keep/Problem/Try）形式の3カラムボードでスプリントの振り返りを可視化する。

## ゴール

- TypeScript型定義を追加する
- レトロ・ルール・ノート用のReact Hooksを作成する
- ScrumDashboardに「レトロスペクティブ」タブを追加する
- KPT 3カラムボードのRetrospectiveViewコンポーネントを実装する

## スコープ

### 含む

- `src/types/index.ts` への型定義追加（RetroSession, RetroItem, RetroRule, ProjectNote）
- `src/hooks/useRetrospective.ts`, `useRetroRules.ts`, `useProjectNotes.ts` の作成
- `src/components/kanban/ScrumDashboard.tsx` のタブ拡張
- `src/components/kanban/RetrospectiveView.tsx` の新規作成
- KPTカードの手動追加・編集・削除UI

### 含まない

- SM AIによるKPT合成（EPIC51で実装）
- POノート画面（EPIC49で実装）
- Try→ルール変換（EPIC53で実装）
- POアシスタント連携（EPIC52で実装）

## タスクリスト

### Story 1: TypeScript型定義

- [x] `RetroSession` インターフェース追加
- [x] `RetroCategory` 型 (`'keep' | 'problem' | 'try'`) 追加
- [x] `RetroItem` インターフェース追加
- [x] `RetroRule` インターフェース追加
- [x] `ProjectNote` インターフェース追加

### Story 2: React Hooks作成

- [x] `useRetrospective(projectId)` — retro_sessions + retro_items のCRUD
- [x] `useRetroRules(projectId)` — retro_rules のCRUD
- [x] `useProjectNotes(projectId)` — project_notes のCRUD

### Story 3: ScrumDashboardタブ拡張

- [x] `activeTab` の型を `'backlog' | 'board' | 'retrospective'` に拡張
- [x] 3番目のタブボタン追加（アイコン: `RotateCcw`、ラベル: 「レトロスペクティブ」）
- [x] コンテンツ領域の条件分岐追加

### Story 4: RetrospectiveViewコンポーネント

- [x] スプリントセレクタ（完了済みスプリントをドロップダウンで選択）
- [x] KPT 3カラムレイアウト（Keep=緑系, Problem=赤系, Try=青系）
- [x] 各カラムの「カード追加」ボタンと入力フォーム
- [x] KPTカードコンポーネント（内容表示、編集、削除、承認トグル）
- [x] エージェント由来カードにはAvatarコンポーネントでロールアバター表示
- [x] SM合成サマリの表示パネル（Markdown描画、折りたたみ可能）
- [x] レトロ未作成時の空状態表示
- [x] レトロセッションのステータス表示（draft / in_progress / completed）

### 追加要件: プロジェクト名 + 採番表示

- [x] stories / tasks / sprints に `sequence_number` を追加し、既存データを backfill する
- [x] frontend / backend の型と CRUD を `sequence_number` 対応に更新する
- [x] プロジェクト名ベースの表示 helper を追加する
- [x] Story / Task / Sprint / Retro の UI 表示を `プロジェクト名 + 番号` に更新する
- [x] `npm run build` を再実行し、型エラーなく通す

### 表示調整: Story / Task ラベル簡素化

- [x] Story 表示を `UserStory-xx` に変更する
- [x] Task 表示を `Task-xx` に変更する
- [x] スプリント表示は `プロジェクト名 / スプリント N` のまま維持する
- [x] `npm run build` を再実行し、型エラーなく通す

## 完了条件

- [x] ScrumDashboardに3つのタブが表示され、切り替えが正常に動作する
- [x] レトロスペクティブタブでKPT 3カラムボードが表示される
- [x] KPTカードの手動追加・編集・削除が動作する
- [x] 完了済みスプリントを選択してレトロ内容を切り替えられる
- [x] `npm run build` がエラーなく完了する
- [x] 型エラーが発生しない
