#!/bin/bash
# ===========================================
# EAJMUSIC Frontend Deploy Script
# Run this on the Proxmox LXC (cron or systemd timer)
# Connects to GitHub, downloads latest snapshot build,
# and deploys to Hostinger via SSH.
#
# Required: gh CLI, rsync, ssh
# Setup: gh auth login --with-token < ~/.github-token
#
# NOTE: the frontend repo carries its own scripts/deploy-frontend.sh doing
# the same job with sshpass instead of an ssh key. Two copies of a deploy
# script that can take the site down is how they drift - if you change the
# layout here, change it there too, or better, delete one.
# ===========================================
set -euo pipefail

REPO="EAJRD/eajmusic-frontend"
TEMP_DIR="/tmp/eajmusic-deploy"
LOG_FILE="/var/log/eajmusic-deploy.log"

# Hostinger targets (override via env vars)
HOSTINGER_HOST="${HOSTINGER_HOST:-194.195.84.121}"
HOSTINGER_PORT="${HOSTINGER_PORT:-65002}"
HOSTINGER_USER="${HOSTINGER_USER:-u539343672}"
HOSTINGER_SSH_ARGS="-p $HOSTINGER_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

BASE="${HOSTINGER_BASE:-/home/u539343672/domains/eajmusic.com/public_html}"
MAIN_DIR="$BASE"
ARTIST_DIR="${BASE}/artist"
ADMIN_DIR="${BASE}/eaj"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

log "Starting deploy check..."

# Check gh is authenticated
if ! gh auth status &>/dev/null; then
    log "ERROR: gh not authenticated. Run: gh auth login"
    exit 1
fi

# Download latest snapshot
rm -rf "$TEMP_DIR" && mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

log "Downloading latest snapshot from $REPO..."
if ! gh release download snapshot --repo "$REPO" --dir . 2>/dev/null; then
    log "No snapshot release found. Skipping."
    exit 0
fi

# Check if already deployed (compare commit SHA)
LATEST_SHA=$(gh release view snapshot --repo "$REPO" --json body --jq '.body' 2>/dev/null | grep -oP 'Build from \K[0-9a-f]+' || echo "")
DEPLOYED_SHA=""
[[ -f /tmp/.eajmusic-deployed-sha ]] && DEPLOYED_SHA=$(cat /tmp/.eajmusic-deployed-sha)

if [[ "$LATEST_SHA" == "$DEPLOYED_SHA" ]]; then
    log "Already deployed SHA $LATEST_SHA. Nothing to do."
    rm -rf "$TEMP_DIR"
    exit 0
fi

log "New build detected: $LATEST_SHA"
log "Extracting..."
tar -xzf eajmusic-build.tar.gz

# The archive contains three independent builds (main/, artist/, eaj/ - see
# the frontend's package.json build:main/build:artist/build:eaj). Each one is
# rsynced with a TRAILING SLASH so its *contents* land in the target, not the
# directory itself.
#
# This previously rsynced `.` to all three targets, which copied main/,
# artist/, eaj/ and the tarball itself into each docroot - leaving the main
# site with no index.html at its root (a 403) and both subdomains holding a
# full copy of all three apps. Do not "simplify" these paths back.
for dir in main artist eaj; do
  if [ ! -d "$dir" ]; then
    log "ERROR: expected $dir/ in the build archive but it is missing. Aborting."
    exit 1
  fi
done

log "Deploying to main domain..."
rsync -avz --delete -e "ssh $HOSTINGER_SSH_ARGS" ./main/ "${HOSTINGER_USER}@${HOSTINGER_HOST}:${MAIN_DIR}/"

log "Deploying to artist subdomain..."
rsync -avz --delete -e "ssh $HOSTINGER_SSH_ARGS" ./artist/ "${HOSTINGER_USER}@${HOSTINGER_HOST}:${ARTIST_DIR}/"

log "Deploying to admin subdomain..."
rsync -avz --delete -e "ssh $HOSTINGER_SSH_ARGS" ./eaj/ "${HOSTINGER_USER}@${HOSTINGER_HOST}:${ADMIN_DIR}/"

echo "$LATEST_SHA" > /tmp/.eajmusic-deployed-sha
rm -rf "$TEMP_DIR"
log "Deploy complete: $LATEST_SHA"
