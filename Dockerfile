# ---------- Stage 1: Build the React app ----------
FROM node:22 AS builder
WORKDIR /app

# Install dependencies and build frontend
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---------- Stage 2: Serve React + API via Express ----------
FROM node:22-slim
WORKDIR /app

# Copy only what's needed for production
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Start unified Express server
CMD ["node", "server/callback-server.js"]
