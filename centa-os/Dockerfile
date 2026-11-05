FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && apt-get clean
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npx next build
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# 스키마 반영 후 서버 시작. (최초 1회 관리자 생성은 docs/OPERATIONS.md 참고)
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx next start -p 3000"]
