# A registry digest must be recorded after the first verified release build.
# No Docker build or image security scan is claimed by this source file.
FROM node:24.19.0-bookworm-slim AS source
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY . .
RUN pnpm install --frozen-lockfile

FROM source AS checked
RUN pnpm exec tsc --noEmit

FROM checked AS game
ENV NODE_ENV=production PORT=4001 HOST=0.0.0.0
USER node
EXPOSE 4001
CMD ["node", "--import", "tsx", "apps/game-service/src/server.ts"]

FROM checked AS worker
ENV NODE_ENV=production
USER node
CMD ["node", "--import", "tsx", "apps/worker/src/main.ts"]

FROM checked AS web-build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --dir apps/web build
RUN chown -R node:node /app/.next

FROM web-build AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
USER node
EXPOSE 3000
CMD ["pnpm", "--dir", "apps/web", "start"]
