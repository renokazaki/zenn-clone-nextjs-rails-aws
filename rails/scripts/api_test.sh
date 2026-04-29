#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"
EMAIL="test3@example.com"
PASSWORD="password"

# ヘルスチェック
health_check() {
  echo "=== Health Check ==="
  curl -s -o /dev/null -w "Status: %{http_code}\n" \
    -X GET "$BASE_URL/health_check"
  echo ""
}

# ユーザー新規作成
sign_up() {
  echo "=== Sign Up ==="
  curl -s -w "\nStatus: %{http_code}\n" \
    -X POST "$BASE_URL/auth" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"confirm_success_url\": \"http://localhost:8000\"}"
  echo ""
}

# サインイン（レスポンスヘッダーからトークンを表示）
sign_in() {
  echo "=== Sign In ==="
  curl -s -D - -o /dev/null \
    -X POST "$BASE_URL/auth/sign_in" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" \
    | grep -E "^(access-token|client|uid|HTTP)"
  echo ""
}

# サインイン（トークンをファイルに保存）
sign_in_and_save() {
  echo "=== Sign In & Save Tokens ==="
  HEADERS=$(curl -s -D - -o /dev/null \
    -X POST "$BASE_URL/auth/sign_in" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

  ACCESS_TOKEN=$(echo "$HEADERS" | grep -i "^access-token:" | awk '{print $2}' | tr -d '\r')
  CLIENT=$(echo "$HEADERS" | grep -i "^client:" | awk '{print $2}' | tr -d '\r')
  AUTH_UID=$(echo "$HEADERS" | grep -i "^uid:" | awk '{print $2}' | tr -d '\r')

  echo "access-token: $ACCESS_TOKEN"
  echo "client:       $CLIENT"
  echo "uid:          $AUTH_UID"

  cat > /tmp/auth_tokens.env <<EOF
ACCESS_TOKEN=$ACCESS_TOKEN
CLIENT=$CLIENT
AUTH_UID=$AUTH_UID
EOF
  echo "トークンを /tmp/auth_tokens.env に保存しました"
  echo ""
}

# 認証が必要なAPIを叩く例（トークンファイルを読み込んで使用）
request_with_token() {
  echo "=== Authenticated Request (例: health_check) ==="
  if [ ! -f /tmp/auth_tokens.env ]; then
    echo "先に sign_in_and_save を実行してください"
    return 1
  fi
  source /tmp/auth_tokens.env
  curl -s -w "\nStatus: %{http_code}\n" \
    -X GET "$BASE_URL/health_check" \
    -H "access-token: $ACCESS_TOKEN" \
    -H "client: $CLIENT" \
    -H "uid: $AUTH_UID"
  echo ""
}

# サインインユーザー取得
get_current_user() {
  echo "=== Get Current User ==="
  if [ ! -f /tmp/auth_tokens.env ]; then
    echo "先に sign_in_and_save を実行してください"
    return 1
  fi
  source /tmp/auth_tokens.env
  curl -s -w "\nStatus: %{http_code}\n" \
    -X GET "$BASE_URL/current/user" \
    -H "access-token: $ACCESS_TOKEN" \
    -H "client: $CLIENT" \
    -H "uid: $AUTH_UID"
  echo ""
}

# 記事一覧取得（ページ指定可）
get_articles() {
  PAGE=${2:-1}
  echo "=== Get Articles (page=$PAGE) ==="
  curl -s -w "\nStatus: %{http_code}\n" \
    -X GET "$BASE_URL/articles?page=$PAGE"
  echo ""
}

# 記事詳細取得
get_article() {
  ARTICLE_ID=$2
  if [ -z "$ARTICLE_ID" ]; then
    echo "使い方: $0 get_article <id>"
    return 1
  fi
  echo "=== Get Article (id=$ARTICLE_ID) ==="
  curl -s -w "\nStatus: %{http_code}\n" \
    -X GET "$BASE_URL/articles/$ARTICLE_ID"
  echo ""
}

# 使い方表示
usage() {
  echo "使い方: $0 [コマンド]"
  echo ""
  echo "コマンド:"
  echo "  health_check          ヘルスチェック"
  echo "  sign_up               ユーザー新規作成"
  echo "  sign_in               サインイン（トークン表示のみ）"
  echo "  sign_in_and_save      サインイン（トークンをファイルに保存）"
  echo "  request_with_token    認証済みリクエスト（要: sign_in_and_save 済み）"
  echo "  get_current_user      サインインユーザー取得（要: sign_in_and_save 済み）"
  echo "  get_articles [page]   記事一覧取得（ページ番号省略時は1ページ目）"
  echo "  get_article <id>      記事詳細取得"
  echo "  all                   上記を順番にすべて実行"
  echo ""
}

case "$1" in
  health_check)       health_check ;;
  sign_up)            sign_up ;;
  sign_in)            sign_in ;;
  sign_in_and_save)   sign_in_and_save ;;
  request_with_token) request_with_token ;;
  get_current_user)   get_current_user ;;
  get_articles)       get_articles "$@" ;;
  get_article)        get_article "$@" ;;
  all)
    health_check
    sign_up
    sign_in_and_save
    request_with_token
    get_current_user
    get_articles
    ;;
  *) usage ;;
esac
