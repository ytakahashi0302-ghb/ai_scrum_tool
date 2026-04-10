# Gemini Transport 修正方針 (Epic 43)

## ステータス

- 状態: `Draft`
- 作成日: 2026-04-10
- 対象: Epic 43 の provider / transport 信頼性改善のうち、Gemini CLI / Gemini API の動作不良に特化した調査結果と対処方針
- 前提: 本ドキュメントは調査結果と方針の提示のみ。実装は別タスクで行う。

## 背景

Epic 42 で PO アシスタントに API / CLI の transport 選択を導入したが、2026-04-10 時点の手動検証で Gemini CLI / Gemini API のみが動作しない状態が続いている。

| 組み合わせ | 状態 | 症状 |
|-----------|------|------|
| Claude CLI | ○ | — |
| Claude API | ○ | context 不足による重複 backlog 提案はあり (別課題) |
| Gemini CLI | × | 180 秒でタイムアウト。stderr / exit code が UI に出ないため原因不明 |
| Gemini API | × | 503 `UNAVAILABLE` で失敗。handoff では再試行すると書かれているが実コードには未実装 |
| Codex CLI | ? | 未検証 |
| OpenAI API | ? | 未検証 |

ユーザーから「Gemini が動かないのは設計の問題と疑っている」との指摘があり、コードベースを直接調査したところ、**設計レベルの欠陥が Gemini CLI と Gemini API の双方に存在する**ことが確認できた。本ドキュメントはその根本原因と対処方針をまとめる。

## 調査で判明した根本原因

### A. Gemini CLI: プロンプトが CLI に届いていない (最重要)

**該当ファイル:** `src-tauri/src/cli_runner/gemini.rs:27-40`

```rust
fn build_args(&self, _prompt: &str, model: &str, _cwd: &str) -> Vec<String> {
    vec![
        "--model".into(), model.into(),
        "--approval-mode".into(), "yolo".into(),
        "--prompt".into(), HEADLESS_PROMPT_SUFFIX.into(),
    ]
}

fn stdin_payload(&self, prompt: &str) -> Option<String> {
    Some(prompt.to_string())
}
```

問題点:

1. `build_args` の第 1 引数 `_prompt` が `_` prefix で **破棄されている**。呼び出し側が渡した実プロンプト (system + context + user) は CLI 引数には一切乗らない。
2. `--prompt` には `HEADLESS_PROMPT_SUFFIX = "上記の指示に従い、指定形式で回答してください。"` という**固定の日本語定型句だけ**が渡っている。
3. 実プロンプトは `stdin_payload()` 経由で stdin に書き込まれている。
4. しかし Gemini CLI (`@google/gemini-cli`) の `--prompt` は「非対話モードで与えるプロンプトはこれだけである」と宣言するオプションであり、`--prompt` を指定した時点で stdin からの入力は読まれない。

つまり Gemini CLI は「上記の指示に従い、指定形式で回答してください。」という指示語だけを受け取って動いており、参照すべき「上記の指示」が存在しない状態で実行されている。結果として有意な出力を返せないまま、180 秒のタイムアウトに到達する。

参考として、正しく動いている Claude CLI 版は以下のように実プロンプトを `-p` 引数に直接渡しており、stdin は使っていない。

**比較対象:** `src-tauri/src/cli_runner/claude.rs:26-38`

```rust
fn build_args(&self, prompt: &str, model: &str, cwd: &str) -> Vec<String> {
    vec![
        "-p".into(), prompt.into(),
        "--model".into(), model.into(),
        "--permission-mode".into(), "bypassPermissions".into(),
        "--add-dir".into(), cwd.into(),
        "--verbose".into(),
    ]
}
```

Gemini CLI 版だけが「引数 + stdin の二重渡し」という独自パターンを取っており、それが原因で Gemini が仕様上受け付けない組み合わせになっている。

### B. Gemini CLI: タイムアウトが 180 秒で失敗が遅い

**該当箇所:** `src-tauri/src/cli_runner/gemini.rs:42-44`

```rust
fn timeout_secs(&self) -> u64 { 180 }
```

Claude CLI は trait の default 値 60 秒を使っているのに対し、Gemini CLI だけが 180 秒に延長されている。A のプロンプト未達問題と組み合わさり、ユーザーは毎回 3 分待たされたうえで原因不明のエラーを受け取る状態になっている。

### C. Gemini CLI: 実行 cwd がサイレントに project 外へ切り替わる

**該当箇所:** `src-tauri/src/ai.rs:205-260` 付近 (`select_gemini_execution_cwd` / `resolve_po_transport`)

