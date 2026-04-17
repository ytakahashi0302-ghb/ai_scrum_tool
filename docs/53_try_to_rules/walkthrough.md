# Epic 53 実装ウォークスルー

> 作成日: 2026-04-17

---

## 変更ファイル一覧

| ファイル | 変更区分 | 内容 |
|---|---|---|
| `src/components/kanban/RetrospectiveView.tsx` | 修正 | 承認済みTry一覧にルールON/OFFトグル追加 |
| `src-tauri/src/claude_runner.rs` | 修正 | execute_claude_taskにルール取得・注入処理追加 |
| `src/components/ui/settings/SettingsContext.tsx` | 修正 | `SettingsSectionId` に `'retro-rules'` 追加 |
| `src/components/ui/settings/SettingsShell.tsx` | 修正 | サイドバーカテゴリとrenderSectionにretro-rules追加 |
| `src/components/ui/settings/sections/RetroRulesSection.tsx` | 新規 | ルール管理UIコンポーネント |

---

## Story 1: 承認済み Try 一覧でのルールON/OFF統合

### 変更内容（RetrospectiveView.tsx）

**追加インポート:**
- `useRetroRules` フック
- `Shield` アイコン（lucide-react）

**フック追加:**
```tsx
const { rules, fetchRules, addRule, updateRule } = useRetroRules();
```

**useEffect追加（承認済みTry更新時にルール再取得）:**
```tsx
useEffect(() => {
    void fetchRules();
}, [fetchRules, approvedTryItems]);
```

**ハンドラ追加（handleRuleToggle）:**
- `retro_item_id === item.id` でルールを検索
- ルールなし + ONにする → `addRule(content, item.id, { sprintId })`
- ルールあり → `updateRule(id, content, enable)`

**UI変更（承認済みTry一覧の各行）:**
- 日付とルールトグルボタンを横並びに配置
- トグルボタン: `ルール ON` / `ルール OFF` のラベル付きpill
- 作業中は `Loader2` アニメーション表示
- ON状態: `border-blue-200 bg-blue-50 text-blue-700`
- OFF状態: グレー → ホバーで青に変化

### 動作フロー

```
承認済みTry一覧を展開
  → ルール一覧を fetchRules() で取得
  → 各アイテムの retro_item_id でルールを照合
  → トグルボタンに現在の状態を表示

[ルール OFF → ON クリック]
  → existingRule が null → addRule() で新規作成 (is_active=true)
  → existingRule あり → updateRule(id, content, true)
  → fetchRules() で再取得 → UI更新

[ルール ON → OFF クリック]
  → updateRule(id, content, false)
  → fetchRules() で再取得 → UI更新
```

---

## Story 2: プロンプトへのルール注入（バックエンド）

### 変更内容（claude_runner.rs）

`execute_claude_task` 内の `build_task_prompt` 呼び出し前に挿入:

```rust
// アクティブなレトロルールを取得してプロンプトに注入する
let rules_section = {
    let all_rules = db::get_retro_rules(app_handle.clone(), task.project_id.clone())
        .await
        .unwrap_or_default();
    let active_rules: Vec<_> = all_rules.into_iter().filter(|r| r.is_active).collect();
    if active_rules.is_empty() {
        String::new()
    } else {
        let rules_text = active_rules.iter()
            .map(|r| format!("- {}", r.content))
            .collect::<Vec<_>>()
            .join("\n");
        format!(
            "# 過去のレトロスペクティブからのチームルール\n以下のルールを遵守してください:\n{}",
            rules_text
        )
    }
};

let combined_context = match (additional_context.as_deref(), rules_section.is_empty()) {
    (Some(ctx), false) => Some(format!("{}\n\n{}", ctx, rules_section)),
    (Some(ctx), true)  => Some(ctx.to_string()),
    (None, false)      => Some(rules_section),
    (None, true)       => None,
};

let prompt = build_task_prompt(&task, &role, combined_context.as_deref());
```

### 注入されるプロンプト例

