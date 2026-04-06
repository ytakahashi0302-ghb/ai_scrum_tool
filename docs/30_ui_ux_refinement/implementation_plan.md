# Epic 30 実装計画

## ゴール
- MicroScrum AI 全体の UI を「業務ツールの寄せ集め」ではなく、「ひとつの統一されたプロダクト体験」として感じられる状態へ引き上げる。
- 見た目だけでなく、情報の優先順位、視線誘導、アクションの安全性、状態の分かりやすさを同時に改善する。

## デザイン方針
- ベーストーンは現状のブルー/インディゴ系を継承しつつ、グレーの階調コントラストを強めて情報のレイヤーを明確にする。
- 「作業中の面」はフラットかつ密度高め、「設定や説明の面」は余白とカード境界を活かした落ち着いたレイアウトに寄せる。
- Lucide アイコンは補助情報として使い、意味の特定が難しい操作には必ずテキストラベルまたは説明を併記する。
- Tailwind CSS v4 のユーティリティで、背景、境界線、ホバー、フォーカス、シャドウを再設計する。
- Shadcn UI 的な体験品質を目指し、必要に応じて `frontend-core` 側の既存 UI プリミティブを活用または最小拡張する。

## 対象別方針

### 1. TerminalDock (`src/components/terminal/TerminalDock.tsx`)

#### 解決したい課題
- 現状のタブが「独立した丸ボタン」に見え、ターミナル領域との一体感が弱い。
- アクティブ状態と非アクティブ状態の差が弱く、どのセッションを見ているか瞬時に把握しづらい。
- 状態アイコンと Kill ボタンが、視覚的にコンソール体験へ馴染みきっていない。

#### UI/IA 改善方針
- タブ行を「ターミナル上面のタブストリップ」として再構成し、下の黒いコンソール面と連続して見える形にする。
- タブは上辺で連続し、アクティブタブだけが前面にせり出す IDE 風のレイヤー表現にする。
- 左から「状態アイコン」「ロール名」「タスク名」、右上領域または右端に補助情報を置く構成にする。
- Kill 操作はタブ外の浮いた赤ボタンではなく、アクティブタブ文脈に属するセッションアクションとして整理する。

#### Tailwind クラス変更方針
- タブストリップ全体:
  - `border-b border-zinc-800 bg-[#18181b]`
  - `flex items-end gap-px overflow-x-auto`
- 非アクティブタブ:
  - `bg-[#23232a] text-zinc-400 border border-transparent`
  - `hover:bg-[#2a2a33] hover:text-zinc-200`
- アクティブタブ:
  - `bg-[#1e1e1e] text-zinc-100 border-x border-t border-zinc-700 border-b-[#1e1e1e]`
  - `shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`
- タブ形状:
  - `rounded-t-md rounded-b-none`
  - `px-3 py-2`
- タイトル階層:
  - ロール名は `text-[10px] uppercase tracking-[0.14em] text-zinc-500`
  - タスク名は `text-sm font-medium text-current`
  - 状態文字列は `text-[11px] text-zinc-500`
- Kill ボタン:
  - `inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs text-red-200 hover:bg-red-500/20`
- 空状態:
  - `border border-dashed border-zinc-700 bg-[#202027] text-zinc-400`

#### 実装メモ
- セッション一覧は横スクロール対応を維持しつつ、タブ間の隙間は `gap-px` 程度に抑え、帯として見せる。
- スピナーや成功/失敗アイコンは現状の Lucide を再利用し、色だけターミナル配色に調整する。
- 右上の Kill ボタンは、タブストリップ右端の「アクティブセッション操作」に統合する案を優先する。

### 2. Header / App shell (`src/App.tsx`, `src/components/ui/ProjectSettings.tsx`, `src/components/ui/ProjectSelector.tsx`)

#### 解決したい課題
- Scaffolding のハンマーアイコン単体では意味が伝わらず、誤爆リスクがある。
- ワークスペース操作、プロジェクト固有操作、グローバル操作が近接しすぎており、視覚的なグルーピングが弱い。
- 右側アクション群と左側ワークスペース群の密度差が大きく、ヘッダー空間の使い方にムラがある。

#### UI/IA 改善方針
- ヘッダーを 3 つのグループに整理する。
  - ブランド/コンテキスト
  - ワークスペース操作群
  - グローバル操作群
- Scaffolding はアイコン単体をやめ、`Scaffold` または `初期化` のテキストラベル付きアクションに変更する。
- Scaffolding は「フォルダ設定完了後に使うプロジェクト固有アクション」として、ワークスペース領域の末尾に配置する。
- グローバル設定は右端のユーティリティ群へ寄せ、履歴や AI Leader と同じ「アプリ全体操作」の文脈で整理する。
- Tooltip を使う場合でも、危険回避の観点から Scaffolding はテキストラベル併記を基本とする。

#### Tailwind クラス変更方針
- ヘッダーラッパー:
  - `bg-white/90 backdrop-blur-md border-b border-slate-200`
- 左グループ:
  - `flex items-center gap-3`
- ワークスペース操作グループ:
  - `flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-1`
- グローバル操作グループ:
  - `flex items-center gap-2`
- Scaffolding ボタン:
  - `inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`
- グローバル設定ボタン:
  - `p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100`
- プロジェクト選択トリガー:
  - 現状の単体ボタンから、グループ内で自然に馴染む `border-slate-200 bg-white shadow-sm` 系へ微調整する。

