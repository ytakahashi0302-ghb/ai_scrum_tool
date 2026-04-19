# CHANGELOG

## Unreleased

### Epic 55: コンテキスト連動型 POアシスタント
- Task / PBI カードと既存編集モーダルから、対象アイテムにフォーカスしたまま PO アシスタントへ直接相談できる導線を追加
- プロダクトバックログ画面の PBI カードとネスト Task 一覧からも直接相談を開始できるように拡張
- PO アシスタントサイドバーに focus チップ、コンテキスト境界システムメッセージ、自動 focus 解除、新しい会話リセットを追加
- backend の focus 付き相談を非 mutation モードへ切り替え、AI による直接 DB 更新を禁止したうえで Task / Story ごとの prompt 制約を実装
- Task focus では `## 提案` 形式の Markdown 提案を誘導し、Story focus では prompt と parser の二段構えで提案ブロックを禁止
- Forgiving parser と差分比較 `SuggestionReviewModal` を追加し、AI 提案は既存編集モーダル確認経由でのみ反映する安全なフローへ統一

### 検証
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `node tests/suggestionParser.test.mjs`
- `node tests/poAssistantFocusState.test.mjs`
