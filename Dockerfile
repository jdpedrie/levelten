# Use Node.js as the base image
FROM node:23-alpine as builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the code
COPY . .

# Build the React frontend
RUN npm run build

# Create production image
FROM node:23-alpine

# Set working directory
WORKDIR /app

# Create data directory with appropriate permissions
RUN mkdir -p /app/data && chmod 777 /app/data

# Copy package.json and package-lock.json for the server
COPY server/package*.json ./server/

# Install server dependencies
WORKDIR /app/server
RUN npm ci --only=production

# Copy the server code
COPY server ./

# Copy the built frontend from the builder stage
COPY --from=builder /app/build /app/build

# Add script to serve static files
RUN echo 'app.use(express.static(path.join(__dirname, "..", "build")));' >> server.js
RUN echo 'app.get("*", (req, res) => { res.sendFile(path.join(__dirname, "..", "build", "index.html")); });' >> server.js

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data

# Expose the port
EXPOSE 3000

# Command to run the server
CMD ["node", "server.js"]
