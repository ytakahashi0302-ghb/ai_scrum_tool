# EPIC57 実装計画 — デザインブラッシュアップ

## 背景・目的

アプリの機能は十分に拡充されたが、以下の問題が蓄積している。

- `gray-*` と `slate-*` が同一コンポーネント内で混在
- 角丸（`rounded-md` / `rounded-lg` / `rounded-xl` / `rounded-2xl`）が場所によってバラバラ
- ストーリータイトルなどで `truncate` がなく2行に崩れる箇所がある
- ヘッダー右クラスターに異なる性質の要素（コスト・プロジェクト名・フォルダ・履歴）が混在
- Dev エージェント（ターミナル）の開き方が分かりにくい
- Board のプレビューボタンが大きなカード型で、ヘッダー行のバランスを崩している
- `sky-*` カラーが Board のみで使われ、システム全体と不統一

**方針**: 機能変更なし。Tailwind クラスとコンポーネント構造のみ変更する。

---

## 対象モジュール

| モジュール | 対象ファイル |
|-----------|------------|
| frontend-core | `src/App.tsx`, `src/components/ui/*` |
| frontend-kanban | `src/components/kanban/*`, `src/components/board/*` |
| frontend-ai | `src/components/ai/PoAssistantSidebar.tsx`（バッジ連携のみ） |
| frontend-terminal | `src/components/terminal/TerminalDock.tsx`（バー改修） |

---

## Phase 別実装詳細

### Phase 1: デザイントークン定義
**対象**: `tailwind.config.js`

カスタムテーマを定義し、後続 Phase の基準とする。

```js
// tailwind.config.js
theme: {
  extend: {
    borderRadius: {
      badge: '0.25rem',   // rounded-md相当（バッジ・タグ）
      card:  '0.75rem',   // rounded-xl相当（カード・パネル）
    },
    boxShadow: {
      card:  '0 1px 3px 0 rgb(0 0 0 / 0.07)',
      panel: '0 4px 6px -1px rgb(0 0 0 / 0.07)',
    },
  },
}
```

**統一方針**:
- ニュートラルカラーは `slate-*` に統一（`gray-*` は廃止方向）
- アクセントカラーは `blue-*` に統一（`sky-*` は廃止）
- 角丸: バッジ/タグ → `rounded-md`、カード/パネル → `rounded-xl`、全体ボタン → `rounded-xl`
- シャドウ: カード → `shadow-sm`、フローティングパネル → `shadow-md`

---

### Phase 2: カラー統一
**対象**: `App.tsx`, `TaskCard.tsx`, `StorySwimlane.tsx`, `StatusColumn.tsx`, `BacklogView.tsx`, `Button.tsx`

主な置換パターン：

| 変更前 | 変更後 | 場所 |
|--------|--------|------|
| `bg-gray-100` | `bg-slate-100` | `App.tsx`, `Board.tsx` |
| `bg-gray-50` | `bg-slate-50` | `StorySwimlane.tsx` ヘッダー |
| `border-gray-200` | `border-slate-200` | 各カード |
| `text-gray-500` | `text-slate-500` | 説明文・補助テキスト |
| `text-gray-900` | `text-slate-900` | 見出しテキスト |
| `bg-gray-200` (Button Secondary) | `bg-slate-200` | `Button.tsx` |
| `border-sky-200`, `bg-sky-*`, `text-sky-*` | `border-blue-200`, `bg-blue-*`, `text-blue-*` | `Board.tsx` プレビューボタン |

---

### Phase 3: カードデザイン統一
**対象**: `TaskCard.tsx`, `StorySwimlane.tsx`, `StatusColumn.tsx`, `BacklogView.tsx`

統一後の基本スタイル:

```
カード全般:  bg-white rounded-xl border border-slate-200 shadow-sm
スイムレーン: bg-white rounded-xl border border-slate-200 shadow-sm mb-4
タスクカード: rounded-xl（現在 rounded-md から変更）
列コンテナ:  rounded-xl（現在通り、shadow を shadow-sm に統一）
```

---

### Phase 4: テキストオーバーフロー対応
**対象**: `StorySwimlane.tsx`, `BacklogView.tsx`

