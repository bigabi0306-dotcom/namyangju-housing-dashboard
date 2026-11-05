FROM node:22-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npx next build
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx next start -p 3000"]
