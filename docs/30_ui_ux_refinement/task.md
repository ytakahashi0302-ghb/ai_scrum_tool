# Epic 30: UI/UXと情報設計（IA）の洗練

## 背景
- Epic 28 によりマルチエージェント基盤が安定稼働し、Epic 29 により技術的負債の解消が完了した。
- 本Epicでは、MicroScrum AI を「使えるツール」から「毎日触りたくなるプロツール」へ引き上げるため、見た目の完成度と情報設計を重点的に改善する。

## 目的
- ターミナルDockを IDE ライクな本物のタブ UI に刷新し、視認性と操作性を高める。
- ヘッダーのアクション配置を整理し、誤操作を減らしつつ、初見でも意味が分かる導線にする。
- Devチーム構成設定において、Claude Code CLI による自律エージェント実行というシステム価値を可視化し、情報の流れを自然にする。

## 対象コンポーネント
- `src/components/terminal/TerminalDock.tsx`
- `src/App.tsx`
- `src/components/ui/ProjectSettings.tsx`
- `src/components/ui/ProjectSelector.tsx`
- `src/components/ui/TeamSettingsTab.tsx`
- 参照のみ: `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`

## 成果物
- ターミナルDockのタブデザイン改善案
- ヘッダーのナビゲーション/アクション再配置案
- Team Settings の情報設計再構成案
- 実装方針とテスト方針をまとめた `implementation_plan.md`

## PO決定事項
- Scaffold ボタンのラベルは `Scaffold` を採用する。
- Team Settings の導入コピーは、技術説明だけでなくプロダクト訴求寄りのワクワク感を持たせる。
- TerminalDock の配色は VS Code ライクなダークグレー基調を強め、没入感を優先する。

## タスクリスト
1. [x] 既存ヘッダーを「ワークスペース文脈」と「グローバル操作」に分離する方針を定義し、実装した。
2. [x] `TerminalDock.tsx` のセッションタブを VS Code ライクな連続タブへ再設計し、その後 1 行統合型のスリークなタブストリップへ仕上げた。
3. [x] `TeamSettingsTab.tsx` を 4 つの視線誘導ブロックに再編した。
4. [x] Claude Code CLI を前面に出す説明バッジ/コピーを設計し、プロダクト訴求寄りの表現で実装した。
5. [x] 既存の Tailwind ユーティリティに合わせた実装方針で、局所的な UI 改善として完結させた。
6. [x] レスポンシブ、状態表現、アクセシビリティ、誤操作防止の観点を反映し、`npm run build` で確認した。
7. [x] `App.tsx` のヘッダーを Kanban / Inception Deck 共通ナビゲーションとして統合した。
8. [x] カンバン画面から Inception Deck へ再入線できる導線をヘッダー内に常設した。
9. [x] Terminal Dock の開閉トグルについて、クリック領域拡大と視認性改善を行い、最終的にタブバー右端へ統合した。
10. [x] `TaskCard.tsx` と関連モーダルにおいて、入力時のキーイベントが `dnd-kit` に誤伝播しないよう制御した。

## 完了条件
- [x] PO 要望 3 点に対する改善方針が文書化されている。
- [x] 各対象コンポーネントごとに、見た目の変更意図と情報設計の意図が明記されている。
- [x] 実装着手前に確認すべきリスク、依存、テスト観点が整理されている。
- [x] 関連 BACKLOG として指定された 4 件が、今回の UI 改善と矛盾なく同時解消されている。

## 完了サマリー
- Epic 30 は PO 承認済みで完了。
- UI/IA の主対象であるヘッダー、Team Settings、Terminal Dock の改善を実装完了。
- 関連 BACKLOG として指定されたナビゲーション統合、Inception Deck 再入線、Terminal Dock トグル改善、キー入力バグ修正も同時に解消。
- フロントエンドは `npm run build` 成功によりビルド検証済み。
