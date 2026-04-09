use rig::agent::Agent;
use rig::client::CompletionClient;
use rig::completion::message::Message as RigMessage;
use rig::completion::Prompt;
use rig::providers::anthropic;
use rig::providers::anthropic::completion::CompletionModel as AnthropicModel;
use rig::providers::gemini;
use rig::providers::gemini::completion::CompletionModel as GeminiModel;
use serde::Serialize;
use serde_json::json;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, PartialEq)]
pub enum AiProvider {
    Anthropic,
    Gemini,
}

impl AiProvider {
    pub fn from_str(s: &str) -> Self {
        match s {
            "gemini" => AiProvider::Gemini,
            _ => AiProvider::Anthropic,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ApiKeyStatus {
    pub name: String,
    pub display_name: String,
    pub configured: bool,
}

fn extract_store_string_value(value: serde_json::Value) -> Option<String> {
    if let Some(obj) = value.as_object() {
        obj.get("value")
            .and_then(|inner| inner.as_str())
            .map(|inner| inner.to_string())
    } else {
        value.as_str().map(|inner| inner.to_string())
    }
}

fn has_configured_store_value(value: Option<serde_json::Value>) -> bool {
    value.and_then(extract_store_string_value)
        .map(|inner| !inner.trim().is_empty())
        .unwrap_or(false)
}

/// Resolve the AI provider and API key from the Tauri store.
pub async fn resolve_provider_and_key(
    app: &AppHandle,
    provider_override: Option<String>,
) -> Result<(AiProvider, String, String), String> {
    let store = app
        .store("settings.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let provider = match provider_override {
        Some(p) => AiProvider::from_str(&p),
        None => match store.get("default-ai-provider") {
            Some(val) => {
                let s = if let Some(obj) = val.as_object() {
                    obj.get("value")
                        .and_then(|v| v.as_str())
                        .unwrap_or("anthropic")
                } else if let Some(s) = val.as_str() {
                    s
                } else {
                    "anthropic"
                };
                AiProvider::from_str(s)
            }
            None => AiProvider::Anthropic,
        },
    };

    let (key_name, model_key_name, default_model) = match provider {
        AiProvider::Gemini => ("gemini-api-key", "gemini-model", "gemini-2.0-flash"),
        AiProvider::Anthropic => (
            "anthropic-api-key",
            "anthropic-model",
            "claude-haiku-4-5-20251001",
        ),
    };

    let api_key = match store.get(key_name) {
        Some(val) => {
            if let Some(obj) = val.as_object() {
                obj.get("value")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .ok_or_else(|| format!("{} format mismatch", key_name))?
            } else if let Some(s) = val.as_str() {
                s.to_string()
            } else {
                return Err(format!("{} format mismatch", key_name));
            }
        }
        None => return Err(format!("{} is not set", key_name)),
    };

    let model = match store.get(model_key_name) {
        Some(val) => {
            if let Some(obj) = val.as_object() {
                obj.get("value")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .unwrap_or(default_model)
                    .to_string()
            } else if let Some(s) = val.as_str() {
                if s.is_empty() {
                    default_model.to_string()
                } else {
                    s.to_string()
                }
            } else {
                default_model.to_string()
            }
        }
        None => default_model.to_string(),
    };

    Ok((provider, api_key, model))
}

/// Convert the app's Message type to Rig's Message type.
pub fn convert_messages(messages: &[crate::ai::Message]) -> Vec<RigMessage> {
    messages
        .iter()
        .map(|m| match m.role.as_str() {
            "user" => RigMessage::user(&m.content),
            "assistant" => RigMessage::assistant(&m.content),
            "system" => RigMessage::system(&m.content),
            _ => RigMessage::user(&m.content),
        })
        .collect()
}

#[derive(Debug, Clone)]
pub struct LlmTextResponse {
    pub content: String,
    pub provider: String,
    pub model: String,
    pub usage: crate::llm_observability::NormalizedUsage,
    pub raw_usage_json: serde_json::Value,
    pub started_at: i64,
    pub completed_at: i64,
}

fn current_timestamp_millis() -> Result<i64, String> {
    Ok(std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64)
}

async fn chat_anthropic(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_input: &str,
    mut chat_history: Vec<RigMessage>,
) -> Result<LlmTextResponse, String> {
    let started_at = current_timestamp_millis()?;
    let client = anthropic::Client::new(api_key)
        .map_err(|e| format!("Failed to create Anthropic client: {}", e))?;
    let agent: Agent<AnthropicModel> = client
        .agent(model)
        .preamble(system_prompt)
        .max_tokens(4096)
        .build();
    let response = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        agent
            .prompt(user_input)
            .with_history(&mut chat_history)
            .extended_details(),
    )
    .await
    .map_err(|_| "Anthropic API timed out after 60 seconds".to_string())?
    .map_err(|e| format!("Anthropic error: {}", e))?;
    let completed_at = current_timestamp_millis()?;
    let usage = crate::llm_observability::NormalizedUsage::from(response.usage);

    Ok(LlmTextResponse {
        content: response.output,
        provider: "anthropic".to_string(),
        model: model.to_string(),
        usage,
        raw_usage_json: json!({
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "total_tokens": usage.total_tokens,
            "cached_input_tokens": usage.cached_input_tokens,
        }),
        started_at,
        completed_at,
    })
}

async fn chat_gemini(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_input: &str,
    mut chat_history: Vec<RigMessage>,
) -> Result<LlmTextResponse, String> {
    let started_at = current_timestamp_millis()?;
    let client = gemini::Client::new(api_key)
        .map_err(|e| format!("Failed to create Gemini client: {}", e))?;
    let agent: Agent<GeminiModel> = client
        .agent(model)
        .preamble(system_prompt)
        .max_tokens(4096)
        .build();
    let response = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        agent
            .prompt(user_input)
            .with_history(&mut chat_history)
            .extended_details(),
    )
    .await
    .map_err(|_| "Gemini API timed out after 60 seconds".to_string())?
    .map_err(|e| format!("Gemini error: {}", e))?;
    let completed_at = current_timestamp_millis()?;
    let usage = crate::llm_observability::NormalizedUsage::from(response.usage);

    Ok(LlmTextResponse {
        content: response.output,
        provider: "gemini".to_string(),
        model: model.to_string(),
        usage,
        raw_usage_json: json!({
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "total_tokens": usage.total_tokens,
            "cached_input_tokens": usage.cached_input_tokens,
        }),
        started_at,
        completed_at,
    })
}

/// Send a prompt with conversation history via Rig and return the raw text response.
/// For single-turn prompts, pass an empty Vec for `chat_history`.
pub async fn chat_with_history(
    provider: &AiProvider,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_input: &str,
    chat_history: Vec<RigMessage>,
) -> Result<LlmTextResponse, String> {
    match provider {
        AiProvider::Anthropic => {
            chat_anthropic(api_key, model, system_prompt, user_input, chat_history).await
        }
        AiProvider::Gemini => {
            chat_gemini(api_key, model, system_prompt, user_input, chat_history).await
        }
    }
}

pub async fn chat_team_leader_with_tools(
    app: &AppHandle,
    provider: &AiProvider,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_input: &str,
    mut chat_history: Vec<RigMessage>,
    project_id: &str,
) -> Result<LlmTextResponse, String> {
    let tool = crate::ai_tools::CreateStoryAndTasksTool {
        app: app.clone(),
        project_id: project_id.to_string(),
    };

    match provider {
        AiProvider::Anthropic => {
            let started_at = current_timestamp_millis()?;
            let client = anthropic::Client::new(api_key)
                .map_err(|e| format!("Failed to create Anthropic client: {}", e))?;
            let agent = client
                .agent(model)
                .preamble(system_prompt)
                .max_tokens(4096)
                .tool(tool)
                .default_max_turns(5)
                .build();
            let response = tokio::time::timeout(
                std::time::Duration::from_secs(60),
                agent
                    .prompt(user_input)
                    .with_history(&mut chat_history)
                    .max_turns(5)
                    .extended_details(),
            )
            .await
            .map_err(|_| "Anthropic API timed out after 60 seconds".to_string())?
            .map_err(|e| format!("Anthropic error: {}", e))?;
            let completed_at = current_timestamp_millis()?;
            let usage = crate::llm_observability::NormalizedUsage::from(response.usage);
            let message_count = response.messages.as_ref().map(|messages| messages.len());

            Ok(LlmTextResponse {
                content: response.output,
                provider: "anthropic".to_string(),
                model: model.to_string(),
                usage,
                raw_usage_json: json!({
                    "input_tokens": usage.input_tokens,
                    "output_tokens": usage.output_tokens,
                    "total_tokens": usage.total_tokens,
                    "cached_input_tokens": usage.cached_input_tokens,
                    "messages_count": message_count
                }),
                started_at,
                completed_at,
            })
        }
        AiProvider::Gemini => {
            let started_at = current_timestamp_millis()?;
            let client = gemini::Client::new(api_key)
                .map_err(|e| format!("Failed to create Gemini client: {}", e))?;
            let agent = client
                .agent(model)
                .preamble(system_prompt)
                .max_tokens(4096)
                .tool(tool)
                .default_max_turns(5)
                .build();
            let response = tokio::time::timeout(
                std::time::Duration::from_secs(60),
                agent
                    .prompt(user_input)
                    .with_history(&mut chat_history)
                    .max_turns(5)
                    .extended_details(),
            )
            .await
            .map_err(|_| "Gemini API timed out after 60 seconds".to_string())?
            .map_err(|e| format!("Gemini error: {}", e))?;
            let completed_at = current_timestamp_millis()?;
            let usage = crate::llm_observability::NormalizedUsage::from(response.usage);
            let message_count = response.messages.as_ref().map(|messages| messages.len());

            Ok(LlmTextResponse {
                content: response.output,
                provider: "gemini".to_string(),
                model: model.to_string(),
                usage,
                raw_usage_json: json!({
                    "input_tokens": usage.input_tokens,
                    "output_tokens": usage.output_tokens,
                    "total_tokens": usage.total_tokens,
                    "cached_input_tokens": usage.cached_input_tokens,
                    "messages_count": message_count
                }),
                started_at,
                completed_at,
            })
        }
    }
}

#[tauri::command]
pub async fn get_available_models(
    app: tauri::AppHandle,
    provider: String,
) -> Result<Vec<String>, String> {
    use tauri_plugin_store::StoreExt;
    let store = app
        .store("settings.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    if provider.to_lowercase() == "gemini" {
        let api_key = match store.get("gemini-api-key") {
            Some(val) => {
                if let Some(obj) = val.as_object() {
                    obj.get("value")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                } else {
                    val.as_str().map(|s| s.to_string())
                }
            }
            None => None,
        }
        .ok_or("Gemini API key is not set")?;

        let client = reqwest::Client::new();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={}",
            api_key
        );
        let res = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;

        let mut models = vec![];
        if let Some(data) = json.get("models").and_then(|v| v.as_array()) {
            for m in data {
                if let Some(name) = m.get("name").and_then(|v| v.as_str()) {
                    let display_name = name.strip_prefix("models/").unwrap_or(name);
                    models.push(display_name.to_string());
                }
            }
        } else {
            return Err("Invalid response format from Gemini API".into());
        }

        Ok(models)
    } else {
        let api_key = match store.get("anthropic-api-key") {
            Some(val) => {
                if let Some(obj) = val.as_object() {
                    obj.get("value")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                } else {
                    val.as_str().map(|s| s.to_string())
                }
            }
            None => None,
        }
        .ok_or("Anthropic API key is not set")?;

        let client = reqwest::Client::new();
        let res = client
            .get("https://api.anthropic.com/v1/models")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;

        let mut models = vec![];
        if let Some(data) = json.get("data").and_then(|v| v.as_array()) {
            for m in data {
                if let Some(id) = m.get("id").and_then(|v| v.as_str()) {
                    models.push(id.to_string());
                }
            }
        } else if json.get("type").and_then(|v| v.as_str()) == Some("error") {
            if let Some(msg) = json
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
            {
                return Err(format!("Anthropic API error: {}", msg));
            }
        }

        Ok(models)
    }
}

#[tauri::command]
pub async fn check_api_key_status(app: tauri::AppHandle) -> Result<Vec<ApiKeyStatus>, String> {
    let store = app
        .store("settings.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    Ok(vec![
        ApiKeyStatus {
            name: "anthropic".to_string(),
            display_name: "Anthropic".to_string(),
            configured: has_configured_store_value(store.get("anthropic-api-key")),
        },
        ApiKeyStatus {
            name: "gemini".to_string(),
            display_name: "Gemini".to_string(),
            configured: has_configured_store_value(store.get("gemini-api-key")),
        },
    ])
}

#[cfg(test)]
mod tests {
    use super::{extract_store_string_value, has_configured_store_value};
    use serde_json::json;

    #[test]
    fn extract_store_string_value_reads_wrapped_value() {
        let result = extract_store_string_value(json!({ "value": "secret" }));
        assert_eq!(result.as_deref(), Some("secret"));
    }

    #[test]
    fn has_configured_store_value_rejects_blank_values() {
        assert!(!has_configured_store_value(Some(json!({ "value": "   " }))));
        assert!(!has_configured_store_value(Some(json!(""))));
        assert!(has_configured_store_value(Some(json!("configured"))));
    }
}
