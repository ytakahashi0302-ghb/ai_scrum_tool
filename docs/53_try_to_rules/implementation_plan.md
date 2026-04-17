# EPIC53 実装計画

## 概要

レトロスペクティブの成果をエージェント動作に反映するパイプラインを構築する。承認済みTryアイテム → ルール化 → プロンプト注入 → Settings管理の一連のフローを実装する。

## 現状整理

### build_task_prompt（claude_runner.rs L188-208）

```rust
fn build_task_prompt(
    task: &db::Task,
    role: &db::TeamRole,
    additional_context: Option<&str>,
) -> String {
    let extra_context = additional_context
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| format!("\n# 追加コンテキスト\n{}\n", value))
        .unwrap_or_default();

    format!(
        "あなたは {} です。\n{}\n\n# タスク名\n{}\n\n# 詳細\n{}\n{}# 作業指示\n...",
        role.name.trim(), role.system_prompt.trim(),
        task.title.trim(), description.trim(), extra_context
    )
}
```

### execute_claude_task（claude_runner.rs L1081-）

```rust
pub async fn execute_claude_task(
    ...
    additional_context: Option<String>,
    ...
) -> Result<(), String> {
    ...
    let prompt = build_task_prompt(&task, &role, additional_context.as_deref());
    ...
}
```

`additional_context` は既にフロントエンドから渡せる設計。ルール注入はこのパラメータに結合する形で実装する。

### SettingsPage構造

`src/components/ui/settings/` 配下にセクション別コンポーネントが配置されている。

## 実施ステップ

### Step 1: ルール注入（バックエンド）

`execute_claude_task` 内で、ルールをadditional_contextに結合:

```rust
// execute_claude_task内（L1190付近、build_task_prompt呼び出し前）
let rules = db::get_retro_rules(&app_handle, &project_id).await
    .unwrap_or_default()
    .into_iter()
    .filter(|r| r.is_active != 0)
    .collect::<Vec<_>>();

let rules_section = if rules.is_empty() {
    String::new()
} else {
    let rules_text = rules.iter()
        .map(|r| format!("- {}", r.content))
        .collect::<Vec<_>>()
        .join("\n");
    format!("# 過去のレトロスペクティブからのルール\n以下のルールを遵守してください:\n{}", rules_text)
};

// additional_contextとルールを結合
let combined_context = match (additional_context.as_deref(), rules_section.is_empty()) {
    (Some(ctx), false) => Some(format!("{}\n\n{}", ctx, rules_section)),
    (Some(ctx), true) => Some(ctx.to_string()),
    (None, false) => Some(rules_section),
    (None, true) => None,
};

let prompt = build_task_prompt(&task, &role, combined_context.as_deref());
```

### Step 2: ルール化UI（RetrospectiveView）

RetrospectiveView のTryカラム内、承認済みアイテムに「ルール化」ボタンを追加:

```tsx
// TryカラムのKPTカード内
{item.is_approved && item.category === 'try' && (
    <button
        onClick={() => handleConvertToRule(item)}
        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        disabled={isRuleConverted(item.id)}
    >
        <Shield size={12} />
        {isRuleConverted(item.id) ? 'ルール化済み' : 'ルール化'}
    </button>
)}
```

`handleConvertToRule`:
```typescript
const handleConvertToRule = async (item: RetroItem) => {
    // 確認ダイアログ
    const confirmed = window.confirm(`以下をルールとして追加しますか？\n\n${item.content}`);
    if (!confirmed) return;

    await addRule(item.content, item.id, selectedSprintId);
    // 成功フィードバック
};
```

### Step 3: ルール管理UI（SettingsPage）

`src/components/ui/settings/RetroRulesSection.tsx` を新規作成:

```tsx
// レイアウト構造
RetroRulesSection
├── セクションヘッダー「レトロスペクティブ ルール」
├── 新規ルール追加フォーム
│   ├── テキストエリア
│   └── 追加ボタン
└── ルール一覧
    └── RuleRow（繰り返し）
        ├── トグルスイッチ（有効/無効）
        ├── ルール内容（インライン編集可能）
        ├── 作成元情報（スプリント名、日時）
        └── 削除ボタン
```

SettingsPage本体に `RetroRulesSection` を追加:

```tsx
// SettingsPage.tsx 内
<RetroRulesSection projectId={currentProjectId} />
```

### Step 4: フロントエンドHook修正

`useRetroRules` hookに以下を確認:
- `addRule(content, retroItemId?, sprintId?)` — ルール追加
- `updateRule(id, content?, isActive?)` — 有効無効切替・編集
- `deleteRule(id)` — 削除

## リスクと対策

### リスク 1: ルールの蓄積によるプロンプト肥大化

- 初期実装ではルール数の上限を設けない（通常は少数のルールが想定される）
- 将来的にルール数が増えた場合は、プロンプトトークン数を監視してwarnログを出す

### リスク 2: additional_contextとの結合による書式崩れ

- ルールセクションはMarkdown見出し付きで独立したセクションとして追加する
- 既存のadditional_contextとは改行2つで区切る

