#!/usr/bin/env node
/**
 * Verify that Git history cache is working correctly
 * This script checks if the cache file exists and can be loaded
 */

import fs from 'fs';
import path from 'path';

function verifyGitCache() {
  const cachePath = path.join(process.cwd(), 'app/data/git-history.json');

  console.log('🔍 Verifying Git history cache...\n');

  // Check if cache file exists
  if (!fs.existsSync(cachePath)) {
    console.error('❌ Cache file not found:', cachePath);
    console.log('\n💡 Run: pnpm run git:cache');
    process.exit(1);
  }

  console.log('✅ Cache file exists:', cachePath);

  // Check if cache file is valid JSON
  try {
    const cacheContent = fs.readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(cacheContent) as any;

    console.log('✅ Cache file is valid JSON');

    // Check cache structure
    if (!cache.generatedAt) {
      console.error('❌ Cache missing "generatedAt" field');
      process.exit(1);
    }

    if (!cache.files || typeof cache.files !== 'object') {
      console.error('❌ Cache missing or invalid "files" field');
      process.exit(1);
    }

    console.log('✅ Cache structure is valid');

    // Display cache statistics
    const fileCount = Object.keys(cache.files).length;
    const generatedAt = new Date(cache.generatedAt);

    console.log('\n📊 Cache Statistics:');
    console.log(`   Generated: ${generatedAt.toLocaleString()}`);
    console.log(`   Files cached: ${fileCount}`);

    if (fileCount > 0) {
      console.log('\n📝 Cached files:');
      Object.entries(cache.files).forEach(([filePath, gitInfo]: [string, any]) => {
        const commitCount = gitInfo.commits?.length || 0;
        console.log(`   • ${filePath} (${commitCount} commits)`);
      });
    }

    // Check if cache is recent (within last 7 days)
    const daysSinceGenerated = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceGenerated > 7) {
      console.log('\n⚠️  Cache is older than 7 days. Consider regenerating:');
      console.log('   pnpm run git:cache');
    } else {
      console.log('\n✅ Cache is up to date');
    }

    console.log('\n🎉 Git history cache verification passed!');
  } catch (error) {
    console.error('❌ Failed to parse cache file:', error);
    process.exit(1);
  }
}

verifyGitCache();
