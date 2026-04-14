# EPIC49 実装計画

## 概要

POアシスタントサイドバー内にノートタブを追加し、DEV実行中にPOがMarkdownメモを書ける機能を実装する。EPIC47のDB CRUD（`project_notes`テーブル）とEPIC48の `useProjectNotes` hookを利用する。

## 現状整理

### POアシスタントサイドバーの構造

- ファイル: `src/components/ai/PoAssistantSidebar.tsx`
- 構成: チャットメッセージ一覧 + 入力フォーム
- 呼び出し: `invoke('chat_with_team_leader', ...)` でAPIベースのチャット
- サイドバーの開閉: `EdgeTabHandle` コンポーネントで右端トグル

### Markdownエディタの既存パターン

`src/components/board/TaskFormModal.tsx` で使用:
- `<textarea>` と `<ReactMarkdown>` の切替
- タブ: 「編集」「プレビュー」
- prose クラスでスタイリング

## 実施ステップ

### Step 1: PoAssistantSidebar のタブ化

`src/components/ai/PoAssistantSidebar.tsx` を修正:

1. ヘッダー領域（タイトル部分）の下にタブ切替UIを追加
2. `useState<'chat' | 'notes'>('chat')` で管理
3. タブスタイル: 既存のScrumDashboardタブと統一（`border-b-2`パターン）
4. `activeTab === 'chat'` → 既存チャットUI、`activeTab === 'notes'` → NotesPanel

```tsx
// タブ部分のイメージ
<div className="flex border-b border-gray-200 px-3">
    <button onClick={() => setTab('chat')} className={tabClass('chat')}>
        <MessageSquare size={14} className="mr-1" /> チャット
    </button>
    <button onClick={() => setTab('notes')} className={tabClass('notes')}>
        <FileText size={14} className="mr-1" /> ノート
    </button>
</div>
```

### Step 2: NotesPanel コンポーネント

`src/components/ai/NotesPanel.tsx` を新規作成:

**レイアウト構造:**
```
NotesPanel
├── ヘッダー
│   ├── スプリントフィルタ（ドロップダウン）
│   └── 「+ 新規ノート」ボタン
├── ノート一覧（スクロール可能）
│   └── NoteCard（繰り返し）
│       ├── タイトル + ソースバッジ（user / po_assistant）
│       ├── 作成日時
│       ├── アクションボタン（編集 / 削除 / レトロに追加）
│       └── 展開時: Markdown描画コンテンツ
└── 新規作成/編集フォーム（展開時）
    ├── タイトル入力
    ├── Markdownエディタ（edit/preview タブ切替）
    └── 保存 / キャンセルボタン
```

**主要な状態管理:**
```typescript
const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
const [isCreating, setIsCreating] = useState(false);
const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
const [sprintFilter, setSprintFilter] = useState<string | null>(null); // null = 全て
```

### Step 3: レトロ転記機能

各NoteCardに「レトロに追加」ボタンを配置:

1. ボタンクリック → カテゴリ選択ドロップダウン表示（Keep / Problem / Try）
2. カテゴリ選択 → `useRetrospective` の `addItem()` を呼び出し
   - `retro_session_id`: 現在アクティブなレトロセッションのID
   - `source`: 'po'
   - `content`: ノートの内容
3. 成功時: トースト通知 or バッジ表示

**注意:** アクティブなレトロセッションがない場合はボタンを非活性にし、ツールチップで案内する。

## リスクと対策

### リスク 1: サイドバー幅の制約

- サイドバーは限られた幅（通常350-400px程度）なので、エディタの使い勝手に注意
- Markdownプレビューは折り返し表示、長いコードブロックは横スクロール

### リスク 2: 既存チャット機能への影響

- タブ切替はチャット状態をリセットしない（既存コンポーネントはそのまま維持）
- チャット入力中にタブを切り替えても入力内容が消えないようにする

## テスト方針

### 手動確認

- POサイドバーのチャット/ノートタブ切替が正常に動作する
- チャットタブからノートタブに切り替えてもチャット状態が維持される
- ノートの作成・編集・削除がDBに反映される
- Markdownプレビューが正しく描画される
- スプリントフィルタで表示が切り替わる
- 「レトロに追加」でretro_itemsにレコードが追加される

## 成果物

- `src/components/ai/PoAssistantSidebar.tsx`（タブ追加修正）
- `src/components/ai/NotesPanel.tsx`（新規）
