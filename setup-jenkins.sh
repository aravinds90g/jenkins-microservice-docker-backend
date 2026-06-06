#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
JENKINS_CONTAINER="void-jenkins"
JENKINS_IMAGE="void-jenkins:latest"
JENKINS_PORT="${JENKINS_PORT:-8081}"
JENKINS_VOLUME="jenkins_home"

echo "========================================"
echo " Void E-Commerce — Jenkins Setup Script"
echo "========================================"
echo ""

check_command() {
    if ! command -v "$1" &>/dev/null; then
        echo "ERROR: $1 is not installed."
        case "$1" in
            docker) echo "Install it with: curl -fsSL https://get.docker.com | bash" ;;
            git)    echo "Install it with: sudo apt install -y git" ;;
        esac
        exit 1
    fi
}

check_command docker
check_command git

docker version --format '{{.Server.Version}}' &>/dev/null || {
    echo "ERROR: Docker daemon is not running. Start it with: sudo systemctl start docker"
    exit 1
}

echo "[1/5] Building custom Jenkins image (includes docker CLI) ..."
docker build -t "$JENKINS_IMAGE" -f "$ROOT/docker/jenkins/Dockerfile" "$ROOT/docker/jenkins"
echo "  Done."
echo ""

echo "[2/5] Creating Docker volume for Jenkins data ..."
docker volume create "$JENKINS_VOLUME" 2>/dev/null || true
echo "  Done."
echo ""

echo "[3/5] Creating shared network (if not exists) ..."
docker network create void-backend 2>/dev/null || true
echo "  Done."
echo ""

echo "[4/5] Removing old Jenkins container if present ..."
docker rm -f "$JENKINS_CONTAINER" 2>/dev/null || true
echo "  Done."
echo ""

echo "[5/5] Starting Jenkins container ..."
docker run -d \
    --name "$JENKINS_CONTAINER" \
    --restart unless-stopped \
    --network void-backend \
    -p "$JENKINS_PORT:8080" \
    -p 50000:50000 \
    -v "$JENKINS_VOLUME:/var/jenkins_home" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    "$JENKINS_IMAGE"

echo ""
echo "========================================"
echo " Jenkins is starting up!"
echo "========================================"
echo ""

sleep 5

echo "Admin password:"
docker exec "$JENKINS_CONTAINER" cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null \
    || echo "  (still initializing — run the command below in a few seconds)"

echo ""
echo "Access Jenkins at:  http://localhost:$JENKINS_PORT"
echo ""
echo "Next steps:"
echo "  1. Open the URL above in a browser"
echo "  2. Enter the admin password to unlock Jenkins"
echo "  3. Install suggested plugins"
echo "  4. Create admin user"
echo "  5. Add credentials (see README or Jenkinsfile for details):"
echo "     - jwt-secret        (Secret text)"
echo "     - stripe-secret-key (Secret text)"
echo "     - stripe-webhook-secret (Secret text)"
echo "  6. Create a new Pipeline job:"
echo "     - Pipeline from SCM → Git → your GitHub repo URL"
echo "     - Script Path: Jenkinsfile"
echo ""
echo "To view logs:  docker logs -f $JENKINS_CONTAINER"
echo "To stop:       docker stop $JENKINS_CONTAINER"
