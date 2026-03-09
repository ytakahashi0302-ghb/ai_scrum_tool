use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};
use serde_json::Value as JsonValue;
use sqlx::sqlite::SqliteRow;

// Define shared types
#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub rows_affected: u64,
    pub last_insert_id: i64,
}

// Model types
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Story {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub status: String,
    pub sprint_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub story_id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub sprint_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Sprint {
    pub id: String,
    pub project_id: String,
    pub started_at: i64,
    pub completed_at: i64,
    pub duration_ms: i64,
}

const DB_STRING: &str = "sqlite:ai-scrum.db";

pub async fn execute_query(app: &AppHandle, query: &str, values: Vec<JsonValue>) -> Result<QueryResult, String> {
    let instances = app.state::<DbInstances>();
    let db_instances = instances.0.read().await;
    let wrapper = db_instances.get(DB_STRING).ok_or("Database instance not found")?;
    
    #[allow(unreachable_patterns)]
    let pool = match wrapper {
        DbPool::Sqlite(p) => p,
        _ => return Err("Not an sqlite database".to_string()),
    };
    
    let mut q = sqlx::query(query);
    for v in values {
        if let Some(s) = v.as_str() {
            q = q.bind(s.to_string());
        } else if let Some(n) = v.as_i64() {
             q = q.bind(n);
        } else if v.is_null() {
            q = q.bind(Option::<String>::None);
        } else {
            q = q.bind(v.to_string());
        }
    }

    match q.execute(pool).await {
        Ok(result) => Ok(QueryResult {
            rows_affected: result.rows_affected(),
            last_insert_id: result.last_insert_rowid(),
        }),
        Err(e) => Err(e.to_string()),
    }
}

pub async fn select_query<T>(app: &AppHandle, query: &str, values: Vec<JsonValue>) -> Result<Vec<T>, String> 
where 
    T: for<'r> sqlx::FromRow<'r, SqliteRow> + Send + Unpin 
{
    let instances = app.state::<DbInstances>();
    let db_instances = instances.0.read().await;
    let wrapper = db_instances.get(DB_STRING).ok_or("Database instance not found")?;
    
    #[allow(unreachable_patterns)]
    let pool = match wrapper {
        DbPool::Sqlite(p) => p,
        _ => return Err("Not an sqlite database".to_string()),
    };

    let mut q = sqlx::query_as::<_, T>(query);
    for v in values {
        if let Some(s) = v.as_str() {
            q = q.bind(s.to_string());
        } else if let Some(n) = v.as_i64() {
             q = q.bind(n);
        } else if v.is_null() {
            q = q.bind(Option::<String>::None);
        } else {
            q = q.bind(v.to_string());
        }
    }

    match q.fetch_all(pool).await {
        Ok(result) => Ok(result),
        Err(e) => Err(e.to_string()),
    }
}

// ------------------------------------------------------------------------------------------------
// Projects CRUD
// ------------------------------------------------------------------------------------------------

#[tauri::command]
pub async fn get_projects(app: AppHandle) -> Result<Vec<Project>, String> {
    let query = "SELECT * FROM projects ORDER BY created_at ASC";
    select_query::<Project>(&app, query, vec![]).await
}

#[tauri::command]
pub async fn create_project(app: AppHandle, id: String, name: String, description: Option<String>) -> Result<QueryResult, String> {
    let query = "INSERT INTO projects (id, name, description) VALUES (?, ?, ?)";
    let values = vec![
        serde_json::to_value(id).unwrap(),
        serde_json::to_value(name).unwrap(),
        serde_json::to_value(description).unwrap(),
    ];
    execute_query(&app, query, values).await
}

#[tauri::command]
pub async fn update_project(app: AppHandle, id: String, name: String, description: Option<String>) -> Result<QueryResult, String> {
    let query = "UPDATE projects SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    let values = vec![
        serde_json::to_value(name).unwrap(),
        serde_json::to_value(description).unwrap(),
        serde_json::to_value(id).unwrap(),
    ];
    execute_query(&app, query, values).await
}

#[tauri::command]
pub async fn delete_project(app: AppHandle, id: String) -> Result<QueryResult, String> {
    let query = "DELETE FROM projects WHERE id = ?";
    let values = vec![serde_json::to_value(id).unwrap()];
    execute_query(&app, query, values).await
}

