FROM node:22-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/LICENSE ./LICENSE
COPY server/src ./src
COPY src/shared/syncSchema.json ./src/syncSchema.json

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["node", "src/main.mjs"]
