# rails開発環境立ち上げ

## docker関連バージョン修正

---

対応した変更  
 ファイル: docker-compose.yml  
 変更内容: version: "3"  
 行を削除（obsolete
警告の解消）、MySQL
を 8.0.32 → 8.4 に更新
───────────────────────────────────────
─
ファイル: rails/Dockerfile
変更内容: Ruby を 3.1.2 → 3.3.7 に更新
───────────────────────────────────────
─
ファイル: rails/Gemfile
変更内容: Rails を ~> 7.1.5 → ~> 8.0  
 に更新
───────────────────────────────────────
─
ファイル: rails/entorypoint.sh
変更内容: タイポを修正して
entrypoint.sh
に改名

---

## rubocopのrubyのバージョン修正

3.1.2⇒3.3
(そもそも少数は受け入れていなかった)

# nextjs 立ち上げ

FROM node:22
WORKDIR /app

---

# Next.js モダン化対応メモ（教材との差分）

教材（`docs/next/` 配下）は Next.js 13 / Pages Router ベースで書かれているが、本プロジェクトでは Next.js 15 / App Router を使う。主な差分を以下にまとめる。

## バージョン差分

| 教材 | 本プロジェクト |
|------|-------------|
| `node:19.4.0` | `node:22` |
| `Next.js 13.4.19` → `14.1.4` | `Next.js 15`（latest） |
| Pages Router（`src/pages/`） | App Router（`src/app/`） |

## ルーティング

| Pages Router（教材） | App Router（本プロジェクト） |
|--------------------|--------------------------|
| `src/pages/index.tsx` | `src/app/page.tsx` |
| `src/pages/articles/[id].tsx` | `src/app/articles/[id]/page.tsx` |
| `src/pages/_app.tsx` | `src/app/layout.tsx` |
| `src/pages/_document.tsx` | `src/app/layout.tsx`（`<html>` タグ管理） |
| `src/pages/api/xxx.ts` | `src/app/api/xxx/route.ts` |

## コンポーネント

- デフォルトが**サーバーコンポーネント（RSC）**。`useState` / `useEffect` / イベントハンドラを使う場合はファイル先頭に `'use client'` を追加
- `NextPage` 型は使わない
- `useRouter` の import 元は `next/navigation`（`next/router` ではない）
- 動的ルートのパラメータ: サーバーコンポーネントは `params` prop、クライアントコンポーネントは `useParams()`

## データフェッチ

- サーバーコンポーネントでは `async/await` + `fetch()` で直接取得（`useSWR` 不要）
- サーバーコンポーネントの fetch URL は `http://rails:3000`（Docker サービス名）を使う
- ブラウザから直接叩くクライアントコンポーネントは引き続き `http://localhost:3000`
- `getServerSideProps` / `getStaticProps` は使わない

## MUI + emotion セットアップ

- `_document.tsx` / `_app.tsx` がないため、emotion の SSR 設定方法が異なる
- `src/components/ThemeRegistry.tsx`（`'use client'`）を作り `src/app/layout.tsx` でラップ
- `.babelrc` は使わず `next.config.ts` の `compiler.emotion: true` を使う

## ESLint

- Next.js 15 は ESLint 9（Flat Config）がデフォルト。設定ファイルは `eslint.config.mjs`

## 認証（グローバルステート）

- `_app.tsx` がないため `<Auth>` コンポーネントを `src/app/layout.tsx` 内の Client Component として配置
- グローバルユーザー状態は React Context（`'use client'`）で管理
- `localStorage` は必ず `'use client'` コンポーネント内の `useEffect` で操作

---

# rails docker build エラー対応

## rails new 後の Dockerfile について

`rails new` を実行すると、Rails 8 以降はプロダクション向けの Dockerfile が自動生成される。
これはハンズオン手順書が想定する開発用の Dockerfile とは別物であり、そのままでは以下の理由でビルドエラーになる。

- `BUNDLE_WITHOUT="development"` により rubocop・rspec などの development gem がインストールされない
- `COPY vendor/* ./vendor/` で vendor/ ディレクトリが存在しないとエラー
- `BUNDLE_DEPLOYMENT="1"` により Gemfile.lock が古いとエラー
- `./bin/thrust` など Gemfile にない gem を参照する

## 対処法

`rails new` 後に生成された Dockerfile を削除し、以下の開発用シンプル構成に置き換える。

```dockerfile
FROM ruby:3.3.7
RUN apt-get update -qq && apt-get install -y vim default-mysql-client

RUN mkdir /myapp
WORKDIR /myapp
COPY Gemfile /myapp/Gemfile
COPY Gemfile.lock /myapp/Gemfile.lock

RUN bundle install
COPY . /myapp

COPY entrypoint.sh /usr/bin/entrypoint.sh
RUN chmod +x /usr/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]
```

Dockerfile の中身はコンテナの土台を作るだけであり、以降のハンズオン手順（rails s / rails c / rails db:migrate など）への影響はない。

---

# Windows（Git Bash）でのDocker execエラー

## エラー内容

```
OCI runtime exec failed: exec failed: unable to start container process: exec: "C:/Program Files/Git/usr/bin/bash": no such file or directory
```

## 原因

Git Bash が `/bin/bash` を Windows のパス `C:/Program Files/Git/usr/bin/bash` に自動変換してしまうため。

## 対処法

**A. コマンドプロンプトまたはPowerShellから実行する（推奨）**

```
docker compose exec rails bash
```

**B. Git Bash のままパス変換を無効化する**

```bash
MSYS_NO_PATHCONV=1 docker compose exec rails /bin/bash
```

---

# railsコンテナ起動直後に落ちる問題

## エラー内容

```
tail: cannot open 'log/development.log' for reading: No such file or directory
tail: no files remaining
```

## 原因

`docker-compose.yml` の command が `tail -f log/development.log` になっているが、`log/` ディレクトリが存在しない状態で `tail` しようとしてコンテナが終了する。

## 対処法

`docker-compose.yml` の command を以下に変更する。

```yaml
command: bash -c "mkdir -p log && touch log/development.log && tail -f log/development.log"
```

---

# railsサーバー起動時の bootsnap エラー

## エラー内容

```
cannot load such file -- bootsnap/setup (LoadError)
```

## 原因

`config/boot.rb` で `require "bootsnap/setup"` しているが、Gemfile に `bootsnap` が含まれていない。

## 対処法

Gemfile に追加してから `docker compose build --no-cache` で再ビルドする。

```ruby
gem "bootsnap", require: false
```
