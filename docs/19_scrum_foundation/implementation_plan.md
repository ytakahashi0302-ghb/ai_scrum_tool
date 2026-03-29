# 実装計画: Epic 6 スクラム基盤の再構築（Backlog & Active Sprint分離）

## 1. 目的と概要
現在のシステムでは、「In Progressステータス」であるタスクを「アクティブなスプリント」として便宜的に代用しています。しかし、この構造では「次にやる予定のタスク（プロダクトバックログ）」と「今まさにスプリントで着手しているタスク（スプリントバックログ）」を明確に分割・管理ができず、AIエージェントがスプリントの範囲を正確に把握できない設計上のブロッカーとなっています。

本実装では、Jiraのような標準的なスクラムツールに倣い、「プロダクトバックログ（未割り当てのリスト）」と「スプリントバックログ（現在進行中のカンバン）」をデータモデルとUIの両面から完全に分離します。

---

## 2. データモデルの改修 (DB Migration)

現在の `sprints` テーブルは「完了したスプリント」の履歴を残す用途にのみ使われています。これを拡張し、「計画中（Planned）」「進行中（Active）」の概念を導入します。

### マイグレーション手順 (`src-tauri/migrations/7_scrum_foundation.sql`)
SQLiteでは `NOT NULL` 制約のカラム（`started_at`, `completed_at`等）を `ALTER TABLE` で容易に変更できないため、新テーブルを作成してデータを移行し、リネームする安全なアプローチをとります。

```sql
-- 1. 拡張された sprints テーブルの作成
CREATE TABLE sprints_new (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Completed', -- 'Planned', 'Active', 'Completed'
    started_at INTEGER,
    completed_at INTEGER,
    duration_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 2. 既存の完了済みスプリントデータを移行 (statusは 'Completed' とみなす)
INSERT INTO sprints_new (id, project_id, status, started_at, completed_at, duration_ms)
SELECT id, project_id, 'Completed', started_at, completed_at, duration_ms 
FROM sprints;

-- 3. 古いテーブルの削除とリネーム
DROP TABLE sprints;
ALTER TABLE sprints_new RENAME TO sprints;

-- 4. stories および tasks テーブルに sprint_id 用のインデックス追加 (パフォーマンス用)
CREATE INDEX IF NOT EXISTS idx_stories_sprint_id ON stories(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
```

> [!CAUTION]
> マイグレーション適用前に、必ず既存の環境における挙動を確認します。SQLiteのテーブル再定義時は外部キー制約などが一時的に影響するため、Tauriのマイグレーションプラグイン側で安全に処理される仕様に準拠します。

---

## 3. バックエンド (Rust / Tauri) の改修

DBスキーマ変更に伴い、バックエンドのコマンド群を改修・追加します。

### [MODIFY] `src-tauri/src/db.rs`
- **モデル構造体の更新**: `Sprint` 構造体の `started_at`, `completed_at`, `duration_ms` を `Option<i64>` に変更し、新たに `status: String` を追加します。
- **既存コマンドの修正**: 
  - `archive_sprint`: 仕様を「進行中のスプリントを完了（Completed）にする処理」へと変更します。完了時に「Doneでないタスクの `sprint_id` を NULL に戻してバックログへ差し戻す」処理を実装します。
- **新規コマンドの追加**:
  - `create_planned_sprint(project_id)`: ステータスが "Planned" のスプリントレコードを作成。
  - `start_sprint(sprint_id, duration_ms)`: 対象のスプリントを "Active" に変更し、`started_at` に現在時刻をセット。他のアクティブなスプリントがないか確認する仕組みも含めます。
  - `get_project_sprints(project_id)`: Planned, Active, Completed なスプリント一覧を返す。
  - `assign_task_to_sprint(task_id, sprint_id)` / `assign_story_to_sprint(story_id, sprint_id)`: バックログ画面からタスクやストーリーを特定スプリントに割り当てる。

---

## 4. フロントエンド (React) の画面とUI/UXの分割

単一の「Board（カンバン）」画面だった構成を、ルーティングもしくはタブ構成で明確に2画面へ分割します。

### 画面ルーティングの設計 (Tabs UI)
ヘッダー下部ナビゲーション、もしくはサイドバーを利用し、以下のビューを切り替えられるようにします。
- **Backlog**: プロダクトバックログ画面。
- **Board**: アクティブスプリントのカンバン画面。
- (Existing) **History**: スプリント履歴（過去完了分）。

### [NEW] バックログ画面 (Backlog View)
- 未完了かつ `sprint_id` が未割り当て（NULL）のストーリーとタスクをリスト表示。
- **右側（または上部）ペイン**: 「Planned Sprints (次のスプリント)」パネルを設置。
- ドラッグ＆ドロップで、バックログのアイテムを「Planned Sprint」にアサインできるUI。
- Planned Sprint パネル内の「Sprintを開始」ボタンを押下して初めてアクティブ化する。

### [MODIFY] アクティブスプリント画面 (Active Sprint / Board View)
- 現在のカンバンコンポーネントを改修し、`status === 'Active'` なスプリントに紐づくタスクのみを表示するようにフィルター。
- `Active`なスプリントが存在しない場合は、「アクティブなスプリントがありません。バックログからスプリントを開始してください」といった Empty State を表示する。

