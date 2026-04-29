#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"
EMAIL="test2@example.com"
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
  UID=$(echo "$HEADERS" | grep -i "^uid:" | awk '{print $2}' | tr -d '\r')

  echo "access-token: $ACCESS_TOKEN"
  echo "client:       $CLIENT"
  echo "uid:          $UID"

  cat > /tmp/auth_tokens.env <<EOF
ACCESS_TOKEN=$ACCESS_TOKEN
CLIENT=$CLIENT
UID=$UID
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
    -H "uid: $UID"
  echo ""
}

# 使い方表示
usage() {
  echo "使い方: $0 [コマンド]"
  echo ""
  echo "コマンド:"
  echo "  health_check       ヘルスチェック"
  echo "  sign_up            ユーザー新規作成"
  echo "  sign_in            サインイン（トークン表示のみ）"
  echo "  sign_in_and_save   サインイン（トークンをファイルに保存）"
  echo "  request_with_token 認証済みリクエスト（要: sign_in_and_save 済み）"
  echo "  all                上記を順番にすべて実行"
  echo ""
}

case "$1" in
  health_check)       health_check ;;
  sign_up)            sign_up ;;
  sign_in)            sign_in ;;
  sign_in_and_save)   sign_in_and_save ;;
  request_with_token) request_with_token ;;
  all)
    health_check
    sign_up
    sign_in_and_save
    request_with_token
    ;;
  *) usage ;;
esac
