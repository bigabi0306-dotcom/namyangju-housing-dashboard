#!/usr/bin/env bash
set -euo pipefail
[ -f "${1:-}" ] || { echo "사용법: $0 백업파일.sql.gz"; exit 1; }
read -r -p "현재 DB를 덮어씁니다. 계속하려면 YES 입력: " a; [ "$a" = YES ] || exit 1
psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
gunzip -c "$1" | psql "$DATABASE_URL"; echo "복구 완료"
