# EPIC52 実装計画

## 概要

POアシスタントにレトロ関連の2つのAI Toolを追加し、会話中にノート追加やレトロアイテム提案ができるようにする。既存の `CreateStoryAndTasksTool` の実装パターンに厳密に従う。

## 現状整理

### 既存AI Toolパターン（ai_tools.rs）

```rust
pub struct CreateStoryAndTasksTool {
    pub app: AppHandle,
    pub project_id: String,
}

impl Tool for CreateStoryAndTasksTool {
    const NAME: &'static str = "create_story_and_tasks";
    type Error = CustomToolError;
    type Args = CreateStoryAndTasksArgs;
    type Output = String;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: Self::NAME.to_string(),
            description: "...".to_string(),
            parameters: json!({ "type": "object", "properties": {...}, "required": [...] }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        // DB操作 + イベント通知
        let _ = self.app.emit("kanban-updated", ());
        Ok("成功メッセージ".to_string())
    }
}
```

### POアシスタントのツール登録（ai.rs）

POアシスタント呼び出し時にツールを登録するコード箇所を確認し、既存の `CreateStoryAndTasksTool` と並列に新ツールを追加する。

## 実施ステップ

### Step 1: AddProjectNoteTool

```rust
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AddProjectNoteArgs {
    pub title: String,
    pub content: String,
    pub sprint_id: Option<String>,
}

pub struct AddProjectNoteTool {
    pub app: AppHandle,
    pub project_id: String,
}

impl Tool for AddProjectNoteTool {
    const NAME: &'static str = "add_project_note";
    type Error = CustomToolError;
    type Args = AddProjectNoteArgs;
    type Output = String;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: Self::NAME.to_string(),
            description: "プロジェクトノートを追加します。DEV実行中の気づき、改善案、問題点などを記録するために使用してください。".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "ノートのタイトル" },
                    "content": { "type": "string", "description": "ノートの内容（Markdown形式）" },
                    "sprint_id": { "type": "string", "description": "関連するスプリントID（省略時は現在のスプリント）" }
                },
                "required": ["title", "content"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let note_id = uuid::Uuid::new_v4().to_string();
        db::add_project_note(
            &self.app, &note_id, &self.project_id,
            args.sprint_id.as_deref(), &args.title, &args.content, "po_assistant"
        ).await.map_err(|e| CustomToolError(e))?;

        let _ = self.app.emit("kanban-updated", ());
        Ok(format!("ノート「{}」を追加しました。", args.title))
    }
}
```

### Step 2: SuggestRetroItemTool

```rust
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SuggestRetroItemArgs {
    pub category: String,  // "keep" | "problem" | "try"
    pub content: String,
}

pub struct SuggestRetroItemTool {
    pub app: AppHandle,
    pub project_id: String,
}

impl Tool for SuggestRetroItemTool {
    const NAME: &'static str = "suggest_retro_item";
    type Error = CustomToolError;
    type Args = SuggestRetroItemArgs;
    type Output = String;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: Self::NAME.to_string(),
            description: "レトロスペクティブにKPTアイテムを提案します。会話中に気づいた改善点(Try)、良かった点(Keep)、問題点(Problem)を提案する時に使用してください。".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["keep", "problem", "try"],
                        "description": "KPTカテゴリ: keep=良かった点, problem=問題点, try=改善提案"
                    },
                    "content": { "type": "string", "description": "アイテムの内容" }
                },
                "required": ["category", "content"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        // アクティブなレトロセッションを検索
        let sessions = db::get_retro_sessions(&self.app, &self.project_id)
            .await.map_err(|e| CustomToolError(e))?;
        let active_session = sessions.iter()
            .find(|s| s.status == "draft" || s.status == "in_progress")
            .ok_or_else(|| CustomToolError(
                "アクティブなレトロセッションがありません。スプリント完了後にレトロを開始してください。".to_string()
            ))?;

        let item_id = uuid::Uuid::new_v4().to_string();
        db::add_retro_item(
            &self.app, &item_id, &active_session.id,
            &args.category, &args.content, "po", None
        ).await.map_err(|e| CustomToolError(e))?;

        let _ = self.app.emit("kanban-updated", ());
        let category_label = match args.category.as_str() {
            "keep" => "Keep",
            "problem" => "Problem",
            "try" => "Try",
            _ => &args.category,
        };
        Ok(format!("レトロの{}に「{}」を追加しました。", category_label, args.content))
    }
}
```

### Step 3: ツール登録 + プロンプト更新

`ai.rs` のPOアシスタントツール登録箇所に追加:

```rust
// 既存
let story_tool = CreateStoryAndTasksTool { app: app.clone(), project_id: project_id.clone() };
// 新規追加
let note_tool = AddProjectNoteTool { app: app.clone(), project_id: project_id.clone() };
let retro_tool = SuggestRetroItemTool { app: app.clone(), project_id: project_id.clone() };
```

POアシスタントシステムプロンプトに追記:

```
## レトロスペクティブ連携
- 会話中にプロセスの改善点、良かった点、問題点に気づいた場合は、suggest_retro_item ツールで提案してください。
- 重要な気づきやアイデアがあれば、add_project_note ツールでノートとして記録してください。
- カテゴリの判断基準:
  - Keep: 継続すべき良い取り組み
  - Problem: 解決すべき課題や障害
  - Try: 次回試してみたい改善案
```

## リスクと対策

### リスク 1: POアシスタントがツールを過剰に呼び出す

- システムプロンプトで「明らかに有用な場合のみ」と制約する
- ユーザーへの確認なしに自動追加されるため、追加時の通知が重要

### リスク 2: アクティブなレトロセッションがない場合

- `SuggestRetroItemTool` でエラーメッセージを返し、POアシスタントがユーザーに案内する

## テスト方針

### 自動テスト

- `AddProjectNoteTool` の `call` メソッドテスト（正常系）
- `SuggestRetroItemTool` のセッション未存在時のエラーハンドリングテスト

### 手動確認

- POアシスタントとの会話で「ここは改善できそうですね」のような発言 → ツール呼び出し確認
- NotesPanel / RetrospectiveView にアイテムが反映されることを確認

## 成果物

- `src-tauri/src/ai_tools.rs`（`AddProjectNoteTool`, `SuggestRetroItemTool` 追加）
- `src-tauri/src/ai.rs`（ツール登録 + プロンプト更新）
