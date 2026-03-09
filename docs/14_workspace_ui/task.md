# Epic 2: フェーズ3 フロントエンド ワークスペースUI実装 タスクリスト

- [x] 1. Workspace Contextの作成とプロジェクト型定義
  - `src/types/index.ts` に `Project` 型を追加。
  - `src/context/WorkspaceContext.tsx` を作成し、`currentProjectId` のステート管理と、Rustコマンド (`get_projects`, `create_project`等) を呼び出す処理を実装。
- [/] 2. 既存フックの動的フィルタリング対応
  - `useStories.ts` の `projectId: 'default'` を `currentProjectId` に置換。
  - `useTasks.ts` の `projectId: 'default'` を `currentProjectId` に置換。
  - `useSprintHistory.ts` の `projectId: 'default'` を `currentProjectId` に置換。
  - `useSprintArchive.ts` の `projectId: 'default'` を `currentProjectId` に置換。
  - `App.tsx` で `WorkspaceProvider` を追加し、その内側で `ScrumProvider` 等が動くように階層を整理。
- [ ] 3. ワークスペースUIの実装
  - カンバンボードのヘッダー部分 (`App.tsx` 内の `MicroScrum AI` ロゴ周辺など) にプロジェクト切り替え用のドロップダウン (ProjectSelector) を実装。
  - 新規プロジェクト作成用のモーダル (`CreateProjectModal.tsx`) を実装。
- [ ] 4. 結合テスト (マニュアル検証)
  - プロジェクト新規作成が正常に行われ、Tauriを通じてDBに保存されること。
  - 複数プロジェクト間で切り替えた際、即座にタスクやストーリーの表示が切り替わること (UIのリアクティビティ確保)。
