# zenn-clone-nextjs-rails-aws

Zenn のクローンアプリ。Rails（APIモード）× Next.js × MySQL の構成を Docker で開発する。

## 技術スタック

| 役割 | 技術 |
| --- | --- |
| バックエンド | Rails 8.1 APIモード / Ruby 3.3.7 |
| フロントエンド | Next.js 15 App Router / Node 22 |
| DB | MySQL 8.4 |
| インフラ | Docker / AWS |

---

## 環境構築

```bash
# コンテナビルド
docker compose build --no-cache

# コンテナ起動
docker compose up -d

# DBセットアップ（railsコンテナ内）
rails db:create
rails db:migrate
```

---

## 開発サーバー起動

コンテナ起動とサーバー起動は分離しています。コンテナ起動後、各コンテナ内で手動起動してください。

```bash
# railsコンテナに入る
docker compose exec rails bash

# railsコンテナ内でサーバー起動
rails s -b '0.0.0.0'
```

```bash
# nextコンテナに入る
docker compose exec next bash

# nextコンテナ内でサーバー起動
npm run dev
```

| サービス | URL |
| --- | --- |
| Rails API | http://localhost:3000 |
| Next.js | http://localhost:8000 |
| 開発メール確認 | http://localhost:3000/letter_opener |

---

## API テスト（curl）

`rails/scripts/api_test.sh` を使って curl でAPIの動作確認ができます。

### 実行方法（railsコンテナ内）

```bash
chmod +x scripts/api_test.sh
scripts/api_test.sh [コマンド]
```

### コマンド一覧

| コマンド | 内容 |
| --- | --- |
| `health_check` | ヘルスチェック |
| `sign_up` | ユーザー新規作成 |
| `sign_in` | サインイン（トークン表示のみ） |
| `sign_in_and_save` | サインイン（トークンを `/tmp/auth_tokens.env` に保存） |
| `request_with_token` | 保存済みトークンで認証済みリクエスト |

### 動作確認の流れ

```bash
# 1. ユーザー新規作成
scripts/api_test.sh sign_up

# 2. ブラウザで http://localhost:3000/letter_opener を開き
#    届いたメールの「アカウントを有効化する」を押下

# 3. サインイン＆トークン保存
scripts/api_test.sh sign_in_and_save

# 4. 認証済みリクエスト
scripts/api_test.sh request_with_token
```

---

## その他のコマンド

```bash
# Rubocop
bundle exec rubocop -A

# Rspec
bundle exec rspec

# Brakeman（セキュリティ検査）
bin/brakeman --no-pager

# bundle-audit（脆弱性検査）
bin/bundler-audit
```

---

## トラブルシュート

詳細は `docs/memo.md` を参照してください。
