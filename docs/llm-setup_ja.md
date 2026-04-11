# LLM セットアップガイド

vicara が対応している LLM プロバイダーの設定手順を説明します。

---

## 対応プロバイダー

vicara は以下の LLM プロバイダーを2つのカテゴリで対応しています：

### CLI エージェント（Dev Agent の実行 & Scaffold 用）

| プロバイダー | 説明 |
|-------------|------|
| **Claude Code CLI** | Anthropic のコーディングエージェント CLI |
| **Gemini CLI** | Google のコーディングエージェント CLI |
| **Codex CLI** | OpenAI のコーディングエージェント CLI |

### API プロバイダー（POアシスタント、Inception Deck、タスク分解 用）

| プロバイダー | 説明 |
|-------------|------|
| **Claude API**（Anthropic） | Anthropic API 経由の Claude モデル |
| **Gemini API**（Google） | Google AI API 経由の Gemini モデル |
| **OpenAI API** | OpenAI API 経由の GPT / o シリーズモデル |
| **Ollama** | ローカル LLM 推論（Llama, Mistral 等） |

> **推奨**: 少なくとも1つの CLI エージェントをインストールし、1つ以上の API キーを登録してください。

---

## CLI エージェントのセットアップ

### Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
claude login
```

表示される手順に従って認証を完了してください。Claude Code ベースの Dev Agent 実行と Scaffold に必要です。

### Gemini CLI

```bash
npm install -g @anthropic-ai/claude-code  # Placeholder — Google公式ドキュメントを確認
gemini login
```

[Google Gemini CLI ドキュメント](https://github.com/google-gemini/gemini-cli)を参照してインストール・認証してください。

### Codex CLI

```bash
npm install -g @openai/codex
codex login
```

[OpenAI Codex CLI ドキュメント](https://github.com/openai/codex)を参照してインストール・認証してください。

---

## API キーのセットアップ

### Anthropic API Key（Claude）

1. [Anthropic Console](https://console.anthropic.com/) にアクセス
2. サインアップまたはログイン
3. **API Keys** に移動
4. 新しい API キーを作成してコピー

### Gemini API Key（Google AI）

1. [Google AI Studio](https://aistudio.google.com/) にアクセス
2. Google アカウントでログイン
3. **API Keys**（または「Get API Key」）に移動
4. 新しい API キーを作成してコピー

### OpenAI API Key

1. [OpenAI Platform](https://platform.openai.com/) にアクセス
2. サインアップまたはログイン
3. **API Keys** に移動
4. 新しい API キーを作成してコピー

### Ollama（ローカル）

1. [ollama.com](https://ollama.com/) から Ollama をインストール
2. モデルを取得: `ollama pull llama3`（その他対応モデルも可）
3. Ollama はローカルで動作するため、API キーは不要
4. vicara で使用する前に Ollama が起動していることを確認

---

## vicara への登録

1. vicara を起動
2. ヘッダー右上の **⚙️ 設定** をクリック
3. **AI設定** タブを開く
4. 各プロバイダーの API キーを登録
5. （任意）プロバイダーごとに使用するモデルを選択

### チーム設定

**⚙️ 設定** → **チーム設定** では、以下を設定できます：

- ロール名の定義
- 各ロールへの CLI エージェントとモデルの割り当て
- システムプロンプトで責務やレビュー観点を付与
- **最大並行稼働数** の設定（1〜5）

---

## トラブルシューティング

| 問題 | 対処法 |
|------|--------|
| 「実行」が動かない | 割り当てられた CLI エージェントがインストール・認証済みか確認 |
| POアシスタントが応答しない | 少なくとも1つの API キーが登録されていることを確認 |
| モデルが見つからないエラー | AI設定のモデル名が利用可能なモデルと一致しているか確認 |
| Ollama接続エラー | Ollama が起動しているか確認（`ollama serve`） |
| APIレート制限エラー | プロバイダーのコンソールで API プランの制限を確認 |

---

← [README（日本語）](../README_ja.md) に戻る
