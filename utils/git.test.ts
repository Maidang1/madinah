import { describe, it, expect } from 'vitest';
import { loadGitConfig, getFileGitHistory } from './git';

describe('Git Utilities', () => {
  describe('loadGitConfig', () => {
    it('should load git config without throwing', () => {
      const config = loadGitConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should return githubRepo if repository is configured', () => {
      const config = loadGitConfig();
      // Config may or may not have githubRepo depending on package.json
      if (config.githubRepo) {
        expect(typeof config.githubRepo).toBe('string');
        expect(config.githubRepo).toMatch(/^[^/]+\/[^/]+$/);
      }
    });
  });

  describe('getFileGitHistory', () => {
    it('should return null for non-existent file', () => {
      const result = getFileGitHistory('non-existent-file.txt');
      expect(result).toBeNull();
    });

    it('should extract git history for README.md', () => {
      const config = loadGitConfig();
      const result = getFileGitHistory('README.md', config);

      if (result) {
        expect(result).toHaveProperty('createdAt');
        expect(result).toHaveProperty('updatedAt');
        expect(result).toHaveProperty('commits');
        expect(Array.isArray(result.commits)).toBe(true);

        if (result.commits.length > 0) {
          const commit = result.commits[0];
          expect(commit).toHaveProperty('hash');
          expect(commit).toHaveProperty('date');
          expect(commit).toHaveProperty('message');
          expect(commit).toHaveProperty('author');
          expect(commit.hash).toHaveLength(7);
        }
      }
    });

    it('should filter out noise commits', () => {
      const config = loadGitConfig();
      const result = getFileGitHistory('README.md', config);

      if (result && result.commits.length > 0) {
        // Check that filtered commits don't start with noise patterns
        const noisePatterns = ['chore:', 'style:', 'format:', 'typo:'];
        result.commits.forEach(commit => {
          const lowerMessage = commit.message.toLowerCase();
          noisePatterns.forEach(pattern => {
            expect(lowerMessage.startsWith(pattern)).toBe(false);
          });
        });
      }
    });

    it('should generate GitHub URLs when config is provided', () => {
      const config = loadGitConfig();

      if (config.githubRepo) {
        const result = getFileGitHistory('README.md', config);

        if (result && result.commits.length > 0) {
          const commit = result.commits[0];
          expect(commit.githubUrl).toBeDefined();
          expect(commit.githubUrl).toMatch(/^https:\/\/github\.com\//);
        }
      }
    });
  });
});
