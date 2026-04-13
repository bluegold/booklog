# Reading Log (Cloudflare Workers + Hono + D1 + htmx)

ISBN を入力して本を登録し、一覧を表示する小さな読書ログアプリです。

- Backend: Cloudflare Workers + Hono
- Database: D1 (SQLite)
- UI: Server-rendered HTML + htmx
- Styling: Tailwind CSS v4 (CLI build)
- Test: Vitest

## Features

- ISBN 入力フォームから登録
- openBD から書誌情報を取得（title / author / publisher / published_at / cover_url）
- 登録済み一覧の表示
- htmx による部分更新
- 書影未取得時は NO IMAGE プレースホルダーを表示
- 重複 ISBN 登録時のエラー表示
- CSRF トークン検証と ISBN 形式検証

## Tech Notes

- `wrangler` と `tsc` はグローバルコマンドとして使える前提です。
- `npx wrangler ...` / `npx tsc ...` でも実行できます。
- `DEBUG_OPENBD=1` を設定すると openBD 取得と保存直前ペイロードのデバッグログを出力します。

## Getting Started

1. 依存インストール

```bash
npm install
```

2. D1 スキーマ適用

```bash
wrangler d1 execute reading-log-db --file=./schema.sql
```

ローカル DB に適用する場合は `--local` を付けます。

```bash
wrangler d1 execute reading-log-db --local --file=./schema.sql
```

3. 開発起動

```bash
npm run dev
```

`npm run dev` は以下を同時実行します。

- Tailwind CSS の watch ビルド
- `wrangler dev`

## Scripts

```bash
npm run dev         # Tailwind watch + wrangler dev
npm run build:css   # public/app.css を生成（minify）
npm run watch:css   # CSS の watch ビルド
npm test            # Vitest 単発実行
npm run test:watch  # Vitest watch
```

## Routes

- `GET /` : 入力フォームと一覧セクションを表示
- `GET /books` : 登録済み書籍一覧の HTML 断片を返す
- `POST /books` : CSRF 検証後に ISBN 登録。結果メッセージと一覧更新断片（OOB）を返す

## Project Structure

```text
src/
  index.tsx                    # Routes
  repositories/                # D1 access
  services/                    # use-case / validation / duplicate handling
  templates/                   # Layout / pages / partials
  styles/                      # Tailwind input files
public/                        # Tailwind output files
schema.sql                     # D1 schema
```

## Testing Policy (Current)

- Route-level tests を優先（`app.request` ベース）
- DB 挙動はユニットテスト内でモック
- openBD 呼び出しは `fetch` をモックして検証
- htmx 応答は HTML 断片（`hx-*`, `hx-swap-oob`）を検証

## Current Schema

```sql
CREATE TABLE books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn TEXT UNIQUE,
  title TEXT,
  author TEXT,
  publisher TEXT,
  published_at TEXT,
  cover_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
