use serde::{Deserialize, Serialize};

pub mod claude;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CliType {
    Claude,
    Gemini,
    Codex,
}

impl CliType {
    pub fn from_str(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "gemini" => Self::Gemini,
            "codex" => Self::Codex,
            _ => Self::Claude,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Gemini => "gemini",
            Self::Codex => "codex",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Claude => "Claude Code CLI",
            Self::Gemini => "Gemini CLI",
            Self::Codex => "Codex CLI",
        }
    }
}

pub trait CliRunner: Send + Sync {
    fn cli_type(&self) -> CliType;

    fn command_name(&self) -> &str;

    fn display_name(&self) -> &str {
        self.cli_type().display_name()
    }

    fn build_args(&self, prompt: &str, model: &str, cwd: &str) -> Vec<String>;

    fn env_vars(&self) -> Vec<(String, String)> {
        vec![]
    }

    #[allow(dead_code)]
    fn parse_version(&self, stdout: &[u8], stderr: &[u8]) -> Option<String> {
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
}

pub fn create_runner(cli_type: &CliType) -> Result<Box<dyn CliRunner>, String> {
    match cli_type {
        CliType::Claude => Ok(Box::new(claude::ClaudeRunner)),
        CliType::Gemini => {
            Err("Gemini CLI runner は未実装です。Epic 38 で対応予定です。".to_string())
        }
        CliType::Codex => {
            Err("Codex CLI runner は未実装です。Epic 38 で対応予定です。".to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{create_runner, CliType};

    #[test]
    fn cli_type_defaults_to_claude_for_unknown_values() {
        assert_eq!(CliType::from_str("unknown"), CliType::Claude);
    }

    #[test]
    fn create_runner_returns_claude_runner() {
        let runner = create_runner(&CliType::Claude).expect("Claude runner should exist");

        assert_eq!(runner.cli_type(), CliType::Claude);
        assert_eq!(runner.command_name(), "claude");
        assert_eq!(runner.display_name(), "Claude Code CLI");
    }

    #[test]
    fn create_runner_rejects_unimplemented_runners() {
        assert!(create_runner(&CliType::Gemini).is_err());
        assert!(create_runner(&CliType::Codex).is_err());
    }
}
