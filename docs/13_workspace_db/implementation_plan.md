# 13_workspace_db 実装計画

## 目的
マルチプロジェクト（ワークスペース）機能導入の事前準備として、現在のフロントエンド（React Hooks）に直書きされているSQLロジックをすべてRust側のTauriコマンドに移行（リファクタリング）します。これによりアーキテクチャの「ねじれ」を解消し、将来の Epic 3 (AI RAG) においてRust側からDBのデータを直接プロンプトへ注入できる基盤を整えます。リファクタリング完了後、当初の計画であったプロジェクト拡張（スキーマ変更とフィルタ対応）を実施します。

## フェーズ1: DBアクセスロジックのRust側への全面移行 (リファクタリング)

### 1-1. Rust側コマンドの実装 (`src-tauri/src/db.rs` 等)
既存の `stories`, `tasks`, `sprints` について、フロントエンドで利用されている各クエリに対応するCRUD処理をTauriコマンドとしてRust側で実装します。
（構造体を `serde::Serialize`, `serde::Deserialize` で定義し、フロントエンドと型を合わせます。）
- **Stories**: `get_stories`, `add_story`, `update_story`, `delete_story`
- **Tasks**: `get_tasks`, `get_tasks_by_story_id`, `add_task`, `update_task_status`, `update_task`, `delete_task`
- **Sprints**: （各フックのクエリに応じた）履歴取得等のコマンド

### 1-2. フロントエンドHooksの改修 (`src/hooks/*.ts`)
`useStories.ts`, `useTasks.ts`, `useSprintHistory.ts`, `useSprintTimer.ts` 等のHooks内で `@tauri-apps/plugin-sql` の機能を用いて直接発行している `db.select` や `db.execute` を、`invoke("get_stories")` のようにTauriコマンドの呼び出しへ置き換えます。

---

## フェーズ2: ワークスペース（プロジェクト）DBスキーマ拡張

### 2-1. マイグレーションの追加 (`src-tauri/migrations/3_add_projects.sql`)
SQLiteの制限を考慮し、フェーズ1のRustリファクタリング完了後に以下のマイグレーションを追加します。
```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 既存データ用のデフォルトプロジェクト
INSERT INTO projects (id, name, description) VALUES ('default', 'Default Project', 'Default workspace');

-- 既存テーブル群へ外部キー付きカラムの追加し、既存データには 'default' をセットする
ALTER TABLE stories ADD COLUMN project_id TEXT REFERENCES projects(id) DEFAULT 'default';
ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) DEFAULT 'default';
ALTER TABLE sprints ADD COLUMN project_id TEXT REFERENCES projects(id) DEFAULT 'default';
```

### 2-2. プロジェクト関連のCRUDコマンド実装
プロジェクト管理用のTauriコマンド (`create_project`, `get_projects`, `update_project`, `delete_project`) を実装します。

### 2-3. フェーズ1で移行したコマンドの改修 (project_id フィルタ適応)
フェーズ1で作った `get_stories` や `get_tasks`、INSERT処理に、引数として `project_id` を受け取るように改修し、特定プロジェクトのデータのみを扱うようにSQLを修正します。フロントエンドの型 (`src/types/index.ts`) も更新し、連携の準備を完了させます。

---

## 検証方針 (Verification Plan)

### 自動テスト / ビルドチェック
- `cargo check`: Rust側のコマンド定義、SQLクエリ、型のバリデーション・エラーがないかを確認します。
- TypeScriptのビルドにおいて型エラーがないことを確認します。

### 手動検証 (Manual Verification)
1. **フェーズ1完了時点**: 既存のカンバンアプリが問題なく動作し、タスクの作成・ステータス更新・削除などが正常に行えるか、退行エラーがないかを確認します。
2. **フェーズ2完了時点**: アプリ起動時にマイグレーションエラーが発生しないこと、および「デフォルトプロジェクト」に紐付くデータとして既存のカンバンが正しく表示されることを確認します。