```tsx
// StorySwimlane.tsx — ストーリータイトル（現在: 無制限）
<h2 className="truncate text-lg font-semibold text-slate-900" title={story.title}>
  {story.title}
</h2>

// BacklogView.tsx — バックログアイテムタイトル
<span className="line-clamp-2 text-sm font-medium text-slate-900">
  {item.title}
</span>

// ステータスバッジ全般
<span className="... whitespace-nowrap">...</span>
```

---

### Phase 5: ヘッダーリファイン
**対象**: `src/App.tsx`（`AppHeader` 関数 / `AppContent` 関数）、`ScrumDashboard.tsx`、`Board.tsx`

**変更内容**:

1. `LlmUsagePill` をヘッダーから削除し、`Board.tsx` のスプリントボードヘッダー行（タイトル横）に移動
2. 履歴ボタン（`onOpenHistory`）をヘッダーから削除し、`Board.tsx` ヘッダー行に移動
3. ヘッダー右クラスターは `[プロジェクト名▼ | フォルダ⚙]` のみに整理

```tsx
// ヘッダー右クラスター（変更後）
<div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-1 shadow-sm">
  <ProjectSelector />
  <div className="hidden h-8 w-px bg-slate-200 sm:block" />
  <ProjectSettings />
</div>

// Board.tsx ヘッダー行（変更後）
<div className="mb-6 flex justify-between items-center">
  <div>
    <h1>スプリントボード</h1>
    <p>{formatSprintLabel(activeSprint)}</p>
  </div>
  <div className="flex items-center gap-3">
    <LlmUsagePill projectId={currentProjectId} />   // ← ここに移動
    <button onClick={onOpenHistory}>履歴</button>     // ← ここに移動
    <PreviewButton ... />                             // ← 整理後のボタン
  </div>
</div>
```

`LlmUsagePill` と `onOpenHistory` は props として `Board` に渡す設計に変更。

---

### Phase 6: 動作確認ボタン整理
**対象**: `src/components/kanban/Board.tsx`

**変更内容**:

- `min-h-[56px]` の3行カード型ボタン → 標準の `h-10` ボタン1個に変更
- `sky-*` → `blue-*` 統一
- `rounded-2xl` → `rounded-xl` 統一
- URL サブタイトルをボタン内から除去し `title` 属性（tooltip）へ移動
- 「停止」ボタンの別出現を廃止 → 同じボタンがアイコン+テキスト切替で2状態に

```tsx
// 変更後のボタン（起動前）
<Button variant="secondary" size="md"
  className="rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50"
  title={rootPreviewSubtitle}
>
  <Eye size={15} className="mr-1.5" />
  動作確認
</Button>

// 変更後のボタン（起動中 / 停止）
<Button variant="secondary" size="md"
  className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
  onClick={handleStopRootPreview}
  title={`停止: ${previewInfo?.url}`}
>
  <Square size={15} className="mr-1.5" />
  停止
</Button>
```

---

### Phase 7: Dev Agent / PO アシスタント 動線改善
**対象**: `src/App.tsx`, `src/components/terminal/TerminalDock.tsx`, `src/components/ui/EdgeTabHandle.tsx`

#### 7-A: ターミナル最小化バーをクリック可能な帯に改修

`TerminalDock.tsx` の最小化状態 UI を改修。現在の34px 最小化バーを全体クリック可能なボタン帯にする。

```tsx
// TerminalDock.tsx — 最小化時の表示（変更後）
{isMinimized && (
  <button
    onClick={onToggleMinimize}
    className="flex h-full w-full items-center gap-2 px-4 text-gray-400 hover:text-gray-200 transition-colors"
  >
    <TerminalSquare size={14} className="shrink-0" />
    <span className="text-xs font-semibold uppercase tracking-[0.12em]">Dev Agent</span>
    <span className="ml-auto text-xs opacity-50">▲ 開く</span>
  </button>
)}
```

#### 7-B: EdgeTabHandle のラベル変更

