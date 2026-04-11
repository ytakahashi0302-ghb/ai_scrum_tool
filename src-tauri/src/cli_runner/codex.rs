use super::{CliRunner, CliType};
use std::path::{Path, PathBuf};

pub const DEFAULT_MODEL: &str = "gpt-5.4-mini";
pub const INSTALL_HINT: &str = "npm install -g @openai/codex";

#[derive(Debug, Clone, Copy, Default)]
pub struct CodexRunner;

impl CliRunner for CodexRunner {
    fn cli_type(&self) -> CliType {
        CliType::Codex
    }

    fn command_name(&self) -> &str {
        "codex"
    }

    fn default_model(&self) -> &str {
        DEFAULT_MODEL
    }

    fn install_hint(&self) -> &str {
        INSTALL_HINT
    }

    fn build_args(&self, _prompt: &str, model: &str, _cwd: &str) -> Vec<String> {
        vec![
            "exec".to_string(),
            "--full-auto".to_string(),
            "--skip-git-repo-check".to_string(),
            "--model".to_string(),
            model.to_string(),
            "-".to_string(),
        ]
    }

    fn prepare_response_capture(
        &self,
        args: &mut Vec<String>,
        capture_path: &Path,
    ) -> Result<(), String> {
        args.insert(1, capture_path.to_string_lossy().to_string());
        args.insert(1, "--output-last-message".to_string());
        Ok(())
    }

    fn prefers_response_capture_file(&self) -> bool {
        true
    }

    fn stdin_payload(&self, prompt: &str) -> Option<String> {
        Some(prompt.to_string())
    }

    fn env_vars(&self) -> Vec<(String, String)> {
        vec![("RUST_LOG".to_string(), "error".to_string())]
    }

    fn prepare_invocation(
        &self,
        command_path: &Path,
        args: Vec<String>,
    ) -> Result<(PathBuf, Vec<String>), String> {
        #[cfg(windows)]
        {
            if let Some((node_path, mut prefix_args)) = resolve_windows_npm_shim(command_path)? {
                prefix_args.extend(args);
                return Ok((node_path, prefix_args));
            }
        }

        Ok((command_path.to_path_buf(), args))
    }
}

#[cfg(windows)]
fn resolve_windows_npm_shim(command_path: &Path) -> Result<Option<(PathBuf, Vec<String>)>, String> {
    super::resolve_windows_npm_cli_invocation(
        command_path,
        "codex",
        &["node_modules", "@openai", "codex", "bin", "codex.js"],
        &[],
    )
}

#[cfg(test)]
mod tests {
    use super::{CodexRunner, DEFAULT_MODEL, INSTALL_HINT};
    use crate::cli_runner::{CliRunner, CliType};
    use std::path::Path;

    #[test]
    fn builds_expected_codex_arguments() {
        let runner = CodexRunner;
        let args = runner.build_args("prompt", "gpt-5.4-mini", "C:/repo");

        assert_eq!(runner.cli_type(), CliType::Codex);
        assert_eq!(
            args,
            vec![
                "exec",
                "--full-auto",
                "--skip-git-repo-check",
                "--model",
                "gpt-5.4-mini",
                "-"
            ]
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>()
        );
        assert_eq!(runner.default_model(), DEFAULT_MODEL);
        assert_eq!(runner.install_hint(), INSTALL_HINT);
        assert_eq!(runner.stdin_payload("prompt").as_deref(), Some("prompt"));
        assert_eq!(
            runner.env_vars(),
            vec![("RUST_LOG".to_string(), "error".to_string())]
        );
    }

    #[cfg(windows)]
    #[test]
    fn prepare_invocation_rewrites_npm_shim_to_node_bundle() {
        let temp = tempfile::tempdir().expect("tempdir should exist");
        let npm_dir = temp.path();
        let bundle_dir = npm_dir
            .join("node_modules")
            .join("@openai")
            .join("codex")
            .join("bin");
        std::fs::create_dir_all(&bundle_dir).expect("bundle dir should exist");
        std::fs::write(bundle_dir.join("codex.js"), "console.log('ok');")
            .expect("bundle file should exist");

        let command_path = npm_dir.join("codex.cmd");
        std::fs::write(&command_path, "@echo off").expect("cmd shim should exist");

        let runner = CodexRunner;
        let (resolved_command, resolved_args) = runner
            .prepare_invocation(&command_path, vec!["--full-auto".into(), "--model".into()])
            .expect("invocation should be prepared");

        assert!(resolved_command
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.eq_ignore_ascii_case("node") || name.eq_ignore_ascii_case("node.exe"))
            .unwrap_or(false));
        assert!(resolved_args[0].ends_with("codex.js"));
        assert_eq!(resolved_args[1], "--full-auto");
        assert_eq!(resolved_args[2], "--model");
    }

    #[test]
    fn prepare_response_capture_injects_output_file_flag() {
        let runner = CodexRunner;
        let mut args = runner.build_args("prompt", "gpt-5.4-mini", "C:/repo");
        runner
            .prepare_response_capture(&mut args, Path::new("C:/tmp/codex-output.txt"))
            .expect("capture args should be prepared");

        assert_eq!(
            args,
            vec![
                "exec",
                "--output-last-message",
                "C:/tmp/codex-output.txt",
                "--full-auto",
                "--skip-git-repo-check",
                "--model",
                "gpt-5.4-mini",
                "-",
            ]
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>()
        );
    }
}
