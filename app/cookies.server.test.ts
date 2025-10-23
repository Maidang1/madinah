import { describe, it, expect } from 'vitest';
import { userTheme, userLocale } from './cookies.server';

describe('Cookies configuration', () => {
  it('should export userTheme cookie', () => {
    expect(userTheme).toBeDefined();
  });

  it('should export userLocale cookie', () => {
    expect(userLocale).toBeDefined();
  });

  it('userTheme cookie should have a name', () => {
    expect(userTheme.name).toBe('user-theme');
  });

  it('userLocale cookie should have a name', () => {
    expect(userLocale.name).toBe('user-locale');
  });

  it('both cookies should be defined and functional', () => {
    expect(typeof userTheme.serialize).toBe('function');
    expect(typeof userLocale.serialize).toBe('function');
  });
});
