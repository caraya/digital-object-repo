# Use a full Node.js image to build and run the app
FROM node:24

# Set the working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*
RUN npm install
# Install Playwright browsers and their dependencies
RUN npx playwright install --with-deps

# Copy the rest of the application source code
COPY . .

# Create a non-root user for better security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser
RUN chown -R appuser:nodejs /usr/src/app

# Switch to the non-root user
USER appuser

# Expose the port
EXPOSE ${PORT}

# Define the command to run the app
CMD [ "npm", "start" ]
