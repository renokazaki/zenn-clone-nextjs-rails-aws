# AWS デプロイ構築手順まとめ（Next.js × Rails）

## 構成概要

```
インターネット
    ↓
Route53（独自ドメイン）
    ↓
ACM（SSL証明書）
    ↓
ALB（Application Load Balancer）× 2
  ├── frontend ALB → ECS (Next.js) ─── パブリックサブネット
  └── backend ALB  → ECS (Nginx + Rails) ─── パブリックサブネット
                                  ↓
                             RDS (MySQL) ─── プライベートサブネット
```

---

## AWS CDK（TypeScript）とは

**AWS CDK（Cloud Development Kit）** は、TypeScriptなどのプログラミング言語でAWSリソースをコードとして定義・管理できるツールです。

- GUIでポチポチ作るのではなく、コードで「どんなインフラを作るか」を宣言する
- `cdk deploy` を実行するだけで、コードの通りにAWSリソースが自動で作成・更新される
- コードとしてGitで管理できるため、変更履歴が残る・チームで共有できる

### CDKプロジェクトの事前セットアップ

CDKを使い始める前に、以下の準備が必要です。

```bash
# AWS CDKをグローバルインストール
npm install -g aws-cdk

# CDK用のディレクトリを作成してプロジェクトを初期化
mkdir cdk && cd cdk
cdk init app --language typescript

# 必要なCDKライブラリをインストール
npm install \
  aws-cdk-lib \
  constructs \
  @aws-cdk/aws-rds-alpha
```

初期化すると `cdk/lib/cdk-stack.ts` というファイルが生成されます。
この中に後述のCDKコードを書いていきます。

### CDKの基本的な使い方

```bash
# AWSアカウントにCDKを初期設定（初回のみ）
cdk bootstrap

# 作成されるリソースを確認（実際には何も作らない）
cdk diff

# リソースを実際にAWSに反映する
cdk deploy

# 全リソースを削除する（学習完了後など）
cdk destroy
```

### CDKコード全体の置き場所について

このドキュメントでは各セクションごとにCDKコードを記載しています。
実際にはこれらを `cdk/lib/cdk-stack.ts` の `constructor` の中にまとめて記述します。

```typescript
// cdk/lib/cdk-stack.ts の基本構造
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// 各サービスのimportをここに追加していく

export class ZennCloneStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ここに各セクションのCDKコードをまとめて書く

  }
}
```

---

## 0. 前提作業

### AWSアカウント初期設定（GUIのみ）

| 設定項目 | 値 |
|---|---|
| リージョン | アジアパシフィック（東京）|

**請求アラート設定**

`AWS Billing > Cost Management > Budgets`

| 項目 | 値 |
|---|---|
| 予算の設定 | テンプレートを使用（シンプル）|
| テンプレート | ゼロ支出予算 |
| 予算名 | My Zero-Spend Budget |
| Eメールの受信者 | 通知先メールアドレス |

---

## 1. ネットワーク構築

### 1-1. VPC

**GUI手順**

`VPC > VPCを作成`

| 項目 | 値 |
|---|---|
| 作成するリソース | VPCのみ |
| 名前タグ | zenn-clone-vpc |
| IPv4 CIDR | 10.0.0.0/16 |
| IPv6 CIDR ブロック | なし |
| テナンシー | デフォルト |

**AWS CDK（TypeScript）**

```typescript
import * as ec2 from 'aws-cdk-lib/aws-ec2';

// VPCを作成
// natGateways: 0 → NAT Gatewayは有料なので今回は使わない
const vpc = new ec2.Vpc(this, 'ZennCloneVpc', {
  vpcName: 'zenn-clone-vpc',
  ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
  natGateways: 0,
  // サブネットの定義（次のセクション1-2と一緒に設定する）
  subnetConfiguration: [
    {
      cidrMask: 24,
      name: 'public',
      subnetType: ec2.SubnetType.PUBLIC,
    },
    {
      cidrMask: 24,
      name: 'private',
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    },
  ],
});
```

> CDKのVpcコンストラクトは、VPC・サブネット・インターネットゲートウェイ・ルートテーブルを一括で作成してくれます。
> 1-1〜1-4をまとめて上記の1つのコードで完結します。

---

### 1-2. サブネット

VPC作成時の `subnetConfiguration` で自動生成されるため、個別の設定は不要です（1-1のCDKコードで完結）。

GUIで個別に作成する場合の値は以下の通りです。

| サブネット名 | AZ | CIDR | 用途 |
|---|---|---|---|
| zenn-clone-public-subnet1 | ap-northeast-1a | 10.0.0.0/24 | ECS（パブリック）|
| zenn-clone-public-subnet2 | ap-northeast-1c | 10.0.1.0/24 | ECS（パブリック）|
| zenn-clone-private-subnet1 | ap-northeast-1a | 10.0.10.0/24 | RDS（プライベート）|
| zenn-clone-private-subnet2 | ap-northeast-1c | 10.0.11.0/24 | RDS（プライベート）|

---

### 1-3. インターネットゲートウェイ

1-1のCDKコードで自動作成されます。GUIで作業する場合は以下を参照。

**GUI手順**

1. `VPC > インターネットゲートウェイ > 作成`
   - 名前タグ: `zenn-clone-internet-gateway`
2. 作成後、`アクション > VPCにアタッチ` → `zenn-clone-vpc` を選択

---

### 1-4. ルートテーブル

1-1のCDKコードで自動作成されます。GUIで作業する場合は以下を参照。

**GUI手順**

1. `VPC > ルートテーブル > 作成`

   | 項目 | 値 |
   |---|---|
   | 名前 | zenn-clone-route-table |
   | VPC | zenn-clone-vpc |

2. `アクション > ルートを編集` → ルートを追加

   | 送信先 | ターゲット |
   |---|---|
   | 0.0.0.0/0 | zenn-clone-internet-gateway |

3. `アクション > サブネットの関連付けを編集` → パブリックサブネット2つを選択

---

### 1-5. セキュリティグループ

**GUI手順**

`VPC > セキュリティグループ > 作成`

#### ECS(backend)用

| 項目 | 値 |
|---|---|
| 名前 | zenn-clone-ecs-backend-security-group |
| VPC | zenn-clone-vpc |

インバウンドルール:

| タイプ | ソース |
|---|---|
| HTTP | Anywhere-IPv4 |
| HTTP | Anywhere-IPv6 |

#### RDS用

| 項目 | 値 |
|---|---|
| 名前 | zenn-clone-rds-security-group |
| VPC | zenn-clone-vpc |

インバウンドルール:

| タイプ | ソース |
|---|---|
| MYSQL/Aurora | カスタム → zenn-clone-ecs-backend-security-group |

#### ECS(frontend)用

| 項目 | 値 |
|---|---|
| 名前 | zenn-clone-ecs-frontend-security-group |
| VPC | zenn-clone-vpc |

インバウンドルール:

| タイプ | ソース |
|---|---|
| HTTP | Anywhere-IPv4 |
| HTTP | Anywhere-IPv6 |

**AWS CDK（TypeScript）**

```typescript
// ECS(backend)用セキュリティグループ
// → Railsコンテナが入るECSへのHTTPアクセスを全開放
const ecsBackendSg = new ec2.SecurityGroup(this, 'EcsBackendSg', {
  securityGroupName: 'zenn-clone-ecs-backend-security-group',
  vpc,
  allowAllOutbound: true, // アウトバウンドは全て許可（デフォルト）
});
ecsBackendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
ecsBackendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80));

// RDS用セキュリティグループ
// → ECS(backend)からのMySQL接続のみ許可
const rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
  securityGroupName: 'zenn-clone-rds-security-group',
  vpc,
  allowAllOutbound: true,
});
// ecsBackendSgからのMySQLポート(3306)のみ許可
rdsSg.addIngressRule(ecsBackendSg, ec2.Port.tcp(3306));

// ECS(frontend)用セキュリティグループ
// → Next.jsコンテナが入るECSへのHTTPアクセスを全開放
const ecsFrontendSg = new ec2.SecurityGroup(this, 'EcsFrontendSg', {
  securityGroupName: 'zenn-clone-ecs-frontend-security-group',
  vpc,
  allowAllOutbound: true,
});
ecsFrontendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
ecsFrontendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80));
```