> [!IMPORTANT]
> 「In Progressステータス ＝ アクティブスプリント所属」という従来の暗黙のルールを廃止します。バックログ上では、すべてのアイテムが「To Do」であることを基本とします。

---

## オープンクエスチョン (User Review Required)

1. **画面の切り替え方式について**
   現在、アプリ全体は `App.tsx` のStateベースで画面が切り替わっているか、単一画面です。切り替えを `react-router-dom` などのルーターライブラリを入れて本格的に行うか、現状のまま軽量な「タブ切替（Stateベース）」で Backlog / Board を分けるか、どちらを推奨しますか？（※タブ切替の方が手軽でUXの遅延がありません）

2. **ストーリーへのアサインについて**
   バックログからスプリントへ割り当てる際、Jiraのように「ストーリー単位でスプリントに入れれば、子タスクも一括でスプリントに追随する」仕様としますか？それともタスク単位で細かく個別にアサインさせますか？（※一般的には、親であるストーリーをドラッグすれば子が一緒についてくる仕様が便利です）

---

## 検証計画 (Verification Plan)

### マニュアルテスト手順
1. アプリを起動し、既存のデータがマイグレーションによりエラーなく表示されること。
2. 新規の「Backlog」画面で、新しい計画中スプリント（Planned）を作成できること。
3. タスクをPlannedスプリントにD&D（またはクリック）で割り当てできること。
4. 「Start Sprint」を押すと、そのスプリントがActiveになり、「Board」画面にタスクが表示されること。
5. 「Archive Sprint」で完了すると、Doneタスクがアーカイブされ、未完了タスクがBacklogに自動で戻される（または次回スプリントへ回せる状態になる）こと。

---

## Phase 3: バグ修正とUX向上（追加実装）

前回の実装フェーズにおけるクリティカルバグの修正と、実際の現場運用に必要な3つの機能追加に関するプランです。

### 1. `src-tauri/src/db.rs`
#### [MODIFY] `db.rs`
**Bug 1 / Feature 1: スプリント完了ロジック (complete_sprint) の変更**
- 既存の `complete_sprint` は、未完了のタスク・ストーリーの `sprint_id` を一旦 `NULL` に戻していました。
- これを修正し、完了処理のトランザクション内で **「現在 `status = 'Planned'` のスプリントが存在するか確認し、無ければ新規作成。その後、未完了アイテムの `sprint_id` をその Planned Sprint の ID に更新する」** ロジックに書き換えます（ロールオーバーの自動化）。

**Feature 2: タスク取得クエリ (get_tasks) の変更**
- 既存: `SELECT * FROM tasks WHERE archived = 0 AND project_id = ? ORDER BY created_at ASC`
- 変更後: `SELECT tasks.* FROM tasks JOIN stories ON tasks.story_id = stories.id WHERE stories.archived = 0 AND tasks.project_id = ? ORDER BY tasks.created_at ASC`
- 目的: 親のストーリーがバックログに存在（`archived = 0`）する限り、過去のスプリントで完了してアーカイブ済みのタスクであってもフロントエンドへ全て返すようにします。
- 補足: スプリント完了時、タスクの `sprint_id` はそのまま保持されるため、「古いアーカイブ済みタスクが新しいアクティブスプリントに混入する」ことは `Board.tsx` のフィルタリング (`t.sprint_id === activeSprint.id`) により自動的に防がれます。

### 2. Frontend Components (`src/components/kanban/`)
#### [MODIFY] `Board.tsx`
- **Bug 1対策**: 親ストーリーが消失するバグの根本原因として、Reactの `dnd-kit` や `activeStories` 周りのフィルタリングやMemo化の依存配列等を再検証し、タスクのStatus更新（楽観的UIによるState変更）で親コンポーネントが不要なアンマウント・クラッシュを起こさないようコードを堅牢化します（必要な場合 `useTasks` 側も修正）。

#### [MODIFY] `BacklogView.tsx`
- **Feature 2**: ストーリーのヘッダータイトル横に「2/5 個完了」のように、`t.status === 'Done'` なタスクの割合を表示するUIを追加します。
- **Feature 2**: タスクリストをレンダリングする際、`t.status === 'Done'` のタスクに対して `opacity-50` などのグレーアウトクラスを適用し、完了済みであることが直感的に分かるようにします。
- **Feature 3**: スプリントからバックログへの差し戻し（フォールバック用「←」ボタンおよびD&D）の挙動を担保するため、`null` が正しくバックエンドに渡るかイベントフローを点検します。

### 検証計画 (Phase 3)

#### 自動生成スプリントの確認
- `npm run tauri dev` 起動後、「完了にする」ボタンを押してスプリントを終了させます。
- 自動的に `Planned` ステータスの新規スプリントが生まれ、未完了タスク・ストーリーがそこに割り当てられているか確認します。
- 未完了タスク・ストーリーが「アクティブスプリントがない場合」のボードから消え、バックログ画面の「次のスプリント」ペインに存在するか確認します。

#### バックログの進捗可視化確認
- バックログ画面で、過去のスプリントで完了にした完了済みタスクが「半透明」で表示されているか見ます。
- 「1/3」などのタスク総数に対する消化数が正しく表示されるか見ます。

#### 消失バグの確認
- ボード上で未完了タスクを「Done」列にドラッグ＆ドロップし、完了タスクが通常通り更新され、かつ親ストーリーのSwimlaneが画面から**異常消失しない**ことを念入りにテストします。
