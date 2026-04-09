# Epic 36 Handoff

## この Epic で確定したこと

- Git が未インストールでも、Vicara 全体はブロックされずに起動する。
- Git 未検出時は `src/App.tsx` でヘッダー直下にワーニングバナーを表示する。
- `WorkspaceContext` の `gitStatus` と `refreshGitStatus()` は維持されているため、後続機能は引き続きこの状態を参照できる。

## 利用可能になったバックエンド API

- Tauri コマンド: `detect_installed_clis`
- 実装ファイル: `src-tauri/src/cli_detection.rs`
- 登録箇所: `src-tauri/src/lib.rs`

返却形式:

```ts
type CliDetectionResult = {
  name: string;
  display_name: string;
  installed: boolean;
  version: string | null;
};
```

現時点の検出対象:

- `claude`
- `gemini`
- `codex`

## フロントエンド側の再利用ポイント

- フック: `src/hooks/useCliDetection.ts`
- 提供値: `results`, `loading`, `error`, `refresh`
- 初回取得結果はメモリキャッシュされる
- `refresh()` で強制再検出できる

## 次の Epic で意識してほしいこと

- Git 未検出は「アプリ利用不能」ではなく「Dev エージェント機能制限」として扱う前提に変わった
- CLI 検出結果は UI 表示だけでなく、エージェント起動可否や設定画面の説明文にも使える
- `frontend-core` の基盤である `WorkspaceContext` は今回触っていないため、後続 Epic でも安全に参照できる

## 検証状況

- `cargo test --manifest-path src-tauri/Cargo.toml` 成功
- `npm run build` 成功
- 手動動作確認は PO 判断でスキップ済み