```markdown
あなたは Developer です。
...

# タスク名
ユーザー認証機能の実装

# 詳細
...

# 過去のレトロスペクティブからのチームルール
以下のルールを遵守してください:
- コードレビュー前に必ずユニットテストを追加すること
- PRのタイトルは日本語で記述すること

# 作業指示
...
```

---

## Story 3: ルール管理UI（SettingsPage）

### SettingsContext.tsx

`SettingsSectionId` 型に `'retro-rules'` を追加。

### SettingsShell.tsx

**サイドバーカテゴリ追加:**
```
レトロ連携
  └── レトロルール（エージェントへのルール注入管理）
```

**renderSection ケース追加:**
```tsx
case 'retro-rules':
    return <SettingsSection title="レトロルール" ...>
        <RetroRulesSection />
    </SettingsSection>
```

### RetroRulesSection.tsx（新規）

**機能一覧:**
| 機能 | 説明 |
|---|---|
| ルール一覧表示 | 内容・ON/OFF状態・作成日時・レトロ由来バッジ |
| ON/OFFトグル | クリックで `updateRule(is_active)` を呼び出し |
| インライン編集 | テキストクリックで編集モードに移行、保存・キャンセル |
| ルール削除 | 確認ダイアログ付きで `deleteRule` を呼び出し |
| 手動追加 | テキストエリア + 追加ボタンで `addRule` を呼び出し |
| レトロ由来表示 | `retro_item_id` が存在する場合に「レトロ由来」バッジ表示 |

---

## 検証結果

### 自動テスト

```
cargo test: 92 passed; 0 failed ✅
npm run build: ✓ built in 6.97s (型エラーなし) ✅
```

チャンクサイズ警告（997KB）は Epic 52 引き継ぎ書に記載された既知問題のため対象外。

### 手動確認項目（今後）

- [ ] レトロ画面で承認済みTryのトグルをONにする → ルールが作成される
- [ ] 設定画面「レトロルール」でルールが表示される
- [ ] ルールをONにした状態でエージェントタスク実行 → `.vicara-agent/vicara-agent-prompt-*.md` にルールセクションが含まれる
- [ ] ルールをOFFにした状態 → プロンプトにルールが含まれない
- [ ] 設定画面でルールのインライン編集・削除・手動追加が動作する

---

## 設計判断メモ

- **Story 1 のUI変更**: POからの要求により、当初のTryカラムへのボタン案を廃棄。承認済みTry一覧アコーディオン内でのトグル操作に変更。この設計の方がルール状態を一覧で俯瞰できるため、UX的にも優れている。
- **ルール取得の失敗処理**: `get_retro_rules` は `unwrap_or_default()` でエラー時は空配列扱いとし、タスク実行を止めない。
- **`app_handle.clone()`**: `get_retro_rules` は `#[tauri::command]` で `AppHandle` を owned で受け取るため、`.clone()` で渡す。`AppHandle` は参照カウント型のため低コスト。

---

# 追加ウォークスルー: プレビュー URL 動的抽出とスキャフォールド規約整備

> 作成日: 2026-04-17

## 変更ファイル一覧（追加）

| ファイル | 変更区分 | 内容 |
|---|---|---|
| `src-tauri/src/preview.rs` | 全面書き換え | stdout 監視方式。Local/Network ラベル必須、ANSI 除去、30 秒タイムアウト、生ログ出力 |
| `src-tauri/src/worktree.rs` | 修正 | `open_preview_in_browser` 引数を `port: u16` → `url: String` |
| `src/components/kanban/TaskCard.tsx` | 修正 | `invoke('open_preview_in_browser', { url })` 対応 |
| `src/components/CreateProjectModal.tsx` | 修正 | 3 層フレックス + `createPortal` で `document.body` 直下へ移動 + backdrop 統一 |
| `src/components/ui/Modal.tsx` | 修正 | backdrop を `bg-slate-900/40 backdrop-blur-sm` に統一 |
| `src/components/SprintTimer.tsx` | 修正 | backdrop 統一 + TIME_UP 時の完了ボタン表示条件拡張 |
| `src/App.css` | 修正 | `html, body, #root` に `min-h-screen` 付与 |
| `src-tauri/src/scaffolding.rs` | 修正 | AI CLI / API 両経路の system_prompt にフルスタック規約を追記 |

