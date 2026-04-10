# Epic 43: PO アシスタント Provider / Transport 信頼性改善 タスクリスト

## ステータス

- 状態: `Closed`
- 着手条件: Epic 42 完了
- 更新日: 2026-04-10

## 概要

Epic 42 で追加した PO アシスタントの CLI / API 選択対応を、実運用に耐える品質まで引き上げる。provider / transport ごとの成功条件と失敗理由を明確にし、Gemini 系の不安定さと Claude API の context 精度問題を解消する。

## 現状マトリクス

- Claude CLI: `○` backlog 作成成功
- Claude API: `○` backlog 作成成功、重複 backlog 抑止も反映済み
- Gemini CLI: `○` backlog 追加成功
- Gemini API: `○` `gemini-3-flash-preview` で成功
- Codex CLI: `○` backlog 追加 / Inspection Deck 作成成功、Dev エージェントも正常動作
- OpenAI API: `○` backlog 追加 / Inspection Deck 作成成功

## 実行順序

### 1. 現状再現と観測ログ整備
- [x] provider / transport ごとの再現シナリオを固定する。
- [x] `refine_idea` / `generate_tasks_from_story` / `chat_inception` / `chat_with_team_leader` の代表ケースを決める。
- [x] 成功 / 失敗 / DB 反映 / 最終返信の観測項目を共通フォーマットで記録できるようにする。

### 2. Gemini CLI の headless 実行デバッグ
- [x] timeout 時に原因調査に必要な `stdout` / `stderr` / exit status / cwd を把握できるようにする。
- [x] trust folder / 実行ディレクトリ / `--prompt` / stdin の切り分けを行う。
- [x] `chat_with_team_leader` まで正常完了する構成、または明確な失敗メッセージ返却を実現する。
- [x] Gemini CLI を stdin 併用なしの `--yolo` + `--prompt` 引数設計へ統一する。
- [x] Gemini CLI の cwd サイレントフォールバックを廃止し、常に project_cwd で実行する。
- [x] Windows の npm shim (`gemini.cmd`) を経由せず、`node gemini.js` へ直接委譲する起動経路を追加する。
- [x] Codex CLI の実行モードを `exec` ベースの 1 ショット実行へ切り替える。

### 3. Gemini API の安定化
- [x] 503 / `UNAVAILABLE` の再試行条件を見直す。
- [x] tool 実行前失敗 / tool 実行後失敗 / 部分成功を区別して扱う。
- [x] UI 上で「未作成」「部分成功」「成功」の違いが分かる返答に統一する。
- [x] Gemini CLI / API の default model を `gemini-2.5-pro` に統一する。

### 4. PO コンテキスト精度の改善
- [x] `build_project_context()` に、完了済み story / task の要約を含める方針を決める。
- [x] `ARCHITECTURE.md` / `PRODUCT_CONTEXT.md` / backlog の優先順位を見直す。
- [x] 既存実装済みの DB 設計や一覧・詳細表示機能を再提案しないための文脈を追加する。

### 5. 重複 backlog 防止
- [x] `create_story_and_tasks` 実行前に、既存 story との類似チェックを入れる方針を決める。
- [x] 類似 story がある場合は、新規作成ではなく task 追加へ寄せるか、明示的に失敗させる。
- [x] 抽象依頼時でも既存 backlog を優先活用するルールを system prompt と tool 側の両方に反映する。

### 6. 未検証 provider / transport の確認
- [x] Codex CLI の Windows npm shim (`codex.cmd`) を経由せず、`node codex.js` へ直接委譲する起動経路を追加する。
- [x] Codex CLI の prompt を stdin、最終レスポンスを `--output-last-message` で回収する non-interactive 実行へ変更する。
- [x] Dev エージェントの Codex 実行経路でも stdin prompt / Windows npm shim 回避を `cli_runner` に合わせる。
- [x] Dev エージェント起動時に `TerminalDock` の `fit()` レースで描画例外が出にくいように安全化する。
- [x] Codex Dev エージェント実行時の telemetry `INFO` ログを抑制し、ターミナルを実用的な出力量にする。
- [x] Dev エージェントが補助ドキュメントしか更新できなかった場合は、成功扱いで Review に進めず失敗として返す。
- [x] 設定モーダルで手動選択したチーム設定タブが、初期タブ自動判定で PO アシスタント設定へ戻されないようにする。
- [x] Scaffolding の AI 自動生成が固定 Claude ではなく、PO アシスタント設定の transport / CLI 選択に追従するようにする。
- [x] Codex CLI の `refine_idea` と `chat_with_team_leader` を検証する。
- [x] OpenAI API の `refine_idea` と `chat_with_team_leader` を検証する。
- [x] 成否と制約を setup / handoff に反映する。

### 7. 動作確認
- [x] `cargo test --manifest-path src-tauri/Cargo.toml` が通ること。
- [x] `npm run build` が通ること。
- [x] Claude CLI で backlog 作成が成功すること。
- [x] Claude API で既存実装と重複しない backlog を作成できること。
- [x] Gemini CLI で少なくとも 1 機能は timeout せず完走すること、または UI で原因が分かること。
- [x] Gemini API で 503 発生時の挙動が一貫していること。
- [x] Codex CLI の基本シナリオが確認できること。
- [x] OpenAI API の基本シナリオが確認できること。
