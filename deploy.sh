#!/bin/bash

PI_USER="viethuy"
PI_IP="${1:-192.168.34.107}"
PI_TARGET="/home/$PI_USER/project/smartparking"
LOCAL_SRC="$(dirname "$0")"

echo ""
echo "SmartParking-Pi Deploy Script"
echo "   Target: $PI_USER@$PI_IP:$PI_TARGET"
echo ""

# ── 1. Sync project files (exclude node_modules, venv, db) ──
echo "Syncing project files..."
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='venv' \
  --exclude='*.pyc' \
  --exclude='__pycache__' \
  --exclude='*.db' \
  --exclude='.env' \
  --exclude='dist' \
  "$LOCAL_SRC/source/" \
  "$PI_USER@$PI_IP:$PI_TARGET/source/"

rsync -avz "$LOCAL_SRC/ecosystem.config.cjs" "$PI_USER@$PI_IP:$PI_TARGET/"

echo ""
echo "Files synced to Pi!"
echo ""
echo "Next steps — SSH vào Pi và chạy:"
echo "   ssh $PI_USER@$PI_IP"
echo "   cd $PI_TARGET"
echo "   bash setup.sh"
echo ""
