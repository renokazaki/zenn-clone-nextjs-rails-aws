# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Zenn のクローンアプリ。Rails（APIモード）× Next.js × MySQL の構成を Docker で開発する。ハンズオン教材に沿って構築中。

- バックエンド: `rails/` — Rails 8.1 APIモード、Ruby 3.3.7
- フロントエンド: `next/` — Next.js 15 app router（Node 22）
- DB: MySQL 8.4（`db` コンテナ）

## Docker 操作

```bash
# コンテナビルド
docker compose build --no-cache

# コンテナ起動（バックグラウンド）
docker compose up -d

# コンテナ停止
docker compose stop

# railsコンテナに入る
docker compose exec rails /bin/bash

# nextコンテナに入る
docker compose exec next /bin/bash
```

コンテナ起動とサーバー起動は分離している。コンテナ起動後、各コンテナ内で手動でサーバーを起動する。

```bash
# railsコンテナ内でサーバー起動
rails s -b '0.0.0.0'

# nextコンテナ内でサーバー起動
npm run dev
```

- Rails: http://localhost:3000
- Next.js: http://localhost:8000

## Rails コマンド（コンテナ内で実行）

```bash
bundle install
rails db:create
rails db:migrate
rails db:seed
rails c
bin/rubocop
bin/brakeman --no-pager
bin/bundler-audit
```

## アーキテクチャ

- `docker-compose.yml` — db / rails / next の3コンテナを定義
- `rails/` — Rails アプリ本体。`./rails:/myapp` でホストとマウント
- `next/` — Next.js アプリ本体。`./next:/app` でホストとマウント
- `rails/config/database.yml` — DB接続先は `host: db`（dbコンテナ名で名前解決）
- `rails/.rubocop.yml` — rubocop-rails / rubocop-rspec を require し、`config/rubocop/` 配下の3ファイルを inherit_from で読み込む

## 備忘録

トラブルシュートや環境構築時の知見は `docs/memo.md` に記録していく。同じ構築を再度行う際はまずこのファイルを参照すること。

## 環境構築時の注意点

- `rails new` 実行後に自動生成される Dockerfile はプロダクション用のため、開発用に書き直す必要がある（詳細は `docs/memo.md` 参照）
- `.rubocop.yml` の `TargetRubyVersion` は `3.3.7` のような patch バージョンではなく `3.3` のように指定する
- `docker-compose.yml` に `version:` キーは不要（obsolete）
