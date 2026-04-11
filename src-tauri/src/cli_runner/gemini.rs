use super::{CliRunner, CliType};
use std::path::{Path, PathBuf};

pub const DEFAULT_MODEL: &str = "gemini-3-flash-preview";
pub const INSTALL_HINT: &str = "npm install -g @google/gemini-cli";

#[derive(Debug, Clone, Copy, Default)]
pub struct GeminiRunner;

impl CliRunner for GeminiRunner {
    fn cli_type(&self) -> CliType {
        CliType::Gemini
    }

    fn command_name(&self) -> &str {
        "gemini"
    }

    fn default_model(&self) -> &str {
        DEFAULT_MODEL
    }

    fn install_hint(&self) -> &str {
        INSTALL_HINT
    }

    fn build_args(&self, prompt: &str, model: &str, _cwd: &str) -> Vec<String> {
        vec![
            "--model".to_string(),
            model.to_string(),
            "--yolo".to_string(),
            "--prompt".to_string(),
            prompt.to_string(),
        ]
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

    fn env_vars(&self) -> Vec<(String, String)> {
        vec![]
    }

    fn timeout_secs(&self) -> u64 {
        180
    }
}

#[cfg(windows)]
fn resolve_windows_npm_shim(command_path: &Path) -> Result<Option<(PathBuf, Vec<String>)>, String> {
    super::resolve_windows_npm_cli_invocation(
        command_path,
        "gemini",
        &[
            "node_modules",
            "@google",
            "gemini-cli",
            "bundle",
            "gemini.js",
        ],
        &["--no-warnings=DEP0040"],
    )
}

#[cfg(test)]
mod tests {
    use super::{GeminiRunner, DEFAULT_MODEL, INSTALL_HINT};
    use crate::cli_runner::{CliRunner, CliType};

    #[test]
    fn builds_expected_gemini_arguments() {
        let runner = GeminiRunner;
        let args = runner.build_args("prompt", "gemini-3-flash-preview", "C:/repo");

        assert_eq!(runner.cli_type(), CliType::Gemini);
        assert_eq!(
            args,
            vec![
                "--model",
                "gemini-3-flash-preview",
                "--yolo",
                "--prompt",
                "prompt",
            ]
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>()
        );
        assert_eq!(runner.default_model(), DEFAULT_MODEL);
        assert_eq!(runner.install_hint(), INSTALL_HINT);
        assert!(runner.env_vars().is_empty());
        assert_eq!(runner.stdin_payload("prompt"), None);
        assert_eq!(runner.timeout_secs(), 180);
    }

    #[cfg(windows)]
    #[test]
    fn prepare_invocation_rewrites_npm_shim_to_node_bundle() {
        let temp = tempfile::tempdir().expect("tempdir should exist");
        let npm_dir = temp.path();
        let bundle_dir = npm_dir
            .join("node_modules")
            .join("@google")
            .join("gemini-cli")
            .join("bundle");
        std::fs::create_dir_all(&bundle_dir).expect("bundle dir should exist");
        std::fs::write(bundle_dir.join("gemini.js"), "console.log('ok');")
            .expect("bundle file should exist");

        let command_path = npm_dir.join("gemini.cmd");
        std::fs::write(&command_path, "@echo off").expect("cmd shim should exist");

        let runner = GeminiRunner;
        let (resolved_command, resolved_args) = runner
            .prepare_invocation(
                &command_path,
                vec!["--model".into(), "gemini-3-flash-preview".into()],
            )
            .expect("invocation should be prepared");

        assert!(resolved_command
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.eq_ignore_ascii_case("node") || name.eq_ignore_ascii_case("node.exe"))
            .unwrap_or(false));
        assert_eq!(resolved_args[0], "--no-warnings=DEP0040");
        assert!(resolved_args[1].ends_with("gemini.js"));
        assert_eq!(resolved_args[2], "--model");
        assert_eq!(resolved_args[3], "gemini-3-flash-preview");
    }
}
