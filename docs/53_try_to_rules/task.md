# EPIC53: Try → ルールパイプライン

## 背景

レトロスペクティブで合意されたTryアイテムは、次のスプリント以降のエージェント動作に反映されるべきである。承認されたTryを「ルール」として永続化し、エージェントのタスク実行プロンプトに自動注入する仕組みを構築する。ルールの管理UIもSettingsPageに追加する。

## ゴール

- RetrospectiveViewの「承認済み Try 一覧」アコーディオン内で、各アイテムをルールとしてON/OFFできるトグルUIを実装する（POからのUX変更要求）
- エージェントのタスク実行プロンプトにアクティブルールを自動注入する
- SettingsPageにルール管理画面を追加する（有効/無効切替、編集、削除）

## スコープ

### 含む

- RetrospectiveViewの「承認済み Try 一覧」にルールON/OFFトグル追加（Story 1 変更）
- `src-tauri/src/claude_runner.rs` の `execute_claude_task` でルール取得・注入
- `src/components/ui/settings/sections/RetroRulesSection.tsx` 新規作成
- ルールの有効/無効切替、インライン編集、削除UI
- 手動ルール追加フォーム

### 含まない

- ルールの自動提案（将来的にSMが提案する拡張は別EPIC）
- ルールの優先度付け（初期実装では全アクティブルールを均等に注入）

## タスクリスト

### Story 1: ルールON/OFFトグルUI（承認済み Try 一覧）※PO要望による変更

> 元の「Tryカラムへのルール化ボタン」案は廃止。代わりに「承認済み Try 一覧」アコーディオン内で直接ルールをON/OFFする。

- [x] `useRetroRules` フックをRetrospectiveViewにインポート
- [x] 各承認済みTryアイテム行にルールON/OFFトグルボタン追加
- [x] トグルON → ルールなければ `addRule`、あれば `updateRule(is_active=true)`
- [x] トグルOFF → `updateRule(is_active=false)`
- [x] 作業中のローディング表示（Loader2アイコン）

### Story 2: プロンプトへのルール注入（バックエンド）

- [x] `execute_claude_task` 内で `get_retro_rules(project_id)` を呼び出し
- [x] アクティブルール（`is_active == true`）をフィルタ
- [x] Markdownリスト形式でフォーマットし `additional_context` に結合
- [x] `build_task_prompt` で「過去のレトロスペクティブからのチームルール」セクションとして表示
- [x] ルールが0件の場合は何も追加しない

### Story 3: ルール管理UI（SettingsPage）

- [x] `SettingsSectionId` に `'retro-rules'` 追加（SettingsContext.tsx）
- [x] `RetroRulesSection.tsx` 新規作成
- [x] SettingsShellのカテゴリ一覧に「レトロ連携 > レトロルール」追加
- [x] `renderSection` に `retro-rules` ケース追加
- [x] ルール一覧表示（内容、ON/OFF、作成日時、レトロ由来バッジ）
- [x] 有効/無効トグルスイッチ
- [x] ルール内容のインライン編集（クリックで編集モード）
- [x] ルール削除（確認ダイアログ付き）
- [x] 新規ルール手動追加フォーム

## 完了条件

- [x] 「承認済み Try 一覧」でルールをON/OFFできる
- [x] エージェントのタスク実行時にアクティブルールがプロンプトに含まれる
- [x] SettingsPageでルールの一覧・有効無効切替・編集・削除・手動追加ができる
- [x] `cargo test` / `npm run build` がエラーなく完了する

---

# 追加スコープ: プレビュー URL 動的抽出とスキャフォールド規約整備

> 作成日: 2026-04-17（Epic 53 の追加作業として合流）

## 背景

プレビュー機能で `{"success":false,"error":"Internal Server Error"}` が表示され、worktree 内の Vite dev サーバーにアクセスできない問題が発生した。

当初は外部から `PORT` 環境変数 / `--port` CLI 引数を強制注入して予約ポート帯域（17820-17899）にバインドさせる Option A で対応したが、Vite ではなくバックエンド API が予期せぬポートで応答するケースや `vite.config.ts` 側の `server.host` 設定との競合が脆弱性として残った。

PO フィードバックにより、外部からのポート/ホスト強制を廃止し、**`npm run dev` の stdout を監視して Vite が出力する `Local: http://...` を動的に抽出する**方式（案X）へ方針転換した。

さらに検証で、scaffolding が生成するフルスタック構成プロジェクトの `package.json` に `concurrently` が設定されず、バックエンドしか起動しないためプレビューがタイムアウトする**スキャフォールド不備**が判明し、これも合わせて是正する。

## ゴール（追加）

