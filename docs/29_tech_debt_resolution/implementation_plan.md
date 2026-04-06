# Epic 29 実装計画

## 目的

Epic 28 で完成したマルチエージェント並行実行基盤の前提に合わせ、既存の技術的負債を解消する。特に、role を「同時実行枠」ではなく「エージェント生成テンプレート」として扱う設計へ統一し、UI・バリデーション・AI連携・不要コードを整理して、継続開発時の制約と不整合を除去する。

## 対応方針

### 1. ロール数制約の撤廃

- バックエンド (`src-tauri/src/db.rs`) の `validate_team_configuration` から `max_concurrent_agents <= roles.len()` 制約を削除する。
- フロントエンド (`src/components/ui/GlobalSettingsModal.tsx`) の同等バリデーションを削除する。
- Team Settings UI (`src/components/ui/TeamSettingsTab.tsx`) の説明文を見直し、「ロール数」と「同時実行上限」が独立概念であることを明示する。

### 2. Lint エラーの解消

- `src/components/project/ScaffoldingPanel.tsx` の `handlePostScaffold` 参照順を是正する。
- 必要に応じて hook 依存と effect 内処理を調整し、`npm run lint` がエラー終了しない状態にする。

### 3. AIタスク生成時の JSON パース堅牢化

- `src-tauri/src/ai.rs` の `generate_tasks_from_story` にある脆弱な正規表現依存を解消する。
- 文字列走査ベースで JSON 配列・オブジェクト候補を抽出し、`serde_json` で安全にパースする方式へ寄せる。
- モデルへの指示文も調整し、余計な説明や Markdown fence を返さないようにする。

### 4. 未使用コードのクリーンアップ

- `src-tauri/src/lib.rs` から Tauri テンプレート由来の `greet` コマンドを削除する。
- `src-tauri/src/db.rs` に残る不要なデバッグログ出力を削除する。
- `BACKLOG.md` から完了済み・本Epicで解消済みの項目を整理する。

## 影響範囲

- フロントエンド設定UI
- Tauri バックエンドの team configuration 保存処理
- AIレスポンスの JSON パース処理
- 技術的負債管理ドキュメント (`BACKLOG.md`)

## リスクと確認観点

- `roles = 1, max_concurrent_agents = 3` のような構成が保存できること
- 設定UIの説明が role 数依存の誤解を招かないこと
- AI応答に余分な文章が含まれても JSON 抽出が失敗しにくいこと
- 不要コード削除によって既存の invoke 登録やビルドが壊れないこと

## テスト方針

- バックエンド整合性確認として `cargo check` を実行する。
- フロントエンド静的検証として `npm run lint` を実行し、少なくとも error 0 件を確認する。
- ビルド整合性確認として `npm run build` を実行し、型チェックと本番ビルドが通ることを確認する。
- 追加で、UI上のチーム設定文言と保存挙動は差分レビューで確認する。
