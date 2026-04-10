use serde::Serialize;
use std::collections::HashSet;
use std::env;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
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

#[cfg(windows)]
fn candidate_command_names(name: &str) -> Vec<OsString> {
    vec![
        OsString::from(format!("{name}.exe")),
        OsString::from(format!("{name}.cmd")),
        OsString::from(format!("{name}.bat")),
        OsString::from(name),
    ]
}

#[cfg(not(windows))]
fn candidate_command_names(name: &str) -> Vec<OsString> {
    vec![OsString::from(name)]
}

#[cfg(windows)]
fn known_search_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let mut seen = HashSet::new();

    let mut push_unique = |path: PathBuf| {
        let normalized = path.to_string_lossy().to_lowercase();
        if seen.insert(normalized) {
            dirs.push(path);
        }
    };

    if let Some(path) = env::var_os("PATH") {
        for dir in env::split_paths(&path) {
            push_unique(dir);
        }
    }

    if let Some(app_data) = env::var_os("APPDATA") {
        push_unique(PathBuf::from(app_data).join("npm"));
    }

    if let Some(user_profile) = env::var_os("USERPROFILE") {
        push_unique(PathBuf::from(&user_profile).join(".local").join("bin"));
    }

    if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
        push_unique(
            PathBuf::from(&local_app_data)
                .join("Microsoft")
                .join("WindowsApps"),
        );
        push_unique(
            PathBuf::from(local_app_data)
                .join("OpenAI")
                .join("Codex")
                .join("bin"),
        );
    }

    dirs
}

#[cfg(not(windows))]
fn known_search_dirs() -> Vec<PathBuf> {
    env::var_os("PATH")
        .map(|path| env::split_paths(&path).collect())
        .unwrap_or_default()
}

fn collect_existing_candidate_paths(name: &str, search_dirs: &[PathBuf]) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let mut seen = HashSet::new();

    for dir in search_dirs {
        for candidate_name in candidate_command_names(name) {
            let candidate_path = dir.join(&candidate_name);
            if candidate_path.is_file() {
                let normalized = candidate_path.to_string_lossy().to_lowercase();
                if seen.insert(normalized) {
                    paths.push(candidate_path);
                }
            }
        }
    }

    paths
}

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

fn run_version_command(command_name: &Path) -> Option<String> {
    match Command::new(command_name).arg("--version").output() {
        Ok(output) if output.status.success() => extract_version(&output.stdout, &output.stderr),
        Ok(_) | Err(_) => None,
    }
}

fn find_working_command(name: &str) -> Option<(PathBuf, String)> {
    let search_dirs = known_search_dirs();
    let candidate_paths = collect_existing_candidate_paths(name, &search_dirs);

    for candidate_path in candidate_paths {
        if let Some(version) = run_version_command(&candidate_path) {
            return Some((candidate_path, version));
        }
    }

    for candidate_name in candidate_command_names(name) {
        let candidate_path = PathBuf::from(&candidate_name);
        if let Some(version) = run_version_command(&candidate_path) {
            return Some((candidate_path, version));
        }
    }

    None
}

pub fn resolve_cli_command_path(name: &str) -> Option<PathBuf> {
    find_working_command(name).map(|(command_path, _)| command_path)
}

fn detect_cli(spec: CliSpec) -> CliDetectionResult {
    match find_working_command(spec.name) {
        Some((_, version)) => CliDetectionResult {
            name: spec.name.to_string(),
            display_name: spec.display_name.to_string(),
            installed: true,
            version: Some(version),
        },
        None => CliDetectionResult {
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

#[cfg(test)]
mod tests {
    use super::collect_existing_candidate_paths;
    use std::fs;

    #[cfg(windows)]
    #[test]
    fn windows_prefers_cmd_shim_before_extensionless_file() {
        let dir = tempfile::tempdir().expect("tempdir should be created");
        fs::write(dir.path().join("gemini"), "shim").expect("gemini shim should be written");
        fs::write(dir.path().join("gemini.cmd"), "@echo off")
            .expect("gemini.cmd should be written");

        let candidates = collect_existing_candidate_paths("gemini", &[dir.path().to_path_buf()]);

        assert_eq!(
            candidates
                .first()
                .and_then(|path| path.file_name())
                .and_then(|name| name.to_str()),
            Some("gemini.cmd")
        );
    }

    #[cfg(not(windows))]
    #[test]
    fn non_windows_uses_plain_binary_name() {
        let dir = tempfile::tempdir().expect("tempdir should be created");
        fs::write(dir.path().join("gemini"), "shim").expect("gemini shim should be written");

        let candidates = collect_existing_candidate_paths("gemini", &[dir.path().to_path_buf()]);

        assert_eq!(
            candidates
                .first()
                .and_then(|path| path.file_name())
                .and_then(|name| name.to_str()),
            Some("gemini")
        );
    }
}
