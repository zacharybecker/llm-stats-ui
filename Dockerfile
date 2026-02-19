# Stage 1: Install all dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm install

# Stage 2: Build client
FROM deps AS client-build
COPY client/ ./client/
RUN npm run build --workspace=client

# Stage 3: Build server
FROM deps AS server-build
COPY server/ ./server/
RUN npm run build --workspace=server

# Stage 4: Production
FROM node:22-alpine AS production
WORKDIR /app

# Install production deps only for server
COPY server/package.json ./package.json
RUN npm install --omit=dev && \
    npm cache clean --force && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copy server build
COPY --from=server-build /app/server/dist ./dist

# Copy client build as static assets
COPY --from=client-build /app/client/dist ./public

# Create config directory
RUN mkdir -p /app/config

ENV NODE_ENV=production
ENV PORT=3001
ENV CONFIG_PATH=/app/config/config.yaml

EXPOSE 3001

CMD ["node", "dist/index.js"]
