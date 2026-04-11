# EPIC45 実装計画: 設定画面 UI/UX リファイン

## 1. 背景と目的

現行の `src/components/ui/GlobalSettingsModal.tsx` は **1536 行**の単一コンポーネントで、以下 5 タブを水平タブバーで切り替えている：

1. セットアップ状況
2. POアシスタント設定（約1150行 — 最大）
3. チーム設定
4. アナリティクス
5. プロジェクト設定

Epic39〜43 で設定項目が段階的に追加された結果、以下の課題が顕在化している：

- 水平タブが窮屈で項目数に対してスケールしない
- POアシスタントタブ内でヘッダー・セクション見出しが散在
- 単一コンポーネントに 40+ の state が集中し、保守性が低い
- ユーザーが設定項目の位置を記憶しづらい

本エピックでは **左サイドバー型マスターディテール UI** への再構築によりこれらを解消する。**機能追加ではなく UI/UX 再設計**が主目的。

---

## 2. 設計方針

### 2.1 レイアウト

モーダル全体を左右 2 ペインに分割：

```
┌─────────────────────────────────────────────────┐
│ 設定                                          × │
├──────────────┬──────────────────────────────────┤
│  一般         │   ◆ セクションタイトル           │
│  ├ プロジェクト│   一行説明                      │
│              │   ─────────────────              │
│  AI & モデル  │                                  │
│  ├ POアシスト │   [グループ見出し]               │
│  ├ プロバイダー│   [SettingsField]               │
│  ├ チーム設定 │   [SettingsField]               │
│              │                                  │
│  システム     │   [グループ見出し]               │
│  ├ セットアップ│   [SettingsField]               │
│  ├ アナリティクス│                               │
├──────────────┴──────────────────────────────────┤
│                    [ キャンセル ] [ 保存 ]       │
└─────────────────────────────────────────────────┘
```

- モーダル幅: 既存 `Modal` の `5xl` バリアント
- サイドバー: 固定幅 220–240px、縦スクロール
- 右ペイン: `flex-1`、独立スクロール
- フッター: 右ペイン下部に固定

### 2.2 情報アーキテクチャ

**3 カテゴリ / 6 セクション** に再編：

| カテゴリ | セクション | 現行タブからの移行 |
|---------|-----------|------------------|
| 一般 | プロジェクト | プロジェクト設定タブ |
| AI & モデル | POアシスタント | POアシスタント設定タブ内の Visual/Execution Mode |
| AI & モデル | AIプロバイダー | POアシスタント設定タブ内の Provider/APIキー/モデル |
| AI & モデル | チーム設定 | チーム設定タブ |
| システム | セットアップ状況 | セットアップ状況タブ |
| システム | アナリティクス | アナリティクスタブ |

**ポイント**: 現状 POアシスタント設定に混在している「ビジュアル/実行モード」と「プロバイダー・APIキー」を 2 セクションに分割（ユーザー確認済み）。

### 2.3 コンポーネント構成

```
src/components/ui/settings/
├── SettingsShell.tsx          # マスターディテール全体レイアウト
├── SettingsSidebar.tsx        # 左ナビ（カテゴリ＆セクション）
├── SettingsSection.tsx        # 右ペイン共通ラッパー（タイトル/説明）
├── SettingsField.tsx          # ラベル/説明/入力の統一フィールド
├── SettingsContext.tsx        # 設定state/save/dirty管理
└── sections/
    ├── ProjectSection.tsx
    ├── PoAssistantSection.tsx    # Visual/Execution Mode
    └── AiProviderSection.tsx     # Provider/APIキー/モデル
```

既存ファイルの扱い：
- `GlobalSettingsModal.tsx` → `SettingsShell` を呼ぶ薄いラッパーへ縮小（エントリポイント互換維持）
- `TeamSettingsTab.tsx` / `SetupStatusTab.tsx` / `AnalyticsTab.tsx` → 中身は流用し `SettingsSection` 内にマウント

### 2.4 視覚階層

散在しているヘッダーを 3 階層に統一：

1. **セクションタイトル** (`text-xl font-semibold` + 一行説明)
2. **グループ見出し** (`text-sm font-semibold uppercase tracking-wide text-slate-500` + 区切り線)
3. **フィールドラベル** (`SettingsField` で `label + description + control` を統一配置)

既存 Tailwind トークン（`border-slate-200`, `rounded-xl`, `bg-white/90`）を継続使用。

### 2.5 状態管理

- Tauri Store (`settings.json`) スキーマ・キー名は**変更しない**
- 既存フック (`useCliDetection`, `usePoAssistantAvatarImage`, `useLlmUsageSummary`) をそのまま流用
- 巨大 state を `SettingsContext.tsx`（`src/components/ui/settings/` 配下）に集約
  - CLAUDE.md のルールに従い `src/context/**` は修正しない

### 2.6 レスポンシブ

