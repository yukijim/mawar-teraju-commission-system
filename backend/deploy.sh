#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Configuration
APP_DIR="/var/www/reekod-commission-system/backend"
PM2_APP_NAME="reekod-commission-backend"

echo "============================================="
echo " Starting REEKOD Semak Backend Deployment"
echo "============================================="

# Ensure we are in the correct application directory
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
else
  echo "Error: Directory $APP_DIR does not exist. Please verify the installation path."
  exit 1
fi

# Fetch and pull latest code from git
echo ">>> Pulling latest commits from current branch..."
git fetch
git pull

# Install only production dependencies
echo ">>> Installing production npm dependencies..."
npm install --omit=dev --no-audit --no-fund

# Create log directories if they don't exist
mkdir -p logs

# PM2 App Deployment: Reload to prevent downtime, or start if not running
echo ">>> Managing PM2 processes..."
if pm2 show "$PM2_APP_NAME" >/dev/null 2>&1; then
  echo "Application is currently running. Performing graceful reload..."
  pm2 reload ecosystem.config.js --env production
else
  echo "Application is not running. Starting new process..."
  pm2 start ecosystem.config.js --env production
fi

# Save current PM2 processes to survive server reboots
pm2 save

echo "============================================="
echo " Deployment Completed Successfully!"
echo "============================================="