---

## Story 4-7: preview.rs 書き換え（案X）

### 廃止したもの

- 予約ポート帯域 `PREVIEW_PORT_MIN/MAX`（17820-17899）と `find_available_port()`
- `compose_invocation_command()`（`-- --host 127.0.0.1 --port N --strictPort` の注入）
- `PORT` / `HOST` 環境変数の設定
- `Stdio::null()`

### 新方式の骨格

```rust
fn spawn_preview_process(worktree_path, command) -> Result<Child, String> {
    Command::new(...)
        .args([...command...])
        .env("BROWSER", "none")
        .env("FORCE_COLOR", "0")
        .env("NO_COLOR", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
}

fn spawn_stream_reader<R: Read + Send + 'static>(
    reader: R, stream_name: &'static str, sender: mpsc::Sender<(String, u16)>,
) {
    thread::spawn(move || {
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            log::info!(...); eprintln!(...);  // 生ログ
            if !notified {
                if let Some((url, port)) = extract_url_from_line(&line, &re) {
                    let _ = sender.send((url, port));
                    notified = true;
                }
            }
            // 通知後も drain し続け、pipe 詰まりを防ぐ
        }
    });
}
```

### メインスレッドの待機ループ

```rust
let deadline = Instant::now() + Duration::from_secs(30);
loop {
    if let Some(status) = child.try_wait()? {
        return Err(format!("すぐ終了: {:?}", status));
    }
    match rx.recv_timeout(Duration::from_millis(200)) {
        Ok(detected) => break detected,
        Err(Timeout) if Instant::now() >= deadline => {
            child.kill(); return Err("30秒タイムアウト".into());
        }
        Err(Timeout) => continue,
        Err(Disconnected) => { child.kill(); return Err("ストリーム切断"); }
    }
}
```

3 条件（URL 到着 / 早期終了 / タイムアウト）を同時監視するため、`try_wait` と `recv_timeout` を 200ms 間隔でポーリング。

---

## Story 5: URL 抽出の厳格化（バックエンド誤抽出回避）

### 問題

フルスタック構成で `npm run dev` がバックエンドと Vite を concurrently で同時起動する場合、バックエンドのログ

```
Server running at http://localhost:3000
```

を初期の緩い正規表現が先に拾ってしまい、Vite（5173）ではなくバックエンド（3000）を開いてしまっていた。

### 解決策

```rust
fn url_regex() -> Regex {
    Regex::new(r"(?i)\b(Local|Network)\s*:\s*https?://([A-Za-z0-9\.\-]+):(\d{2,5})")
        .expect("valid regex")
}
```

ANSI エスケープシーケンス（Vite の色付け `\x1B[36m...\x1B[39m`）は `\x1B\[[0-9;]*[a-zA-Z]` で事前除去。

### 優先順位

```rust
let label_priority = if label.eq_ignore_ascii_case("Local") { 0 } else { 10 };
let host_priority = match host {
    "127.0.0.1" => 0,
    "localhost" => 1,
    _ => 2,
};
let priority = label_priority + host_priority;
```

`Local:` を `Network:` より強く優先し、同ラベル内では loopback > localhost > LAN IP の順。

---

## Story 6: 呼び出し側の URL ベース化

### worktree.rs

```rust
#[tauri::command]
pub async fn open_preview_in_browser(app_handle: AppHandle, url: String) -> Result<(), String> {
    preview::open_preview_in_browser(&app_handle, &url)
}
```

### TaskCard.tsx

```tsx
await invoke('open_preview_in_browser', { url: info.url });
```

`PreviewServerInfo.url` は stdout から抽出された実際の URL になる。

---

## Story 7: 生ログ出力によるデバッグ容易化

```
[vicara::preview] spawn: task_id=... cwd=... cmd=`npm run dev`
[vicara::preview::stdout] <Vite/バックエンドの生出力>
[vicara::preview::stderr] <同 stderr>
[vicara::preview] URL extracted: http://... (port ...)
[vicara::preview] open_preview_in_browser: url=http://...
```

