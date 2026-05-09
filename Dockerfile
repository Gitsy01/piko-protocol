FROM node:20-slim

# Prisma needs OpenSSL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root workspace manifests first (better layer caching)
COPY package.json package-lock.json turbo.json ./

# Copy workspace package.json files for dependency resolution
COPY packages/server/package.json packages/server/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/common/package.json packages/common/package.json
COPY apps/web/package.json apps/web/package.json

# Install all dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY packages/ packages/
COPY apps/ apps/
COPY scripts/ scripts/

# Generate Prisma client
RUN cd packages/server && npx prisma generate

# Build all packages (server depends on ai + common)
RUN npm run build

# Railway injects PORT at runtime — don't hardcode
ENV PORT=3001
EXPOSE ${PORT}

# Start the API server
CMD ["node", "packages/server/dist/index.js"]