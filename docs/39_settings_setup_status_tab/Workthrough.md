# Epic 39 Workthrough

## 概要

Epic 39 は当初、「設定画面にセットアップ状況タブを追加し、Git / CLI / API キーの準備状態を確認できるようにする」ことが主目的だった。実装を進める中で、実際の運用上はそれだけでは不十分であることが分かり、最終的には以下まで含む拡張 Epic になった。

- セットアップ状況タブの実装
- API キー有無を返す安全な Tauri コマンドの追加
- Global Settings のタブ再編成
- Team Settings での CLI 種別切替対応
- 5 ロールテンプレートの自動補完
- Gemini CLI の Windows 実行安定化
- Analytics（LLM Observability）の独立タブ化
- Analytics 表示のノイズ削減と CLI provider 補正
- Dev エージェント 5 テンプレートへの既定アバター割り当て

この Workthrough では、当初計画からどのように拡張されたかと、特に Gemini CLI 特有の実行課題をどう解決したかを記録する。

## 当初計画と実装の拡張

PO 承認済みの `implementation_plan.md` では、対象は主に次の 2 点だった。

1. `SetupStatusTab` を追加し、Git / CLI / API キーの状態を表示する。
2. `GlobalSettingsModal` にセットアップ状況タブを追加し、未セットアップ時はそこをデフォルト表示する。

実装中に、実環境では以下の課題が顕在化した。

- Windows の npm グローバル CLI は `*.cmd` shim であり、単純な `Command::new("gemini")` では起動できないケースがある。
- Team Settings が Claude 前提の UI のままで、Gemini / Codex をロールへ割り当てられない。
- 旧 1 テンプレート構成の既存データでは、新しい 5 ロール運用へ自然移行できない。
- LLM Observability がプロジェクト設定内に埋まり、役割として独立した Analytics 画面が必要だった。
- Gemini CLI は Claude CLI と異なり、workspace 外の prompt ファイル参照や旧引数仕様で失敗しやすい。

そのため Epic 39 は、実質的に Epic 40 相当の Team Settings CLI 対応と、Gemini 結合安定化まで包含する形に拡張された。

## 実装の軌跡

### 1. セットアップ状況タブの実装

まず `src/components/ui/SetupStatusTab.tsx` を新規作成し、以下を 1 画面で確認できるようにした。

- Git の導入状況
- Claude Code CLI / Gemini CLI / Codex CLI の導入状況
- Anthropic / Gemini API キーの設定有無
- 未導入時の導入リンク
- 手動再検出ボタン

バックエンドでは `check_api_key_status` コマンドを追加し、`settings.json` から API キーの実値ではなく「設定済みかどうか」だけを返す形にした。これにより、設定画面から安全に状態確認ができるようになった。

### 2. Global Settings の再編

設定画面のタブ順は次の順序に再構成した。

1. セットアップ状況
2. POアシスタント設定
3. チーム設定
4. アナリティクス
5. プロジェクト設定

最初は 4 タブ構成だったが、後半で LLM Observability を独立させたため、最終的には `アナリティクス` タブが追加された。

また、CLI が 1 つもない、または API キーが未設定の場合には、セットアップ状況タブをデフォルトで開くようにした。

### 3. Team Settings の CLI 種別対応

当初計画では対象外だったが、実運用上はロールごとに `Claude / Gemini / Codex` を選べないと意味がないため、Team Settings を拡張した。

- ロールごとに CLI 種別を選択可能にした
- CLI 種別ごとにモデル入力欄の案内を切り替えた
- 未導入 CLI は選択不可にした
- Codex 導入リンクを OpenAI の CLI ページへ更新した

これにより、UI/UX Designer を Gemini、Lead Engineer を Claude、将来的な別ロールを Codex のように割り当てられるようになった。

### 4. 5 ロールテンプレート補完

初期構成を 5 テンプレートに標準化した。

1. Lead Engineer
2. Security & System Architect
3. UI/UX Designer & Multimedia Specialist
4. QA Engineer
5. PMO & Document Manager

補完ロジックは backend の `ensure_default_team_templates()` に寄せた。これにより、フロントエンドの一時状態ではなく DB レベルで一貫したテンプレート構成を保証できるようになった。

実装方針は次の通り。

- ロールが 0 件なら 5 件を新規投入する
- ロールが 1 件だけなら、その 1 件を Lead Engineer 枠として残し、残り 4 件を追加する
- 新規プロジェクト作成時にも、チームテンプレートを必ず 5 件そろえる

このロジックにより、旧構成からの移行と新規構成の統一を同時に満たした。

## Gemini CLI 特有の実行課題と解決

Epic 39 の中で最も実運用に影響したのが Gemini CLI の結合課題だった。主な論点は 3 つある。

### 1. 実体パスの解決

Windows では Gemini CLI を npm グローバル導入すると、実体は `gemini.cmd` になる。初期実装では CLI 検出時に導入済み判定が取れても、実行時は `Command::new("gemini")` を使っていたため、アプリ起動時の `PATH` によっては `program not found` で失敗した。

これに対し、`cli_detection.rs` に「実際に `--version` 実行へ成功したパスを解決する関数」を追加し、`claude_runner.rs` 側ではその解決済みパスをそのまま起動へ使うように修正した。これで、検出と実行が同じ CLI 実体を参照するようになり、Windows の npm shim 問題を解消できた。

