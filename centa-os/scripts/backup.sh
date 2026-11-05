#!/usr/bin/env bash
# 사용: DATABASE_URL=... ./scripts/backup.sh   /  복구: ./scripts/restore.sh backups/파일.sql.gz
set -euo pipefail
mkdir -p backups; f="backups/centa_$(date +%Y%m%d_%H%M%S).sql.gz"
pg_dump "$DATABASE_URL" | gzip > "$f"; echo "백업 완료: $f"
# 업로드된 매물 사진도 함께 백업 (UPLOAD_DIR 또는 ./uploads)
U="${UPLOAD_DIR:-uploads}"; if [ -d "$U" ] && [ -n "$(ls -A "$U" 2>/dev/null)" ]; then u="backups/centa_uploads_$(date +%Y%m%d_%H%M%S).tar.gz"; tar -czf "$u" -C "$U" . && echo "사진 백업 완료: $u"; fi
ls -1t backups/*.sql.gz | tail -n +31 | xargs -r rm --   # 최근 30개만 보관
ls -1t backups/centa_uploads_*.tar.gz 2>/dev/null | tail -n +31 | xargs -r rm --   # 사진 백업도 최근 30개만 보관
