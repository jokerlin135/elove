FROM node:22-alpine

WORKDIR /app

# Copy workspace manifest files first for layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

# Install all workspace dependencies
RUN npm ci --workspace=@elove/worker

# Copy source files
COPY packages/shared/ ./packages/shared/
COPY apps/worker/ ./apps/worker/
COPY tsconfig.base.json ./

WORKDIR /app/apps/worker

CMD ["npx", "tsx", "src/index.ts"]
