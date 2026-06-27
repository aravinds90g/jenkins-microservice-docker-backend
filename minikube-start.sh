#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo " Void E-Commerce — Minikube Setup"
echo "========================================"
echo ""

ROOT="$(cd "$(dirname "$0")" && pwd)"

check_command() {
    if ! command -v "$1" &>/dev/null; then
        echo "ERROR: $1 is not installed."
        case "$1" in
            minikube) echo "Install it: curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 && sudo install minikube-linux-amd64 /usr/local/bin/minikube" ;;
            kubectl)  echo "Install it: curl -LO https://dl.k8s.io/release/\$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl && chmod +x kubectl && sudo mv kubectl /usr/local/bin/" ;;
            docker)   echo "Install it: curl -fsSL https://get.docker.com | bash" ;;
        esac
        exit 1
    fi
}

check_command minikube
check_command kubectl
check_command docker

echo "[1/5] Starting Minikube cluster ..."
minikube status &>/dev/null || minikube start --driver=docker --cpus=4 --memory=8g
echo "  Done."
echo ""

echo "[2/5] Enabling ingress addon ..."
minikube addons enable ingress
echo "  Done."
echo ""

echo "[3/5] Pointing Docker to Minikube's daemon ..."
eval $(minikube -p minikube docker-env)
echo "  Done."
echo ""

echo "[4/5] Building Docker images inside Minikube ..."
echo "  Building void-gateway ..."
docker build -t void-gateway:latest       -f "$ROOT/gateway/Dockerfile"       "$ROOT"
echo "  Building void-user-service ..."
docker build -t void-user-service:latest  -f "$ROOT/user-service/Dockerfile"  "$ROOT"
echo "  Building void-product-service ..."
docker build -t void-product-service:latest -f "$ROOT/product-service/Dockerfile" "$ROOT"
echo "  Building void-cart-service ..."
docker build -t void-cart-service:latest  -f "$ROOT/cart-service/Dockerfile"  "$ROOT"
echo "  Building void-order-service ..."
docker build -t void-order-service:latest -f "$ROOT/order-service/Dockerfile" "$ROOT"
echo "  Building void-payment-service ..."
docker build -t void-payment-service:latest -f "$ROOT/payment-service/Dockerfile" "$ROOT"
echo "  Done."
echo ""

echo "[5/6] Injecting secrets from .env (ignored by git) ..."
if [ -f "$ROOT/.env" ]; then
    echo "  Found .env — creating k8s secret from it ..."
    kubectl create secret generic void-secret -n void-backend \
        --from-env-file="$ROOT/.env" \
        --dry-run=client -o yaml | kubectl apply -f -
    echo "  Done."
elif [ -n "${JWT_SECRET:-}" ]; then
    echo "  Using env vars for secret ..."
    kubectl create secret generic void-secret -n void-backend \
        --from-literal=JWT_SECRET="${JWT_SECRET}" \
        --from-literal=STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}" \
        --from-literal=STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-}" \
        --dry-run=client -o yaml | kubectl apply -f -
    echo "  Done."
else
    echo "  WARNING: No .env file found and JWT_SECRET not set."
    echo "  Creating secret with development-only placeholder ..."
    echo "  Copy .env.example to .env and edit it for real credentials."
    kubectl create secret generic void-secret -n void-backend \
        --from-literal=JWT_SECRET="dev_insecure_change_me" \
        --dry-run=client -o yaml | kubectl apply -f -
fi
echo ""

echo "[6/6] Deploying to Kubernetes ..."
kubectl apply -k "$ROOT/k8s/"
echo ""
echo "Waiting for deployments to roll out ..."
kubectl wait --for=condition=Available --timeout=180s \
    -n void-backend deployment/gateway \
    deployment/user-service \
    deployment/product-service \
    deployment/cart-service \
    deployment/order-service \
    deployment/payment-service
echo "  Done."
echo ""

echo "========================================"
echo " Deployment complete!"
echo "========================================"
echo ""
echo "Access the API:"
echo "  minikube service gateway -n void-backend"
echo ""
echo "Or with port-forwarding:"
echo "  kubectl port-forward -n void-backend service/gateway 5000:5000"
echo ""
echo "To view all pods:"
echo "  kubectl get pods -n void-backend -w"
echo ""
echo "To tear down:"
echo "  kubectl delete ns void-backend"
