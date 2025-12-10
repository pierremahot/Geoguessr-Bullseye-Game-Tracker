# Builder stage
FROM rust:1.83-bookworm as builder

WORKDIR /usr/src/app
COPY . .

# Install dependencies needed for building (e.g. pkg-config, libssl-dev for some crates)
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Build release binary
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies (openssl, ca-certificates, sqlite3)
RUN apt-get update && apt-get install -y libssl3 ca-certificates sqlite3 && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /usr/src/app/target/release/bullseye-tracker-backend .

# Copy migrations folder for runtime migration
COPY --from=builder /usr/src/app/migrations ./migrations

# Create data directory for SQLite
RUN mkdir -p /data
ENV DATABASE_URL="sqlite:///data/bullseye.db"
VOLUME /data

EXPOSE 3000

CMD ["./bullseye-tracker-backend"]
