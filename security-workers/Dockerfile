FROM node:22-alpine
WORKDIR /app
COPY worker.mjs /app/worker.mjs
USER 65532:65532
ENV NODE_ENV=production SCAN_EXECUTION_ENABLED=false
ENTRYPOINT ["node", "/app/worker.mjs"]
