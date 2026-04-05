use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneratedTask {
    pub title: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoryDraft {
    pub title: String,
    pub description: String,
    pub acceptance_criteria: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RefinedIdeaResponse {
    pub reply: String,
    pub story_draft: StoryDraft,
}

// generated_document を廃止し patch_target + patch_content 方式に移行
// フロントエンドは patch_target に指定されたファイルへ patch_content を書き込む
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatInceptionResponse {
    pub reply: String,
    pub is_finished: bool,
    pub patch_target: Option<String>,  // 書き込み先ファイル名 (e.g. "PRODUCT_CONTEXT.md")
    pub patch_content: Option<String>, // 書き込む内容（そのフェーズの差分のみ）
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatTaskResponse {
    pub reply: String,
}

#[tauri::command]
pub async fn generate_tasks_from_story(
    app: AppHandle,
    title: String,
    description: String,
    acceptance_criteria: String,
    provider: String,
    project_id: String,
) -> Result<Vec<GeneratedTask>, String> {
    let (provider_enum, api_key, model) = crate::rig_provider::resolve_provider_and_key(&app, Some(provider)).await?;
    let _context_md = crate::db::build_project_context(&app, &project_id).await.unwrap_or_default();
    let prompt = format!("Context: {}\nStory: {}\nDesc: {}\nAC: {}\nJSON Array Output Please.", _context_md, title, description, acceptance_criteria);

    let system_prompt = "You are a task decomposition expert. Generate a JSON array of tasks.";
    let response = crate::rig_provider::chat_with_history(
        &provider_enum,
        &api_key,
        &model,
        system_prompt,
        &prompt,
        vec![],
    )
    .await?;

    let re = regex::Regex::new(r"(?s)\[.*?\]").map_err(|e| e.to_string())?;
    let json_str = re.captures(&response).and_then(|caps| caps.get(0)).map_or(response.as_str(), |m| m.as_str());
    serde_json::from_str(json_str).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn refine_idea(
    app: AppHandle,
    idea_seed: String,
    previous_context: Option<Vec<Message>>,
    project_id: String,
) -> Result<RefinedIdeaResponse, String> {
    let (provider, api_key, model) = crate::rig_provider::resolve_provider_and_key(&app, None).await?;
    let _context_md = crate::db::build_project_context(&app, &project_id).await.unwrap_or_default();

    let chat_history = if let Some(ctx) = previous_context {
        crate::rig_provider::convert_messages(&ctx)
    } else {
        vec![]
    };

    let system_prompt = "PO Assist";
    let content = crate::rig_provider::chat_with_history(
        &provider,
        &api_key,
        &model,
        system_prompt,
        &idea_seed,
        chat_history,
    )
    .await?;

    let re = regex::Regex::new(r"(?s)\{.*?\}").unwrap();
    let json_str = re.captures(&content).and_then(|caps| caps.get(0)).map_or(content.as_str(), |m| m.as_str());
    serde_json::from_str(json_str).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Inception Deck システムプロンプト構築
// 各フェーズで「何をヒアリングし、どのファイルの差分を生成するか」を定義する
// ---------------------------------------------------------------------------
fn build_inception_system_prompt(phase: u32, context_md: &str) -> String {
    let phase_instruction = match phase {
        1 => r#"## Phase 1: コア価値とターゲット (Why)

**ヒアリング目標** (2〜3往復で引き出す):
- 解決したい課題 / ターゲットユーザー / コアバリュー / プロダクトの目的

**生成ファイル**: patch_target = "PRODUCT_CONTEXT.md" (新規作成)
**出力テンプレート** — 箇条書き・20行以内で厳守:
```
# PRODUCT_CONTEXT.md — {プロダクト名}
> 【AIへの絶対指示】本ファイルはシステムプロンプトとして機能する。

## 0. 課題とコアバリュー
- 課題: {1行}
- 解決策: {1行}

## 1. プロダクト定義
- 対象: {ターゲット}
- 目標: {目標}

## 2. 役割分担
- 人間(PO): What の意思決定のみ
- AI: How の実行（タスク分解・実装・改善）
```"#,

        2 => r#"## Phase 2: やらないことリスト (Not List)

**ヒアリング目標** (2〜3往復):
- スコープ外にすること / 絶対やってはならないこと

**生成ファイル**: patch_target = "PRODUCT_CONTEXT.md" (末尾に追記)
**追記テンプレート** — Section 3〜5のみ・15行以内:
```
## 3. 運用ルール
- {スプリント方針を1行}

## 4. やらないこと (Not To Do)
- {項目1}
- {項目2}

## 5. コンテキスト管理
- Layer 1 (本ファイル + Rule.md): 不変のコア原則
- Layer 2 (handoff.md): スプリントごとの揮発性コンテキスト
```"#,

        3 => r#"## Phase 3: 技術スタック・アーキテクチャ (What)

**ヒアリング目標** (2〜3往復):
- 言語 / FW / DB / アーキテクチャ上の制約

**生成ファイル**: patch_target = "ARCHITECTURE.md" (新規作成)
**出力テンプレート** — 全体20行以内・箇条書きのみ:
```
# ARCHITECTURE.md — {プロダクト名}
> 技術水準と設計方針のまとめ

## 技術スタック
- 言語: {選定}
- FW: {選定}
- DB: {選定}

## アーキテクチャ方針
- {方針1}
- {方針2}

## 設計の制約
- {注意点}
```"#,

        4 => r#"## Phase 4: 開発ルール・AIルール (How)

**ヒアリング目標** (1〜2往復):
- このプロダクト固有のコーディング規約 / AIへの特別指示

**生成ファイル**: patch_target = "Rule.md" (末尾に追記)
**追記テンプレート** — 既存内容は絶対に含めない・15行以内:
```
---
## {プロダクト名} 固有ルール

### 技術スタック固有の規約
- {規約1}

### AIへの追加指示
- {追加ルール1}
```"#,

        _ => "全フェーズ完了。ユーザーにお祝いの言葉を伝えてください。",
    };

    // 既存ドキュメントは先頭400文字のみを参考情報として渡す（転記禁止）
    let existing_docs = if context_md.is_empty() {
        "（生成済みドキュメントなし）".to_string()
    } else {
        let preview: String = context_md.chars().take(400).collect();
        let suffix = if context_md.chars().count() > 400 { "...(省略)" } else { "" };
        format!("【既存ドキュメント概要（参考のみ・このフェーズ以外の内容を再出力しないこと）】\n{}{}", preview, suffix)
    };

    format!(
        r#"あなたは「Inception Deckファシリテーター」です。

## 役割
ユーザーのプロダクト構想をヒアリングし、Markdownドキュメントとして策定することが唯一の仕事。

## 絶対禁止
- コード・実装手順の提案（例: Pythonコード、コマンド等）
- 「作り方」を教えること（あなたは企画コンサルであり、エンジニアではない）
- 他フェーズで生成済みのドキュメント内容を patch_content に含めること

## 出力品質規約（厳守）
- **箇条書きのみ** — 長文解説・説明・挨拶は不要
- **1項目1行** — 無駄な装飾を省く
- **patch_content は20行以内** — トークン節約が最優先
- **reply は1文のみ** — 例:「PRODUCT_CONTEXT.md を生成しました」

{phase_instruction}

{existing_docs}

## 出力フォーマット（必ずこの形式のJSONのみを返すこと）

ヒアリング中:
{{"reply": "質問（1文）", "is_finished": false, "patch_target": null, "patch_content": null}}

ドキュメント生成時:
{{"reply": "〜を生成しました。", "is_finished": true, "patch_target": "ファイル名.md", "patch_content": "Markdownの差分（20行以内）"}}

patch_content にはこのフェーズで追加する部分のみを含め、他フェーズの内容は絶対に含めないこと。"#,
        phase_instruction = phase_instruction,
        existing_docs = existing_docs,
    )
}

#[tauri::command]
pub async fn chat_inception(
    app: AppHandle,
    project_id: String,
    phase: u32,
    messages_history: Vec<Message>,
) -> Result<ChatInceptionResponse, String> {
    let (provider, api_key, model) = crate::rig_provider::resolve_provider_and_key(&app, None).await?;
    let context_md = crate::db::build_project_context(&app, &project_id).await.unwrap_or_default();

    let chat_history = crate::rig_provider::convert_messages(&messages_history);
    let system_prompt = build_inception_system_prompt(phase, &context_md);

    let content = crate::rig_provider::chat_with_history(
        &provider,
        &api_key,
        &model,
        &system_prompt,
        "",
        chat_history,
    )
    .await?;

    // Markdownコードフェンス (```json ... ```) を除去してからパース
    let stripped = {
        let fence_re = regex::Regex::new(r"(?s)```(?:json)?\s*\n?(.*?)\n?\s*```").unwrap();
        if let Some(caps) = fence_re.captures(&content) {
            caps.get(1).unwrap().as_str().to_string()
        } else {
            content.clone()
        }
    };

    // Greedy match でネストした JSON を正確に抽出
    let re = regex::Regex::new(r"(?s)\{.*\}").unwrap();
    let json_str = if let Some(caps) = re.captures(&stripped) {
        caps.get(0).unwrap().as_str()
    } else {
        &stripped
    };

    let resp: ChatInceptionResponse = match serde_json::from_str(json_str) {
        Ok(r) => r,
        Err(_) => ChatInceptionResponse {
            reply: content,
            is_finished: false,
            patch_target: None,
            patch_content: None,
        },
    };

    Ok(resp)
}

#[tauri::command]
pub async fn chat_with_team_leader(
    app: AppHandle,
    project_id: String,
    messages_history: Vec<Message>,
) -> Result<ChatTaskResponse, String> {
    let (provider, api_key, model) = crate::rig_provider::resolve_provider_and_key(&app, None).await?;
    let _context_md = crate::db::build_project_context(&app, &project_id).await.unwrap_or_default();

    let chat_history = crate::rig_provider::convert_messages(&messages_history);
    let system_prompt = format!(
        "あなたはScrum TeamのAI Team Leaderです。ユーザーから機能要件や追加タスクの要望があった場合、自身が持つツール (`create_story_and_tasks`) を呼び出して、ストーリーとサブタスク群をデータベースに自動登録してください。\n\n【現在のプロダクトの状況（既存バックログ等）】\n{}\n\n【重要】ツール実行に失敗した場合は、エラー内容を確認して原因をユーザーに報告、または代替策を考えてください。ツールが失敗したからといって、決してユーザーに手動での登録作業を丸投げしないでください。\n\n会話の返答は必ず以下の形式のJSONオブジェクトのみで返してください。\n\n{{\"reply\": \"ツール実行結果やユーザーへのメッセージ内容\"}}",
        _context_md
    );

    let raw_text = crate::rig_provider::chat_team_leader_with_tools(
        &app,
        &provider,
        &api_key,
        &model,
        &system_prompt,
        "",
        chat_history,
        &project_id,
    )
    .await?;

    let re = regex::Regex::new(r"(?s)\{.*?\}").unwrap();
    let json_str = if let Some(caps) = re.captures(&raw_text) {
        caps.get(0).unwrap().as_str()
    } else {
        &raw_text
    };

    let resp: ChatTaskResponse = match serde_json::from_str(json_str) {
        Ok(r) => r,
        Err(_) => ChatTaskResponse {
            reply: raw_text,
        },
    };

    Ok(resp)
}
