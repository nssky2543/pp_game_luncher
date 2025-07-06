FROM oven/bun:latest

WORKDIR /app

# Copy package.json and bun.lockb
COPY package.json ./
COPY bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . .

RUN bun run build
# Expose the port the app runs on (adjust if needed)
EXPOSE 3000

# Command to run the application
CMD ["bun", "run", "start"]