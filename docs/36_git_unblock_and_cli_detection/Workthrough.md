# Epic 36: Git ブロッキング修正 + CLI 検出基盤 Workthrough

## 概要

Epic 36 では、Git 未インストール時にアプリ全体が停止する状態を解消し、後続 Epic で使う複数 CLI 検出の土台を追加した。目的は「Git が無くても PO 支援やカンバン利用は継続可能にすること」と「Claude / Gemini / Codex を同一パターンで検出できるバックエンド API を先に用意すること」の 2 点だった。

## 実装の軌跡

### 1. Git ブロッキングの解除

既存の `src/App.tsx` には、`gitStatus.checked && !gitStatus.installed` のときにアプリ全体を `return` で止める分岐が存在していた。この構造だと Git Worktree が不要な画面まで巻き込んで利用不能になるため、以下の方針で変更した。

- `WorkspaceContext` の `gitStatus` と `refreshGitStatus()` はそのまま維持する
- ブロッキング `return` を削除し、通常レイアウトを常に描画する
- Git 未検出時のみ、ヘッダー直下に警告バナーを差し込む

これにより、Dev エージェント機能に必要な Git の欠如は明示しつつ、アプリ全体の利用継続性を確保した。

### 2. WarningBanner の追加

計画では `WarningBanner` コンポーネントを使う想定だったが、既存コードベースには同名コンポーネントが存在しなかった。そのため、新規に `src/components/ui/WarningBanner.tsx` を追加した。

技術的な判断:

- `message` と `details` は `ReactNode` で受けられるようにし、今後リンクや補足 UI を柔軟に埋め込めるようにした
- `children` スロットを設け、Git ダウンロードや再チェックなどのアクションを右側に差し込めるようにした
- デザインは既存 UI の Tailwind 設計に合わせ、強すぎない注意喚起色として amber 系を採用した

### 3. CLI 検出基盤の実装

Rust 側では `src-tauri/src/cli_detection.rs` を新設し、以下の CLI を対象にした。

- `claude`
- `gemini`
- `codex`

検出方法は各 CLI に対して `--version` を実行するシンプルなものとし、成功時は `installed: true` とバージョン文字列、失敗時は `installed: false` を返すようにした。

技術的な判断:

- 実行は `tokio::task::spawn_blocking` を使って並列化した
- CLI ごとの差異を吸収するため、`CliSpec` の定義配列から同一ロジックで検出する構造にした
- バージョン文字列は `stdout` 優先、必要なら `stderr` からも最初の非空行を拾うようにした
- コマンド単位のエラーは全体失敗にせず、その CLI のみ `installed: false` として扱うことで API 全体の安定性を優先した

### 4. フロントエンド検出フック

`src/hooks/useCliDetection.ts` では Tauri コマンド `detect_installed_clis` を呼ぶカスタムフックを追加した。後続 Epic で複数画面から再利用されることを想定し、単純な `useEffect` 呼び出しに留めず、軽量なメモリキャッシュを入れている。

技術的な判断:

- 初回取得結果をモジュールスコープに保持し、再マウント時の無駄な再取得を防ぐ
- 進行中リクエストも共有し、同時マウントで重複 IPC が発生しないようにした
- `refresh()` では強制再取得できるようにして、CLI インストール後の再検出をサポートした

## 検証

以下を実行し、いずれも成功した。

- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run build`

Vite の bundle size warning は出るが、ビルド失敗ではなく今回の Epic の受け入れ条件外と判断した。

## 結果

Epic 36 の完了により、Git が未インストールでも Vicara は起動し、非 Dev エージェント領域の利用を継続できるようになった。また、後続 Epic は `detect_installed_clis` を利用して CLI 選択 UI や利用可能ツール判定を組み立てられる状態になった。
