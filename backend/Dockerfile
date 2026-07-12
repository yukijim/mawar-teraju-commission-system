# Step 1: Install production dependencies
FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Step 2: Final runner image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy node_modules from dependencies step
COPY --from=dependencies /app/node_modules ./node_modules

# Copy package descriptors
COPY package*.json ./

# Copy all source files (excluding those in .dockerignore)
COPY . .

# Expose default port
EXPOSE 5000

# Run the app
CMD ["node", "src/server.js"]
