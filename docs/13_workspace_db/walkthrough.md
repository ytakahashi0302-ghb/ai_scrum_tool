# Epic 2: マルチプロジェクト管理（フェーズ1・2）Walkthrough

## 📝 目的と概要
本セッションでは、Epic 2（マルチプロジェクト管理・ワークスペース機能）の土台となるフロントエンドのDB依存脫却（フェーズ1）と、DBスキーマ拡張（フェーズ2）を行いました。

## 🛠️ 実施内容

### フェーズ1: 既存DB処理のRust（Tauriコマンド）全面移行
- 既存のReactフック（`useStories`, `useTasks`, `useSprintHistory`, `useSprintArchive`）で行われていた `@tauri-apps/plugin-sql` の直接叩き処理を全廃しました。
- `src-tauri/src/db.rs` を新設し、Tauriの `invoke` から呼び出されるRustバックエンドAPIを構築しました。
- SQLiteデータベースコネクションの事前ロードを `tauri.conf.json` の `plugins.sql.preload = ["sqlite:ai-scrum.db"]` 設定により自動化し、初期化のアーキテクチャを最適化しました。

### フェーズ2: マルチプロジェクト（ワークスペース）スキーマ追加
- `src-tauri/migrations/3_add_projects.sql` を追加し、`projects` テーブルを新設しました。
- SQLiteの `ALTER TABLE` 制限を回避するため、テーブルの再作成＆データコピー方式 (`INSERT INTO ... SELECT`) で `stories`, `tasks`, `sprints` テーブルに `project_id` を安全に移行・追加（デフォルト値 'default'）しました。
- 構造体（`Story`, `Task`, `Sprint`）のマッピング順序をSQLiteの `CREATE TABLE` 定義順に完全一致させることで、`sqlx::FromRow` の自動マッピングのズレを解消しました。
- `get_projects`, `create_project`, `update_project`, `delete_project` 等のプロジェクト管理用コマンド群を実装しました。
- フロントエンドのTypeScript側型定義を更新し、各APIに `projectId: 'default'` を渡してビルドと動作の健全性を確認しました。

## ✅ 検証とテスト

- **ビルドの成功**: `npm run lint` と `cargo check` が警告なし・エラーなしで通過。
- **マイグレーションの無謬性**: ローカルの `ai-scrum.db` を再構築し、`cargo run` のマイグレーション実行でパニックやエラーが出ないことを確認。
- **UI動作検証**: POによる手動テストにて、ストーリーやタスクが正しく保存・表示され、また既存のデータも欠落せずマッピングされることを確認。

## 🚀 ネクストアクション
次回のセッションでは、**フェーズ3（フロントエンドUI実装）** に移ります。ワークスペースの切り替えドロップダウンの実装や、選択されたプロジェクト情報に基づくデータフェッチの動的切り替えを行います。
