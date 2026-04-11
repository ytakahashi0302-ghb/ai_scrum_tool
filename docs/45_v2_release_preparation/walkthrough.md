# vicara v2.0.0 リリース準備 ウォークスルー

## 変更サマリ

v2.0.0 リリースに向けて、以下の変更を実施しました。

---

## 1. バージョン更新

3ファイルすべてで `1.2.0` → `2.0.0` に更新:

- [package.json](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/package.json)
- [tauri.conf.json](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src-tauri/tauri.conf.json)
- [Cargo.toml](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src-tauri/Cargo.toml)

---

## 2. README の英語ベース再構成

### [README.md](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/README.md)（英語・メイン）
- バナーPNG画像をTOPに配置
- 日本語版への切替リンク
- 構成を最低限に: What is vicara? / Key Features / Getting Started / Tech Stack / Development / Origin of the Name / License
- LLMセットアップの詳細は別ページへリンク

### [README_ja.md](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/README_ja.md)（日本語版）
- 英語版と同じ構成で日本語化
- 英語版への切替リンクを配置

---

## 3. LLM セットアップガイド（分離）

- [docs/llm-setup.md](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/docs/llm-setup.md)（英語）
- [docs/llm-setup_ja.md](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/docs/llm-setup_ja.md)（日本語）

内容: Claude Code CLI / Anthropic API / Gemini API / モデル設定 / チーム設定 / トラブルシューティング

---

## 4. バナー PNG 生成

- `public/logos/banner.svg` を `sharp-cli` で PNG に変換
- `public/logos/banner.png`（約191KB）として保存
- README で使用

---

## 5. GitHub Actions リリースワークフロー

### [.github/workflows/release.yml](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/.github/workflows/release.yml)

`tauri-apps/tauri-action@v0` を使用したクロスプラットフォームビルド:

| プラットフォーム | ターゲット |
|---|---|
| Windows | `windows-latest` |
| macOS Intel | `macos-latest` + `--target x86_64-apple-darwin` |
| macOS Apple Silicon | `macos-latest` + `--target aarch64-apple-darwin` |
| Linux | `ubuntu-22.04` |

### リリース手順

```bash
# 1. バージョン更新済みの状態でコミット
git add -A
git commit -m "release: v2.0.0"

# 2. タグを作成してプッシュ
git tag v2.0.0
git push origin main
git push origin v2.0.0

# 3. GitHub Actions が自動ビルド開始
# 4. GitHub Releases にドラフトが作成される
# 5. ドラフトを確認し、公開
```

> [!IMPORTANT]
> **前提条件**: GitHub リポジトリの Settings > Actions > General > Workflow permissions を **Read and write permissions** に設定してください。

---

## 6. LICENSE

- [LICENSE](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/LICENSE)（Apache License 2.0）

---

## 注意事項

- `docs/images/vicara-overview-v2_0_0.png` はユーザーが別途用意する前提（READMEで参照済み）
- コード署名（macOS Notarization / Windows Authenticode）は未設定。必要に応じて後日対応
- `scripts/` ディレクトリの一時変換スクリプトは削除済み