---

## 2. ドメイン・SSL設定

### 2-1. Route53 ドメイン取得（GUIのみ）

ドメイン購入はGUIのみの作業です。CDKでは管理しません。

1. `Route53 > ドメインの登録` → 取得したいドメイン名を入力してチェック
2. トップレベルドメインを選択して「続行」
3. 個人情報入力 → 「注文を完了」
4. 認証メールのURLをクリックして認証

---

### 2-2. ACM SSL証明書

**GUI手順**

1. `AWS Certificate Manager > 証明書をリクエスト > パブリック証明書をリクエスト`
2. 完全修飾ドメイン名を入力:

   | 完全修飾ドメイン名 |
   |---|
   | your-domain.com |
   | *.your-domain.com |

3. 検証方法: `DNS` → 「リクエスト」
4. 証明書詳細画面 → 「Route53でレコードを作成」→「レコードを作成」
5. 数分待ってステータスが「発行済み」になればOK

**AWS CDK（TypeScript）**

```typescript
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';

// Route53のホストゾーンを参照
// ※ドメイン取得後にRoute53に自動でホストゾーンが作成されているのでそれを参照する
const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
  domainName: 'your-domain.com', // ← 取得した独自ドメインに置き換える
});

// SSL証明書を作成し、DNS検証で自動発行する
// DnsValidatedCertificateはRoute53に検証レコードを自動で作成してくれる
const certificate = new acm.Certificate(this, 'Certificate', {
  domainName: 'your-domain.com',
  subjectAlternativeNames: ['*.your-domain.com'], // サブドメイン全てに対応
  validation: acm.CertificateValidation.fromDns(hostedZone),
});
```

---

## 3. RDS（データベース）

### 3-1. RDS用サブネットグループ

**GUI手順**

`RDS > サブネットグループ > DBサブネットグループを作成`

| 項目 | 値 |
|---|---|
| 名前 | zenn-clone-rds-subnet-group |
| VPC | zenn-clone-vpc |
| アベイラビリティーゾーン | ap-northeast-1a, ap-northeast-1c |
| サブネット | 10.0.10.0/24, 10.0.11.0/24（プライベートサブネット2つ）|

---

### 3-2. RDS データベース作成

**GUI手順**

`RDS > データベース > データベースの作成`

| 項目 | 値 |
|---|---|
| 作成方法 | 標準作成 |
| エンジン | MySQL |
| エンジンバージョン | MySQL 8.0.32 |
| テンプレート | 無料利用枠 |
| DB インスタンス識別子 | zenn-clone-db |
| マスターユーザー名 | admin |
| マスターパスワード | 任意（必ずメモしておくこと）|
| インスタンスクラス | db.t3.micro |
| コンピューティングリソース | EC2コンピューティングリソースに接続しない |
| ネットワークタイプ | IPv4 |
| VPC | zenn-clone-vpc |
| DBサブネットグループ | zenn-clone-rds-subnet-group |
| パブリックアクセス | なし |
| VPCセキュリティグループ | zenn-clone-rds-security-group |
| データベース認証 | パスワード認証 |

**AWS CDK（TypeScript）**

```typescript
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

// DBパスワードをSecrets Managerで自動生成・安全に管理する
// （パスワードをコードに直書きせずに済む）
const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
  secretName: 'zenn-clone-db-secret',
  generateSecretString: {
    secretStringTemplate: JSON.stringify({ username: 'admin' }),
    generateStringKey: 'password',
    excludePunctuation: true, // 記号なしのパスワードにする（接続文字列で問題が起きにくい）
  },
});

// RDS MySQLインスタンスを作成
const db = new rds.DatabaseInstance(this, 'ZennCloneDb', {
  instanceIdentifier: 'zenn-clone-db',
  engine: rds.DatabaseInstanceEngine.mysql({
    version: rds.MysqlEngineVersion.VER_8_0_32,
  }),
  instanceType: ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.MICRO
  ),
  vpc,
  // プライベートサブネットに配置する
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
  securityGroups: [rdsSg],
  credentials: rds.Credentials.fromSecret(dbSecret),
  databaseName: 'myapp_production',
  // 削除保護をオフにする（学習目的なので手動で消せるようにする）
  deletionProtection: false,
  // スタック削除時にスナップショットなしで削除する
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

> DBパスワードは `dbSecret` としてAWS Secrets Managerに保存されます。
> `RDS > データベース > zenn-clone-db > 設定 > マスターユーザーのシークレット` からARNを確認し、
> `Secrets Manager > シークレットの値を取得` でエンドポイント・パスワードを確認できます。

---

## 4. アプリケーションコード修正

CDKとは別に、アプリのソースコードを本番用に修正する作業です。

### 4-1. Backend（Rails）デプロイ準備

**`nginx/Dockerfile.prod` を新規作成**

```dockerfile
FROM --platform=linux/x86_64 nginx:latest