- `md:` ブレークポイント以下でサイドバーを折りたたみ、ハンバーガーボタンで展開するドロワー形式に切替。
- それ以上の幅では常時サイドバー表示。

**今回スコープ外**（ユーザー確認済み）: 検索バー / 未保存変更バッジ / キーボードナビ

---

## 3. 修正対象ファイル

### 新規作成
- `src/components/ui/settings/SettingsShell.tsx`
- `src/components/ui/settings/SettingsSidebar.tsx`
- `src/components/ui/settings/SettingsSection.tsx`
- `src/components/ui/settings/SettingsField.tsx`
- `src/components/ui/settings/SettingsContext.tsx`
- `src/components/ui/settings/sections/ProjectSection.tsx`
- `src/components/ui/settings/sections/PoAssistantSection.tsx`
- `src/components/ui/settings/sections/AiProviderSection.tsx`

### 修正
- `src/components/ui/GlobalSettingsModal.tsx` — `SettingsShell` ラッパー化
- `src/components/ui/SetupStatusTab.tsx` — `SettingsSection` 内での利用に調整
- `src/components/ui/TeamSettingsTab.tsx` — 同上
- `src/components/ui/AnalyticsTab.tsx` — 同上

### 参照のみ（修正禁止）
- `src/components/ui/Modal.tsx` / `Button.tsx` / `Input.tsx` / `Textarea.tsx` / `Card.tsx` / `AvatarImageField.tsx` / `WarningBanner.tsx`
- `src/context/WorkspaceContext.tsx`
- `src/hooks/useCliDetection.ts` / `useLlmUsageSummary.ts` / `usePoAssistantAvatarImage.ts`
- `src/App.tsx`（設定モーダル呼び出し L227 付近）

---

## 4. 再利用する既存資産

- **UIプリミティブ**: `Button`, `Input`, `Textarea`, `Card`, `Modal`, `AvatarImageField`, `WarningBanner`
- **スタイルトークン**: `border-slate-200`, `bg-white/90`, `rounded-xl`, `shadow-*`
- **フック**: `useCliDetection`, `useLlmUsageSummary`, `usePoAssistantAvatarImage`
- **永続化**: Tauri Store (`settings.json`)

---

## 5. テスト方針

自動テストが未整備のため、**手動検証チェックリスト**を walkthrough に記録する方針で進める。

### 機能検証
1. 設定モーダルの開閉が正常動作
2. すべての既存設定項目が新サイドバー配下から到達可能
3. 保存 → 再オープンで値が永続化されている（全カテゴリ）
4. プロバイダー切替（Anthropic/Gemini/OpenAI/Ollama）で APIキー入力・モデル取得ボタンが動作
5. チーム設定: ロール追加・編集・削除・並び保持
6. セットアップ状況: CLI 検出更新ボタン動作
7. アナリティクス: トークン/コスト表示が現行と一致
8. プロジェクト削除（Danger Zone）が `default` プロジェクトで無効

### UI/UX 検証
9. サイドバーのセクション切替で右ペインが正しく差し替わる
10. 画面幅 `md:` 以下でサイドバーがドロワー化し、ハンバーガーで展開
11. `Esc` でモーダルが閉じる
12. 日本語が文字化けせず表示される

### リグレッション検証
13. カンバン画面・POアシスタントサイドバー・ターミナル dock が影響を受けていない
14. `frontend-core` (`src/context/**`, `src/hooks/**`, `src/types/**`) に差分なし（`git diff` で確認）
15. TypeScript 型エラー・ESLint エラーなし

### 実行手順
```bash
npm run tauri dev
```
起動後、ヘッダー右上の設定ボタンからモーダルを開き、上記 1–15 を順に実施。結果を `walkthrough.md` に記録。

---

## 6. 実装順序

1. **骨格**: `SettingsContext` → `SettingsShell` → `SettingsSidebar` → `SettingsSection` → `SettingsField`
2. **既存タブ移植**: SetupStatus → Analytics → Team（薄いラッパー適用のみで済むもの順）
3. **POアシスタント分割**: `ProjectSection` → `PoAssistantSection` → `AiProviderSection`
4. **統合**: `GlobalSettingsModal.tsx` を `SettingsShell` 呼び出しへ縮小
5. **レスポンシブ**: ドロワー挙動の追加
6. **検証**: walkthrough.md チェックリスト消化

---

## 7. リスクと対策

| リスク | 対策 |
|-------|------|
| state の移行でセットアップ値が失われる | 最初に `SettingsContext` に現行 state を完全複製し、段階移行 |
| 既存 Tab コンポーネントの props 互換崩れ | 既存 props を維持し、ラッパー側で吸収 |
| Tauri Store キー衝突 | キー名一切変更しない方針を徹底 |
| `frontend-core` への意図せぬ変更 | 実装前後で `git diff src/context src/hooks src/types` を確認 |
