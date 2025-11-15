#!/bin/bash
# Setup Git hooks for automatic Git history cache generation

echo "🔧 Setting up Git hooks..."

# Create .husky directory if it doesn't exist
mkdir -p .husky

# Make the pre-push hook executable
chmod +x .husky/pre-push

# Install husky if not already installed
if ! command -v husky &> /dev/null; then
  echo "📦 Installing husky..."
  pnpm add -D husky
  pnpm exec husky install
fi

echo "✅ Git hooks setup complete!"
echo ""
echo "The pre-push hook will automatically:"
echo "  1. Generate Git history cache before each push"
echo "  2. Commit the cache file if it changed"
echo ""
echo "You can also manually generate the cache with:"
echo "  pnpm run git:cache"
