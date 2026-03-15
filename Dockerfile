FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

# Create covers dir for uploads
RUN mkdir -p public/covers

ENV NODE_ENV=production
ENV PORT=4100

EXPOSE 4100

CMD ["npx", "tsx", "src/server.ts"]
