use super::common::{
    execute_po_cli_prompt, get_project_backlog_counts, parse_json_response, record_cli_usage,
    record_provider_usage, resolve_po_transport, serialize_chat_history, ChatTaskResponse, Message,
    PoAssistantExecutionPlan, PoTransport, ProjectBacklogCounts,
};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

mod heuristics;
mod plan;
mod prompts;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusTarget {
    pub kind: String,
    pub id: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct FocusedTaskContextRow {
    id: String,
    sequence_number: i64,
    title: String,
    description: Option<String>,
    status: String,
    priority: i32,
    story_id: String,
    story_sequence_number: i64,
    story_title: String,
    acceptance_criteria: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct FocusedStoryContextRow {
    id: String,
    sequence_number: i64,
    title: String,
    description: Option<String>,
    status: String,
    priority: i32,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct FocusedStoryTaskRow {
    sequence_number: i64,
    title: String,
    status: String,
}

fn format_optional_focus_text(value: Option<&str>) -> String {
    let trimmed = value.unwrap_or_default().trim();
    if trimmed.is_empty() {
        "（未設定）".to_string()
    } else {
        trimmed.to_string()
    }
}

fn build_task_focus_block(task: &FocusedTaskContextRow) -> String {
    format!(
        r#"【現在の相談対象】
- 種別: Task
- ID: {}
- ラベル: Task-{}
- タイトル: {}
- 説明: {}
- ステータス: {}
- 優先度: P{}
- 所属PBI: PBI-{} {}
- 所属PBI ID: {}
- 受け入れ条件: {}

【Task focus 時の返答ルール】
- 既存 Task を直接更新したり、更新済みと断定したりしないこと
- 修正提案を返す場合は、`reply` の中で必ず次の Markdown フォーマットを使うこと
## 提案
### タイトル案
<新しいタイトル>

### 説明案
<新しい description（複数行可）>

### 優先度案
<1〜5 の整数。変更不要なら「変更なし」>
- 補足説明や理由は `## 提案` の前後の地の文に書いてよい
- 提案は現在の Task だけを対象とし、別 Task や別 PBI の内容を混入させないこと"#,
        task.id,
        task.sequence_number,
        task.title,
        format_optional_focus_text(task.description.as_deref()),
        task.status,
        task.priority,
        task.story_sequence_number,
        task.story_title,
        task.story_id,
        format_optional_focus_text(task.acceptance_criteria.as_deref()),
    )
}

fn build_story_focus_block(story: &FocusedStoryContextRow, tasks: &[FocusedStoryTaskRow]) -> String {
    let task_lines = if tasks.is_empty() {
        "- （配下タスクなし）".to_string()
    } else {
        tasks
            .iter()
            .map(|task| {
                format!(
                    "- Task-{} {} [{}]",
                    task.sequence_number, task.title, task.status
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    format!(
        r#"【現在の相談対象】
- 種別: PBI
- ID: {}
- ラベル: PBI-{}
- タイトル: {}
- 説明: {}
- ステータス: {}
- 優先度: P{}

【配下タスク一覧】
{}

【重要な制約】現在の相談対象は Story です。いかなる場合も `## 提案` 見出しを含むフォーマットを出力してはいけません。
タイトル案・説明案・優先度案といった単一アイテム書き換えの提案ブロックも禁止です。
テキストによるアドバイス・分割案の箇条書き・トレードオフの説明のみで回答してください。
- 配下 Task を新規登録したり更新済みと断定してはいけません
- 回答は Story 全体の整理・分割・優先度判断に限定すること"#,
        story.id,
        story.sequence_number,
        story.title,
        format_optional_focus_text(story.description.as_deref()),
        story.status,
        story.priority,
        task_lines,
    )
}

async fn resolve_focus_block(
    app: &AppHandle,
    project_id: &str,
    focus: &FocusTarget,
) -> Result<Option<String>, String> {
    match focus.kind.as_str() {
        "task" => {
            let query = r#"
                SELECT
                    t.id,
                    t.sequence_number,
                    t.title,
                    t.description,
                    t.status,
                    t.priority,
                    t.story_id,
                    s.sequence_number AS story_sequence_number,
                    s.title AS story_title,
                    s.acceptance_criteria
                FROM tasks t
                JOIN stories s ON s.id = t.story_id
                WHERE t.id = ? AND t.project_id = ? AND t.archived = 0 AND s.archived = 0
                LIMIT 1
            "#;
            let mut rows = crate::db::select_query::<FocusedTaskContextRow>(
                app,
                query,
                vec![
                    serde_json::to_value(&focus.id).unwrap(),
                    serde_json::to_value(project_id).unwrap(),
                ],
            )
            .await?;
            Ok(rows.pop().map(|row| build_task_focus_block(&row)))
        }
        "story" => {
            let story_query = r#"
                SELECT id, sequence_number, title, description, status, priority
                FROM stories
                WHERE id = ? AND project_id = ? AND archived = 0
                LIMIT 1
            "#;
            let mut stories = crate::db::select_query::<FocusedStoryContextRow>(
                app,
                story_query,
                vec![
                    serde_json::to_value(&focus.id).unwrap(),
                    serde_json::to_value(project_id).unwrap(),
                ],
            )
            .await?;
            let Some(story) = stories.pop() else {
                return Ok(None);
            };

            let task_query = r#"
                SELECT sequence_number, title, status
                FROM tasks
                WHERE story_id = ? AND project_id = ? AND archived = 0
                ORDER BY sequence_number ASC, created_at ASC
            "#;
            let tasks = crate::db::select_query::<FocusedStoryTaskRow>(
                app,
                task_query,
                vec![
                    serde_json::to_value(&focus.id).unwrap(),
                    serde_json::to_value(project_id).unwrap(),
                ],
            )
            .await?;

            Ok(Some(build_story_focus_block(&story, &tasks)))
        }
        other => Err(format!("unsupported focus kind: {}", other)),
    }
}

#[tauri::command]
pub async fn chat_with_team_leader(
    app: AppHandle,
    project_id: String,
    messages_history: Vec<Message>,
    focus: Option<FocusTarget>,
) -> Result<ChatTaskResponse, String> {
    let transport = resolve_po_transport(&app, &project_id, None).await?;
    let context_md = crate::db::build_project_context(&app, &project_id)
        .await
        .unwrap_or_default();
    let before_counts: ProjectBacklogCounts = get_project_backlog_counts(&app, &project_id).await?;
    let latest_user_index = messages_history
        .iter()
        .rposition(|message| message.role == "user");
    let (latest_user_message, prior_messages) = if let Some(index) = latest_user_index {
        let latest = messages_history[index].content.clone();
        let prior = messages_history[..index].to_vec();
        (latest, prior)
    } else {
        (String::new(), messages_history.clone())
    };
    let focus_block = if let Some(focus) = focus.as_ref() {
        match resolve_focus_block(&app, &project_id, focus).await? {
            Some(block) => Some(block),
            None => {
                return Ok(ChatTaskResponse::focus_missing(
                    "現在の相談対象が見つからなかったため、フォーカスを解除しました。カードが削除または移動されている可能性があります。必要に応じて別の PBI / Task から改めて相談してください。",
                ));
            }
        }
    } else {
        None
    };
    let is_focus_consultation = focus_block.is_some();
    let generic_backlog_request =
        heuristics::looks_like_generic_backlog_creation_request(&latest_user_message);
    let has_product_context = heuristics::has_product_context_document(&context_md);

    match transport {
        PoTransport::Api {
            provider,
            api_key,
            model,
        } => {
            let system_prompt = prompts::build_po_assistant_api_system_prompt(
                &context_md,
                focus_block.as_deref(),
            );

            if is_focus_consultation {
                let raw_text = match crate::rig_provider::chat_with_history(
                    &provider,
                    &api_key,
                    &model,
                    &system_prompt,
                    &latest_user_message,
                    crate::rig_provider::convert_messages(&prior_messages),
                )
                .await
                {
                    Ok(response) => response,
                    Err(error) => {
                        if heuristics::is_transient_provider_unavailable(&error) {
                            return Ok(heuristics::build_team_leader_provider_unavailable_reply(
                                &error,
                                false,
                            ));
                        }

                        return Err(error);
                    }
                };
                record_provider_usage(&app, &project_id, "team_leader", &raw_text).await;

                return Ok(match parse_json_response(&raw_text.content) {
                    Ok(response) => response,
                    Err(_) => ChatTaskResponse::new(raw_text.content),
                });
            }

            let mutation_requested = heuristics::looks_like_mutation_request(&latest_user_message);
            let raw_text = match plan::chat_team_leader_with_tools_with_retry(
                &app,
                &provider,
                &api_key,
                &model,
                &system_prompt,
                &latest_user_message,
                &prior_messages,
                &project_id,
            )
            .await
            {
                Ok(response) => response,
                Err(error) => {
                    if mutation_requested {
                        if let Some(partial_success_response) =
                            heuristics::build_partial_team_leader_success_response(
                                &app,
                                &project_id,
                                before_counts,
                                &error,
                            )
                            .await?
                        {
                            return Ok(partial_success_response);
                        }
                    }

                    if heuristics::is_transient_provider_unavailable(&error) {
                        return Ok(heuristics::build_team_leader_provider_unavailable_reply(
                            &error,
                            mutation_requested,
                        ));
                    }

                    return Err(error);
                }
            };
            record_provider_usage(&app, &project_id, "team_leader", &raw_text).await;
            let data_changed =
                heuristics::detect_backlog_change_with_retry(&app, &project_id, before_counts)
                    .await?;

            if mutation_requested && !data_changed {
                if generic_backlog_request && !has_product_context {
                    return Ok(ChatTaskResponse::new(
                        heuristics::build_missing_product_context_reply(),
                    ));
                }

                if let Some(fallback_response) = plan::execute_fallback_team_leader_plan(
                    &app,
                    &provider,
                    &api_key,
                    &model,
                    &project_id,
                    &context_md,
                    &latest_user_message,
                    before_counts,
                )
                .await?
                {
                    return Ok(fallback_response);
                }

                return Ok(ChatTaskResponse::new(if generic_backlog_request {
                    "PRODUCT_CONTEXT.md を踏まえた具体的なバックログ案を生成できず、実際のバックログ件数変化も確認できませんでした。今回は成功扱いにせず停止します。プロジェクトの Local Path と PRODUCT_CONTEXT.md の内容を確認してから再試行してください。".to_string()
                } else {
                    "登録・追加系の依頼として解釈しましたが、実際にはバックログの件数変化を確認できませんでした。今回は成功扱いにせず停止します。`create_story_and_tasks` の未実行または失敗が疑われるため、再試行時は対象ストーリーIDを明示して実行してください。".to_string()
                }));
            }

            Ok(match parse_json_response(&raw_text.content) {
                Ok(response) => response,
                Err(_) => ChatTaskResponse::new(raw_text.content),
            })
        }
        PoTransport::Cli {
            cli_type,
            model,
            cwd,
        } => {
            let history_block = if prior_messages.is_empty() {
                "（会話履歴なし）".to_string()
            } else {
                serialize_chat_history(&prior_messages)
            };
            let cli_prompt = prompts::build_po_assistant_cli_prompt(
                &context_md,
                &history_block,
                &latest_user_message,
                focus_block.as_deref(),
            );
            let result = execute_po_cli_prompt::<PoAssistantExecutionPlan>(
                &cli_type,
                &model,
                &cli_prompt,
                &cwd,
            )
            .await?;
            record_cli_usage(
                &app,
                &project_id,
                "team_leader",
                &cli_type,
                &result.metadata,
            )
            .await;

            let plan_result = result.value;
            if is_focus_consultation {
                return Ok(ChatTaskResponse::new(
                    plan_result
                        .reply
                        .unwrap_or_else(|| "判断材料を整理しました。".to_string()),
                ));
            }

            if plan_result.operations.is_empty() && plan_result.actions.is_empty() {
                if generic_backlog_request {
                    if !has_product_context {
                        return Ok(ChatTaskResponse::new(
                            heuristics::build_missing_product_context_reply(),
                        ));
                    }

                    if let Some(applied_response) = plan::execute_contextual_cli_backlog_plan(
                        &app,
                        &project_id,
                        cli_type,
                        &model,
                        &cwd,
                        &context_md,
                        &latest_user_message,
                        before_counts,
                    )
                    .await?
                    {
                        return Ok(applied_response);
                    }
                }

                return Ok(ChatTaskResponse::new(
                    plan_result
                        .reply
                        .unwrap_or_else(|| "判断材料を整理しました。".to_string()),
                ));
            }

            if let Some(applied_response) = plan::apply_team_leader_execution_plan(
                &app,
                &project_id,
                plan_result,
                before_counts,
            )
            .await?
            {
                return Ok(applied_response);
            }

            if generic_backlog_request {
                if !has_product_context {
                    return Ok(ChatTaskResponse::new(
                        heuristics::build_missing_product_context_reply(),
                    ));
                }

                if let Some(applied_response) = plan::execute_contextual_cli_backlog_plan(
                    &app,
                    &project_id,
                    cli_type,
                    &model,
                    &cwd,
                    &context_md,
                    &latest_user_message,
                    before_counts,
                )
                .await?
                {
                    return Ok(applied_response);
                }
            }

            Ok(ChatTaskResponse::new(
                "登録・追加系の計画を受け取りましたが、実際にはバックログの件数変化を確認できませんでした。今回は成功扱いにせず停止します。対象ストーリーIDや生成タスク内容を見直して再試行してください。",
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_story_focus_block, build_task_focus_block, heuristics, prompts,
        FocusedStoryContextRow, FocusedStoryTaskRow, FocusedTaskContextRow,
    };
    use crate::ai::common::ProjectBacklogCounts;

    fn normalize_snapshot(value: &str) -> String {
        value.replace("\r\n", "\n").trim().to_string()
    }

    #[test]
    fn generic_backlog_creation_request_is_detected() {
        assert!(heuristics::looks_like_generic_backlog_creation_request(
            "バックログを1つ作成してください"
        ));
    }

    #[test]
    fn task_addition_to_existing_story_does_not_use_generic_story_fallback() {
        assert!(!heuristics::looks_like_generic_backlog_creation_request(
            "既存 story ID: abc にタスクを追加してください"
        ));
    }

    #[test]
    fn product_context_document_is_detected_from_project_context_block() {
        assert!(heuristics::has_product_context_document(
            "\n【プロジェクト既存ドキュメントコンテキスト】\n--- PRODUCT_CONTEXT.md ---\n# sample"
        ));
        assert!(!heuristics::has_product_context_document(
            "\n【現在のバックログ】\nstory-1: 既存ストーリー"
        ));
    }

    #[test]
    fn backlog_counts_reply_reports_actual_deltas() {
        let response = heuristics::build_backlog_counts_reply(
            "部分成功".to_string(),
            ProjectBacklogCounts {
                stories: 2,
                tasks: 5,
                dependencies: 1,
            },
            ProjectBacklogCounts {
                stories: 3,
                tasks: 8,
                dependencies: 4,
            },
        )
        .expect("reply should exist when backlog changes");

        assert!(response.reply.contains("部分成功"));
        assert!(response.reply.contains("stories +1"));
        assert!(response.reply.contains("tasks +3"));
        assert!(response.reply.contains("dependencies +3"));
        assert!(!response.focus_missing);
    }

    #[test]
    fn transient_provider_unavailable_detects_gemini_503() {
        let error = "Gemini error: CompletionError: HttpError: Invalid status code 503 Service Unavailable with message: {\"error\":{\"status\":\"UNAVAILABLE\",\"message\":\"high demand\"}}";
        assert!(heuristics::is_transient_provider_unavailable(error));
    }

    #[test]
    fn provider_unavailable_reply_mentions_no_creation_for_mutation() {
        let response = heuristics::build_team_leader_provider_unavailable_reply(
            "Gemini error: 503 Service Unavailable",
            true,
        );

        assert!(response
            .reply
            .contains("今回はバックログを作成していません"));
        assert!(response.reply.contains("503 Service Unavailable"));
        assert!(!response.focus_missing);
    }

    #[test]
    fn po_assistant_prompts_share_quality_gates() {
        let api_prompt = prompts::build_po_assistant_api_system_prompt("context", None);
        let cli_prompt =
            prompts::build_po_assistant_cli_prompt("context", "history", "依頼", None);

        assert!(api_prompt.contains("【完了条件】"));
        assert!(cli_prompt.contains("【完了条件】"));
        assert!(api_prompt.contains("【自己検証】"));
        assert!(cli_prompt.contains("【自己検証】"));
        assert!(api_prompt.contains("PBI"));
        assert!(cli_prompt.contains("PBI"));
        assert!(api_prompt.contains("自然な日本語"));
        assert!(cli_prompt.contains("やること:"));
        assert!(cli_prompt.contains("検証観点:"));
    }

    #[test]
    fn contextual_backlog_prompt_requires_self_check() {
        let prompt = prompts::build_contextual_backlog_generation_system_prompt(
            "--- PRODUCT_CONTEXT.md ---",
        );

        assert!(prompt.contains("完了条件"));
        assert!(prompt.contains("自己検証"));
        assert!(prompt.contains("operations"));
        assert!(prompt.contains("自然な日本語"));
        assert!(prompt.contains("やること:"));
        assert!(prompt.contains("完了状態:"));
    }

    #[test]
    fn task_focus_block_requires_markdown_proposal_format() {
        let block = build_task_focus_block(&FocusedTaskContextRow {
            id: "task-1".to_string(),
            sequence_number: 12,
            title: "ログイン画面のバリデーション".to_string(),
            description: Some("現状の説明".to_string()),
            status: "To Do".to_string(),
            priority: 2,
            story_id: "story-1".to_string(),
            story_sequence_number: 7,
            story_title: "ログイン導線を改善する".to_string(),
            acceptance_criteria: Some("AC".to_string()),
        });

        assert!(block.contains("## 提案"));
        assert!(block.contains("### タイトル案"));
        assert!(block.contains("### 説明案"));
        assert!(block.contains("### 優先度案"));
        assert!(block.contains("Task-12"));
    }

    #[test]
    fn story_focus_block_forbids_proposal_format() {
        let block = build_story_focus_block(
            &FocusedStoryContextRow {
                id: "story-1".to_string(),
                sequence_number: 3,
                title: "認証改善".to_string(),
                description: Some("PBI の説明".to_string()),
                status: "Ready".to_string(),
                priority: 2,
            },
            &[FocusedStoryTaskRow {
                sequence_number: 9,
                title: "ログイン API を確認".to_string(),
                status: "To Do".to_string(),
            }],
        );

        assert!(block.contains("いかなる場合も `## 提案`"));
        assert!(block.contains("Task-9"));
        assert!(block.contains("テキストによるアドバイス"));
    }

    #[test]
    fn focus_prompts_switch_to_non_mutating_mode() {
        let api_prompt = prompts::build_po_assistant_api_system_prompt(
            "context",
            Some("FOCUS_BLOCK"),
        );
        let cli_prompt = prompts::build_po_assistant_cli_prompt(
            "context",
            "history",
            "依頼",
            Some("FOCUS_BLOCK"),
        );

        assert!(api_prompt.contains("DB を更新してはいけません"));
        assert!(api_prompt.contains("FOCUS_BLOCK"));
        assert!(cli_prompt.contains("`operations` と `actions` は必ず空配列"));
        assert!(cli_prompt.contains("FOCUS_BLOCK"));
    }

    #[test]
    fn task_focus_api_system_prompt_matches_snapshot() {
        let task_focus_block = build_task_focus_block(&FocusedTaskContextRow {
            id: "task-1".to_string(),
            sequence_number: 12,
            title: "ログイン画面のバリデーション".to_string(),
            description: Some("現状の説明".to_string()),
            status: "To Do".to_string(),
            priority: 2,
            story_id: "story-1".to_string(),
            story_sequence_number: 7,
            story_title: "ログイン導線を改善する".to_string(),
            acceptance_criteria: Some("AC".to_string()),
        });
        let prompt = prompts::build_po_assistant_api_system_prompt("context", Some(&task_focus_block));
        let expected =
            include_str!("snapshots/po_assistant_api_task_focus_prompt.txt");

        assert_eq!(normalize_snapshot(&prompt), normalize_snapshot(expected));
    }

    #[test]
    fn story_focus_api_system_prompt_matches_snapshot() {
        let story_focus_block = build_story_focus_block(
            &FocusedStoryContextRow {
                id: "story-1".to_string(),
                sequence_number: 3,
                title: "認証改善".to_string(),
                description: Some("PBI の説明".to_string()),
                status: "Ready".to_string(),
                priority: 2,
            },
            &[FocusedStoryTaskRow {
                sequence_number: 9,
                title: "ログイン API を確認".to_string(),
                status: "To Do".to_string(),
            }],
        );
        let prompt =
            prompts::build_po_assistant_api_system_prompt("context", Some(&story_focus_block));
        let expected =
            include_str!("snapshots/po_assistant_api_story_focus_prompt.txt");

        assert_eq!(normalize_snapshot(&prompt), normalize_snapshot(expected));
    }
}
