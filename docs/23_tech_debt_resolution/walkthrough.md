# Epic 23: 技術的負債の解消とUIクリーンアップ — Walkthrough

## 1. 変更内容 (Changes)

### Phase 1: ハードコード系の解消

#### `src-tauri/src/rig_provider.rs`
- `get_available_models` Tauriコマンドを追加。設定されたAPIキーを使ってAnthropicおよびGeminiのモデル一覧を動的に取得する。
- `resolve_provider_and_key` 関数がTauri Storeからモデル名を読み込むよう修正。ハードコードされたモデル名を完全廃止。

#### `src/context/WorkspaceContext.tsx`
- `currentProjectId` の初期化ロジックを改善。プロジェクト取得後、不正なIDが残らないようフォールバック処理を追加。
- `deleteProject` メソッドを追加。削除後の残存プロジェクトリストから切り替え先を明示的に計算してStateを更新するよう実装。

---

### Phase 2: 揮発性の解消 (Inception Deck)

#### `src/components/project/InceptionDeck.tsx`
- `@tauri-apps/plugin-store` を使い、プロジェクトごとのチャット履歴・フェーズ番号・ファイル内容をTauri Storeに永続化。
- プロジェクト切り替え時に状態を自動復元するよう実装。

---

### Phase 3: UIクリーンアップと設定の統合

#### `src/components/ui/GlobalSettingsModal.tsx` (新規作成)
- AIプロバイダー選択（Anthropic / Gemini）とAPIキー設定・モデル選択をまとめたグローバル設定モーダルを新規作成。
- モデル一覧は「モデル一覧を取得」ボタンでAPIから動的取得。カスタムモデル名の手動入力も可能。
- 「プロジェクト設定」タブにプロジェクト削除（Danger Zone）UIを配置。

#### `Board.tsx`
- 旧 `SettingsModal` 関連のインポートと状態管理コードを削除。
- 不要となった `SettingsModal.tsx` を削除。

---

### Phase 4: Inception Deck AI の振る舞い修正

#### `src-tauri/src/ai.rs`
| 変更点 | Before | After |
|---|---|---|
| レスポンス構造体 | `generated_document: Option<String>` | `patch_target + patch_content`（差分方式） |
| システムプロンプト | 「Inception Guide」(4文字) | フェーズ別指示・箇条書き強制・20行以内制約 |
| JSONパース | lazy正規表現 `{.*?}` | コードフェンス除去 → greedy `{.*}` |
| フェーズ別書き込み | 全文上書き | Phase 1/3: 上書き、Phase 2/4: 末尾追記 |

**patch_target / patch_content 方式の効果:**
- 各フェーズで生成する差分のみをAIに出力させるため、トークン消費を大幅削減
- Phase 2（Not List）がPRODUCT_CONTEXT.mdを上書きしてしまう既知バグを根本解決

---

### Phase 5: Team Leader MaxTurnError 修正

#### `src-tauri/src/rig_provider.rs`
- Team Leader の Anthropic / Gemini 両AgentBuilderに `.default_max_turns(5)` を追加。
- ツール（`create_story_and_tasks`）実行後、結果報告のための追加ターンが許可されるようになった。

---

### Phase 6: プロジェクト削除の非同期バグ修正

#### `src/components/ui/GlobalSettingsModal.tsx`
- `window.confirm()` （Tauri webview内では非同期動作が保証されない）を Tauri `@tauri-apps/plugin-dialog` の `confirm()` に置き換え。
- `await confirm(...)` でユーザーがOKを押すまで確実に待機してから削除処理を実行。

#### `src/context/WorkspaceContext.tsx`
- `deleteProject` 内のフォールバックを `fetchProjects()` 任せから、削除直後の残存リスト（`invoke('get_projects')` の戻り値）を使った明示的な計算に変更。
- 削除対象が `currentProjectId` と一致する場合のみ切り替えを実行するよう制御。

---

## 2. テスト内容・結果 (Validation Result)

| テスト項目 | 結果 |
|---|---|
| `cargo check` | ✅ エラー0件 |
| `npx tsc --noEmit` | ✅ エラーなし |
| Inception Deck 全4フェーズ完了 | ✅ PO実地確認済み |
| Team Leader タスク自律生成 | ✅ PO実地確認済み（MaxTurnError解消） |
| グローバル設定モーダル（モデル動的取得） | ✅ PO実地確認済み |
| プロジェクト削除（確認ダイアログ） | ✅ 修正後、確認後にのみ削除実行 |

---

## 3. POによる確認手順 (Manual Testing Steps)

### 削除バグの確認
1. `npm run tauri dev` でアプリを起動
2. プロジェクトを複数作成しておく
3. ヘッダーの設定アイコン → **プロジェクト設定タブ** → 「このプロジェクトを削除」ボタンをクリック
4. ✅ **Tauriのネイティブ確認ダイアログが表示されること**（OSネイティブのモーダル、ブラウザのalertではない）
5. 「キャンセル」を押した場合 → プロジェクトが削除されず、画面が変化しないことを確認
6. 「OK」を押した場合 → 削除が実行され、別プロジェクトに自動切り替えされることを確認

### Inception Deck の追記確認
1. 新しいプロジェクトを作成してInception Deckを開く
2. Phase 1 でプロダクト概要を整理し、PRODUCT_CONTEXT.md が生成されることを確認
3. Phase 2 でやらないことリストを追加し、**Phase 1の内容（Section 0〜2）が消えずに**Section 3〜5が末尾に追記されることを確認
4. Phase 3 で ARCHITECTURE.md が生成されることを確認
5. Phase 4 で Rule.md に固有ルールが追記されることを確認

### Team Leader の確認
1. Inception Deckでドキュメントを作成したプロジェクトを開く
2. Team Leader チャットに「〜の機能をバックログに追加して」と指示
3. ✅ ツール実行後に完了メッセージが返ること（`MaxTurnError` が出ないこと）
4. カンバン画面でストーリーとタスクが自動作成されていることを確認