#### 実装メモ
- `ProjectSettings` にテキストラベル付き Scaffold ボタンを設ける。
- 将来的に Tooltip を導入する余地を残しつつ、今回の最小改善はラベル追加と配置見直しで完結可能。
- モバイル幅ではテキスト省略を入れつつ、アイコンだけに戻らないように最小ラベル幅を確保する。

### 3. Team Settings (`src/components/ui/TeamSettingsTab.tsx`)

#### 解決したい課題
- Claude Code CLI による自律エージェント実行というプロダクト価値が UI 上で伝わっていない。
- 情報の階層がフラットで、ユーザーが「何から設定すればよいか」を自然に理解しづらい。
- 並行数設定、モデル取得、ロール編集が同じ重みで並んでおり、視線誘導が弱い。

#### UI/IA 改善方針
- 以下の順番で、意味の異なる 4 ブロックへ再構成する。
  1. システムのコア説明
  2. 全体の制御
  3. API の準備
  4. テンプレート定義
- 最上部に「Claude Code CLI / Autonomous Agents」系のバッジと説明文を置き、機能の背景を一目で理解できるようにする。
- 並行稼働数は単なるフォームではなく、「システムのスループット制御」であることが伝わる表現にする。
- モデル取得エリアは API 準備ステップとして独立カード化し、未設定/取得済み/取得中の状態差を強める。
- ロール定義は最後の大きな編集領域に置き、ロールカードの見出し、削除アクション、入力欄の密度を整理する。

#### Tailwind クラス変更方針
- 画面全体:
  - `space-y-5`
- コア説明カード:
  - `rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-5`
  - バッジは `inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-semibold text-sky-700`
- セクションカード共通:
  - `rounded-2xl border border-slate-200 bg-white p-5 shadow-sm`
- セクション見出し:
  - `text-sm font-semibold text-slate-900`
  - 補助文は `mt-1 text-sm leading-6 text-slate-600`
- 並行数表示:
  - `rounded-xl bg-slate-100 px-3 py-2 text-lg font-semibold text-slate-800`
- スライダー:
  - ネイティブ `range` を使う場合でも周囲に説明ラベルと目盛りを加え、見た目の粗さを抑える。
- モデル取得ボタン:
  - `inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100`
- バリデーション:
  - `rounded-xl border border-amber-200 bg-amber-50 px-4 py-3`
- ロールカード:
  - `rounded-2xl border border-slate-200 bg-white p-5 shadow-sm`
  - 見出し行を `flex items-start justify-between gap-4`
  - 役割ラベルを `text-[11px] uppercase tracking-[0.16em] text-sky-600`
- 追加ボタン:
  - `w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100`

#### 追加コピー案
- バッジ: `Claude Code CLI Powered`
- 見出し: `自律エージェントチームを編成する`
- 説明文:
  - `本システムは Claude Code CLI を自律エージェントとして利用し、複数ロールが並行して開発するチーム体験をシミュレートします。`

#### 実装メモ
- 既存の `Button` は活用しつつ、カードやバッジの表現は `TeamSettingsTab.tsx` 内で構築可能。
- 必要なら `frontend-core` に Tooltip や Badge 相当の軽量プリミティブを追加するが、まずは局所的な Tailwind で完結できる構成を優先する。

## 依存・影響範囲
- 変更対象はフロントエンドのみで、Tauri バックエンドや Claude 実行ロジックには手を入れない。
- `frontend-core` は参照必須だが、型定義・Context・Hook の変更は不要見込み。
- 既存 UI コンポーネントの命名やクラス構成に合わせ、影響を局所化する。

## テスト方針
- 目視確認
  - ヘッダーで各アクションの意味が初見で理解できること
  - ターミナルタブのアクティブ/非アクティブ差が即座に判別できること
  - Team Settings の視線が上から下へ自然に流れること
- 状態確認
  - ターミナルで `Starting / Running / Completed / Failed / Killed` が崩れず表示されること
  - セッション 0 件時、複数件時、長いタスク名時でもレイアウトが破綻しないこと
  - モデル未取得、取得中、取得済みで Team Settings の表示が適切に変化すること
- 操作確認
  - Scaffold ボタンがワークスペース未設定時に誤操作されにくいこと
  - Kill ボタンがアクティブセッションに対してのみ分かりやすく表示されること
  - モバイル幅および狭いウィンドウ幅でも主要アクションが消失しないこと
- 技術確認
  - `npm run build` でフロントエンドがビルド可能であること
  - Tailwind クラス変更による型エラー、import エラー、未使用シンボルが発生しないこと

## 実装順序
1. ヘッダーを再構成し、Scaffold の意味伝達とアクション整理を先に解消する。
2. TerminalDock のタブストリップを再設計し、セッション操作の一体感を作る。
3. TeamSettingsTab の IA を再構成し、説明・制御・準備・定義の順で流れを整える。
4. 最後に全体の余白、色、境界線、ホバー、フォーカス表現を合わせて微調整する。

## 承認をお願いしたいポイント
- Scaffold ボタンのラベルは `Scaffold` を優先するか、より日本語寄りの `初期化` を優先するか。
- Team Settings の最上部コピーは、技術的正確性を優先した説明調にするか、プロダクト訴求寄りの表現に寄せるか。
- TerminalDock の配色は VS Code ライクなダークグレー基調をどこまで強めるか。