// ------------------------------------------------------------------------------------------------
// Stories CRUD
// ------------------------------------------------------------------------------------------------

#[tauri::command]
pub async fn get_stories(app: AppHandle, project_id: String) -> Result<Vec<Story>, String> {
    let query = "SELECT * FROM stories WHERE sprint_id IS NULL AND project_id = ? ORDER BY created_at DESC";
    let values = vec![serde_json::to_value(project_id).unwrap()];
    let stories = select_query::<Story>(&app, query, values).await?;
    println!("Fetched stories: {:?}", stories);
    Ok(stories)
}

#[tauri::command]
pub async fn get_archived_stories(app: AppHandle, project_id: String) -> Result<Vec<Story>, String> {
    let query = "SELECT * FROM stories WHERE sprint_id IS NOT NULL AND project_id = ?";
    let values = vec![serde_json::to_value(project_id).unwrap()];
    select_query::<Story>(&app, query, values).await
}

#[tauri::command]
pub async fn add_story(app: AppHandle, id: String, project_id: String, title: String, description: Option<String>, acceptance_criteria: Option<String>, status: String) -> Result<QueryResult, String> {
    let query = "INSERT INTO stories (id, project_id, title, description, acceptance_criteria, status) VALUES (?, ?, ?, ?, ?, ?)";
    let values = vec![
        serde_json::to_value(id).unwrap(),
        serde_json::to_value(project_id).unwrap(),
        serde_json::to_value(title).unwrap(),
        serde_json::to_value(description).unwrap(),
        serde_json::to_value(acceptance_criteria).unwrap(),
        serde_json::to_value(status).unwrap(),
    ];
    execute_query(&app, query, values).await
}

#[tauri::command]
pub async fn update_story(app: AppHandle, id: String, title: String, description: Option<String>, acceptance_criteria: Option<String>, status: String) -> Result<QueryResult, String> {
    let query = "UPDATE stories SET title = ?, description = ?, acceptance_criteria = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    let values = vec![
        serde_json::to_value(title).unwrap(),
        serde_json::to_value(description).unwrap(),
        serde_json::to_value(acceptance_criteria).unwrap(),
        serde_json::to_value(status).unwrap(),
        serde_json::to_value(id).unwrap(),
    ];
    execute_query(&app, query, values).await
}

#[tauri::command]
pub async fn delete_story(app: AppHandle, id: String) -> Result<QueryResult, String> {
    let query = "DELETE FROM stories WHERE id = ?";
    let values = vec![serde_json::to_value(id).unwrap()];
    execute_query(&app, query, values).await
}

// ------------------------------------------------------------------------------------------------
// Tasks CRUD
// ------------------------------------------------------------------------------------------------

#[tauri::command]
pub async fn get_tasks(app: AppHandle, project_id: String) -> Result<Vec<Task>, String> {
    let query = "SELECT * FROM tasks WHERE sprint_id IS NULL AND project_id = ? ORDER BY created_at ASC";
    let values = vec![serde_json::to_value(project_id).unwrap()];
    let tasks = select_query::<Task>(&app, query, values).await?;
    println!("Fetched tasks: {:?}", tasks);
    Ok(tasks)
}

#[tauri::command]
pub async fn get_archived_tasks(app: AppHandle, project_id: String) -> Result<Vec<Task>, String> {
    let query = "SELECT * FROM tasks WHERE sprint_id IS NOT NULL AND project_id = ?";
    let values = vec![serde_json::to_value(project_id).unwrap()];
    select_query::<Task>(&app, query, values).await
}

#[tauri::command]
pub async fn get_tasks_by_story_id(app: AppHandle, story_id: String, project_id: String) -> Result<Vec<Task>, String> {
    let query = "SELECT * FROM tasks WHERE story_id = ? AND sprint_id IS NULL AND project_id = ? ORDER BY created_at ASC";
    let values = vec![
        serde_json::to_value(story_id).unwrap(),
        serde_json::to_value(project_id).unwrap(),
    ];
    select_query::<Task>(&app, query, values).await
}

#[tauri::command]
pub async fn add_task(app: AppHandle, id: String, project_id: String, story_id: String, title: String, description: Option<String>, status: String) -> Result<QueryResult, String> {
    let query = "INSERT INTO tasks (id, project_id, story_id, title, description, status) VALUES (?, ?, ?, ?, ?, ?)";
    let values = vec![
        serde_json::to_value(id).unwrap(),
        serde_json::to_value(project_id).unwrap(),
        serde_json::to_value(story_id).unwrap(),
        serde_json::to_value(title).unwrap(),
        serde_json::to_value(description).unwrap(),
        serde_json::to_value(status).unwrap(),
    ];
    execute_query(&app, query, values).await
}