1. `preview.rs` の PORT/HOST 環境変数・CLI 引数強制注入を廃止し、Vite のデフォルト挙動に委ねる
2. `npm run dev` の stdout/stderr を監視して Vite の `Local:` / `Network:` ラベル付き URL を正規表現で抽出
3. バックエンド API のログ（`Server running at http://...`）を誤抽出しないよう正規表現を厳格化
4. 起動 URL 検出のタイムアウト（30 秒）と明示的エラーハンドリングを実装
5. `CreateProjectModal` の UI 見切れを修正（Portal で document.body 直下に移動）
6. scaffolding プロンプト（AI CLI / API 両経路）に**フルスタック規約**を追加
7. 全モーダルバックドロップを統一し Tauri native 黒背景の透けを解消
8. Time's Up 状態でスプリント完了ボタンが消える動線バグを修正

## タスクリスト（追加）

### Story 4: preview.rs の stdout 監視方式への書き換え

- [x] `PORT` / `HOST` 環境変数注入を削除
- [x] `--port` / `--host` / `--strictPort` CLI 引数強制注入を削除
- [x] `PREVIEW_PORT_MIN/MAX`, `find_available_port`, `compose_invocation_command` を削除
- [x] `Stdio::null()` → `Stdio::piped()` に変更し stdout/stderr を捕捉
- [x] `spawn_stream_reader` スレッドで行単位に読み、URL 抽出 + パイプ drain を継続
- [x] mpsc チャネルで URL を通知、`recv_timeout` でメインスレッドが待機
- [x] 30 秒タイムアウト実装、検出失敗時は子プロセスを kill してエラー返却
- [x] 子プロセスの早期終了を `child.try_wait()` で検知

### Story 5: URL 抽出ロジックの厳格化

- [x] ANSI エスケープシーケンス除去ロジック追加
- [x] `(?i)\b(Local|Network)\s*:\s*https?://([A-Za-z0-9\.\-]+):(\d{2,5})` への厳格化
- [x] 優先順位: `Local` > `Network`、同ラベル内では `127.0.0.1` > `localhost` > その他
- [x] バックエンド API ログ（`Server running at http://localhost:3000`）を無視する動作をテストで保証

### Story 6: 呼び出し側の URL ベース化

- [x] `open_preview_in_browser` の引数を `port: u16` → `url: String` に変更
- [x] `worktree.rs` の `#[tauri::command]` 側も同様に変更
- [x] `TaskCard.tsx` で `invoke('open_preview_in_browser', { url: info.url })` に変更
- [x] 停止後の再オープン処理も URL ベースに変更

### Story 7: stdout 生ログのデバッグ出力

- [x] `log::info!` と `eprintln!` の両方で stdout/stderr の生行を出力
- [x] URL 抽出成功時、`open_preview_in_browser` 呼び出し時、spawn 時のログ追加

### Story 8: CreateProjectModal の見切れ修正

- [x] ヘッダー / ボディ / フッター 3 層フレックス構造へ再構成
- [x] `react-dom` の `createPortal` で `document.body` 直下にレンダリング
- [x] 小さい画面でもキャンセル/作成ボタンが常に見える状態を保証

### Story 9: scaffolding プロンプトへのフルスタック規約追記

- [x] `build_ai_scaffold_prompt`（AI CLI 経由）にフルスタック規約を追加
- [x] `execute_api_scaffold_generation` の `system_prompt`（API 経由）にも同等規約を追加
- [x] 規約違反時に Vicara プレビューがタイムアウトする旨を明記

### Story 10: モーダルバックドロップ・アプリ背景の統一

- [x] `CreateProjectModal` の backdrop を `bg-slate-900/40 backdrop-blur-sm` に変更
- [x] 共通 `Modal.tsx` の backdrop も同様に統一
- [x] `SprintTimer` の Time's Up モーダル backdrop も統一
- [x] `App.css` の `@layer base` で `html, body, #root` に `min-h-screen` を付与

### Story 11: Time's Up 状態のスプリント完了ボタン復活

- [x] `SprintTimer` ツールバーの「完了にする」ボタン表示条件を `RUNNING | PAUSED` → `RUNNING | PAUSED | TIME_UP` に拡張
- [x] 「タイマーリセット」は従来通り `COMPLETED | TIME_UP` で表示

## 完了条件（追加）

- [x] `cargo test --lib preview` が全 15 件 pass
- [x] `cargo build --lib` / `npm run build` がエラーなく完了
- [x] バックエンドのログ URL を誤抽出しない
- [x] CreateProjectModal が縦 700px 画面でもボタン表示
- [x] 全モーダルが統一バックドロップで表示される
- [x] Time's Up 後もツールバーから「完了にする」が操作できる
