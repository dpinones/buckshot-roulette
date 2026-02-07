#!/bin/bash
# OpenClaw first-time setup: install deps and verify CLI works
set -e

echo "=== Buckshot Roulette Agent Setup ==="

cd /data/workspace/skills/buckshot-roulette/game

echo "Installing dependencies..."
npm install

echo "Verifying CLI..."
npx tsx src/cli.ts --help

echo ""
echo "Setup complete. The CLI is ready."
echo "Make sure your .env file has the correct contract addresses and agent private keys."
