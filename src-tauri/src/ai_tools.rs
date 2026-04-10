use crate::db::{insert_story_with_tasks, StoryDraftInput, TaskDraft};
use rig::completion::ToolDefinition;
use rig::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;
use std::fmt;
use tauri::{AppHandle, Emitter};

const STORY_DUPLICATE_SIMILARITY_THRESHOLD: f64 = 0.88;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateStoryAndTasksArgs {
    pub target_story_id: Option<String>,
    pub story_title: Option<String>,
    pub story_description: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub story_priority: Option<i32>,
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

#[derive(Debug, Clone, Copy)]
struct ProjectBacklogCounts {
    stories: i64,
    tasks: i64,
    dependencies: i64,
}

async fn get_project_backlog_counts(
    app: &AppHandle,
    project_id: &str,
) -> Result<ProjectBacklogCounts, String> {
    let stories = crate::db::select_query::<(i64,)>(
        app,
        "SELECT COUNT(*) as count FROM stories WHERE project_id = ?",
        vec![serde_json::to_value(project_id).unwrap()],
    )
    .await?
    .first()
    .map(|row| row.0)
    .unwrap_or(0);

    let tasks = crate::db::select_query::<(i64,)>(
        app,
        "SELECT COUNT(*) as count FROM tasks WHERE project_id = ?",
        vec![serde_json::to_value(project_id).unwrap()],
    )
    .await?
    .first()
    .map(|row| row.0)
    .unwrap_or(0);

    let dependencies = crate::db::select_query::<(i64,)>(
        app,
        "SELECT COUNT(*) as count FROM task_dependencies td JOIN tasks t ON td.task_id = t.id WHERE t.project_id = ?",
        vec![serde_json::to_value(project_id).unwrap()],
    )
    .await?
    .first()
    .map(|row| row.0)
    .unwrap_or(0);

    Ok(ProjectBacklogCounts {
        stories,
        tasks,
        dependencies,
    })
}

fn normalize_story_title(title: &str) -> String {
    title
        .chars()
        .flat_map(|ch| ch.to_lowercase())
        .filter(|ch| ch.is_alphanumeric())
        .collect()
}

fn story_title_bigrams(title: &str) -> HashSet<String> {
    let chars = title.chars().collect::<Vec<_>>();
    match chars.len() {
        0 => HashSet::new(),
        1 => std::iter::once(title.to_string()).collect(),
        _ => chars
            .windows(2)
            .map(|window| window.iter().collect::<String>())
            .collect(),
    }
}

fn story_title_similarity(candidate: &str, existing: &str) -> f64 {
    let candidate = normalize_story_title(candidate);
    let existing = normalize_story_title(existing);

    if candidate.is_empty() || existing.is_empty() {
        return 0.0;
    }
    if candidate == existing {
        return 1.0;
    }

    let shorter_len = candidate.chars().count().min(existing.chars().count());
    if shorter_len >= 6 && (candidate.contains(&existing) || existing.contains(&candidate)) {
        return 0.96;
    }

    let candidate_bigrams = story_title_bigrams(&candidate);
    let existing_bigrams = story_title_bigrams(&existing);
    if candidate_bigrams.is_empty() || existing_bigrams.is_empty() {
        return 0.0;
    }

    let intersection = candidate_bigrams.intersection(&existing_bigrams).count() as f64;
    (2.0 * intersection) / ((candidate_bigrams.len() + existing_bigrams.len()) as f64)
}

fn build_duplicate_story_error(story: &crate::db::Story, similarity: f64) -> String {
    let status_label = if story.archived {
        "Completed / Archived".to_string()
    } else {
        story.status.clone()
    };

    format!(
        "既存 Story と重複する可能性が高いため、新規作成を停止しました。候補: \"{}\" (ID: {}, status: {})。類似度: {:.2}。既存 Story へ task を追加する場合は target_story_id を指定し、完了済み実装の派生作業なら差分が分かるタイトルへ具体化してください。",
        story.title, story.id, status_label, similarity
    )
}

pub async fn guard_story_creation_against_duplicates(
    app: &AppHandle,
    project_id: &str,
    target_story_id: Option<&str>,
    story_title: Option<&str>,
) -> Result<(), String> {
    if target_story_id
        .map(str::trim)
        .map(|value| !value.is_empty())
        .unwrap_or(false)
    {
        return Ok(());
    }

    let Some(candidate_title) = story_title.map(str::trim).filter(|title| !title.is_empty()) else {
        return Ok(());
    };

    let existing_stories = crate::db::select_query::<crate::db::Story>(
        app,
        "SELECT * FROM stories WHERE project_id = ? ORDER BY archived ASC, updated_at DESC, created_at DESC",
        vec![serde_json::to_value(project_id).unwrap()],
    )
    .await?;

    let duplicate = existing_stories
        .into_iter()
        .map(|story| {
            let similarity = story_title_similarity(candidate_title, &story.title);
            (story, similarity)
        })
        .filter(|(_, similarity)| *similarity >= STORY_DUPLICATE_SIMILARITY_THRESHOLD)
        .max_by(|(_, left), (_, right)| {
            left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal)
        });

    if let Some((story, similarity)) = duplicate {
        return Err(build_duplicate_story_error(&story, similarity));
    }

    Ok(())
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
                    "story_priority": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 5,
                        "description": "ストーリーの優先度（整数1〜5、小さいほど優先度高）: 1=最重要, 2=高, 3=中(デフォルト), 4=低, 5=最低",
                        "nullable": true
                    },
                    "tasks": {
                        "type": "array",
                        "minItems": 1,
                        "description": "作成するサブタスクのリスト",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": { "type": "string" },
                                "description": { "type": "string", "nullable": true },
                                "priority": {
                                    "type": "integer",
                                    "minimum": 1,
                                    "maximum": 5,
                                    "description": "タスクの優先度（整数1〜5、小さいほど優先度高）: 1=最重要, 2=高, 3=中(デフォルト), 4=低, 5=最低"
                                },
                                "blocked_by_indices": {
                                    "type": "array",
                                    "items": { "type": "integer" },
                                    "description": "このタスクの先行タスクの配列インデックス（0始まり）。依存がなければ省略"
                                }
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
        if args.tasks.is_empty() {
            return Err(CustomToolError(
                "少なくとも1件以上のタスクが必要です。tasks を空配列にせず、作成対象タスクを含めて再実行してください。".to_string(),
            ));
        }

        guard_story_creation_against_duplicates(
            &self.app,
            &self.project_id,
            args.target_story_id.as_deref(),
            args.story_title.as_deref(),
        )
        .await
        .map_err(CustomToolError)?;

        let before = get_project_backlog_counts(&self.app, &self.project_id)
            .await
            .map_err(CustomToolError)?;

        let story_draft = StoryDraftInput {
            target_story_id: args.target_story_id.clone(),
            title: args
                .story_title
                .clone()
                .unwrap_or_else(|| "Untitled Story".to_string()),
            description: args.story_description.clone(),
            acceptance_criteria: args.acceptance_criteria.clone(),
            priority: args.story_priority.clone(),
        };

        match insert_story_with_tasks(&self.app, &self.project_id, story_draft, args.tasks).await {
            Ok(story_id) => {
                let after = get_project_backlog_counts(&self.app, &self.project_id)
                    .await
                    .map_err(CustomToolError)?;
                let added_stories = after.stories.saturating_sub(before.stories);
                let added_tasks = after.tasks.saturating_sub(before.tasks);
                let added_dependencies = after.dependencies.saturating_sub(before.dependencies);

                if added_tasks <= 0 {
                    return Err(CustomToolError(
                        "ストーリー登録後も tasks テーブルの件数が増えていません。タスク追加は完了していないため、成功として扱えません。".to_string(),
                    ));
                }

                let _ = self.app.emit("kanban-updated", ());
                let target_msg = if let Some(id) = args.target_story_id {
                    format!("既存のストーリー(ID: {})", id)
                } else {
                    format!(
                        "新規ストーリー「{}」(ID: {})",
                        args.story_title.unwrap_or_default(),
                        story_id
                    )
                };

                Ok(format!(
                    "正常に{}へ反映しました。追加結果: stories +{}, tasks +{}, dependencies +{}。この結果だけを根拠にユーザーへ報告してください。",
                    target_msg, added_stories, added_tasks, added_dependencies
                ))
            }
            Err(e) => {
                eprintln!("CreateStoryAndTasksTool Execution Error: {:?}", e);
                Err(CustomToolError(e))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_story_title, story_title_similarity};

    #[test]
    fn normalize_story_title_removes_spacing_and_symbols() {
        assert_eq!(
            normalize_story_title("  DB 一覧表示を追加!! "),
            "db一覧表示を追加"
        );
    }

    #[test]
    fn story_title_similarity_detects_exact_and_near_exact_titles() {
        assert_eq!(story_title_similarity("DB一覧表示", "db 一覧表示"), 1.0);
        assert!(story_title_similarity("ユーザー一覧APIを追加", "ユーザー一覧 API を追加") > 0.9);
        assert!(story_title_similarity("通知設定画面を追加", "売上CSVエクスポート") < 0.5);
    }
}
