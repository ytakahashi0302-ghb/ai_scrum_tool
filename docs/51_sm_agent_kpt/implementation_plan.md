# EPIC51 実装計画

## 概要

SMエージェント機能をPOアシスタントと同じトランスポート層（API or CLI）を使って実装し、各エージェントの振り返り自動生成とKPT合成を行う。併せて、レトロの入力データとなるエージェント実行ログの蓄積を `claude_runner.rs` に追加する。

## 現状整理

### AIトランスポート（ai.rs）

- POアシスタントは `PoTransport` で API（rig） or CLI を動的選択
- API使用時: `rig_provider.rs` 経由で直接APIコール
- CLI使用時: `claude_runner.rs` 経由でCLI起動
- ツール定義: `ai_tools.rs` の `CreateStoryAndTasksTool` パターン

### LLM使用量記録（llm_observability.rs）

- `llm_usage_events` テーブルに記録
- `source_kind` カラム: CHECK制約で許可値を制限
- `record_llm_usage` 関数で統一記録

### claude_runner.rs のプロセスライフサイクル（Windows）

```
spawn_agent_process
├── stdout reader thread (L829-857)
│   └── loop: read(&mut buf) → emit("claude_cli_output")
├── stderr reader thread (L863-885)
│   └── loop: read(&mut buf) → emit("claude_cli_output")
└── wait thread (L893-918)
    └── wait_success → record_usage → emit("claude_cli_exit")
```

## 実施ステップ

### Step 1: マイグレーション19（source_kind拡張）

`src-tauri/migrations/19_retro_llm_source.sql`:

SQLiteではCHECK制約の変更にテーブル再作成が必要だが、新しい値を挿入するだけなら既存CHECK制約のALTERは不要な場合もある。既存の制約定義を確認し、柔軟な制約であれば変更不要。制約が厳密な場合はマイグレーションで対応する。

### Step 2: エージェント振り返り生成（ai.rs）

```rust
#[tauri::command]
pub async fn generate_agent_retro_review(
    app_handle: AppHandle,
    project_id: String,
    sprint_id: String,
    role_id: String,
    retro_session_id: String,
) -> Result<Vec<db::RetroItem>, String> {
    // 1. コンテキスト収集
    let tasks = db::get_tasks_by_sprint_and_role(&app_handle, &sprint_id, &role_id).await?;
    let usage = db::get_llm_usage_by_sprint(&app_handle, &sprint_id).await?;
    let notes = db::get_project_notes(&app_handle, &project_id).await?;
    let role = db::get_team_role(&app_handle, &role_id).await?;

    // 2. プロンプト構築
    let prompt = build_agent_retro_prompt(&role, &tasks, &usage, &notes);

    // 3. LLM呼び出し（POアシスタントと同じトランスポート）
    let response = call_llm_for_retro(&app_handle, &prompt).await?;

    // 4. レスポンスをパースしてRetroItemに変換
    let items = parse_kpt_response(&response, &retro_session_id, &role_id)?;

    // 5. DBに保存
    for item in &items {
        db::add_retro_item(&app_handle, item).await?;
    }

    Ok(items)
}
```

**エージェント振り返りプロンプト設計:**
```
あなたは {role.name} です。
{role.system_prompt}

以下のスプリントでの自分の作業を振り返り、KPT（Keep/Problem/Try）形式で
振り返りアイテムを生成してください。

# 完了タスク
{tasks一覧: タイトル + ステータス + 実行ログサマリ}

# LLM使用量
{input_tokens, output_tokens, コスト}

# POからのノート
{関連ノート}

# 出力形式
以下のJSON配列で出力してください:
[{"category": "keep|problem|try", "content": "内容"}]
```

### Step 3: SM KPT合成（ai.rs）

```rust
#[tauri::command]
pub async fn synthesize_retro_kpt(
    app_handle: AppHandle,
    project_id: String,
    retro_session_id: String,
) -> Result<String, String> {
    // 1. 全retro_items取得
    let items = db::get_retro_items(&app_handle, &retro_session_id).await?;
    let session = db::get_retro_session(&app_handle, &retro_session_id).await?;

    // 2. スプリント統計取得
    let sprint_stats = gather_sprint_statistics(&app_handle, &session.sprint_id).await?;

    // 3. SMプロンプト構築
    let prompt = build_sm_synthesis_prompt(&items, &sprint_stats);

    // 4. LLM呼び出し
    let summary = call_llm_for_retro(&app_handle, &prompt).await?;

    // 5. サマリ保存 + ステータス更新
    db::update_retro_session(&app_handle, &retro_session_id, "completed", Some(&summary)).await?;

    // 6. SM統合アイテムも生成・保存
    let sm_items = parse_kpt_response(&summary_items_json, &retro_session_id, None)?;
    for item in &sm_items {
        db::add_retro_item(&app_handle, item).await?;
    }

    Ok(summary)
}
```

