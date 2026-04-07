CREATE TABLE IF NOT EXISTS llm_usage_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
    source_kind TEXT NOT NULL CHECK (
        source_kind IN (
            'idea_refine',
            'task_generation',
            'inception',
            'team_leader',
            'task_execution',
            'scaffold_ai'
        )
    ),
    transport_kind TEXT NOT NULL CHECK (
        transport_kind IN ('provider_api', 'claude_cli')
    ),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd REAL NOT NULL DEFAULT 0,
    input_cost_per_million REAL NOT NULL DEFAULT 0,
    output_cost_per_million REAL NOT NULL DEFAULT 0,
    cache_creation_cost_per_million REAL NOT NULL DEFAULT 0,
    cache_read_cost_per_million REAL NOT NULL DEFAULT 0,
    measurement_status TEXT NOT NULL DEFAULT 'captured' CHECK (
        measurement_status IN ('captured', 'estimated', 'unavailable')
    ),
    request_started_at INTEGER,
    request_completed_at INTEGER,
    latency_ms INTEGER,
    success INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    raw_usage_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_events_project_id_created_at
    ON llm_usage_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_task_id_created_at
    ON llm_usage_events(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_sprint_id_created_at
    ON llm_usage_events(sprint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_source_kind
    ON llm_usage_events(source_kind);
CREATE INDEX IF NOT EXISTS idx_llm_usage_events_model
    ON llm_usage_events(provider, model);
