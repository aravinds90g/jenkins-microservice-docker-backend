#!/usr/bin/env bash
# Start all backend services. Uses systemd-run --scope to escape the shell's cgroup
# so services survive after the parent shell exits.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG="${LOG_DIR:-/tmp/void-logs}"
mkdir -p "$LOG"

for s in user-service product-service cart-service order-service payment-service gateway; do
  if [ ! -d "$ROOT/$s" ]; then continue; fi
  echo "Starting $s..."
  systemd-run --user --scope --quiet --slice=void-backend.slice \
    /usr/bin/env bash -c "cd $ROOT/$s && exec node src/index.js > $LOG/$s.log 2>&1" >/dev/null 2>&1 &
  disown 2>/dev/null || true
done

sleep 3
echo
echo "Health:"
for port in 3001 3002 3003 3004 3005 5000; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 2 "http://localhost:$port/health" 2>/dev/null || echo "000")
  printf "  :%-5s -> %s\n" "$port" "$code"
done
echo
echo "Logs: $LOG/{user,product,cart,order,payment,gateway}-service.log"