### リスク 3: SettingsPageの肥大化

- 独立コンポーネントとして分離し、SettingsPage本体への影響を最小化する

## テスト方針

### 自動テスト

- ルール注入後のプロンプト文字列にルールセクションが含まれることを確認
- ルール0件時にルールセクションが追加されないことを確認
- additional_contextとルールの結合パターン（両方あり / どちらかのみ / なし）のテスト

### 手動確認

- RetrospectiveViewでTryアイテムを承認→ルール化→SettingsPageで確認
- ルールを有効にした状態でエージェントタスク実行→プロンプトにルールが含まれることを確認（ログ or .vicara-agentファイル確認）
- ルールを無効にした状態で同様に確認→ルールが含まれないことを確認
- ルールの編集・削除が正しく動作することを確認

## 成果物

- `src-tauri/src/claude_runner.rs`（ルール注入ロジック追加）
- `src/components/kanban/RetrospectiveView.tsx`（ルール化ボタン追加）
- `src/components/ui/settings/RetroRulesSection.tsx`（新規）
- `src/components/ui/settings/SettingsPage.tsx`（セクション追加）

---

# 追加実装計画: プレビュー URL 動的抽出とスキャフォールド規約整備

> 作成日: 2026-04-17

## 方針概要

外部からポートを強制する Option A の脆弱性を廃し、dev サーバーの実際の起動 URL を stdout から動的に抽出する**案X**へ方針転換する。副次的に判明したスキャフォールド不備（フルスタック構成時の `concurrently` 欠落）も合わせて是正する。

## アーキテクチャ方針

### preview.rs

- dev サーバーは `npm run dev` をそのまま呼び出す（PORT/HOST 干渉なし）
- stdout / stderr を `Stdio::piped()` で受け取り、専用スレッドで行単位に読む
- Vite が出力する `Local:` / `Network:` ラベル付き URL のみを正規表現で抽出
- 抽出スレッドは通知後も読み続け、パイプバッファ満杯による子プロセスブロックを防ぐ
- mpsc チャネル + `recv_timeout(200ms)` のポーリングループで、URL 到着・子プロセス早期終了・タイムアウトの 3 条件を同時監視

### URL 抽出の厳格化

**悪い正規表現（初期案）**:
```
https?://([A-Za-z0-9\.\-]+):(\d{2,5})
```
→ バックエンド API のログ `Server running at http://localhost:3000` を誤抽出

**良い正規表現（最終案）**:
```
(?i)\b(Local|Network)\s*:\s*https?://([A-Za-z0-9\.\-]+):(\d{2,5})
```
→ Vite 固有の `Local:` / `Network:` ラベル前置を必須化

優先順位:
1. `Local:` + `127.0.0.1`
2. `Local:` + `localhost`
3. `Local:` + その他ホスト
4. `Network:` + `127.0.0.1`
5. `Network:` + `localhost`
6. `Network:` + その他ホスト（LAN IP、localhost 解決失敗環境向けのフォールバック）

### インターフェース変更

| 対象 | Before | After |
|---|---|---|
| `preview::open_preview_in_browser` | `(app_handle, port: u16)` | `(app_handle, url: &str)` |
| `worktree::open_preview_in_browser` command | `{port: u16}` | `{url: String}` |
| TaskCard `invoke` 呼び出し | `{port: info.port}` | `{url: info.url}` |
| `PreviewServerInfo.url` | 固定 `http://127.0.0.1:{port}` | stdout から抽出した実 URL |

### scaffolding.rs

2 つの scaffolding 経路（AI CLI / API）のプロンプトに**フルスタック規約**を追記する:

- ルート `package.json` の devDependencies に `concurrently`
- scripts:
  - `"dev": "concurrently -n api,web -c blue,green \"npm:dev:api\" \"npm:dev:web\""`
  - `"dev:api"`: バックエンド起動
  - `"dev:web"`: フロントエンド起動（`npm --prefix frontend run dev` など）
- `frontend/` 側に独立 `package.json` + Vite `dev` スクリプト
- バックエンドは dev モードで `frontend/dist` を serve しない（CORS / Vite プロキシで API 中継）
- 規約違反時に Vicara プレビューがタイムアウトする旨を明記

### CreateProjectModal

2 段階の修正:

**段階1**: 3 層フレックスレイアウト（ヘッダー / ボディ / フッター）に再構成。ボディだけスクロール、フッターは常に固定。

**段階2**: PO 検証でもなおヘッダー内に閉じ込められる見切れが確認されたため、`react-dom` の `createPortal` でモーダルツリー全体を `document.body` 直下にマウントする。

```tsx
return createPortal(
    <div className="fixed inset-0 ...">...</div>,
    document.body,
);
```

**原因と設計判断**:
- `CreateProjectModal` は `ProjectSelector`（ヘッダー内コンポーネント）からレンダリングされる
- 祖先に `overflow: hidden` / `transform` / `filter` / `will-change` のいずれかがあると、`position: fixed` の**包含ブロックがビューポートではなくその祖先**になり（CSS spec）、モーダルがヘッダー領域に閉じ込められる
- Portal で DOM ツリー的に祖先を切り離すことで、この問題を根本的に解決できる

