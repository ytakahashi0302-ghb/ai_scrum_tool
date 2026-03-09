# 実装計画: Epic 2 フェーズ3 フロントエンド ワークスペースUI実装

この計画では、Tauri + React環境において現在ハードコードされているプロジェクトID (`'default'`) を動的に切り替えられるようにし、ヘッダーにワークスペース切り替えUIを実装します。

## 設計スコープとアプローチ

### 1. プロジェクト状態の管理 (React Context)
新たに `WorkspaceContext.tsx` を作成し、アプリケーション全体の選択中プロジェクトを管理します。
初期値は `'default'` とし、Tauri バックエンドから取得したプロジェクト一覧を保持します。
`ScrumProvider` は `WorkspaceContext` に依存するため、`App.tsx` の Provider ツリーを以下のように構成します。
```tsx
<WorkspaceProvider>
  <ScrumProvider>
    <AppContent />
  </ScrumProvider>
</WorkspaceProvider>
```

### 2. データの動的フィルタリング
現在、以下のカスタムフックで `projectId: 'default'` がハードコードされています。
- `src/hooks/useStories.ts`
- `src/hooks/useTasks.ts`
- `src/hooks/useSprintHistory.ts`
- `src/hooks/useSprintArchive.ts`

これらを `useWorkspace()` フックから取得した `currentProjectId` を利用するように改修します。プロジェクトが切り替わった際には、`useEffect` の依存配列を通じて自動的に再フェッチが行われるようにし、UIのリアクティビティを確保します。

### 3. UI実装 (Project Switcher)
`App.tsx` のヘッダー内にプロジェクト切り替えのドロップダウンを実装します。
ネイティブな `<select>` または、Tailwindとlucide-reactを使用したカスタムドロップダウンにし、選択肢の最後に「＋ 新規プロジェクト作成」を配置します。これを選ぶと新規作成モーダルが立ち上がる導線とします。

## Proposed Changes

### Context & Types
#### [MODIFY] [src/types/index.ts](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src/types/index.ts)
- `Project` 型 (`id`, `name`, `description`, `created_at`, `updated_at`) を追加。

#### [NEW] [src/context/WorkspaceContext.tsx](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src/context/WorkspaceContext.tsx)
- `WorkspaceProvider` コンポーネントおよび `useWorkspace` フックの実装。
- `currentProjectId`, `projects`, `fetchProjects`, `addProject` などの管理およびTauriコマンドの呼び出し。

### Hooks Modification
#### [MODIFY] [src/hooks/useStories.ts](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src/hooks/useStories.ts)
- `projectId` に依存する形への対応（フック内での `useWorkspace` 参照、あるいは引数での受け取り）。

#### [MODIFY] [src/hooks/useTasks.ts](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src/hooks/useTasks.ts)
- `projectId` 対応。

#### [MODIFY] [src/hooks/useSprintHistory.ts](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src/hooks/useSprintHistory.ts)
- `projectId` 対応。

#### [MODIFY] [src/hooks/useSprintArchive.ts](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src/hooks/useSprintArchive.ts)
- `projectId` 対応。

### UI Components
#### [MODIFY] [src/App.tsx](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src/App.tsx)
- `WorkspaceProvider` の統合。
- ヘッダー部分に `ProjectSelector` コンポーネントを配置。

#### [NEW] [src/components/ui/ProjectSelector.tsx](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src/components/ui/ProjectSelector.tsx)
- 現在のプロジェクト名表示と、クリック時のドロップダウンメニュー実装。

#### [NEW] [src/components/CreateProjectModal.tsx](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src/components/CreateProjectModal.tsx)
- 新規プロジェクトの「名前」と「説明(任意)」を入力し、`create_project` コマンドを呼び出すモーダル実装。

## Verification Plan

### Manual Verification
1. **アプリ起動**: 開発モード (`npm run tauri dev`) で起動し、エラーなく表示されるか確認する。
2. **デフォルトプロジェクトの確認**: 起動直後、既存のストーリーやタスクが正常に表示されることを確認する。
3. **新規プロジェクトの作成検証**: 
   - ヘッダーのプロジェクトスイッチャーから「＋ 新規プロジェクト作成」を選び、テスト用プロジェクトを作成する。
   - モーダルが閉じた後、表示が即座に新規プロジェクトに切り替わること。
   - 新規プロジェクトではボードが初期状態（空）であることを確認する。
4. **プロジェクトの切り替えとリアクティビティの検証**:
   - スイッチャーから元のプロジェクト（'default'）を選択し、元のタスク一覧がリロードなしで即座に復元されること（リアクティビティの確保）をテストする。
