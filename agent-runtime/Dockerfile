FROM python:3.12-slim

# Install system dependencies (Git, Go, and build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    golang-go \
    && ARCH=$(uname -m) && \
       if [ "$ARCH" = "x86_64" ]; then K_ARCH="amd64"; elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then K_ARCH="arm64"; else K_ARCH="amd64"; fi && \
       curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/v1.31.0/bin/linux/${K_ARCH}/kubectl" && \
       chmod +x /usr/local/bin/kubectl && \
       curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash && \
    rm -rf /var/lib/apt/lists/*


WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Start production API server
CMD ["python", "server.py"]
