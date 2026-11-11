#!/bin/bash
# Deploys aiRoadmap to the villacautela.com server, served at /roadmap/.
# nginx (configured in the tareasPendientes repo, nginx.example.conf) proxies
# /roadmap/ to 127.0.0.1:3002 and gates it with the Tareas Google login.
#
# The roadmap data is NOT part of the deploy: it lives in
# /var/www/roadmap-data/roadmap.json (see ecosystem.config.cjs).

set -euo pipefail

REMOTE_USER="ubuntu"
REMOTE_HOST="34.254.228.23"
REMOTE_PATH="/var/www/roadmap"
DATA_DIR="/var/www/roadmap-data"
SSH_KEY="$HOME/alberite.pem.txt"

SSH=(ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST")

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "==> Testing"
npx vitest run

echo "==> Building client"
rm -rf client/dist
npm run build

echo "==> Staging release"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/client" "$STAGE/server" "$STAGE/shared"
cp package.json package-lock.json ecosystem.config.cjs "$STAGE/"
cp client/package.json "$STAGE/client/"
cp -R client/dist "$STAGE/client/dist"
cp server/package.json "$STAGE/server/"
cp -R server/src "$STAGE/server/src"
cp shared/package.json shared/domain.js "$STAGE/shared/"
find "$STAGE" -name '*.test.js' -delete

echo "==> Uploading"
"${SSH[@]}" "sudo mkdir -p '$REMOTE_PATH' '$DATA_DIR' && sudo chown '$REMOTE_USER': '$REMOTE_PATH' '$DATA_DIR' && chmod 700 '$DATA_DIR'"
rsync -az --delete --exclude node_modules -e "ssh -i $SSH_KEY" "$STAGE/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

echo "==> Installing server dependencies"
"${SSH[@]}" "cd '$REMOTE_PATH' && npm ci --omit=dev --workspace=server --no-audit --no-fund --engine-strict=false"

echo "==> Restarting"
"${SSH[@]}" "cd '$REMOTE_PATH' && (pm2 restart ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs) && pm2 save"

echo "==> Health check"
"${SSH[@]}" "for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS http://127.0.0.1:3002/api/health && exit 0; sleep 1; done; pm2 logs roadmap --lines 30 --nostream; exit 1"
echo
echo "Deployed: https://villacautela.com/roadmap/"
