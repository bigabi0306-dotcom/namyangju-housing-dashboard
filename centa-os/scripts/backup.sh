#!/usr/bin/env bash
# 사용: DATABASE_URL=... ./scripts/backup.sh   /  복구: ./scripts/restore.sh backups/파일.sql.gz
set -euo pipefail
mkdir -p backups; f="backups/centa_$(date +%Y%m%d_%H%M%S).sql.gz"
pg_dump "$DATABASE_URL" | gzip > "$f"; echo "백업 완료: $f"
ls -1t backups/*.sql.gz | tail -n +31 | xargs -r rm --   # 최근 30개만 보관
