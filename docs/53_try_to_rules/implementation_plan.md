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