### モーダルバックドロップの統一

**問題**: Tauri ウィンドウの native 背景が黒のため、`bg-black bg-opacity-50` の backdrop を重ねるとアプリ全体が真っ黒に見える。

**解決策**:
- 全モーダルのオーバーレイを `bg-slate-900/40 backdrop-blur-sm` に統一
- `App.css` の `@layer base` で `html, body, #root` に `min-h-screen` を付与

**対象ファイル**: `CreateProjectModal.tsx`, `ui/Modal.tsx`, `SprintTimer.tsx`, `App.css`

### Time's Up バグ修正

**問題**: `TIME_UP` 時にツールバーから「完了にする」ボタンが消失し「タイマーリセット」しか残らない。

**解決策**: 表示条件を `RUNNING | PAUSED` → `RUNNING | PAUSED | TIME_UP` に拡張。TIME_UP 中は両ボタンが並列表示される。

## 変更ファイル一覧（追加）

| ファイル | 変更区分 | 内容 |
|---|---|---|
| `src-tauri/src/preview.rs` | 全面書き換え | stdout 監視方式。ANSI 除去 + Local/Network 厳格化 + 30 秒タイムアウト + 生ログ |
| `src-tauri/src/worktree.rs` | 修正 | `open_preview_in_browser` 引数を port → url に変更 |
| `src/components/kanban/TaskCard.tsx` | 修正 | `invoke('open_preview_in_browser', { url })` |
| `src/components/CreateProjectModal.tsx` | 修正 | 3 層レイアウト + Portal + backdrop 統一 |
| `src/components/ui/Modal.tsx` | 修正 | backdrop を `bg-slate-900/40 backdrop-blur-sm` に統一 |
| `src/components/SprintTimer.tsx` | 修正 | backdrop 統一 + TIME_UP 時の完了ボタン表示条件拡張 |
| `src/App.css` | 修正 | `html, body, #root` に `min-h-screen` 付与 |
| `src-tauri/src/scaffolding.rs` | 修正 | 両 scaffolding 経路にフルスタック規約追記 |

## テスト方針（追加）

### 自動テスト（`cargo test --lib preview`、全 15 件 pass）

- `normalize_preview_command_*`（3 件）: コマンド正規化
- `extract_url_picks_loopback_when_present` / `_picks_localhost_when_loopback_missing` / `_prefers_loopback_over_network` / `_falls_back_to_network_when_only_network_present`
- `extract_url_handles_ansi_color_codes`
- `extract_url_returns_none_for_unrelated_line` / `_ignores_too_short_port`
- **バックエンド誤抽出防止の回帰テスト**: `_ignores_backend_server_log` / `_ignores_listening_on_log` / `_ignores_url_without_label_prefix` / `_picks_vite_local_when_backend_also_logs` / `_matches_network_label_for_lan_ip`

### ビルド検証

- `cargo build --lib` — warnings/errors なし
- `npm run build` — 型エラーなし

### 手動検証

| 項目 | 期待結果 |
|---|---|
| Vite 単体でプレビュー | 数秒以内にブラウザで `http://127.0.0.1:PORT` が開く |
| バックエンド + Vite 同居 | Vite の Local URL のみ採用、バックエンド URL 無視 |
| バックエンドのみ起動 | 30 秒タイムアウトで明示エラー |
| 小さい画面でモーダル表示 | キャンセル/作成ボタンが常に見える |
| 新規 scaffolding 実行 | ルート package.json に concurrently 付き |

### デバッグ補助

Tauri 起動元コンソールに次のログが出力される:

```
[vicara::preview] spawn: task_id=... cwd=... cmd=`npm run dev`
[vicara::preview::stdout] <生の行>
[vicara::preview::stderr] <生の行>
[vicara::preview] URL extracted: http://... (port ...)
[vicara::preview] open_preview_in_browser: url=http://...
```

## リスクと回避策（追加）

| リスク | 回避策 |
|---|---|
| 子プロセス stdout pipe バッファ満杯で dev サーバーがブロック | URL 検出後も reader スレッドを drain 継続 |
| Vite が `--host` 未指定で Local のみ出力 → localhost 解決失敗環境で到達不可 | Network ラベル行もフォールバック採用 |
| Vite 起動が 30 秒以内に完了しない | タイムアウトを 30 秒に設定、将来的に設定化検討 |
| 既存の壊れた package.json を持つ既存プロジェクト | 本タスクでは対応外（別タスクで救済 UI） |
| scaffolding プロンプト追記を AI が守らない | 規約違反時の具体的な失敗挙動を明記し遵守動機を高める |

## 実装順序

1. preview.rs の書き換え（案X 本体）
2. URL 抽出ロジックの厳格化（Local/Network ラベル必須化）
3. 生ログ出力追加
4. CreateProjectModal のレイアウト修正 + Portal 化
5. scaffolding プロンプトへの規約追記
6. モーダルバックドロップ統一 + App.css 修正
7. Time's Up バグ修正
8. 全テスト・ビルド検証
