# Epic 43 Walkthrough

## 概要

Epic 43 では、PO アシスタントの provider / transport 切り替えを実運用レベルまで引き上げるために、CLI 実行方式、API リトライ、コンテキスト品質、重複 backlog 抑止、未検証 provider の回収を集中的に進めた。  
結果として、Claude / Gemini / Codex / OpenAI の API / CLI 経路が安定し、PO アシスタントと Dev エージェントの両方が横断的に機能する状態まで到達した。

## 変更内容

### 1. Gemini CLI の根本修正

- 原因分析の結果、Gemini CLI は headless 実行時に stdin と `--prompt` を併用した設計が不安定で、Windows では npm shim 経由の引数処理も絡んで失敗しやすいことが判明した。
- `src-tauri/src/cli_runner/gemini.rs` を再設計し、stdin 併用を廃止して `--yolo` + `--prompt` の引数方式へ統一した。
- さらに `gemini.cmd` の batch shim を通さず、`node ... gemini.js` を直接起動する経路へ切り替えることで、`batch file arguments are invalid` を解消した。
- タイムアウトも 180 秒から 60 秒へ戻し、失敗時の `stderr` / exit code / cwd を UI へ返すようにして診断可能性を上げた。
- `src-tauri/src/ai.rs` では Gemini の cwd サイレントフォールバックを廃止し、常に `project_cwd` で実行するようにした。

### 2. Gemini API の 503 安定化

- `src-tauri/src/rig_provider.rs` に、503 / `UNAVAILABLE` / overload 系エラーに対する指数バックオフ付きの最大 3 回リトライを実装した。
- 通常チャット経路と Team Leader の tool-calling 経路の両方で再試行ロジックを適用した。
- 失敗時は「未作成」「部分成功」「成功」の違いが UI 上で分かるように返答を整理し、単純な provider 一時障害で成功扱いしないようにした。
- Gemini CLI / API の既定モデルは `gemini-2.5-pro` に統一した。

### 3. 重複 backlog 作成の防止

- Claude API で確認された重複 backlog 問題に対し、`src-tauri/src/db.rs` の `build_project_context()` を改修し、アーカイブ済み Story / Task の要約もコンテキストへ含めるようにした。
- `src-tauri/src/ai_tools.rs` の `create_story_and_tasks` 実行直前で、既存 Story とのタイトル類似度チェックを行う防波堤を追加した。
- これにより、既存の backlog や完了済み作業の存在を AI が見落としにくくなり、同趣旨 Story の乱立を抑止できるようになった。
- あわせて、抽象的な backlog 依頼でも既存 backlog を優先活用する方針を prompt / tool の双方に反映した。

### 4. Codex CLI と未検証 provider の回収

- Codex CLI は Windows の npm shim 問題と対話モード依存があり、そのままでは安定実行できなかった。
- `src-tauri/src/cli_runner/codex.rs` を `exec` ベースの 1 ショット実行へ切り替え、prompt は stdin、応答は `--output-last-message` 経由で回収する方式へ変更した。
- Dev エージェント側も `src-tauri/src/claude_runner.rs` の共通 CLI 実行基盤へ寄せ、Codex でも同じ stdin / shim 回避ロジックが効くようにした。
- さらに Codex 実行時の telemetry `INFO` ログを抑制し、ターミナルで本当に必要な出力だけが見えるように調整した。
- OpenAI API も含め、PO アシスタントと Inspection Deck 系の主要シナリオを回収し、最終的に全 provider / transport の手動検証が完了した。

### 5. 周辺の安定化

- `src/components/terminal/TerminalDock.tsx` では、dispose 済み terminal に対して `fit()` が走るレースを抑え、Codex Dev エージェント起動時の描画例外を減らした。
- `src/components/ui/GlobalSettingsModal.tsx` では、チーム設定タブを開くと PO アシスタント設定へ戻される不具合を修正した。
- `src/components/project/ScaffoldingPanel.tsx` と `src-tauri/src/scaffolding.rs` では、Scaffolding の AI 自動生成が固定 Claude CLI ではなく、PO アシスタント設定の transport / CLI 選択に追従するようにした。
- Dev エージェントが `walkthrough.md` や `handoff.md` だけを更新した場合は成功扱いで Review に進めないようにし、「コード未変更なのに完了扱い」の誤判定を防止した。

## テスト手順

- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run build`
- 各 provider / transport について、PO により手動で以下を確認
  - PO アシスタントでの backlog 追加
  - Inspection Deck 作成
  - Dev エージェント実行

## 検証結果

- `cargo test --manifest-path src-tauri/Cargo.toml` は最終時点で成功。
- `npm run build` は最終時点で成功。
- PO 手動検証により、Claude / Gemini / Codex / OpenAI の API / CLI すべてで PO アシスタントが正常動作することを確認。
- Dev エージェントについても、各 CLI で正常に動作することを確認。
- Epic 43 の目的であった「PO アシスタント Provider / Transport 信頼性改善」は達成済み。

