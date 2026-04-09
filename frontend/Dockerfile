FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache git

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy application code
COPY . .

# Build for web
RUN npx expo export --platform web

# Install serve for static hosting
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Serve the built web app
CMD ["serve", "-s", "dist", "-l", "3000"]
