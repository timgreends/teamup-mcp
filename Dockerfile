FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev) for building
RUN npm ci

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

ENV NODE_ENV=production

EXPOSE 8080

CMD ["npm", "start"]