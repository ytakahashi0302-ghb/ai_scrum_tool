use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

// ---------------------------------------------------------------------------
// Windows: ConPTY は cmd.exe の出力をバッファリングし正しくストリームしないため、
// std::process::Command + パイプでリアルタイムにストリーミングする。
// macOS/Linux: portable-pty (PTY) を使用する。
// ---------------------------------------------------------------------------

#[cfg(not(target_os = "windows"))]
use portable_pty::{native_pty_system, Child as PtyChild, CommandBuilder, MasterPty, PtySize, SlavePty};
#[cfg(not(target_os = "windows"))]
use std::io::Read as PtyRead;

#[cfg(target_os = "windows")]
use std::process::{Child, Command, Stdio};
#[cfg(target_os = "windows")]
use std::io::Read;

// ---------------------------------------------------------------------------
// State: プラットフォーム別のプロセスハンドル
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
pub struct ClaudeState {
    pub current_child: Arc<Mutex<Option<Child>>>,
}

#[cfg(not(target_os = "windows"))]
struct ClaudeSessionUnix {
    child: Box<dyn PtyChild + Send + Sync>,
    _master: Box<dyn MasterPty + Send>,
    _slave: Box<dyn SlavePty + Send>,
}

#[cfg(not(target_os = "windows"))]
pub struct ClaudeState {
    pub current_session: Arc<Mutex<Option<ClaudeSessionUnix>>>,
}

impl ClaudeState {
    pub fn new() -> Self {
        Self {
            #[cfg(target_os = "windows")]
            current_child: Arc::new(Mutex::new(None)),
            #[cfg(not(target_os = "windows"))]
            current_session: Arc::new(Mutex::new(None)),
        }
    }
}

// ---------------------------------------------------------------------------
// イベントペイロード
// ---------------------------------------------------------------------------

#[derive(Clone, serde::Serialize)]
struct ClaudeOutputPayload {
    task_id: String,
    output: String,
}

#[derive(Clone, serde::Serialize)]
struct ClaudeExitPayload {
    task_id: String,
    success: bool,
    reason: String,
}