- `~/.gemini/trustedFolders.json` を読み、project_cwd がその配下に無い場合は **先頭の trusted folder** にフォールバックしている。
- Claude CLI は常に project_cwd で実行される。
- ユーザー環境でプロジェクトが Gemini の trusted folders に登録されていない場合、Gemini CLI は `~/.gemini/` や無関係のディレクトリで起動され、プロジェクトのファイルが一切見えない。
- この挙動はサイレントでユーザーに通知されず、タイムアウトを誘発する副次要因となる。

### D. Gemini API: 503 / UNAVAILABLE リトライが実装されていない

**該当ファイル:** `src-tauri/src/rig_provider.rs:354-396` の `chat_gemini`

```rust
let response = tokio::time::timeout(
    std::time::Duration::from_secs(60),
    agent.prompt(user_input).with_history(&mut chat_history).extended_details(),
)
.await
.map_err(|_| "Gemini API timed out after 60 seconds".to_string())?
.map_err(|e| format!("Gemini error: {}", e))?;
```

- 単発の `agent.prompt()` を 60 秒タイムアウトでラップしているだけ。
- `docs/42_po_assistant_cli_support/handoff.md` には「Gemini API の 503 / UNAVAILABLE は再試行し、未反映なら通常返信として扱う」と記載されているが、**実コードには 503 判定もリトライも存在しない**。記載と実装が乖離している。
- 結果として UNAVAILABLE が一回でも返ると即失敗となる。

### E. Gemini の default model が CLI / API で不整合

- CLI default: `gemini-2.5-pro` (`src-tauri/src/cli_runner/gemini.rs:3`)
- API default: `gemini-2.0-flash` (`src-tauri/src/rig_provider.rs:220`)

ユーザーが設定画面で CLI / API を切り替えると、裏で異なるモデルが使われる。tool calling 互換性やレイテンシ特性が変わるため、期待値がぶれる原因になる。

### F. 失敗時の観測性がゼロ

**該当箇所:** `src-tauri/src/ai.rs:354-359` 付近 (`execute_po_cli_prompt`)

- 失敗時は「○○ の出力から有効な JSON を抽出できませんでした」というメッセージだけが UI に返る。
- stderr / exit code / 実行 cwd / 実行 args はどこにも出てこない。
- このため Gemini CLI / Codex CLI の不具合を切り分けるための情報がユーザー側にも開発者側にも残らない。

## 対処方針

本節は実装に着手するときの指針である。優先度の高い順に記載する。

### Fix-1: Gemini CLI の引数設計をやり直す (最優先)

Claude CLI と同じく「プロンプトを引数として直接渡す」方式に揃える。

```rust
fn build_args(&self, prompt: &str, model: &str, _cwd: &str) -> Vec<String> {
    vec![
        "--model".into(), model.into(),
        "--yolo".into(),
        "--prompt".into(), prompt.into(),
    ]
}

fn stdin_payload(&self, _prompt: &str) -> Option<String> {
    None
}
```

- `HEADLESS_PROMPT_SUFFIX` 定数は削除する。
- system_prompt + context + user_input は呼び出し側で連結済みのものが `prompt` として渡ってくる前提。
- OS のコマンドライン長制限に抵触するほど巨大なプロンプトを想定する場合のみ、代替として **stdin 方式に一本化** する (その場合は `--prompt` 引数を外す)。**引数と stdin の併用は禁止**。
- `--yolo` 単独と `--approval-mode=yolo` の正確な挙動は `gemini --help` で事前に確認すること。

### Fix-2: Gemini CLI のタイムアウトを統一する

`timeout_secs` のオーバーライドを削除し、trait default (60 秒) に揃える。長時間実行が必要な個別機能が出た場合にのみ、呼び出し側が明示的に延長する設計とする。

### Fix-3: Gemini の cwd フォールバックを廃止する

- `resolve_po_transport` の Gemini 特例分岐 (`ai.rs:256-260` 付近) を削除する。
- Gemini CLI も Claude CLI と同じく常に project_cwd で実行する。
- trusted folder に未登録の場合はサイレントで別ディレクトリに逃げるのではなく、**UI にエラーを返す**。エラーメッセージには「対象プロジェクトを `~/.gemini/trustedFolders.json` に追加してください」と明記する。

### Fix-4: Gemini API に 503 リトライを実装する

`chat_gemini` に以下を追加する。

- 指数バックオフ (例: 2s → 4s → 8s) で最大 3 回再試行。
- エラー文字列に `503`, `UNAVAILABLE`, `overloaded` のいずれかを含む場合のみ再試行対象とする。その他は即時失敗。
- 全リトライ失敗時は「Gemini API が継続的に UNAVAILABLE を返しました」と UI に明示する。
- 判定ロジックは純関数として切り出し、ユニットテスト対象にする。
- 将来 Anthropic / OpenAI / Ollama にも流用できるよう、共通ユーティリティ化を検討する。