```tsx
// App.tsx — 下部フロートハンドル
<EdgeTabHandle
  side="bottom"
  label="Dev Agent"           // 変更: チームの稼働状況 → Dev Agent
  icon={TerminalSquare}
  active={!isTerminalMinimized}
  badge={isAgentRunning ? '●' : undefined}   // 稼働中バッジ
  ...
/>

// App.tsx — 右端ハンドル
<EdgeTabHandle
  side="right"
  label="PO"                  // 変更: PO アシスタント / ふせん → PO
  icon={Bot}
  active={isSidebarOpen}
  badge={hasUnreadPoMessage ? '●' : undefined}   // 未読バッジ
  ...
/>
```

#### 7-C: バッジ状態の管理

- `isAgentRunning`: `TerminalDock` が既に持つエージェント稼働状態を `App.tsx` に lift up
- `hasUnreadPoMessage`: `PoAssistantSidebar` の未読フラグを `App.tsx` に lift up
- バッジは静的なドット（`●`）のみ。アニメーションなし

---

### Phase 8: フォーカスリング統一
**対象**: `Button.tsx`, `Input.tsx`, `Textarea.tsx`, `Modal.tsx`

```
統一後: focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
```

`ring-offset-2` が抜けている箇所に追加。

---

### Phase 9: Badge コンポーネント化
**対象**: `src/components/ui/Badge.tsx`（新規）、`TaskCard.tsx`、`StorySwimlane.tsx`

```tsx
// src/components/ui/Badge.tsx
interface BadgeProps {
  variant: 'priority' | 'status';
  level?: 1 | 2 | 3 | 4 | 5;       // priority 用
  status?: Task['status'];           // status 用
}
```

`TaskCard.tsx` と `StorySwimlane.tsx` に重複実装されている優先度バッジロジックをこのコンポーネントに統合。

---

### Phase 10: PO レビュー後の追加調整
**対象**: `src/components/project/InceptionDeck.tsx`, `src/components/ai/PoAssistantSidebar.tsx`, `src/components/ui/EdgeTabHandle.tsx`, `src/components/terminal/TerminalDock.tsx`, `src/App.tsx`, `src/components/kanban/TaskCard.tsx`

#### 10-A: Inspection Deck の文字被り解消

- 対象不具合は `PoAssistantSidebar` ではなく `InceptionDeck.tsx` 側で発生していたため、修正対象を限定する
- アバターのサイズや全体余白を大きく変えず、入力欄コンテナのみ `z-index` を上げて前面表示にする
- 見た目のバランスを崩す広い `padding-right` 逃がしは採用しない

```tsx
<div className="relative z-20 border-t border-gray-200 bg-white p-4">
  ...
</div>
```

#### 10-B: PO アシスタント側の誤修正ロールバック

- Investigation 中に `PoAssistantSidebar.tsx` へ入れた余白追加・アバター位置変更は、今回の本筋ではないため撤回する
- PO アシスタントの見た目は EPIC 57 完了時点の状態へ戻す

#### 10-C: EdgeTabHandle / TerminalDock の視認性リテイク

- 稼働中バッジは「数値バッジ」や強いピルではなく、小さな静的ドットに簡素化
- ハンドル本体は border / shadow をわずかに強め、ターミナル最小化バーとドック上端の輪郭も少しだけ見えやすくする
- 強い発光や追加色は避け、既存の `blue-*` / `slate-*` だけで整える

#### 10-D: Review タスクカードの情報設計整理

- タスク番号チップはタイトル下ではなく、優先度バッジと同じ上段メタ情報へ移動
- `Review` 状態バッジはカード内から撤去し、状態表示は列ヘッダー側へ統一
- プレビュー未起動時の補助ボックスは廃止し、状態はボタンラベルと `title` 属性へ吸収する
- プレビュー起動中のみ、URL と `開く` / `停止` を含む細い状態行を表示する
- Review アクションは `中立(プレビュー)` / `主アクション(承認してマージ)` / `青アウトライン(コメントを付けて再開発)` に整理する
- 3 ボタンの幅はすべてカード幅に揃える

---

### Phase 11: ヘッダー・設定画面の最終導線整理
**対象**: `src/App.tsx`, `src/components/kanban/Board.tsx`, `src/components/ui/settings/SettingsSidebar.tsx`, `src/components/ui/settings/SettingsShell.tsx`, `src/components/ui/SetupStatusTab.tsx`