// ---------------------------------------------------------------------------
// Windows 実装: std::process::Command + Stdio::piped() でリアルタイムストリーミング
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn execute_claude_task(
    app_handle: AppHandle,
    state: tauri::State<'_, ClaudeState>,
    task_id: String,
    prompt: String,
    cwd: String,
) -> Result<(), String> {
    {
        let guard = state.current_child.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Err("A Claude process is already running.".into());
        }
    }

    // ディレクトリ存在チェック
    let cwd_path = std::path::Path::new(&cwd);
    if !cwd_path.exists() || !cwd_path.is_dir() {
        let err_msg = format!(
            "エラー: 指定されたLocal Path ({}) が存在しません。Settingsで正しいパスを設定してください。",
            cwd
        );
        let _ = app_handle.emit("claude_cli_output", ClaudeOutputPayload {
            task_id: task_id.clone(),
            output: format!("\x1b[31m{}\x1b[0m\r\n", err_msg),
        });
        return Err(err_msg);
    }

    // npx 経由で claude-code を実行（疎通テスト中は echo に変更可能）
    let mut child = match Command::new(r"C:\Windows\System32\cmd.exe")
        .args(["/C", "npx", "-y", "@anthropic-ai/claude-code", "-p", &prompt])
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .envs(std::env::vars())
        .env("FORCE_COLOR", "1")
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            let err_msg = format!("CRITICAL: Failed to spawn process: {}", e);
            let _ = app_handle.emit("claude_cli_output", ClaudeOutputPayload {
                task_id: task_id.clone(),
                output: format!("\x1b[31m{}\x1b[0m\r\n", err_msg),
            });
            return Err(err_msg);
        }
    };

    // stdout / stderr を取り出してスレッドで読む
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Stateに保存
    {
        let mut guard = state.current_child.lock().map_err(|e| e.to_string())?;
        *guard = Some(child);
    }

    // stdout 読み取りスレッド
    let app_stdout = app_handle.clone();
    let tid_stdout = task_id.clone();
    if let Some(mut out) = stdout {
        std::thread::spawn(move || {
            let mut buf = [0u8; 1024];
            loop {
                match out.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_stdout.emit("claude_cli_output", ClaudeOutputPayload {
                            task_id: tid_stdout.clone(),
                            output: text,
                        });
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // stderr 読み取りスレッド
    let app_stderr = app_handle.clone();
    let tid_stderr = task_id.clone();
    if let Some(mut err) = stderr {
        std::thread::spawn(move || {
            let mut buf = [0u8; 1024];
            loop {
                match err.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        // stderr は赤色で表示
                        let _ = app_stderr.emit("claude_cli_output", ClaudeOutputPayload {
                            task_id: tid_stderr.clone(),
                            output: text,
                        });
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // プロセス終了待機スレッド
    let child_arc = state.current_child.clone();
    let app_wait = app_handle.clone();
    let tid_wait = task_id.clone();
    std::thread::spawn(move || {
        // stdout/stderr のスレッドが先に完了するのを少し待つ
        std::thread::sleep(std::time::Duration::from_millis(100));

        loop {
            std::thread::sleep(std::time::Duration::from_millis(500));
            let mut guard = child_arc.lock().unwrap();
            if let Some(ref mut child) = *guard {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        let success = status.success();
                        guard.take(); // State からクリア
                        // フラッシュ待ち
                        drop(guard);
                        std::thread::sleep(std::time::Duration::from_millis(300));
                        let _ = app_wait.emit("claude_cli_exit", ClaudeExitPayload {
                            task_id: tid_wait.clone(),
                            success,
                            reason: if success {
                                "Completed successfully".into()
                            } else {
                                format!("Process exited with code {}", status.code().unwrap_or(-1))
                            },
                        });
                        return;
                    }
                    Ok(None) => {} // まだ実行中
                    Err(e) => {
                        guard.take();
                        drop(guard);
                        let _ = app_wait.emit("claude_cli_exit", ClaudeExitPayload {
                            task_id: tid_wait.clone(),
                            success: false,
                            reason: format!("Wait error: {}", e),
                        });
                        return;
                    }
                }
            } else {
                // kill等で既にクリアされた
                return;
            }
        }
    });

    // タイムアウト (3分)
    let child_arc_timeout = state.current_child.clone();
    let app_timeout = app_handle.clone();
    let tid_timeout = task_id.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(180)).await;
        let mut guard = child_arc_timeout.lock().unwrap();
        if let Some(ref mut child) = *guard {
            let _ = child.kill();
            guard.take();
            drop(guard);
            let _ = app_timeout.emit("claude_cli_exit", ClaudeExitPayload {
                task_id: tid_timeout,
                success: false,
                reason: "Timeout reached (180s). Process forcefully killed.".into(),
            });
        }
    });

    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn kill_claude_process(
    app_handle: AppHandle,
    state: tauri::State<'_, ClaudeState>,
    task_id: String,
) -> Result<(), String> {
    let mut guard = state.current_child.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut child) = *guard {
        let _ = child.kill();
        guard.take();
        let _ = app_handle.emit("claude_cli_exit", ClaudeExitPayload {
            task_id,
            success: false,
            reason: "Manually killed by user.".into(),
        });
        Ok(())
    } else {
        Err("No active Claude process to kill.".into())
    }
}

// ---------------------------------------------------------------------------
// macOS / Linux 実装: portable-pty (PTY) ベース
// ---------------------------------------------------------------------------

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn execute_claude_task(
    app_handle: AppHandle,
    state: tauri::State<'_, ClaudeState>,
    task_id: String,
    prompt: String,
    cwd: String,
) -> Result<(), String> {
    let mut session_guard = state.current_session.lock().map_err(|e| e.to_string())?;
    if session_guard.is_some() {
        return Err("A Claude process is already running.".into());
    }

    let cwd_path = std::path::Path::new(&cwd);
    if !cwd_path.exists() || !cwd_path.is_dir() {
        let err_msg = format!("エラー: 指定されたLocal Path ({}) が存在しません。", cwd);
        let _ = app_handle.emit("claude_cli_output", ClaudeOutputPayload {
            task_id: task_id.clone(),
            output: format!("\x1b[31m{}\x1b[0m\r\n", err_msg),
        });
        return Err(err_msg);
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new("npx");
    cmd.args(["-y", "@anthropic-ai/claude-code", "-p", &prompt]);
    cmd.cwd(&cwd);
    for (key, val) in std::env::vars() {
        cmd.env(key, val);
    }
    cmd.env("FORCE_COLOR", "1");
    cmd.env("TERM", "xterm-256color");

    let child = match pair.slave.spawn_command(cmd) {
        Ok(c) => c,
        Err(e) => {
            let err_msg = format!("CRITICAL: spawn_command failed: {}", e);
            let _ = app_handle.emit("claude_cli_output", ClaudeOutputPayload {
                task_id: task_id.clone(),
                output: format!("\x1b[31m{}\x1b[0m\r\n", err_msg),
            });
            return Err(err_msg);
        }
    };

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    *session_guard = Some(ClaudeSessionUnix {
        child,
        _master: pair.master,
        _slave: pair.slave,
    });
    drop(session_guard);

    let session_arc = state.current_session.clone();
    let app_clone = app_handle.clone();
    let tid_clone = task_id.clone();

    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let output = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit("claude_cli_output", ClaudeOutputPayload {
                        task_id: tid_clone.clone(),
                        output,
                    });
                }
                Err(_) => break,
            }
        }

        std::thread::sleep(std::time::Duration::from_millis(200));

        let mut guard = session_arc.lock().unwrap();
        if let Some(mut session) = guard.take() {
            let success = match session.child.wait() {
                Ok(status) => status.success(),
                Err(_) => false,
            };
            let _ = app_clone.emit("claude_cli_exit", ClaudeExitPayload {
                task_id: tid_clone.clone(),
                success,
                reason: if success { "Completed successfully".into() } else { "Process exited with error".into() },
            });
        }
    });

    // タイムアウト
    let session_arc_timeout = state.current_session.clone();
    let app_timeout = app_handle.clone();
    let tid_timeout = task_id.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(180)).await;
        let mut guard = session_arc_timeout.lock().unwrap();
        if let Some(mut session) = guard.take() {
            let _ = session.child.kill();
            let _ = app_timeout.emit("claude_cli_exit", ClaudeExitPayload {
                task_id: tid_timeout,
                success: false,
                reason: "Timeout reached (180s). Process forcefully killed.".into(),
            });
        }
    });

    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn kill_claude_process(
    app_handle: AppHandle,
    state: tauri::State<'_, ClaudeState>,
    task_id: String,
) -> Result<(), String> {
    let mut guard = state.current_session.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = guard.take() {
        let _ = session.child.kill();
        let _ = app_handle.emit("claude_cli_exit", ClaudeExitPayload {
            task_id,
            success: false,
            reason: "Manually killed by user.".into(),
        });
        Ok(())
    } else {
        Err("No active Claude process to kill.".into())
    }
}