`log::info!` と `eprintln!` の両方に出力。この生ログのおかげで、フルスタック構成時にバックエンドしか起動していないこと（concurrently 欠落）が即座に判明した。

---

## Story 8: CreateProjectModal の見切れ修正

### 段階1: 3 層フレックス構造への再構成

```tsx
<div className="... max-h-[90vh] flex flex-col overflow-hidden">
    <div className="px-6 py-4 border-b ...">ヘッダー</div>
    <form className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">...</div>
        <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4">キャンセル / 作成</div>
    </form>
</div>
```

### 問題の真因（PO 検証で発覚）

- `CreateProjectModal` は `ProjectSelector`（アプリヘッダー内）からレンダリングされる
- 祖先に `overflow: hidden` / `transform` / `filter` / `will-change` のいずれかがあると、**CSS 仕様により `position: fixed` の包含ブロックがビューポートではなくその祖先要素になる**
- 結果、`fixed inset-0` でもモーダルは祖先の矩形に閉じ込められる

### 段階2: React Portal への移行

```tsx
import { createPortal } from 'react-dom';

return createPortal(
    <div className="fixed inset-0 ...">...</div>,
    document.body,
);
```

DOM ツリー上はモーダルを `document.body` 直下に配置し、祖先の overflow/transform の影響を完全に切り離す。React のイベントバブリングは元の親まで伝播するため呼び出し側の挙動は変更不要。

---

## Story 9: scaffolding プロンプトへのフルスタック規約追記

### 問題の根本原因

生成済み worktree のルート `package.json` が

```json
{ "scripts": { "dev": "tsx watch src/index.ts" } }
```

のようにバックエンドしか起動しない構成で、`frontend/` 配下に独立した Vite プロジェクトがあるにもかかわらず `concurrently` による同時起動がセットアップされていなかった。

### 修正

`scaffolding.rs` の 2 経路両方に同等の規約を追記:

```
5. 【フルスタック規約】バックエンドとフロントエンドを同時に含む構成を生成する場合は、以下を必ず満たすこと:
   - ルート package.json に concurrently を devDependencies として追加
   - scripts に以下を定義:
     * "dev": "concurrently -n api,web -c blue,green \"npm:dev:api\" \"npm:dev:web\""
     * "dev:api": バックエンドの起動コマンド
     * "dev:web": フロントエンドの起動コマンド
   - フロントエンド側ディレクトリにも独自の package.json と dev スクリプトを配置
   - バックエンドは development モードで frontend/dist を serve しない
   - これらを怠ると npm run dev がバックエンドしか起動せず、Vicara のプレビューが必ずタイムアウトする
```

規約違反時の失敗挙動を併記し、AI に規約の重要性を認識させる設計にした。

---

## Story 10: モーダルバックドロップとアプリ背景の統一

### 問題

`CreateProjectModal` 表示時、モーダル以外の画面領域が**真っ黒**になる。

### 原因

1. **Tauri native ウィンドウの背景色が黒**。アプリ領域がウィンドウ全域を埋めない場合、native が透けて見える
2. モーダル backdrop が `bg-black bg-opacity-50` → 上の黒が透けた状態に 50% 黒を重ねるとほぼ全面が黒になる

### 解決策

**(a) backdrop の統一**

| コンポーネント | Before | After |
|---|---|---|
| `CreateProjectModal` | `bg-black bg-opacity-50` | `bg-slate-900/40 backdrop-blur-sm` |
| `ui/Modal.tsx`（共通） | `bg-black/50` | `bg-slate-900/40 backdrop-blur-sm` |
| `SprintTimer` Time's Up | `bg-gray-900/60 backdrop-blur-sm` | `bg-slate-900/40 backdrop-blur-sm` |

**(b) アプリ背景の高さ確保**

`App.css` の `@layer base` に:

```css
html, body, #root { @apply min-h-screen; }
```