#### 11-A: ヘッダーと Board ヘッダーの役割再整理

- `LlmUsagePill` は Kanban 以外の画面や PO アシスタント会話でも意味を持つため、Board ヘッダーから撤去してアプリヘッダー右端へ戻す
- `ProjectSettings` は初期セットアップ後の常用導線ではないため、現在のワークスペースに `local_path` が未設定のときだけヘッダー表示する
- `履歴` はスプリント単位の文脈に近いため、Board 右上アクション帯ではなくスプリント名の横へ移動する
- Board 右上は `動作確認` だけに絞り、用途の異なるアクション混在を避ける

#### 11-B: 設定サイドバーのナビゲーション密度調整

- デスクトップのサイドバー幅を少し広げ、説明文の 2 行折り返しを減らす
- 説明文は「本文の要約」ではなくナビ用の短いラベルへ寄せ、1 行で読めることを優先する
- モバイルドロワー幅も合わせて拡張し、デスクトップとの情報密度差を小さくする

#### 11-C: 設定画面の勝手な遷移防止

- `recommendedInitialSection` は「初回にどこを開くか」の推薦値に留め、画面表示後の非同期再判定では active section を上書きしない
- これにより、設定画面を開いて数秒後に `AIプロバイダー設定` へ自動遷移してしまう挙動を防ぐ

#### 11-D: セットアップ状況の進行表示の分離

- `補足` ボックスは説明専用に戻し、ロード中メッセージは含めない
- `現在のセットアップ状況を確認しています` は `今すぐ再検出` ボタン左の進行表示として分離し、補足情報と状態表示の役割を分ける

---

## 実施順序

```
Phase 1（トークン定義）→ Phase 2（カラー）→ Phase 3（カード）→ Phase 4（テキスト）
→ Phase 5（ヘッダー）→ Phase 6（プレビューボタン）→ Phase 7（動線）
→ Phase 8（フォーカス）→ Phase 9（バッジ）→ Phase 10（PO レビュー後の追加調整）
→ Phase 11（ヘッダー・設定画面の最終導線整理）
```

Phase 1〜4 は機械的な置換が中心で独立性が高い。Phase 5〜7 はコンポーネント間の props 受け渡しを伴うため慎重に。

---

## テスト方針

各 Phase 完了後に開発サーバー（`npm run tauri dev`）で以下を目視確認：

| 確認項目 | 対象 Phase |
|---------|-----------|
| カード崩れなし（テキスト truncate 正常動作） | 3, 4 |
| ドラッグ＆ドロップ正常動作 | 3 |
| ヘッダーの要素配置・折り返し動作 | 5 |
| プレビューボタン：起動 → 停止の状態切替 | 6 |
| ターミナルバーのクリックで展開・格納 | 7 |
| EdgeTabHandle のバッジ表示（エージェント稼働時） | 7 |
| サイドバー・ターミナルのリサイズ動作 | 7 |
| スプリント作成・タスク移動・AI chat | 全体回帰 |
| フォーカスリングの表示（Tab キー移動） | 8 |
| Inspection Deck の入力文字がアバターに被らない | 10 |
| PO アシスタント側の見た目が EPIC 57 完了時点から変わっていない | 10 |
| Dev Agent / PO ハンドルのドットが過度に目立たず、輪郭だけ改善されている | 10 |
| Review カードでタスク番号・ボタン幅・状態表示が一貫している | 10 |
| ヘッダー右側が `ワークスペース切替 / 必要時のみフォルダ設定 / LLM 使用量` の順で安定表示される | 11 |
| Board 右上は `動作確認` のみで、`履歴` はスプリント名の横に表示される | 11 |
| 設定サイドバーの説明文が 2 行崩れしにくく、本文幅も十分保たれている | 11 |
| 設定画面を開いた後に数秒後の自動遷移が発生しない | 11 |
| セットアップ状況のロード文言が補足ボックスではなく再検出導線側に表示される | 11 |

追加で、各リテイク後に `npm run build` を実行し、型エラー・ビルドエラーが出ていないことを確認する。
