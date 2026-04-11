# vicara v2.0.0 リリース準備

v2.0.0 リリースに伴い、バージョン設定の更新、READMEの英語ベース再構成、LLMセットアップガイドの分離、GitHub Actionsによるリリース自動化を行う。

---

## User Review Required

> [!IMPORTANT]
> **README構成の方針**: 英語版を `README.md`（メイン）とし、日本語版を `README_ja.md` に分離します。README冒頭にバッジ形式で日本語版へのリンクを配置します。

> [!WARNING]
> **GitHub Actions**: macOS/Linuxビルドは、GitHub Actionsのホストランナー上でビルドされます。ローカルでテストできないため、初回は失敗する可能性があります。また、**コード署名（macOS Notarization / Windows署名）は未設定**のままです。必要であれば後日対応。

> [!IMPORTANT]
> **portable-pty クレート**: このクレートはLinux/macOSでのPTY操作を前提としているため、クロスプラットフォームビルドは基本的に対応しているはずですが、Linux環境での追加依存（`libwebkit2gtk-4.1-dev` 等）が必要です。

---

## 提案する変更

### 1. バージョン更新（3ファイル）

#### [MODIFY] [package.json](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/package.json)
- `"version": "1.2.0"` → `"version": "2.0.0"`

#### [MODIFY] [tauri.conf.json](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src-tauri/tauri.conf.json)
- `"version": "1.2.0"` → `"version": "2.0.0"`

#### [MODIFY] [Cargo.toml](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/src-tauri/Cargo.toml)
- `version = "1.2.0"` → `version = "2.0.0"`

---

### 2. README.md（英語ベースに全面書き換え）

#### [MODIFY] [README.md](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/README.md)

構成:
```
バナー画像（public/logos/banner.svg）
言語切替バッジ（English | 日本語）
h1: vicara
キャッチコピー（英語）
---
What is vicara?（簡潔な概要）
---
Key Features（テーブル形式で主要機能一覧）
---
Getting Started
  - Prerequisites
  - Installation & Launch
  - Configure API Keys
  - Set Working Directory
  ※ LLM setup は別ページへのリンク
---
Tech Stack（テーブル）
---
Development（開発コマンド）
---
Origin of the Name
---
License / Footer
```

- バナー: `![vicara banner](./public/logos/banner.svg)`
- LLMセットアップの詳細は `docs/llm-setup.md` へリンク
- 現行の「使い方: 開発ワークフロー」「類似ツールとの違い」「ロードマップ」は削除し、最低限に留める

---

### 3. 日本語版README

#### [NEW] [README_ja.md](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/README_ja.md)

- README.md の日本語翻訳版
- 同じ構成で日本語化
- LLMセットアップは `docs/llm-setup_ja.md` へリンク

---

### 4. LLMセットアップガイド（英語・日本語）

#### [NEW] [docs/llm-setup.md](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/docs/llm-setup.md)

内容:
- Claude Code CLI のインストールとログイン
- Anthropic API Key の取得と登録
- Gemini API Key の取得と登録
- アプリ内での設定場所の説明
- 各プロバイダーモデルの設定手順

#### [NEW] [docs/llm-setup_ja.md](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/docs/llm-setup_ja.md)

- 上記の日本語版

---

### 5. GitHub Actions リリースワークフロー

#### [NEW] [.github/workflows/release.yml](file:///c:/Users/green/Documents/workspaces/ai-scrum-tool/.github/workflows/release.yml)

`tauri-apps/tauri-action` を使用したクロスプラットフォームビルド & GitHub Release 自動作成:

```yaml
name: 'Release'

on:
  push:
    tags:
      - 'v*'

jobs:
  publish-tauri:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target x86_64-apple-darwin'
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: lts/*

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install dependencies (Ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install frontend dependencies
        run: npm ci

      - name: Build and Release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'vicara v__VERSION__'
          releaseBody: 'See the assets to download and install vicara.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

**リリース手順**:
1. バージョンを更新（上記3ファイル）
2. コミット & プッシュ
3. `git tag v2.0.0 && git push origin v2.0.0`
4. GitHub Actions が自動でビルド開始
5. 完了後、GitHub Releases にドラフトが作成される
6. ドラフトを確認し、公開する

**前提条件**:
- Repository Settings > Actions > General > Workflow permissions を **Read and write permissions** に設定すること

---

## Open Questions

> [!IMPORTANT]
> 1. **README のスクリーンショット**: 現行のスクリーンショット (`./docs/images/vicara-overview-v1_2_0.png`) は新READMEに含めますか？含める場合、v2.0.0 用のスクリーンショットを用意しますか？
> 2. **ライセンス表記**: READMEにライセンス表記を追加しますか？（MIT, Apache-2.0 など）
> 3. **バナーのGitHub表示**: SVGバナーはGitHubのREADMEプレビューで表示される場合とされない場合があります。もし表示されない場合、PNG版に変換して使用する対応は可能ですか？

---

## テスト方針

### 自動テスト
- GitHub Actions ワークフローは `v*` タグプッシュ時に自動実行
- 初回は `releaseDraft: true` でドラフトリリースとして作成し、手動確認後に公開

### 手動検証
- READMEのプレビュー: GitHub上でバナー画像・リンク・テーブルの表示確認
- 各プラットフォームの実行ファイルが正しく生成されることを確認（ドラフトリリースのアセット確認）
- 日本語版READMEの切替リンクが正しく動作することを確認
