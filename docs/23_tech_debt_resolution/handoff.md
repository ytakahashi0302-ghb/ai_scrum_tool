# Epic 23: 技術的負債の解消とUIクリーンアップ — Handoff Document

**作成日**: 2026-04-05  
**担当**: AI Dev Agent  
**ステータス**: ✅ **完了・クローズ**

---

## 1. 実装完了サマリー

### 1.1 ハードコード系の解消

**問題**: AIモデル名（`claude-3-5-sonnet` 等）がソースコード内にハードコードされており、モデルの廃止・更新のたびにコード変更が必要だった。

**解決策**:
- `get_available_models` Tauriコマンドを実装し、Anthropic / Gemini のAPIから利用可能なモデル一覧をリアルタイムで取得
- `GlobalSettingsModal.tsx` でドロップダウン（動的）＋手動入力（カスタム）を両立したUI
- 選択されたモデル名は `settings.json`（Tauri Store）に永続化。`rig_provider.rs` の `resolve_provider_and_key` がStoreから読み込む設計に統一

### 1.2 Inception Deck の揮発性解消

**問題**: アプリ再起動・プロジェクト切り替えでチャット履歴とフェーズ番号がリセットされていた。

**解決策**:
- `InceptionDeck.tsx` に Tauri Store（`inception-${projectId}.json`）への読み書きを実装
- チャット履歴・`currentPhase`・生成済みドキュメント内容をプロジェクト別に永続化
- プロジェクト切り替え時に自動復元

### 1.3 Inception Deck AI の差分追記アーキテクチャ

**問題（旧方式の致命的な欠陥 2つ）**:
1. **全上書きバグ**: Phase 2 で AIが `PRODUCT_CONTEXT.md` を全文再生成して出力すると、Phase 1 で作成したセクションが消える
2. **トークン枯渇**: AIに全ドキュメントを一度に出力させると Max Tokens に引っかかりJSONが途中で切断される

**解決策（patch_target / patch_content 方式）**:

```
旧: {"reply": "...", "is_finished": true, "generated_document": "全文1000行..."}  ← 途中切断される
新: {"reply": "...", "is_finished": true, "patch_target": "PRODUCT_CONTEXT.md", "patch_content": "## 4. やらないこと\n- ..."}
```

各フェーズで**追加する差分のみ**を出力させ、フロントエンドが既存ファイルに追記（Append）する設計に変更:

| Phase | 対象ファイル | 書き込み方式 |
|---|---|---|
| 1 | PRODUCT_CONTEXT.md | 上書き（新規作成）|
| 2 | PRODUCT_CONTEXT.md | 末尾追記（Section 3〜5のみ）|
| 3 | ARCHITECTURE.md | 上書き（新規作成）|
| 4 | Rule.md | 末尾追記（固有ルールのみ）|

### 1.4 UIクリーンアップ

- 旧 `SettingsModal.tsx` を削除し、`GlobalSettingsModal.tsx` に統合
- プロジェクト削除 UI を設定モーダルの「プロジェクト設定」タブに集約

### 1.5 Team Leader MaxTurnError 解消

- Tool Calling（`create_story_and_tasks`）実行後、AIが完了報告を生成するターンがなくエラーになっていた
- `rig_provider.rs` の Anthropic / Gemini AgentBuilder に `.default_max_turns(5)` を設定して解消

### 1.6 プロジェクト削除の非同期バグ修正

- `window.confirm()` をTauri dialog plugin の `await confirm()` に置き換え
- 削除後のフォールバック先を残存リストから明示的に計算する安全な切り替えを実装

---

## 2. 【警告】技術的な重要ポイント（罠の回避録）

> [!CAUTION]
> ### Tauri WebView での `window.confirm()` は使用禁止
>
> **問題**: Tauri の WebView 環境では `window.confirm()` / `window.alert()` は同期的に見えるが、ユーザーの操作を **await で待機することができない**。「OK」を押す前に後続の処理が実行されてしまう。
>
> **正しい実装**:
> ```typescript
> import { confirm } from '@tauri-apps/plugin-dialog';
>
> const confirmed = await confirm('削除しますか？', { title: '確認', kind: 'warning' });
> if (!confirmed) return;
> // ← ここから先はユーザーがOKを押した後に確実に実行される
> ```
>
> **対象ファイル**: `@tauri-apps/plugin-dialog` を cargo の `Cargo.toml` と npm の `package.json` の両方に依存として追加する必要がある。

---