RUN apt-get update && apt-get install -y curl vim sudo lsof
RUN rm -f /etc/nginx/conf.d/*
ADD nginx.conf /etc/nginx/myapp.conf
CMD /usr/sbin/nginx -g 'daemon off;' -c /etc/nginx/myapp.conf
EXPOSE 80
```

**`nginx/nginx.conf` を新規作成**

```nginx
user  nginx;
worker_processes  auto;
error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events { worker_connections 1024; }

http {
  upstream myapp {
    server unix:///myapp/tmp/sockets/puma.sock;
  }

  server {
    listen 80;
    server_name localhost;
    access_log /var/log/nginx/access.log;
    error_log  /var/log/nginx/error.log;
    root /myapp/public;

    proxy_connect_timeout 600;
    proxy_read_timeout    600;
    proxy_send_timeout    600;
    client_max_body_size 100m;
    keepalive_timeout 600;

    location /healthcheck {
      root   /usr/share/nginx/html;
      empty_gif;
      break;
    }

    location / { try_files $uri @myapp; }

    location @myapp {
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header Host $http_host;
      proxy_pass http://myapp;
    }
  }
}
```

**`rails/config/puma.rb` を書き換え**

```ruby
threads_count = ENV.fetch("RAILS_MAX_THREADS") { 5 }.to_i
threads threads_count, threads_count
environment ENV.fetch("RAILS_ENV") { "development" }
plugin :tmp_restart

app_root = File.expand_path("..", __dir__)
bind "unix://#{app_root}/tmp/sockets/puma.sock"
```

**`rails/Dockerfile.prod` を新規作成**

```dockerfile
FROM --platform=linux/x86_64 ruby:3.1.2

ENV LANG C.UTF-8
ENV TZ Asia/Tokyo
ENV RAILS_ENV=production

RUN mkdir /myapp
WORKDIR /myapp
COPY Gemfile /myapp/Gemfile
COPY Gemfile.lock /myapp/Gemfile.lock

RUN gem update --system
RUN bundle update --bundler
RUN bundle install

COPY . /myapp
RUN mkdir -p tmp/sockets
RUN mkdir -p tmp/pids

VOLUME /myapp/public
VOLUME /myapp/tmp

COPY entrypoint.prod.sh /usr/bin/
RUN chmod +x /usr/bin/entrypoint.prod.sh
ENTRYPOINT ["entrypoint.prod.sh"]
EXPOSE 3000
```

**`rails/entrypoint.prod.sh` を新規作成（初回デプロイ用）**

```bash
#!/bin/bash
set -e

rm -f /myapp/tmp/pids/server.pid
bundle exec rails db:create RAILS_ENV=production
bundle exec rails db:migrate RAILS_ENV=production
bundle exec rails db:seed RAILS_ENV=production
bundle exec pumactl start
```

> 2回目以降のデプロイでは `db:create` と `db:seed` をコメントアウトすること

**credentials に本番DBアクセス情報を登録**

```bash
# railsコンテナ内で実行
EDITOR="vi" bin/rails credentials:edit
```

以下を追記（RDSエンドポイントとパスワードは実際の値に置き換える）:

```yaml
production:
  database_url: mysql2://admin:<パスワード>@<RDSエンドポイント>
```

**`rails/config/database.yml` に本番環境設定を追記**

```yaml
production:
  <<: *default
  database: myapp_production
  url: <%= Rails.application.credentials.production.database_url %>
```

**`rails/config/settings/production.yml` を新規作成**

```yaml
front_domain: "https://your-domain.com"
```

---

### 4-2. Frontend（Next.js）デプロイ準備

**`next/.env.production` を新規作成**

```env
NEXT_PUBLIC_API_BASE_URL=https://backend.your-domain.com/api/v1
NEXT_PUBLIC_FRONT_BASE_URL=https://your-domain.com
```

**`next/package.json` のstartコマンドを修正（80番ポート化）**

```json
"start": "next start -p 80"
```

**`next/Dockerfile.prod` を新規作成**

```dockerfile
# --- Build Stage ---
FROM --platform=linux/x86_64 node:19.4.0 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Run Stage ---
FROM --platform=linux/x86_64 node:19.4.0-alpine
WORKDIR /app
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/.env.production ./.env.production
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

ENV NODE_ENV production
EXPOSE 80
CMD ["npm", "run", "start"]
```

---

## 5. ターミナルからAWSにアクセス（CLI設定）

### 5-1. AWS CLI インストール

公式ドキュメントに従ってインストールしてください。

```bash
# インストール確認
aws --version
# → aws-cli/2.x.x ... と表示されればOK
```

### 5-2. IAMユーザー作成（管理者権限）

**GUI手順**

`IAM > ユーザー > ユーザーの作成`

| 項目 | 値 |
|---|---|
| ユーザー名 | Administrator（任意）|
| ポリシー | AdministratorAccess（直接アタッチ）|

作成後、`セキュリティ認証情報 > アクセスキーを作成`（ユースケース: CLI）→ アクセスキーとシークレットをメモ

> IAMユーザーのアクセスキーはGUIから手動で発行するのが安全です。CDKでは管理しません。

### 5-3. AWS CLI に IAMユーザーを登録

```bash
aws configure
# AWS Access Key ID: <アクセスキー>
# AWS Secret Access Key: <シークレットアクセスキー>
# Default region name: ap-northeast-1
# Default output format: json
```

---

## 6. ECR（コンテナイメージリポジトリ）

### 6-1. ECRリポジトリ作成

**GUI手順**

`ECR > リポジトリを作成`（可視性: プライベート）

| リポジトリ名 | 用途 |
|---|---|
| zenn-clone-rails | Railsコンテナ |
| zenn-clone-nginx | Nginxコンテナ |
| zenn-clone-next | Next.jsコンテナ |

**AWS CDK（TypeScript）**

```typescript
import * as ecr from 'aws-cdk-lib/aws-ecr';

// Railsコンテナ用リポジトリ
const railsRepo = new ecr.Repository(this, 'RailsRepo', {
  repositoryName: 'zenn-clone-rails',
  // スタック削除時にリポジトリごと削除する（学習目的）
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  emptyOnDelete: true,
});

// Nginxコンテナ用リポジトリ
const nginxRepo = new ecr.Repository(this, 'NginxRepo', {
  repositoryName: 'zenn-clone-nginx',
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  emptyOnDelete: true,
});

// Next.jsコンテナ用リポジトリ
const nextRepo = new ecr.Repository(this, 'NextRepo', {
  repositoryName: 'zenn-clone-next',
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  emptyOnDelete: true,
});
```

---

### 6-2. コンテナイメージをECRにプッシュ

ECRへのイメージプッシュはCDKではなく、ターミナルのコマンドで行います。

```bash
# AWSアカウントIDを変数に入れておく（コマンドが短くなる）
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=ap-northeast-1
ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# ECRにDockerでログイン
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${ECR_BASE}

# ---- railsイメージをビルド＆プッシュ ----
docker build -t zenn-clone-rails -f ./rails/Dockerfile.prod ./rails
docker tag zenn-clone-rails:latest ${ECR_BASE}/zenn-clone-rails:latest
docker push ${ECR_BASE}/zenn-clone-rails:latest

# ---- nginxイメージをビルド＆プッシュ ----
docker build -t zenn-clone-nginx -f ./nginx/Dockerfile.prod ./nginx
docker tag zenn-clone-nginx:latest ${ECR_BASE}/zenn-clone-nginx:latest
docker push ${ECR_BASE}/zenn-clone-nginx:latest

# ---- nextイメージをビルド＆プッシュ ----
docker build -t zenn-clone-next -f ./next/Dockerfile.prod ./next
docker tag zenn-clone-next:latest ${ECR_BASE}/zenn-clone-next:latest
docker push ${ECR_BASE}/zenn-clone-next:latest
```

---

## 7. ECS（コンテナ実行環境）

### 7-1. ECSタスク実行用IAMロール作成

**GUI手順**

`IAM > ロール > ロールを作成`

| 項目 | 値 |
|---|---|
| 信頼されたエンティティタイプ | AWSのサービス |
| ユースケース | Elastic Container Service Task |
| 許可ポリシー | AmazonEC2ContainerRegistryReadOnly, AmazonECS_FullAccess, CloudWatchFullAccess |
| ロール名 | ecsTaskExecutionRole |

**AWS CDK（TypeScript）**

```typescript
import * as iam from 'aws-cdk-lib/aws-iam';

// ECSがECRからイメージを取得したり、CloudWatchにログを書き込むためのロール
const ecsTaskExecutionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
  roleName: 'ecsTaskExecutionRole',
  // ECSタスクがこのロールを引き受けられるように設定
  assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
  managedPolicies: [
    // ECRからイメージを取得する権限
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
    // ECSタスクを実行する権限
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECS_FullAccess'),
    // CloudWatchにログを書き込む権限
    iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'),
  ],
});
```

---

### 7-2. ECSクラスター作成

**GUI手順**

`ECS > クラスター > クラスターの作成`

| 項目 | 値 |
|---|---|
| クラスター名 | zenn-clone-cluster |
| インフラストラクチャ | AWS Fargate（サーバーレス）|

**AWS CDK（TypeScript）**

```typescript
import * as ecs from 'aws-cdk-lib/aws-ecs';

// ECSクラスター = サービスやタスクをまとめる入れ物
const cluster = new ecs.Cluster(this, 'ZennCloneCluster', {
  clusterName: 'zenn-clone-cluster',
  vpc,
});
```

---

### 7-3. タスク定義（backend）

**GUI手順**

`ECS > タスク定義 > 新しいタスク定義の作成`

**基本設定**

| 項目 | 値 |
|---|---|
| タスク定義名 | zenn-clone-task-definition-backend |
| 起動タイプ | AWS Fargate |
| OS/アーキテクチャ | Linux/x86_64 |
| CPU | .25vCPU |
| メモリ | .5GB |
| タスクロール | ecsTaskExecutionRole |
| タスク実行ロール | ecsTaskExecutionRole |

**コンテナ1（rails）**

| 項目 | 値 |
|---|---|
| 名前 | rails |
| イメージ | ECR `zenn-clone-rails` のURI |
| 必須コンテナ | はい |
| コンテナポート | 3000 |
| 環境変数 `RAILS_LOG_TO_STDOUT` | true |
| 環境変数 `RAILS_MASTER_KEY` | `rails/config/master.key` の中身 |
| ヘルスチェック | `CMD-SHELL, curl --unix-socket /myapp/tmp/sockets/puma.sock localhost/api/v1/health_check \|\| exit 1` |
| ログ収集 | 有効（awslogsドライバー）|

**コンテナ2（nginx）**

| 項目 | 値 |
|---|---|
| 名前 | nginx |
| イメージ | ECR `zenn-clone-nginx` のURI |
| 必須コンテナ | はい |
| コンテナポート | 80 |
| ヘルスチェック | `CMD-SHELL, curl -f http://localhost/api/v1/health_check \|\| exit 1` |
| スタートアップ依存順序 | コンテナ名: rails, 条件: Healthy |
| ログ収集 | 有効（awslogsドライバー）|

**ストレージ（ボリューム共有）**

| 項目 | 値 |
|---|---|
| コンテナ | nginx |
| ソースコンテナ | rails |

**AWS CDK（TypeScript）**

```typescript
import * as logs from 'aws-cdk-lib/aws-logs';
import * as fs from 'fs';

// RAILS_MASTER_KEYをファイルから読み込む
// （rails/config/master.key の中身）
const railsMasterKey = fs.readFileSync('../../rails/config/master.key', 'utf8').trim();

// backendタスク定義
// docker-compose.ymlに相当するもの
const backendTaskDef = new ecs.FargateTaskDefinition(this, 'BackendTaskDef', {
  family: 'zenn-clone-task-definition-backend',
  cpu: 256,    // 0.25 vCPU
  memoryLimitMiB: 512,  // 0.5 GB
  taskRole: ecsTaskExecutionRole,
  executionRole: ecsTaskExecutionRole,
  // railsとnginxのボリューム共有（sockファイルをやりとりするため）
  volumes: [{ name: 'rails-socket' }],
});

// railsコンテナの定義
const railsContainer = backendTaskDef.addContainer('rails', {
  image: ecs.ContainerImage.fromEcrRepository(railsRepo, 'latest'),
  essential: true,
  portMappings: [{ containerPort: 3000 }],
  environment: {
    RAILS_LOG_TO_STDOUT: 'true',
    RAILS_MASTER_KEY: railsMasterKey,
  },
  healthCheck: {
    command: [
      'CMD-SHELL',
      'curl --unix-socket /myapp/tmp/sockets/puma.sock localhost/api/v1/health_check || exit 1',
    ],
    interval: cdk.Duration.seconds(30),
    timeout: cdk.Duration.seconds(10),
    retries: 3,
    startPeriod: cdk.Duration.seconds(60),
  },
  // CloudWatchLogsにログを送る設定
  logging: ecs.LogDrivers.awsLogs({
    streamPrefix: 'ecs',
    logGroup: new logs.LogGroup(this, 'BackendLogGroup', {
      logGroupName: '/ecs/zenn-clone-task-definition-backend',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    }),
  }),
});

// railsコンテナのボリュームマウント設定
railsContainer.addMountPoints({
  containerPath: '/myapp/tmp',
  sourceVolume: 'rails-socket',
  readOnly: false,
});

// nginxコンテナの定義
const nginxContainer = backendTaskDef.addContainer('nginx', {
  image: ecs.ContainerImage.fromEcrRepository(nginxRepo, 'latest'),
  essential: true,
  portMappings: [{ containerPort: 80 }],
  healthCheck: {
    command: [
      'CMD-SHELL',
      'curl -f http://localhost/api/v1/health_check || exit 1',
    ],
    interval: cdk.Duration.seconds(30),
    timeout: cdk.Duration.seconds(10),
    retries: 3,
    startPeriod: cdk.Duration.seconds(90),
  },
  logging: ecs.LogDrivers.awsLogs({
    streamPrefix: 'ecs',
    logGroup: new logs.LogGroup(this, 'NginxLogGroup', {
      logGroupName: '/ecs/zenn-clone-task-definition-backend-nginx',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    }),
  }),
});

// nginxコンテナもrailsと同じボリュームをマウントする（sockファイル共有）
nginxContainer.addMountPoints({
  containerPath: '/myapp/tmp',
  sourceVolume: 'rails-socket',
  readOnly: false,
});

// nginxはrailsのヘルスチェックが正常になってから起動する
nginxContainer.addContainerDependencies({
  container: railsContainer,
  condition: ecs.ContainerDependencyCondition.HEALTHY,
});
```

---

### 7-4. タスク定義（frontend）

**AWS CDK（TypeScript）**

```typescript
// frontendタスク定義
const frontendTaskDef = new ecs.FargateTaskDefinition(this, 'FrontendTaskDef', {
  family: 'zenn-clone-task-definition-frontend',
  cpu: 256,
  memoryLimitMiB: 512,
  taskRole: ecsTaskExecutionRole,
  executionRole: ecsTaskExecutionRole,
});

// nextコンテナの定義
frontendTaskDef.addContainer('next', {
  image: ecs.ContainerImage.fromEcrRepository(nextRepo, 'latest'),
  essential: true,
  portMappings: [{ containerPort: 80 }],
  logging: ecs.LogDrivers.awsLogs({
    streamPrefix: 'ecs',
    logGroup: new logs.LogGroup(this, 'FrontendLogGroup', {
      logGroupName: '/ecs/zenn-clone-task-definition-frontend',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    }),
  }),
});
```

---

## 8. ALB（ロードバランサー）と独自ドメイン設定

### 8-1. ALB用セキュリティグループ

**GUI手順（backend用）**

`VPC > セキュリティグループ > 作成`

| 項目 | 値 |
|---|---|
| 名前 | zenn-clone-alb-backend-security-group |
| VPC | zenn-clone-vpc |

インバウンドルール: HTTP/HTTPS × Anywhere-IPv4/IPv6 の計4つ

アウトバウンドルール:

| タイプ | 送信先 |
|---|---|
| HTTP | zenn-clone-ecs-backend-security-group |

**AWS CDK（TypeScript）**

```typescript
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

// ALB(backend)用セキュリティグループ
const albBackendSg = new ec2.SecurityGroup(this, 'AlbBackendSg', {
  securityGroupName: 'zenn-clone-alb-backend-security-group',
  vpc,
  allowAllOutbound: false, // アウトバウンドは明示的に定義する
});
albBackendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
albBackendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80));
albBackendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
albBackendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(443));
// ALBからECS(backend)へのHTTPアウトバウンドを許可
albBackendSg.addEgressRule(ecsBackendSg, ec2.Port.tcp(80));

// ALB(frontend)用セキュリティグループ
const albFrontendSg = new ec2.SecurityGroup(this, 'AlbFrontendSg', {
  securityGroupName: 'zenn-clone-alb-frontend-security-group',
  vpc,
  allowAllOutbound: false,
});
albFrontendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
albFrontendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80));
albFrontendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
albFrontendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(443));
// ALBからECS(frontend)へのHTTPアウトバウンドを許可
albFrontendSg.addEgressRule(ecsFrontendSg, ec2.Port.tcp(80));
```

---

### 8-2. ALB + ECSサービス + Route53 Aレコード（backend）

初回はALBなしでECSサービスを作成して動作確認し、その後ALBを付与して再作成します。

**GUI手順（初回ECSサービス）**

`ECS > zenn-clone-cluster > サービス > 作成`

| 項目 | 値 |
|---|---|
| コンピューティングオプション | 起動タイプ: FARGATE |
| タスク定義 | zenn-clone-task-definition-backend（最新）|
| サービス名 | zenn-clone-backend-service |
| 必要なタスク数 | 1 |
| VPC | zenn-clone-vpc |
| サブネット | パブリックサブネット2つ |
| セキュリティグループ | zenn-clone-ecs-backend-security-group |
| パブリックIP | オン |

動作確認後にサービスを削除し、以下のALBあり設定で再作成します。

**ALB(backend)作成 → GUI手順**

`EC2 > ロードバランサー > 作成（Application Load Balancer）`

| 項目 | 値 |
|---|---|
| 名前 | zenn-clone-alb-backend |
| スキーム | インターネット向け |
| VPC | zenn-clone-vpc |
| マッピング | ap-northeast-1a, 1c のパブリックサブネット |
| セキュリティグループ | zenn-clone-alb-backend-security-group |
| リスナー | HTTP:80 → zenn-clone-alb-backend-tg |
| リスナー | HTTPS:443 → zenn-clone-alb-backend-tg |
| SSL/TLS証明書 | ACMで取得したドメインを選択 |

**ECSサービス再作成（ALBあり）GUI手順**

ロードバランシング設定を追加:

| 項目 | 値 |
|---|---|
| ロードバランサーの種類 | Application Load Balancer |
| ロードバランサー | zenn-clone-alb-backend |
| ロードバランス用コンテナ | nginx 80:80 |
| ターゲットグループ | zenn-clone-alb-backend-tg |

**Route53 Aレコード（backend）GUI手順**

`Route53 > ホストゾーン > レコードを作成`

| 項目 | 値 |
|---|---|
| レコード名 | backend |
| レコードタイプ | A |
| ルーティング先 | ALBエイリアス → アジアパシフィック（東京）→ zenn-clone-alb-backend |

**AWS CDK（TypeScript）**

```typescript
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';

// ターゲットグループ（ALBがリクエストを転送する先の定義）
const backendTg = new elbv2.ApplicationTargetGroup(this, 'BackendTg', {
  targetGroupName: 'zenn-clone-alb-backend-tg',
  vpc,
  protocol: elbv2.ApplicationProtocol.HTTP,
  port: 80,
  targetType: elbv2.TargetType.IP,
  healthCheck: {
    path: '/api/v1/health_check',
  },
});

// ALB(backend)本体
const albBackend = new elbv2.ApplicationLoadBalancer(this, 'AlbBackend', {
  loadBalancerName: 'zenn-clone-alb-backend',
  vpc,
  internetFacing: true, // インターネットからアクセス可能にする
  securityGroup: albBackendSg,
  vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
});

// HTTP:80 → ターゲットグループにフォワード
albBackend.addListener('BackendHttpListener', {
  port: 80,
  defaultTargetGroups: [backendTg],
});

// HTTPS:443 → ターゲットグループにフォワード（SSL証明書を使用）
albBackend.addListener('BackendHttpsListener', {
  port: 443,
  certificates: [certificate],
  defaultTargetGroups: [backendTg],
});

// ECSサービス(backend)の作成
const backendService = new ecs.FargateService(this, 'BackendService', {
  serviceName: 'zenn-clone-backend-service',
  cluster,
  taskDefinition: backendTaskDef,
  desiredCount: 1,
  securityGroups: [ecsBackendSg],
  vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
  assignPublicIp: true, // パブリックIPを割り当てる
});

// ECSサービスをターゲットグループに登録
backendTg.addTarget(backendService.loadBalancerTarget({
  containerName: 'nginx',
  containerPort: 80,
}));

// Route53にbackend用のAレコードを追加
new route53.ARecord(this, 'BackendARecord', {
  zone: hostedZone,
  recordName: 'backend', // backend.your-domain.com
  target: route53.RecordTarget.fromAlias(
    new route53targets.LoadBalancerTarget(albBackend)
  ),
});
```

---

### 8-3. ALB + ECSサービス + Route53 Aレコード（frontend）

**GUI手順（初回ECSサービス）**

| 項目 | 値 |
|---|---|
| タスク定義 | zenn-clone-task-definition-frontend（最新）|
| サービス名 | zenn-clone-frontend-service |
| 必要なタスク数 | 1 |
| VPC | zenn-clone-vpc |
| サブネット | パブリックサブネット2つ |
| セキュリティグループ | zenn-clone-ecs-frontend-security-group |
| パブリックIP | オン |

動作確認（`http://<IP>/api/health_check`）後、ALBを付与して再作成。

**HTTP→HTTPSリダイレクト設定（GUI）**

`EC2 > ロードバランサー > zenn-clone-alb-frontend > リスナーとルール > HTTP:80 > リスナーを編集`

| 項目 | 値 |
|---|---|
| アクションの種類 | URLにリダイレクト |
| プロトコル:ポート | HTTPS 443 |
| ステータスコード | 301 |

**Route53 Aレコード（frontend）GUI手順**

| 項目 | 値 |
|---|---|
| レコード名 | （空欄）|
| レコードタイプ | A |
| ルーティング先 | ALBエイリアス → アジアパシフィック（東京）→ zenn-clone-alb-frontend |

**AWS CDK（TypeScript）**

```typescript
// ターゲットグループ（frontend）
const frontendTg = new elbv2.ApplicationTargetGroup(this, 'FrontendTg', {
  targetGroupName: 'zenn-clone-alb-frontend-tg',
  vpc,
  protocol: elbv2.ApplicationProtocol.HTTP,
  port: 80,
  targetType: elbv2.TargetType.IP,
  healthCheck: {
    path: '/api/health_check',
  },
});

// ALB(frontend)本体
const albFrontend = new elbv2.ApplicationLoadBalancer(this, 'AlbFrontend', {
  loadBalancerName: 'zenn-clone-alb-frontend',
  vpc,
  internetFacing: true,
  securityGroup: albFrontendSg,
  vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
});

// HTTP:80 → HTTPS:443 にリダイレクト
albFrontend.addListener('FrontendHttpListener', {
  port: 80,
  defaultAction: elbv2.ListenerAction.redirect({
    protocol: 'HTTPS',
    port: '443',
    statusCode: 'HTTP_301',
  }),
});

// HTTPS:443 → ターゲットグループにフォワード
albFrontend.addListener('FrontendHttpsListener', {
  port: 443,
  certificates: [certificate],
  defaultTargetGroups: [frontendTg],
});

// ECSサービス(frontend)の作成
const frontendService = new ecs.FargateService(this, 'FrontendService', {
  serviceName: 'zenn-clone-frontend-service',
  cluster,
  taskDefinition: frontendTaskDef,
  desiredCount: 1,
  securityGroups: [ecsFrontendSg],
  vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
  assignPublicIp: true,
});

// ECSサービスをターゲットグループに登録
frontendTg.addTarget(frontendService.loadBalancerTarget({
  containerName: 'next',
  containerPort: 80,
}));

// Route53にfrontend用のAレコードを追加
new route53.ARecord(this, 'FrontendARecord', {
  zone: hostedZone,
  recordName: '', // your-domain.com（空欄 = ルートドメイン）
  target: route53.RecordTarget.fromAlias(
    new route53targets.LoadBalancerTarget(albFrontend)
  ),
});
```

---

## 9. メール送信設定（Gmail SMTP）

### 9-1. Googleアカウントでアプリパスワードを発行

1. Googleアカウント > セキュリティ > 2段階認証を有効化
2. `2段階認証プロセス` ページ最下部の「アプリパスワード」に入る
3. アプリ名を任意で入力 → 16文字のパスワードをメモ

### 9-2. credentials にGmailアカウント情報を登録

```bash
EDITOR="vi" bin/rails credentials:edit
```

```yaml
production:
  database_url: mysql2://...（既存）
  gmail:
    user_name: your-email@gmail.com
    password: xxxxxxxxxxxxxxxx  # アプリパスワード
```

### 9-3. `rails/config/environments/production.rb` に追記

```ruby
config.action_mailer.default_options = { from: "no-reply@your-domain.com" }
config.action_mailer.default_url_options = { host: "https://your-domain.com" }
config.action_mailer.delivery_method = :smtp
config.action_mailer.smtp_settings = {
  address: "smtp.gmail.com",
  port: 587,
  domain: "gmail.com",
  user_name: Rails.application.credentials.production.gmail.user_name,
  password: Rails.application.credentials.production.gmail.password,
  authentication: "plain",
  enable_starttls_auto: true,
}
```

### 9-4. RailsイメージをECRに再プッシュ → タスク再起動

```bash
# --no-cache: キャッシュをクリアしてコード変更を確実に反映
docker build -t zenn-clone-rails -f ./rails/Dockerfile.prod ./rails --no-cache
docker tag zenn-clone-rails:latest ${ECR_BASE}/zenn-clone-rails:latest
docker push ${ECR_BASE}/zenn-clone-rails:latest
```

その後、`ECS > zenn-clone-cluster > タスク` から稼働中タスクを手動停止 → サービスが自動で新タスクを起動する。

---

## 10. GitHub Actions CD設定

### 10-1. GitHub Actions用IAMユーザー作成

**GUI手順**

`IAM > ユーザー > ユーザーの作成`

| 項目 | 値 |
|---|---|
| ユーザー名 | GitHubActionsUser（任意）|
| ポリシー | AmazonEC2ContainerRegistryPowerUser, AmazonECS_FullAccess |

作成後、`セキュリティ認証情報 > アクセスキーを作成`（ユースケース: その他）→ アクセスキーとシークレットをメモ

**AWS CDK（TypeScript）**

```typescript
// GitHub Actions用IAMユーザー
const githubActionsUser = new iam.User(this, 'GitHubActionsUser', {
  userName: 'GitHubActionsUser',
  managedPolicies: [
    // ECRへのイメージプッシュ権限
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'),
    // ECSでのコンテナ再起動権限
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECS_FullAccess'),
  ],
});

// アクセスキーの生成（CDKでは作成のみ。値はSecrets Managerに格納される）
// ※実際のキー値は AWS Secrets Manager から確認すること
const accessKey = new iam.CfnAccessKey(this, 'GitHubActionsAccessKey', {
  userName: githubActionsUser.userName,
});

// スタックの出力にアクセスキーIDを表示する（シークレットはSecrets Managerで確認）
new cdk.CfnOutput(this, 'AccessKeyId', {
  value: accessKey.ref,
  description: 'GitHub Actions用のAWS_ACCESS_KEY_ID',
});
```

> シークレットアクセスキーの値は `AWS Secrets Manager` または `cdk deploy` 後の出力で確認してください。

### 10-2. GitHubリポジトリにSecretsを登録

`GitHub リポジトリ > Settings > Secrets and Variables > Actions > New repository secret`

| Name | 値 |
|---|---|
| AWS_ACCESS_KEY_ID | IAMユーザーのアクセスキー |
| AWS_SECRET_ACCESS_KEY | IAMユーザーのシークレットアクセスキー |

### 10-3. タスク定義のJSONファイルを取得

`ECS > タスク定義 > zenn-clone-task-definition-backend > 最新リビジョン > JSONを使用した新しいリビジョンの作成`

→ 表示されたJSONを `rails/task-definition.json` に保存

同様に `zenn-clone-task-definition-frontend` のJSONを `next/task-definition.json` に保存

### 10-4. `.github/workflows/cd.yml` を作成

```yaml
name: Continuous Delivery

on:
  push:
    branches: ["main"]

env:
  AWS_REGION: ap-northeast-1
  ECS_CLUSTER: zenn-clone-cluster
  ECS_SERVICE_BACKEND: zenn-clone-backend-service
  ECS_SERVICE_FRONTEND: zenn-clone-frontend-service
  ECS_TASK_DEFINITION_BACKEND: ./rails/task-definition.json
  ECS_TASK_DEFINITION_FRONTEND: ./next/task-definition.json
  ECR_REPOSITORY_RAILS: zenn-clone-rails
  ECR_REPOSITORY_NEXT: zenn-clone-next
  CONTAINER_NAME_RAILS: rails
  CONTAINER_NAME_NEXT: next

permissions:
  contents: read

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  deploy-rails:
    needs: [ci]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      - id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      - id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_RAILS:$IMAGE_TAG -f ./rails/Dockerfile.prod ./rails
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_RAILS:$IMAGE_TAG
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY_RAILS:$IMAGE_TAG" >> $GITHUB_OUTPUT
      - id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: ${{ env.ECS_TASK_DEFINITION_BACKEND }}
          container-name: ${{ env.CONTAINER_NAME_RAILS }}
          image: ${{ steps.build-image.outputs.image }}
      - uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE_BACKEND }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true

  deploy-next:
    needs: [ci]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      - id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      - id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_NEXT:$IMAGE_TAG -f ./next/Dockerfile.prod ./next
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_NEXT:$IMAGE_TAG
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY_NEXT:$IMAGE_TAG" >> $GITHUB_OUTPUT
      - id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: ${{ env.ECS_TASK_DEFINITION_FRONTEND }}
          container-name: ${{ env.CONTAINER_NAME_NEXT }}
          image: ${{ steps.build-image.outputs.image }}
      - uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE_FRONTEND }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
```

### 10-5. `.github/workflows/ci.yml` を修正

```yaml
on:
  push:
    branches-ignore:
      - "main"
  workflow_call:
```

---

## 手順まとめ（フロー）

```
0. AWSアカウント初期設定・請求アラート（GUI）
        ↓
1. ネットワーク構築
   CDK: VPC・サブネット・IGW・ルートテーブル・セキュリティグループ
        ↓
2. ドメイン・SSL
   GUI: Route53でドメイン取得
   CDK: ACM証明書の発行・DNS検証
        ↓
3. RDS（MySQL）
   CDK: サブネットグループ・DB作成（パスワードはSecrets Managerで自動管理）
        ↓
4. アプリコード修正（CDKとは別作業）
   Backend: nginx設定・Dockerfile.prod・entrypoint・credentials・database.yml
   Frontend: .env.production・Dockerfile.prod・package.json
        ↓
5. AWS CLI設定（GUI + ターミナル）
   IAMユーザー作成（GUI） → aws configure（ターミナル）
        ↓
6. ECR
   CDK: リポジトリ作成
   ターミナル: イメージビルド＆プッシュ
        ↓
7. ECS（初回デプロイ・動作確認）
   CDK: IAMロール・クラスター・タスク定義・サービス作成
   動作確認: パブリックIPでヘルスチェックAPIにアクセス
        ↓
8. ALB + 独自ドメイン
   CDK: セキュリティグループ・TG・ALB・ECSサービス再作成・Route53 Aレコード
   動作確認: https://your-domain.com にアクセス
        ↓
9. メール送信設定（Gmail SMTP）
   アプリパスワード発行 → credentials登録 → production.rb修正 → 再デプロイ
        ↓
10. GitHub Actions CD
    IAMユーザー作成 → GitHub Secrets登録 → task-definition.json取得 → cd.yml作成 → ci.yml修正
```

---

## AWS CDK まとめ：管理可否一覧

| AWSリソース | CDK管理 | 備考 |
|---|---|---|
| VPC / サブネット / IGW / ルートテーブル | ◎ | 1-1のコードで全て一括作成 |
| セキュリティグループ | ◎ | |
| RDS | ◎ | パスワードはSecrets Managerで自動管理 |
| ECRリポジトリ | ◎ | イメージプッシュはCLIコマンドで実施 |
| ECSクラスター / タスク定義 / サービス | ◎ | CD更新はGitHub Actionsで行う |
| ALB / ターゲットグループ | ◎ | |
| Route53 Aレコード | ◎ | |
| ACM証明書 | ◎ | |
| Route53 ドメイン取得 | × | GUIで購入（CDKでは管理しない）|
| IAMユーザーのアクセスキー発行 | △ | CDKで生成できるが、値の管理はSecrets Manager |
| credentials（Rails master.key）| × | GitにコミットせずECSの環境変数で渡す |
| GitHub Secrets | × | GitHubのUIから手動登録 |

---

## 付録：IaCによる「使う時だけ起動・終わったら削除」戦略

### IaCのコスト削減メリットは本当か？

**結論：本当です。ただし条件があります。**

AWSは基本的に「稼働した時間」に対して課金されます。
CDK で `cdk deploy` / `cdk destroy` を使えば、必要な時だけインフラを丸ごと起動・削除できるため、
開発・学習用途では大幅なコスト削減が可能です。

#### リソース別のコスト特性

| リソース | 課金の仕組み | 削除の速さ | 削除によるコスト削減効果 |
|---|---|---|---|
| ECS Fargate | タスク稼働時間 × CPU/メモリ量 | ◎ 数分 | **大きい**（主要コストの一つ）|
| ALB | 時間課金 + 通信量課金 | ◎ 数分 | **大きい**（時間課金あり）|
| RDS | インスタンス稼働時間 | △ 15〜20分かかる | **大きい**（最も高い）|
| VPC / セキュリティグループ | ほぼ無料 | ◎ 数秒 | 小さい（消さなくてもよい）|
| ECR | 保存したイメージのストレージ容量 | ◎ 数秒 | 小さい（数十円/月程度）|
| ACM 証明書 | **完全無料** | ◎ 数秒 | 0円（削除しなくてもよい）|
| Route53 ホストゾーン | $0.50 / 月 固定 | ◎ 数秒 | 小さい |
| Route53 ドメイン | 年間 $13 固定（年払い） | × 返却不可 | **削除しても止まらない** |

#### 費用のイメージ比較

| 運用パターン | 月額目安 |
|---|---|
| 常時稼働（ECS×2 + ALB×2 + RDS） | 約 $30〜50 / 月（約4,500〜7,500円）|
| 週1回・数時間だけ起動 | 約 $1〜3 / 月（約150〜450円）|
| 月1回・数時間だけ起動 | 数十円 / 月 |

---

### 「開発時のみ構成を起動する」ための CDK スタック分割

コスト削減を実現するために、**「常時残すリソース」と「使う時だけ起動するリソース」をスタックで分割**するのがおすすめです。

```
cdk/
  lib/
    permanent-stack.ts    ← 常時残す（VPC・ECR・ACM・Route53 など）
    app-stack.ts          ← 使う時だけ起動（RDS・ECS・ALB など）
  bin/
    cdk.ts                ← 両スタックをまとめて管理
```

#### `cdk/bin/cdk.ts`

```typescript
import * as cdk from 'aws-cdk-lib';
import { PermanentStack } from '../lib/permanent-stack';
import { AppStack } from '../lib/app-stack';

const app = new cdk.App();

// 常時残すスタック（ドメイン・SSL・ECR など）
const permanent = new PermanentStack(app, 'ZennClonePermanentStack', {
  env: { region: 'ap-northeast-1' },
});

// 使う時だけ起動するスタック（RDS・ECS・ALB など）
// permanent スタックの出力値（VPCなど）を参照する
new AppStack(app, 'ZennCloneAppStack', {
  vpc: permanent.vpc,
  certificate: permanent.certificate,
  hostedZone: permanent.hostedZone,
  railsRepo: permanent.railsRepo,
  nginxRepo: permanent.nginxRepo,
  nextRepo: permanent.nextRepo,
  env: { region: 'ap-northeast-1' },
});
```

#### `cdk/lib/permanent-stack.ts`（常時残すリソース）

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';

export class PermanentStack extends cdk.Stack {
  // 他のスタックから参照できるようにpublicで公開する
  public readonly vpc: ec2.Vpc;
  public readonly hostedZone: route53.IHostedZone;
  public readonly certificate: acm.Certificate;
  public readonly railsRepo: ecr.Repository;
  public readonly nginxRepo: ecr.Repository;
  public readonly nextRepo: ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC（ほぼ無料なので常時残す）
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: 'zenn-clone-vpc',
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGateways: 0,
      subnetConfiguration: [
        { cidrMask: 24, name: 'public',  subnetType: ec2.SubnetType.PUBLIC },
        { cidrMask: 24, name: 'private', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // Route53 ホストゾーンを参照（ドメインは事前にGUIで購入済み）
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'your-domain.com', // ← 自分のドメインに置き換える
    });

    // ACM 証明書（完全無料なので常時残す）
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: 'your-domain.com',
      subjectAlternativeNames: ['*.your-domain.com'],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    // ECR リポジトリ（イメージのストレージ課金は微小なので常時残す）
    this.railsRepo = new ecr.Repository(this, 'RailsRepo', {
      repositoryName: 'zenn-clone-rails',
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 削除されないよう保護
    });
    this.nginxRepo = new ecr.Repository(this, 'NginxRepo', {
      repositoryName: 'zenn-clone-nginx',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.nextRepo = new ecr.Repository(this, 'NextRepo', {
      repositoryName: 'zenn-clone-next',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
```

#### `cdk/lib/app-stack.ts`（使う時だけ起動するリソース）

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as fs from 'fs';

// PermanentStackから受け取る値の型定義
interface AppStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  certificate: acm.Certificate;
  hostedZone: route53.IHostedZone;
  railsRepo: ecr.Repository;
  nginxRepo: ecr.Repository;
  nextRepo: ecr.Repository;
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { vpc, certificate, hostedZone, railsRepo, nginxRepo, nextRepo } = props;

    // -----------------------------------------------
    // セキュリティグループ
    // -----------------------------------------------
    const ecsBackendSg = new ec2.SecurityGroup(this, 'EcsBackendSg', {
      securityGroupName: 'zenn-clone-ecs-backend-security-group',
      vpc,
      allowAllOutbound: true,
    });
    ecsBackendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    ecsBackendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80));

    const rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      securityGroupName: 'zenn-clone-rds-security-group',
      vpc,
      allowAllOutbound: true,
    });
    rdsSg.addIngressRule(ecsBackendSg, ec2.Port.tcp(3306));

    const ecsFrontendSg = new ec2.SecurityGroup(this, 'EcsFrontendSg', {
      securityGroupName: 'zenn-clone-ecs-frontend-security-group',
      vpc,
      allowAllOutbound: true,
    });
    ecsFrontendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    ecsFrontendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80));

    const albBackendSg = new ec2.SecurityGroup(this, 'AlbBackendSg', {
      securityGroupName: 'zenn-clone-alb-backend-security-group',
      vpc,
      allowAllOutbound: false,
    });
    albBackendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    albBackendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80));
    albBackendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
    albBackendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(443));
    albBackendSg.addEgressRule(ecsBackendSg, ec2.Port.tcp(80));

    const albFrontendSg = new ec2.SecurityGroup(this, 'AlbFrontendSg', {
      securityGroupName: 'zenn-clone-alb-frontend-security-group',
      vpc,
      allowAllOutbound: false,
    });
    albFrontendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    albFrontendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80));
    albFrontendSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
    albFrontendSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(443));
    albFrontendSg.addEgressRule(ecsFrontendSg, ec2.Port.tcp(80));

    // -----------------------------------------------
    // RDS（最もコストが高い）
    // -----------------------------------------------
    const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: 'zenn-clone-db-secret',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    const db = new rds.DatabaseInstance(this, 'ZennCloneDb', {
      instanceIdentifier: 'zenn-clone-db',
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_32,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSg],
      credentials: rds.Credentials.fromSecret(dbSecret),
      databaseName: 'myapp_production',
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // cdk destroy で削除される
    });

    // -----------------------------------------------
    // ECS クラスター・IAMロール
    // -----------------------------------------------
    const ecsTaskExecutionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
      roleName: 'ecsTaskExecutionRole',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECS_FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'),
      ],
    });

    const cluster = new ecs.Cluster(this, 'ZennCloneCluster', {
      clusterName: 'zenn-clone-cluster',
      vpc,
    });

    // -----------------------------------------------
    // タスク定義（backend: Rails + Nginx）
    // -----------------------------------------------
    const railsMasterKey = fs.readFileSync('../../rails/config/master.key', 'utf8').trim();

    const backendTaskDef = new ecs.FargateTaskDefinition(this, 'BackendTaskDef', {
      family: 'zenn-clone-task-definition-backend',
      cpu: 256,
      memoryLimitMiB: 512,
      taskRole: ecsTaskExecutionRole,
      executionRole: ecsTaskExecutionRole,
      volumes: [{ name: 'rails-socket' }],
    });

    const railsContainer = backendTaskDef.addContainer('rails', {
      image: ecs.ContainerImage.fromEcrRepository(railsRepo, 'latest'),
      essential: true,
      portMappings: [{ containerPort: 3000 }],
      environment: {
        RAILS_LOG_TO_STDOUT: 'true',
        RAILS_MASTER_KEY: railsMasterKey,
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl --unix-socket /myapp/tmp/sockets/puma.sock localhost/api/v1/health_check || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs',
        logGroup: new logs.LogGroup(this, 'BackendLogGroup', {
          logGroupName: '/ecs/zenn-clone-task-definition-backend',
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }),
    });
    railsContainer.addMountPoints({ containerPath: '/myapp/tmp', sourceVolume: 'rails-socket', readOnly: false });

    const nginxContainer = backendTaskDef.addContainer('nginx', {
      image: ecs.ContainerImage.fromEcrRepository(nginxRepo, 'latest'),
      essential: true,
      portMappings: [{ containerPort: 80 }],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost/api/v1/health_check || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 3,
        startPeriod: cdk.Duration.seconds(90),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs',
        logGroup: new logs.LogGroup(this, 'NginxLogGroup', {
          logGroupName: '/ecs/zenn-clone-task-definition-backend-nginx',
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }),
    });
    nginxContainer.addMountPoints({ containerPath: '/myapp/tmp', sourceVolume: 'rails-socket', readOnly: false });
    nginxContainer.addContainerDependencies({ container: railsContainer, condition: ecs.ContainerDependencyCondition.HEALTHY });

    // -----------------------------------------------
    // タスク定義（frontend: Next.js）
    // -----------------------------------------------
    const frontendTaskDef = new ecs.FargateTaskDefinition(this, 'FrontendTaskDef', {
      family: 'zenn-clone-task-definition-frontend',
      cpu: 256,
      memoryLimitMiB: 512,
      taskRole: ecsTaskExecutionRole,
      executionRole: ecsTaskExecutionRole,
    });
    frontendTaskDef.addContainer('next', {
      image: ecs.ContainerImage.fromEcrRepository(nextRepo, 'latest'),
      essential: true,
      portMappings: [{ containerPort: 80 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs',
        logGroup: new logs.LogGroup(this, 'FrontendLogGroup', {
          logGroupName: '/ecs/zenn-clone-task-definition-frontend',
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      }),
    });

    // -----------------------------------------------
    // ALB（backend）+ ECSサービス + Route53
    // -----------------------------------------------
    const backendTg = new elbv2.ApplicationTargetGroup(this, 'BackendTg', {
      targetGroupName: 'zenn-clone-alb-backend-tg',
      vpc,
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 80,
      targetType: elbv2.TargetType.IP,
      healthCheck: { path: '/api/v1/health_check' },
    });

    const albBackend = new elbv2.ApplicationLoadBalancer(this, 'AlbBackend', {
      loadBalancerName: 'zenn-clone-alb-backend',
      vpc,
      internetFacing: true,
      securityGroup: albBackendSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });
    albBackend.addListener('BackendHttpListener', { port: 80, defaultTargetGroups: [backendTg] });
    albBackend.addListener('BackendHttpsListener', { port: 443, certificates: [certificate], defaultTargetGroups: [backendTg] });

    const backendService = new ecs.FargateService(this, 'BackendService', {
      serviceName: 'zenn-clone-backend-service',
      cluster,
      taskDefinition: backendTaskDef,
      desiredCount: 1,
      securityGroups: [ecsBackendSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      assignPublicIp: true,
    });
    backendTg.addTarget(backendService.loadBalancerTarget({ containerName: 'nginx', containerPort: 80 }));

    new route53.ARecord(this, 'BackendARecord', {
      zone: hostedZone,
      recordName: 'backend',
      target: route53.RecordTarget.fromAlias(new route53targets.LoadBalancerTarget(albBackend)),
    });

    // -----------------------------------------------
    // ALB（frontend）+ ECSサービス + Route53
    // -----------------------------------------------
    const frontendTg = new elbv2.ApplicationTargetGroup(this, 'FrontendTg', {
      targetGroupName: 'zenn-clone-alb-frontend-tg',
      vpc,
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 80,
      targetType: elbv2.TargetType.IP,
      healthCheck: { path: '/api/health_check' },
    });

    const albFrontend = new elbv2.ApplicationLoadBalancer(this, 'AlbFrontend', {
      loadBalancerName: 'zenn-clone-alb-frontend',
      vpc,
      internetFacing: true,
      securityGroup: albFrontendSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });
    albFrontend.addListener('FrontendHttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({ protocol: 'HTTPS', port: '443', statusCode: 'HTTP_301' }),
    });
    albFrontend.addListener('FrontendHttpsListener', { port: 443, certificates: [certificate], defaultTargetGroups: [frontendTg] });

    const frontendService = new ecs.FargateService(this, 'FrontendService', {
      serviceName: 'zenn-clone-frontend-service',
      cluster,
      taskDefinition: frontendTaskDef,
      desiredCount: 1,
      securityGroups: [ecsFrontendSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      assignPublicIp: true,
    });
    frontendTg.addTarget(frontendService.loadBalancerTarget({ containerName: 'next', containerPort: 80 }));

    new route53.ARecord(this, 'FrontendARecord', {
      zone: hostedZone,
      recordName: '',
      target: route53.RecordTarget.fromAlias(new route53targets.LoadBalancerTarget(albFrontend)),
    });
  }
}
```

---

### 実際の使い方：起動→作業→削除のサイクル

#### 環境を起動する（開発・デモ・確認をするとき）

```bash
cd cdk

# 常時残すリソースが未作成の場合は初回のみ実行
cdk deploy ZennClonePermanentStack

# 課金対象のリソース（RDS・ECS・ALB）を起動
cdk deploy ZennCloneAppStack
# → 完了まで約10〜20分（RDSの起動が一番時間がかかる）
```

#### 環境を削除する（作業が終わったとき）

```bash
cd cdk

# 課金対象のリソース（RDS・ECS・ALB）をまとめて削除
cdk destroy ZennCloneAppStack
# → 完了まで約10〜15分
# → この時点で大部分の課金が止まる
```

> `ZennClonePermanentStack`（VPC・ECR・ACM・Route53）は削除しなくてよいです。
> これらはほぼ無料か月$0.50以下なので、常時残しておいた方が次回の起動が速くなります。

#### 完全にクリーンアップするとき（学習終了後など）

```bash
# AppStack を先に削除（依存関係があるため順番が重要）
cdk destroy ZennCloneAppStack

# PermanentStack を削除
cdk destroy ZennClonePermanentStack

# ※ Route53 ドメインは AWS から返却できないため削除しても年額は発生し続ける
```

---

### 注意点：RDSを毎回削除すると初回デプロイ処理が毎回走る

`cdk deploy ZennCloneAppStack` でRDSを再作成すると、DBが空の状態から始まります。
`entrypoint.prod.sh` の `db:create` と `db:seed` が毎回必要になるため、
起動のたびにコメントアウトを手動で切り替えるのは手間です。

#### 対策：entrypoint.prod.sh を冪等（べきとう）な書き方にする

**冪等（べきとう）** とは「何度実行しても同じ結果になる」という意味です。
以下のように書き換えると、`db:create` も `db:seed` も「すでに存在していればスキップ」する動作になるため、
毎回削除・再作成しても手動でコメントアウトを切り替える必要がなくなります。

```bash
#!/bin/bash
set -e

echo "Start entrypoint.prod.sh"

rm -f /myapp/tmp/pids/server.pid

echo "bundle exec rails db:create RAILS_ENV=production"
# db:create は既に存在する場合はスキップされるため、毎回実行しても安全
bundle exec rails db:create RAILS_ENV=production

echo "bundle exec rails db:migrate RAILS_ENV=production"
# db:migrate は未実行のマイグレーションのみ実行するため、毎回実行しても安全
bundle exec rails db:migrate RAILS_ENV=production

echo "bundle exec rails db:seed RAILS_ENV=production"
# db:seed はデータが重複しないよう Rails の find_or_create_by を使って実装しておくこと
# → seeds.rb を冪等に書いておけば毎回実行しても安全
bundle exec rails db:seed RAILS_ENV=production

echo "exec pumactl start"
bundle exec pumactl start
```

`db:seed` を冪等にするには `rails/db/seeds.rb` で `find_or_create_by` を使います。

```ruby
# rails/db/seeds.rb の書き方例
# create ではなく find_or_create_by を使うことで、
# 既存レコードがある場合は作成をスキップする
User.find_or_create_by(email: 'test@example.com') do |u|
  u.name = 'テストユーザー'
  u.password = 'password'
end
```

---

### 推奨の運用パターン

| ユースケース | 推奨戦略 | 月額目安 |
|---|---|---|
| ポートフォリオを常時公開したい | AppStackを常時起動 | $30〜50 / 月 |
| 開発・学習中（毎週数時間だけ使う）| 作業時だけ AppStack を起動・削除 | $1〜3 / 月 |
| 面接前など一時的に公開したい | デモ期間だけ AppStack を起動 | 数日分の課金のみ |
| 完全にやめる | 両スタックを削除 | ドメイン代（年$13）のみ残る |

---

### 「使う時だけ起動」の全体フロー図

```
【初回セットアップ】
  cdk deploy ZennClonePermanentStack   # VPC・ECR・ACM を作成（1回だけ）
  ↓
  docker push（Rails・Nginx・Next のイメージをECRにプッシュ）
  ↓
  cdk deploy ZennCloneAppStack         # RDS・ECS・ALB を起動
  ↓
  動作確認・ポートフォリオ公開


【2回目以降の作業サイクル】

  ┌─────────────────────────────────┐
  │  cdk deploy ZennCloneAppStack   │  ← 作業開始（約15〜20分）
  │    ↓                            │
  │  コード変更・動作確認            │
  │    ↓                            │
  │  （必要なら docker push して    │
  │   ECSタスク再起動）              │
  │    ↓                            │
  │  cdk destroy ZennCloneAppStack  │  ← 作業終了（約10〜15分）
  └─────────────────────────────────┘


【完全クリーンアップ（学習終了後）】
  cdk destroy ZennCloneAppStack
  ↓
  cdk destroy ZennClonePermanentStack
  ↓
  ※ Route53 ドメインのみ年額が残る（AWSでは返却不可）
```