これで `body` の `bg-gray-50` が viewport 全域を覆い、Tauri native の黒が透けなくなる。

### 調査過程

`fixed inset-0` + `absolute inset-0` でフルスクリーンオーバーレイを grep し全モーダル/オーバーレイを洗い出し:

- `CreateProjectModal`, `Modal.tsx`, `SprintTimer` → 統一対象（修正済）
- `SettingsShell`（モバイルサイドバー `bg-slate-950/20`）→ 薄く問題なし（据え置き）
- `TerminalDock`（装飾ぼかし `bg-sky-400/20`）→ モーダルではない（据え置き）

---

## Story 11: Time's Up 状態のスプリント完了ボタン復活

### 問題

スプリントタイマーが時間切れ（`TIME_UP`）になると、ツールバーの**「完了にする」ボタンが消失**し「タイマーリセット」しか表示されなくなる。Time's Up モーダルを「閉じる」で閉じると二度と完了操作に辿り着けない動線バグ。

### 修正

```tsx
{(status === 'RUNNING' || status === 'PAUSED' || status === 'TIME_UP') && (
    <Button>完了にする</Button>
)}
```

「タイマーリセット」側は据え置き。これにより `TIME_UP` 時はツールバーに**「完了にする」+「タイマーリセット」が並列表示**され、ユーザーがどちらの操作も選べる状態になる。

---

## 検証結果（追加）

### 自動テスト

```
cargo test --lib preview: 15 passed; 0 failed ✅
  - normalize_preview_command 系: 3 件
  - extract_url 系: 12 件（うち 5 件はバックエンド誤抽出防止の回帰テスト）
```

### ビルド検証

```
cargo build --lib: エラー/警告なし ✅
npm run build:     ✓ built（型エラーなし） ✅
```

### 手動検証

| 項目 | 結果 |
|---|---|
| stdout 生ログが Tauri コンソールに出力される | ✅ |
| Vite の `Local: http://localhost:5173/` が抽出される | ✅ |
| バックエンドの `Server running at http://localhost:3000` を無視する | ✅ |
| URL 未検出時に 30 秒で明示的エラー | ✅ |
| CreateProjectModal で縦 700px 画面でもボタン表示 | ✅ |
| 新 scaffolding が concurrently 付き package.json を生成 | 🟡 次回 scaffolding 実行時に確認 |

---

## 設計判断メモ（追加）

- **案A（ポート強制）の廃止理由**: 外部から CLI 引数/環境変数でポート強制すると `vite.config.ts` の `server.host`/`server.port` 設定と競合しうる脆弱な前提になる。Vite のデフォルト挙動を尊重する方針に変更。
- **Local/Network ラベル必須化**: POの検証ログで「バックエンドが先に `http://localhost:3000` を出力」するケースが実在したため、単純な `http://...` 抽出は誤抽出リスクが大きいと判断。
- **`Network:` フォールバックを残した理由**: 「localhost は解決できないが 192.168.x.x だと到達可能」という Windows 環境が存在した。
- **生ログ出力を commit に含めた理由**: プレビュー関連の問題は PO の環境依存要因が多いため、ログがないと切り分け不可能。恒久的なトラブルシュート資産として残す。
- **scaffolding プロンプト修正の意義**: preview.rs 側の対応は「正しく動くプロジェクト」の前提が崩れた場合の堅牢化に留まる。根本原因への対処は scaffolding プロンプト側で行う必要がある。
- **Modal.tsx を共通修正した理由**: 個別モーダルだけ直すとスタイル不統一が広がる。共通コンポーネント側で統一することで、今後追加されるモーダルも自動的にこの外観を継承する。
- **`min-h-screen` を html/body/#root に付与した理由**: Tauri では透過設定次第で native ウィンドウ背景（黒）が透ける。`min-h-screen` でアプリ領域が常にビューポート全体を占めることを保証。
- **Time's Up 時の並列表示**: 排他選択にすると「時間切れ → レトロ実施 → スプリント完了」の正規フローから一つ操作を奪う。並列提示でユーザーが状況に応じて選べる UX を優先。