> [!WARNING]
> ### LLMレスポンスのJSONパースには必ずストリップ処理を挟む
>
> **問題**: LLMに `JSONのみを返せ` と厳命しても、高確率で以下のようにMarkdownコードフェンスで囲んで返してくる:
> ```
> ```json
> {"reply": "...", "is_finished": true}
> ```
> ```
> そのまま `JSON.parse()` するとクラッシュする。
>
> **正しい実装**（Rust側）:
> ```rust
> // Step 1: コードフェンスを除去
> let fence_re = regex::Regex::new(r"(?s)```(?:json)?\s*\n?(.*?)\n?\s*```").unwrap();
> let stripped = if let Some(caps) = fence_re.captures(&content) {
>     caps.get(1).unwrap().as_str().to_string()
> } else {
>     content.clone()
> };
>
> // Step 2: Greedy マッチで JSON オブジェクトを抽出（lazy だとネスト構造を誤検出）
> let re = regex::Regex::new(r"(?s)\{.*\}").unwrap();
> ```
>
> `r"(?s)\{.*?\}"` （lazy）では**ネストしたJSONを正しく取れない**。必ず `r"(?s)\{.*\}"` （greedy）を使うこと。

---

> [!CAUTION]
> ### LLMに長文ドキュメントを一度に生成させない（トークン枯渇対策）
>
> **問題**: 「これまでのすべてのドキュメントを統合して出力せよ」という指示はMax Tokens制限により**出力が途中で切断（Truncate）**される。JSONなので切断されるとパース不能になる。
>
> **設計原則**:
> 1. AIには**そのフェーズで追加・変更する差分のみ**を出力させる
> 2. システム側（フロントエンド/バックエンド）が既存ファイルへの **Append** を担当する
> 3. システムプロンプトで出力行数の上限を明示する（例: `patch_content は20行以内`）
> 4. 既存ドキュメントをコンテキストとして注入する際は **先頭N文字のプレビューのみ** を渡す
>
> ```
> 悪い例: AIに全文を出力させる → トークン枯渇で途中切断
> 良い例: AIは差分のみ出力 → システムが Append → 完全なファイルが完成
> ```

---

> [!WARNING]
> ### Rig Agent の MaxTurnError: Tool Calling 後のレポートターンを確保する
>
> **問題**: Tool Calling を実行したAIエージェントが、完了報告メッセージを生成しようとする際に `MaxTurnError: reached max turn limit: 0` が発生する。
>
> **原因**: `AgentBuilder` のデフォルトターン数が不足しており、ツール実行後の「報告ターン」が許可されていない。
>
> **正しい実装**: Tool を持つエージェントのBuilderには必ず `.default_max_turns(n)` を設定する。
> ```rust
> let agent = client
>     .agent(model)
>     .preamble(system_prompt)
>     .max_tokens(4096)
>     .tool(tool)
>     .default_max_turns(5)  // ← ツール実行 + 完了報告のターンを確保
>     .build();
> ```
> ツール呼び出し 1回 + 完了報告 1回 = 最低 2ターン必要。余裕を持って `5` に設定。

---

## 3. 次期開発へのネクストステップ

### 優先度: 高
- **Inception Deck の残UIタスク**: `StorySwimlane.tsx` からAI自動生成ボタン、`BacklogView.tsx` からアイデアボタン、`IdeaRefinementDrawer.tsx` の削除（BACKLOG記載の既知タスク）
- **App.tsx のナビゲーション統合**: Inception Deck ヘッダーを Kanban 側と共通のナビゲーションデザインに統合

### 優先度: 中
- **Inception Deck フェーズ完了後の自動タブ切り替え**: ファイルが更新された際に対応するタブ（CONTEXT/ARCHITECTURE/RULE）を自動でアクティブにするUX改善
- **生成ドキュメントの編集機能**: 右ペインのMarkdownをユーザーが直接編集できるようにする

### 優先度: 低（将来構想）
- **マルチエージェント協調**: `FUTURE_CONCEPT.md` に記載の複数AIエージェントによる自律的スプリント実行
- **Inception Deck から初期バックログの自動生成**: Phase 4 完了後にTeam Leaderが自動で基本的なストーリーを起票する機能

---

## 4. 主要ファイル構成（Epic 23 完了時点）

```
src-tauri/src/
├── ai.rs              ← AIロジック心臓部。ChatInceptionResponse, build_inception_system_prompt
├── rig_provider.rs    ← AIプロバイダー解決・chat関数群。default_max_turns(5) 設定済み
└── inception.rs       ← Inception Deck ファイルR/W（read/write_inception_file）

src/
├── components/ui/
│   └── GlobalSettingsModal.tsx  ← AI設定 + プロジェクト削除の統合設定モーダル
├── components/project/
│   └── InceptionDeck.tsx        ← patch_target/patch_content 方式の追記ロジック
└── context/
    └── WorkspaceContext.tsx     ← deleteProject の安全な非同期フォールバック実装済み
```
