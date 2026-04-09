use super::{CliRunner, CliType};

#[derive(Debug, Clone, Copy, Default)]
pub struct ClaudeRunner;

impl CliRunner for ClaudeRunner {
    fn cli_type(&self) -> CliType {
        CliType::Claude
    }

    fn command_name(&self) -> &str {
        "claude"
    }

    fn build_args(&self, prompt: &str, model: &str, cwd: &str) -> Vec<String> {
        vec![
            "-p".to_string(),
            prompt.to_string(),
            "--model".to_string(),
            model.to_string(),
            "--permission-mode".to_string(),
            "bypassPermissions".to_string(),
            "--add-dir".to_string(),
            cwd.to_string(),
            "--verbose".to_string(),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::ClaudeRunner;
    use crate::cli_runner::{CliRunner, CliType};

    #[test]
    fn builds_expected_claude_arguments() {
        let runner = ClaudeRunner;
        let args = runner.build_args("prompt", "claude-3-5-sonnet-20241022", "C:/repo");

        assert_eq!(runner.cli_type(), CliType::Claude);
        assert_eq!(
            args,
            vec![
                "-p",
                "prompt",
                "--model",
                "claude-3-5-sonnet-20241022",
                "--permission-mode",
                "bypassPermissions",
                "--add-dir",
                "C:/repo",
                "--verbose",
            ]
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>()
        );
    }
}