### Fix-5: Gemini の default model を統一する

- Epic 43 スコープでは「API / CLI の default を同じモデル名に揃える」方針とする。
- 候補は `gemini-2.5-pro` か `gemini-2.0-flash` のいずれか。コスト / レイテンシ / tool calling 互換性を踏まえ、PO アシスタント用途としては `gemini-2.5-pro` を推奨する。
- 最終的にどちらに寄せるかは実装時にユーザー判断を仰ぐ。

### Fix-6: 失敗時の観測情報を UI に流す

`execute_po_cli_prompt` の失敗パスで以下を含むエラー文字列を構築する。

- exit code
- stderr の末尾 (最大 2KB 程度)
- stdout の末尾 (JSON 抽出に失敗した場合のみ、最大 2KB 程度)
- 実行 cwd
- 実行 args (API key / token 等が args に含まれていないことを前提とする)

Fix-1〜3 で Gemini CLI が直らなかった場合、Fix-6 のログを元に追加調査を行うための足場となる。

### Fix-7: Codex CLI / OpenAI API の未検証マトリクスの回収

本ドキュメントのスコープ外だが、同じ Epic 43 の中で以下を並行して対応することを推奨する。

- Codex CLI runner (`src-tauri/src/cli_runner/codex.rs`) が Gemini と同じ「固定 `--prompt` + stdin 併用」パターンになっていないかを確認する。該当する場合は Fix-1 と同等の修正を適用する。
- OpenAI API (`chat_openai_compatible`) は Fix-4 のリトライ共通化で自然に恩恵を受ける。

## 変更候補ファイル (参考)

| ファイル | 想定変更 |
|---------|---------|
| `src-tauri/src/cli_runner/gemini.rs` | Fix-1, Fix-2 |
| `src-tauri/src/cli_runner/codex.rs` | Fix-7 (同構造の場合) |
| `src-tauri/src/ai.rs` | Fix-3, Fix-6 |
| `src-tauri/src/rig_provider.rs` | Fix-4, Fix-5 |
| `src/components/ui/GlobalSettingsModal.tsx` | Fix-3 のエラー誘導文言 (任意) |
| `docs/43_transport_layer_unification/task.md` | 本方針の反映 |
| `docs/43_transport_layer_unification/walkthrough.md` | 実装後に作成 |

## テスト方針

### 自動テスト (Rust)

- `cli_runner/gemini.rs` の `builds_expected_gemini_arguments` テストを新仕様 (`--yolo` + 実 prompt 引数) に合わせて書き換える。
- Gemini API の 503 リトライ判定を純関数として切り出し、エラー文字列パターンごとの判定をユニットテストで固定する。
- `resolve_po_transport` から Gemini 特例分岐が外れたことを明示するテストを追加する。
- 既存 `cargo test --manifest-path src-tauri/Cargo.toml` が緑のまま通ること。

### 手動テスト (matrix)

| # | transport | 確認項目 |
|---|-----------|---------|
| 1 | Gemini CLI | `refine_idea` がタイムアウトせず JSON を返す |
| 2 | Gemini CLI | `chat_with_team_leader` で backlog 作成まで成功、または stderr 付きの明示失敗 |
| 3 | Gemini API | 503 発生時に 3 回再試行され、最終的に成功または明示失敗 |
| 4 | Gemini API | tool calling 経由で backlog 作成が成功 |
| 5 | Claude CLI | 回帰していない |
| 6 | Claude API | 回帰していない |
| 7 | Codex CLI | `refine_idea` が通る (Fix-7 実施後) |
| 8 | OpenAI API | `refine_idea` が通る |

### 完了条件

- Gemini CLI で少なくとも `refine_idea` / `chat_with_team_leader` がタイムアウトせず完走する、または失敗時に stderr / exit code が UI から読める。
- Gemini API の 503 が自動リトライで吸収される (または明示エラーで返る)。
- Claude CLI / Claude API が回帰していない。
- Codex CLI / OpenAI API の未検証マトリクスが埋まる。

## 次のアクション

本ドキュメントはあくまで調査結果と方針の提示であり、実装は含まない。実装着手の判断と順序はユーザーに委ねる。推奨する着手順序は以下のとおり。

1. Fix-1 (Gemini CLI の引数設計やり直し) を単独で実施し、手動で Gemini CLI の挙動を確認する。これだけで Gemini CLI 問題の大部分が解消する見込み。
2. Fix-2 / Fix-3 を続けて入れ、タイムアウトと cwd フォールバックを正常化する。
3. Fix-4 / Fix-5 で Gemini API を安定化する。
4. Fix-6 で観測性を底上げする。
5. Fix-7 で Codex CLI / OpenAI API の未検証を回収する。
