use serde::Serialize;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct CliDetectionResult {
    pub name: String,
    pub display_name: String,
    pub installed: bool,
    pub version: Option<String>,
}

#[derive(Clone, Copy)]
struct CliSpec {
    name: &'static str,
    display_name: &'static str,
}

const CLI_SPECS: [CliSpec; 3] = [
    CliSpec {
        name: "claude",
        display_name: "Claude Code",
    },
    CliSpec {
        name: "gemini",
        display_name: "Gemini CLI",
    },
    CliSpec {
        name: "codex",
        display_name: "Codex CLI",
    },
];

fn extract_version(stdout: &[u8], stderr: &[u8]) -> Option<String> {
    [stdout, stderr]
        .into_iter()
        .map(|bytes| String::from_utf8_lossy(bytes).trim().to_string())
        .find_map(|text| {
            text.lines()
                .map(str::trim)
                .find(|line| !line.is_empty())
                .map(str::to_string)
        })
}

fn detect_cli(spec: CliSpec) -> CliDetectionResult {
    match Command::new(spec.name).arg("--version").output() {
        Ok(output) if output.status.success() => CliDetectionResult {
            name: spec.name.to_string(),
            display_name: spec.display_name.to_string(),
            installed: true,
            version: extract_version(&output.stdout, &output.stderr),
        },
        Ok(_) | Err(_) => CliDetectionResult {
            name: spec.name.to_string(),
            display_name: spec.display_name.to_string(),
            installed: false,
            version: None,
        },
    }
}

#[tauri::command]
pub async fn detect_installed_clis() -> Result<Vec<CliDetectionResult>, String> {
    let mut handles = Vec::with_capacity(CLI_SPECS.len());
    for spec in CLI_SPECS {
        handles.push(tokio::task::spawn_blocking(move || detect_cli(spec)));
    }

    let mut results = Vec::with_capacity(handles.len());
    for handle in handles {
        let result = handle
            .await
            .map_err(|error| format!("CLI 検出タスクの実行に失敗しました: {}", error))?;
        results.push(result);
    }

    Ok(results)
}
