FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
# Use Huawei npm mirror to avoid registry.npmjs.org timeouts
RUN npm config set registry https://mirrors.huaweicloud.com/repository/npm/ && \
    npm ci

# Install platform-specific native binaries based on target architecture
# TARGETARCH is automatically set by Docker during multi-platform builds (amd64 or arm64)
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "amd64" ]; then \
      npm install @next/swc-linux-x64-gnu lightningcss-linux-x64-gnu @tailwindcss/oxide-linux-x64-gnu --no-save || true; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
      npm install @next/swc-linux-arm64-gnu lightningcss-linux-arm64-gnu @tailwindcss/oxide-linux-arm64-gnu --no-save || true; \
    fi

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Remove npm/corepack (not needed at runtime, also removes CVE-2026-24842 risk)
# Note: apt-get upgrade skipped to avoid issues with corporate proxies/VPN intercepting apt mirrors.
# For air-gapped internal deployment, OS-level CVEs can be handled by host scanning instead.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js standalone output
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
