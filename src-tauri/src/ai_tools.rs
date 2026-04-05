use crate::db::{insert_story_with_tasks, StoryDraftInput, TaskDraft};
use rig::completion::ToolDefinition;
use rig::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fmt;
use tauri::{AppHandle, Emitter};

#[derive(Deserialize, Serialize)]
pub struct CreateStoryAndTasksArgs {
    pub target_story_id: Option<String>,
    pub story_title: Option<String>,
    pub story_description: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub tasks: Vec<TaskDraft>,
}

#[derive(Debug)]
pub struct CustomToolError(pub String);

impl fmt::Display for CustomToolError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Tool error: {}", self.0)
    }
}

impl std::error::Error for CustomToolError {}

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
            description: "カンバンバックログに新しいストーリーとサプタスク群を登録する、または既存のストーリーにタスクを追加するツール。既存のストーリーにタスクを追加する場合は、事前情報から対象のストーリーIDを推測して target_story_id に指定すること。".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "target_story_id": {
                        "type": "string",
                        "description": "既存のストーリーにタスクを追加する場合の対象ストーリーID。新規作成の場合は指定しない(null)。",
                        "nullable": true
                    },
                    "story_title": {
                        "type": "string",
                        "description": "新規生成するストーリーの要約タイトル（新規作成時のみ指定）",
                        "nullable": true
                    },
                    "story_description": {
                        "type": "string",
                        "description": "ストーリーの詳細な説明",
                        "nullable": true
                    },
                    "acceptance_criteria": {
                        "type": "string",
                        "description": "ストーリーの受け入れ条件（マークダウンのリスト推奨）",
                        "nullable": true
                    },
                    "tasks": {
                        "type": "array",
                        "description": "作成するサブタスクのリスト",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": { "type": "string" },
                                "description": { "type": "string", "nullable": true }
                            },
                            "required": ["title"]
                        }
                    }
                },
                "required": ["tasks"]
            })
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let story_draft = StoryDraftInput {
            target_story_id: args.target_story_id.clone(),
            title: args.story_title.clone().unwrap_or_else(|| "Untitled Story".to_string()),
            description: args.story_description.clone(),
            acceptance_criteria: args.acceptance_criteria.clone(),
        };

        match insert_story_with_tasks(&self.app, &self.project_id, story_draft, args.tasks).await {
            Ok(_) => {
                let _ = self.app.emit("kanban-updated", ());
                let target_msg = if let Some(id) = args.target_story_id {
                    format!("既存のストーリー(ID: {})", id)
                } else {
                    format!("新規ストーリー「{}」", args.story_title.unwrap_or_default())
                };

                Ok(format!(
                    "正常に{}とタスク群をバックログへ追加・反映しました。この結果をユーザーに報告してください。",
                    target_msg
                ))
            },
            Err(e) => {
                eprintln!("CreateStoryAndTasksTool Execution Error: {:?}", e);
                Err(CustomToolError(e))
            },
        }
    }
}
