# ---- Build Stage ----
# Use a full Node.js image to build the app
FROM node:24 AS builder

# Set the working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# ---- Production Stage ----
# Use a minimal, more secure Node.js image for the final image
FROM node:24-slim

# Set the working directory
WORKDIR /usr/src/app

# Create a non-root user for better security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser
USER appuser

# Copy dependencies and package files from the 'builder' stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Copy application code from the 'builder' stage
COPY --from=builder /usr/src/app .

# Expose the port
EXPOSE ${PORT}

# Define the command to run the app
CMD [ "npm", "start" ]
