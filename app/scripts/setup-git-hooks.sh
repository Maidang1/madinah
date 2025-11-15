#!/bin/bash
# Setup Git hooks for automatic Git history cache generation

echo "🔧 Setting up Git hooks..."

# Create .husky directory if it doesn't exist
mkdir -p .husky

# Make the pre-commit hook executable
chmod +x .husky/pre-commit

# Install husky if not already installed
if ! command -v husky &> /dev/null; then
  echo "📦 Installing husky..."
  pnpm add -D husky
  pnpm exec husky init
fi

echo "✅ Git hooks setup complete!"
echo ""
echo "The pre-commit hook will automatically:"
echo "  1. Detect when you commit blog posts or content files"
echo "  2. Generate updated Git history cache"
echo "  3. Include the cache file in your commit"
echo ""
echo "You can also manually generate the cache with:"
echo "  pnpm run git:cache"
