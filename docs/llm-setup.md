# LLM Setup Guide

This guide explains how to set up the LLM providers supported by vicara.

---

## Supported Providers

vicara supports the following LLM providers across two categories:

### CLI Agents (for Dev Agent execution & Scaffold)

| Provider | Description |
|----------|-------------|
| **Claude Code CLI** | Anthropic's coding agent CLI |
| **Gemini CLI** | Google's coding agent CLI |
| **Codex CLI** | OpenAI's coding agent CLI |

### API Providers (for PO Assistant, Inception Deck, Task Decomposition)

| Provider | Description |
|----------|-------------|
| **Claude API** (Anthropic) | Claude models via Anthropic API |
| **Gemini API** (Google) | Gemini models via Google AI API |
| **OpenAI API** | GPT / o-series models via OpenAI API |
| **Ollama** | Local LLM inference (Llama, Mistral, etc.) |

> **Recommendation**: Install at least one CLI agent and register at least one API key for the best experience.

---

## CLI Agent Setup

### Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
claude login
```

Follow the prompts to authenticate. Required for Claude Code-based Dev Agent execution and Scaffold.

### Gemini CLI

```bash
npm install -g @anthropic-ai/claude-code  # Placeholder — check Google's official docs
gemini login
```

Install and authenticate via [Google's Gemini CLI documentation](https://github.com/google-gemini/gemini-cli).

### Codex CLI

```bash
npm install -g @openai/codex
codex login
```

Install and authenticate via [OpenAI Codex CLI documentation](https://github.com/openai/codex).

---

## API Key Setup

### Anthropic API Key (Claude)

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key and copy it

### Gemini API Key (Google AI)

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Navigate to **API Keys** (or click "Get API Key")
4. Create a new API key and copy it

### OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key and copy it

### Ollama (Local)

1. Install Ollama from [ollama.com](https://ollama.com/)
2. Pull a model: `ollama pull llama3` (or any supported model)
3. Ollama runs locally — no API key required
4. Ensure Ollama is running before using it in vicara

---

## Register in vicara

1. Launch vicara
2. Click **⚙️ Settings** in the top-right header
3. Open the **AI Settings** tab
4. Register your API keys for each provider
5. (Optional) Select preferred models per provider

### Team Settings

In **⚙️ Settings** → **Team Settings**, you can:

- Define role names for your AI team
- Assign a CLI agent and model to each role
- Set system prompts for responsibilities and review perspectives
- Configure **max concurrent agents** (1–5)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Launch" does nothing | Ensure the assigned CLI agent is installed and authenticated |
| PO Assistant not responding | Check that at least one API key is registered |
| Model not found errors | Verify the model name in AI Settings matches available models |
| Ollama connection failed | Ensure Ollama is running (`ollama serve`) |
| API rate limit errors | Check your API plan limits on the provider's console |

---

← Back to [README](../README.md)