#[tauri::command]
pub async fn update_task_status(app: AppHandle, id: String, status: String) -> Result<QueryResult, String> {
    let query = "UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    let values = vec![
        serde_json::to_value(status).unwrap(),
        serde_json::to_value(id).unwrap(),
    ];
    execute_query(&app, query, values).await
}

#[tauri::command]
pub async fn update_task(app: AppHandle, id: String, title: String, description: Option<String>, status: String) -> Result<QueryResult, String> {
    let query = "UPDATE tasks SET title = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    let values = vec![
        serde_json::to_value(title).unwrap(),
        serde_json::to_value(description).unwrap(),
        serde_json::to_value(status).unwrap(),
        serde_json::to_value(id).unwrap(),
    ];
    execute_query(&app, query, values).await
}

#[tauri::command]
pub async fn delete_task(app: AppHandle, id: String) -> Result<QueryResult, String> {
    let query = "DELETE FROM tasks WHERE id = ?";
    let values = vec![serde_json::to_value(id).unwrap()];
    execute_query(&app, query, values).await
}

// ------------------------------------------------------------------------------------------------
// Sprints CRUD
// ------------------------------------------------------------------------------------------------

#[tauri::command]
pub async fn get_sprints(app: AppHandle, project_id: String) -> Result<Vec<Sprint>, String> {
    let query = "SELECT * FROM sprints WHERE project_id = ? ORDER BY started_at DESC";
    let values = vec![serde_json::to_value(project_id).unwrap()];
    select_query::<Sprint>(&app, query, values).await
}

#[tauri::command]
pub async fn add_sprint(app: AppHandle, id: String, project_id: String, started_at: i64, completed_at: i64, duration_ms: i64) -> Result<QueryResult, String> {
    let query = "INSERT INTO sprints (id, project_id, started_at, completed_at, duration_ms) VALUES (?, ?, ?, ?, ?)";
    let values = vec![
        serde_json::to_value(id).unwrap(),
        serde_json::to_value(project_id).unwrap(),
        serde_json::to_value(started_at).unwrap(),
        serde_json::to_value(completed_at).unwrap(),
        serde_json::to_value(duration_ms).unwrap(),
    ];
    execute_query(&app, query, values).await
}

#[tauri::command]
pub async fn archive_sprint(app: AppHandle, project_id: String, started_at: i64, completed_at: i64, duration_ms: i64) -> Result<bool, String> {
    // 1. Generate new sprint ID
    let sprint_id = uuid::Uuid::new_v4().to_string();

    // 2. Insert into sprints
    let query_sprint = "INSERT INTO sprints (id, project_id, started_at, completed_at, duration_ms) VALUES (?, ?, ?, ?, ?)";
    let values_sprint = vec![
        serde_json::to_value(&sprint_id).unwrap(),
        serde_json::to_value(&project_id).unwrap(),
        serde_json::to_value(started_at).unwrap(),
        serde_json::to_value(completed_at).unwrap(),
        serde_json::to_value(duration_ms).unwrap(),
    ];
    execute_query(&app, query_sprint, values_sprint).await?;

    // 3. Update tasks with status 'Done'
    let query_tasks = "UPDATE tasks SET sprint_id = ?, updated_at = CURRENT_TIMESTAMP WHERE status = 'Done' AND sprint_id IS NULL AND project_id = ?";
    let values_tasks = vec![
        serde_json::to_value(&sprint_id).unwrap(),
        serde_json::to_value(&project_id).unwrap(),
    ];
    execute_query(&app, query_tasks, values_tasks).await?;

    // 4. Update stories where all child tasks are archived
    let query_stories = r#"
        UPDATE stories 
        SET sprint_id = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE sprint_id IS NULL AND project_id = ?
        AND NOT EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.story_id = stories.id 
            AND tasks.sprint_id IS NULL
        )
    "#;
    let values_stories = vec![
        serde_json::to_value(&sprint_id).unwrap(),
        serde_json::to_value(&project_id).unwrap(),
    ];
    execute_query(&app, query_stories, values_stories).await?;

    Ok(true)
}

