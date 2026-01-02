#!/bin/bash

echo "========================================"
echo "Building and Syncing Capacitor App"
echo "========================================"
echo ""

echo "[1/2] Building web app..."
npm run build
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Build failed!"
    exit 1
fi

echo ""
echo "[2/2] Syncing Capacitor..."
npx cap sync
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Sync failed!"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ Build and Sync completed successfully!"
echo "========================================"