### 2. ワークスペース内での prompt ファイル配置

CLI 実行時には、役割とタスク指示を prompt ファイルに書き出し、そのパスを Gemini に渡していた。初期実装ではこのファイルを `%TEMP%` に置いていたが、Gemini CLI は workspace 外ファイルの読込を拒否するため、`Path not in workspace` で失敗した。

これに対し、prompt ファイルの作成先を `%TEMP%` から「実際の作業ワークツリー配下 `.vicara-agent/`」へ変更した。こうすることで Gemini から見ても workspace 内の許可済みファイルになり、prompt ファイル参照エラーを解消できた。終了時にはファイルだけでなく `.vicara-agent/` ディレクトリも必要に応じて削除するようにしている。

### 3. オプション引数の衝突回避

Epic 38 からの引き継ぎでは、Gemini CLI は `--sandbox permissive` 想定で実装されていた。しかし実機で `gemini --help` を確認すると、現行 CLI の `--sandbox` は boolean フラグであり、後続の `permissive` は位置引数として解釈されてしまう。その結果、`-p/--prompt` と位置引数が同時に渡された扱いになり、headless 実行が失敗した。

そこで `src-tauri/src/cli_runner/gemini.rs` を更新し、`--sandbox permissive` をやめて `--approval-mode yolo` を使う形へ変更した。これにより、Gemini CLI の現行ヘルプ仕様に沿った headless 実行へ切り替えることができた。

## エラー表示先のズレ修正

Gemini 起動エラーの調査中に、エラーが別タスクのターミナルタブへ表示される問題も見つかった。原因は、起動失敗時にフロントエンドへ送っていたイベントが単なる文字列で、`taskId` を含んでいなかったことだった。

これを次の形で修正した。

- `TaskCard.tsx` 側で `taskId / taskTitle / roleName / model / message` を持つ `claude_error` イベントを送る
- `TerminalDock.tsx` 側でその payload を解釈し、失敗したタスク専用のセッションを作成する
- アクティブタブではなく、対象タスクのタブへログを紐付ける

これにより、Gemini の起動失敗でも正しいタスクの文脈でエラーを追えるようになった。

## Analytics（LLM Observability）の UI 分離

LLM Observability は当初 `プロジェクト設定` タブの一部として配置されていたが、情報量と用途が独立していたため、`AnalyticsTab.tsx` を新設して `アナリティクス` タブへ分離した。

UI 分離に合わせて、表示上の整理も行っている。

- `~$0.000` の Source / Model 内訳は表示しない
- CLI usage の注意文を Claude 固定ではなく「CLI 実行の一部は厳密 token 未計測」とした
- CLI usage の provider 表記を `claude_cli / gemini_cli / codex_cli` へ分離した
- 既存の legacy データで `claude_cli` と保存されている Gemini 系モデルも、表示側で `GEMINI_CLI` と解釈できるよう補正した

これにより、Analytics が設定項目の付属情報ではなく、独立した監視・把握画面として機能するようになった。

## 5 件強制補完と既定アバター割り当て

ロールテンプレートは 5 件構成を標準化しただけでなく、Dev エージェントの見た目も role 順に識別しやすくした。

`public/avatars` に追加された以下の資産を前提に、backend seed と保存ロジックの両方で既定アバターを割り当てている。

- `dev-agent-1.png`
- `dev-agent-2.png`
- `dev-agent-3.png`
- `dev-agent-4.png`
- `dev-agent-5.png`

割り当てはテンプレート順で固定している。

1. Lead Engineer → `dev-agent-1.png`
2. Security & System Architect → `dev-agent-2.png`
3. UI/UX Designer & Multimedia Specialist → `dev-agent-3.png`
4. QA Engineer → `dev-agent-4.png`
5. PMO & Document Manager → `dev-agent-5.png`

さらに、既存テンプレートでも `avatar_image` が空なら `sort_order` に応じて既定アバターを補完するようにした。Team Settings で「デフォルトに戻す」を押して `null` 保存になった場合も、保存時に backend 側で既定値が再注入される。

PO アシスタント側の generic fallback は、将来の拡張を見越して `po-assistant-1.png` を参照するように変更した。

## 互換性上の判断

実装全体では、既存 UI との互換性のために一部名称を残している。

- Tauri コマンド名 `execute_claude_task`
- イベント名 `claude_cli_started / claude_cli_output / claude_cli_exit / claude_error`

内部的には Gemini / Codex / Claude を切り替えているが、既存フロントエンドと IPC 契約を壊さないため、命名は据え置いた。Analytics では provider / transport を分離し、可視化上は正しい CLI 種別が見えるように補正している。

## 検証

実装のたびに `task.md` を更新し、以下を継続的に確認した。

- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml`

最終的に、ビルドと Rust テストは通過している。

## まとめ

Epic 39 は単なる設定タブ追加では終わらず、実運用で必要な CLI 統合・テンプレート標準化・Analytics 分離・Gemini 安定化までを取り込んだ基盤整備 Epic になった。

特に Gemini CLI 対応では、

- 実体パスの解決
- workspace 内での prompt ファイル配置
- 現行 CLI 仕様に沿った引数整理

の 3 点を通して、単に「選べる」だけでなく「実際に完了まで走る」状態へ引き上げたことが大きい。今後の Epic は、この安定した基盤の上でさらに role テンプレートや Analytics の活用を拡張できる状態になっている。