**SM合成プロンプト設計:**
```
あなたはスクラムマスター（SM）です。
以下のスプリントの振り返りデータを元に、チーム全体のKPT（Keep/Problem/Try）を
合成してください。

# エージェント別振り返り
{各エージェントのKPTアイテム一覧}

# スプリント統計
- 完了タスク数: X / 総タスク数: Y
- 総LLMトークン使用量: Z
- スプリント所要時間: ...

# 出力
1. マークダウン形式の統合サマリ（概要 + 各KPTの要約）
2. 統合KPTアイテムのJSON配列
```

### Step 4: 実行ログ蓄積（claude_runner.rs）

stdoutとstderrの各リーダースレッドで、emitと同時にリングバッファに書き込む:

```rust
// 共有バッファ型
type LogBuffer = Arc<Mutex<VecDeque<u8>>>;
const MAX_LOG_BUFFER_SIZE: usize = 4096; // 4KB

fn append_to_log_buffer(buffer: &LogBuffer, data: &[u8]) {
    let mut buf = buffer.lock().unwrap();
    buf.extend(data);
    while buf.len() > MAX_LOG_BUFFER_SIZE {
        buf.pop_front();
    }
}
```

waitスレッド内（L893-918）でプロセス完了時にバッファ内容を保存:

```rust
// waitスレッド内、usage記録後に追加
let log_content = {
    let buf = log_buffer.lock().unwrap();
    String::from_utf8_lossy(&buf.iter().copied().collect::<Vec<_>>()).to_string()
};
if !log_content.is_empty() {
    tauri::async_runtime::block_on(
        db::update_task_execution_log(&app_wait, &tid_wait, &log_content)
    );
}
```

### Step 5: フロントエンド接続

RetrospectiveView のボタンハンドラ:

```typescript
// 「レトロ開始」
const handleStartRetro = async () => {
    setLoading(true);
    // 全エージェントロールを取得
    const roles = await invoke('get_team_roles', { projectId });
    // 各ロールに対して振り返り生成
    for (const role of roles) {
        await invoke('generate_agent_retro_review', {
            projectId, sprintId, roleId: role.id, retroSessionId
        });
    }
    await refreshItems();
    setLoading(false);
};

// 「KPT合成」
const handleSynthesizeKpt = async () => {
    setLoading(true);
    const summary = await invoke('synthesize_retro_kpt', {
        projectId, retroSessionId
    });
    await refreshSession();
    setLoading(false);
};
```

## リスクと対策

### リスク 1: LLMレスポンスのパース失敗

- JSON配列の出力を要求しつつ、パースに失敗した場合はMarkdownテキストとしてフォールバック
- パース失敗時は1つの「未分類」retro_itemとして保存する

### リスク 2: 長時間タスクのログバッファ

- 4KBの制限によりメモリ問題は発生しない
- VecDequeのpop_frontは効率的

### リスク 3: LLMコスト

- 各エージェント × 1回 + SM合成1回 = 6-7回程度のAPI呼び出し
- 使用量は `llm_usage_events` で追跡可能

## テスト方針

### 自動テスト

- プロンプト構築関数のユニットテスト
- KPTレスポンスパースのユニットテスト（正常系 + 異常系）
- ログバッファのリングバッファ動作テスト

### 手動確認

- レトロ開始→各エージェントの振り返りカード生成→KPT合成→サマリ表示の一連フローを確認
- 実行ログがタスクに保存されていることをDBで確認

## 成果物

- `src-tauri/src/ai.rs`（`generate_agent_retro_review`, `synthesize_retro_kpt` 追加）
- `src-tauri/src/claude_runner.rs`（ログバッファ蓄積追加）
- `src-tauri/src/db.rs`（`update_task_execution_log` + 補助クエリ追加）
- `src-tauri/migrations/19_retro_llm_source.sql`（source_kind拡張、必要な場合）
- `src/components/kanban/RetrospectiveView.tsx`（ボタンハンドラ接続）
