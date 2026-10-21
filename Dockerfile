FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 DATA_DIR=/data TRUST_PROXY=1
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# The import script runs from source with tsx: docker compose exec emailpattern-web npm run import -- /data/samples.jsonl
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:4321/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "./dist/server/entry.mjs"]
